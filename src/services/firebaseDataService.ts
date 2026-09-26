import { 
  collection, 
  doc, 
  setDoc, 
  getDoc, 
  getDocs, 
  updateDoc, 
  serverTimestamp,
  query,
  limit,
  orderBy,
  onSnapshot
} from 'firebase/firestore';
import { db } from './firebase';
import { apiClient } from './apiClient';
import { QueueOrder, AuthUser, QueueStatus, Store, FoodItem } from '../types';
import { INITIAL_QUEUES, STORES, FOOD_ITEMS } from '../data/mockData';

const ORDERS_COLLECTION = 'orders';
const USERS_COLLECTION = 'users';
const STORES_COLLECTION = 'stores';
// `menu_items` is the canonical collection: it is the one firestore.rules and
// the composite indexes cover, and the one authoritative order pricing reads.
// `food_items` is still read so data written under the old name keeps showing.
const MENU_ITEMS_COLLECTION = 'menu_items';
const LEGACY_FOOD_ITEMS_COLLECTION = 'food_items';
const DIAGNOSTICS_COLLECTION = 'system_diagnostics';

const LOCAL_STORAGE_ORDERS_KEY = 'queueup_orders_v1';
const LOCAL_STORAGE_SESSION_KEY = 'queueup_session_v1';

export interface DiagnosticStep {
  name: string;
  status: 'pending' | 'success' | 'warning' | 'error';
  latencyMs?: number;
  details: string;
}

export interface DiagnosticReport {
  timestamp: string;
  overallStatus: 'healthy' | 'degraded' | 'offline';
  firestoreConnected: boolean;
  localStorageConnected: boolean;
  totalOrdersLocal: number;
  totalOrdersCloud: number;
  writeLatencyMs: number;
  readLatencyMs: number;
  steps: DiagnosticStep[];
}

/**
 * Service for Data Storage (เก็บข้อมูล) and Retrieval (ดึงข้อมูล)
 * Features dual-tier storage: Firebase Cloud Firestore + LocalStorage fallback
 */
export const FirebaseDataService = {
  /**
   * บันทึกคำสั่งซื้อ (Save Order)
   * บันทึกเข้า Firestore และ LocalStorage
   */
  async saveOrder(order: QueueOrder): Promise<{ success: boolean; source: 'firestore' | 'local'; error?: string }> {
    // 1. บันทึกลง LocalStorage เสมอเพื่อความเสถียร
    try {
      const existingStr = localStorage.getItem(LOCAL_STORAGE_ORDERS_KEY);
      const existingOrders: QueueOrder[] = existingStr ? JSON.parse(existingStr) : [];
      const updated = [order, ...existingOrders.filter(o => o.id !== order.id)];
      localStorage.setItem(LOCAL_STORAGE_ORDERS_KEY, JSON.stringify(updated));
    } catch (localErr) {
      console.warn('LocalStorage save error:', localErr);
    }

    // 2. บันทึกลง Cloud Firestore
    try {
      const orderRef = doc(db, ORDERS_COLLECTION, order.id);
      await setDoc(orderRef, {
        ...order,
        syncedAt: serverTimestamp(),
        updatedAt: new Date().toISOString()
      }, { merge: true });

      return { success: true, source: 'firestore' };
    } catch (cloudErr: unknown) {
      const errMsg = cloudErr instanceof Error ? cloudErr.message : String(cloudErr);
      console.warn('Firestore save order fallback to local:', errMsg);
      return { 
        success: true, 
        source: 'local', 
        error: errMsg.includes('permission-denied') 
          ? 'Firestore Security Rules ยังไม่ได้เปิดสิทธิ์สาธารณะ (ระบบบันทึกใน LocalStorage เรียบร้อย)' 
          : errMsg 
      };
    }
  },

  /**
   * อัปเดตสถานะคิวคำสั่งซื้อ (Update Order Status)
   */
  async updateOrderStatus(orderId: string, status: QueueStatus, paymentStatus?: 'PENDING' | 'PAID'): Promise<{ success: boolean; source: 'firestore' | 'local' }> {
    // 1. อัปเดต LocalStorage
    try {
      const existingStr = localStorage.getItem(LOCAL_STORAGE_ORDERS_KEY);
      if (existingStr) {
        const orders: QueueOrder[] = JSON.parse(existingStr);
        const updated = orders.map(o => {
          if (o.id === orderId) {
            return {
              ...o,
              status,
              paymentStatus: paymentStatus || (status !== 'PAYMENT_PENDING' ? 'PAID' : o.paymentStatus),
              version: (o.version || 1) + 1
            };
          }
          return o;
        });
        localStorage.setItem(LOCAL_STORAGE_ORDERS_KEY, JSON.stringify(updated));
      }
    } catch (e) {
      console.warn('LocalStorage status update warning:', e);
    }

    // 2. อัปเดต Firestore
    try {
      const orderRef = doc(db, ORDERS_COLLECTION, orderId);
      const updatePayload: Record<string, unknown> = {
        status,
        updatedAt: new Date().toISOString(),
        serverUpdatedAt: new Date().toISOString()
      };
      if (paymentStatus) {
        updatePayload.paymentStatus = paymentStatus;
      } else if (status !== 'PAYMENT_PENDING') {
        updatePayload.paymentStatus = 'PAID';
      }
      await updateDoc(orderRef, updatePayload);
      return { success: true, source: 'firestore' };
    } catch (cloudErr) {
      console.warn('Firestore update order status fallback:', cloudErr);
      return { success: true, source: 'local' };
    }
  },

  /**
   * ดึงข้อมูลคำสั่งซื้อทั้งหมด (Fetch Orders)
   * ดึงจาก Cloud Firestore และผสานกับ LocalStorage
   */
  async fetchOrders(): Promise<{ orders: QueueOrder[]; source: 'firestore' | 'local'; count: number }> {
    // โหลดข้อมูลในเครื่องก่อน
    let localOrders: QueueOrder[] = [];
    try {
      const localStr = localStorage.getItem(LOCAL_STORAGE_ORDERS_KEY);
      if (localStr) {
        localOrders = JSON.parse(localStr);
      }
    } catch (e) {
      console.warn('LocalStorage read error:', e);
    }

    if (localOrders.length === 0) {
      localOrders = INITIAL_QUEUES;
    }

    // พยายามดึงจาก Cloud Firestore
    try {
      const q = query(collection(db, ORDERS_COLLECTION), orderBy('createdAt', 'desc'), limit(50));
      const querySnapshot = await getDocs(q);
      
      if (!querySnapshot.empty) {
        const cloudOrders: QueueOrder[] = [];
        querySnapshot.forEach(docSnap => {
          cloudOrders.push(docSnap.data() as QueueOrder);
        });

        // ผสานข้อมูล (cloud มีความสำคัญสูงสุด)
        const mergedMap = new Map<string, QueueOrder>();
        localOrders.forEach(o => mergedMap.set(o.id, o));
        cloudOrders.forEach(o => mergedMap.set(o.id, o));
        const merged = Array.from(mergedMap.values());

        // บันทึกกลับลง local
        try {
          localStorage.setItem(LOCAL_STORAGE_ORDERS_KEY, JSON.stringify(merged));
        } catch {
          // ignore
        }

        return { orders: merged, source: 'firestore', count: merged.length };
      }
    } catch (cloudErr) {
      console.info('Fetching from Cloud Firestore returned fallback:', cloudErr);
    }

    return { orders: localOrders, source: 'local', count: localOrders.length };
  },

  /**
   * บันทึกข้อมูลโปรไฟล์ผู้ใช้งาน (Save User Profile)
   */
  async saveUserProfile(user: AuthUser): Promise<{ success: boolean; source: 'firestore' | 'local' }> {
    try {
      localStorage.setItem(LOCAL_STORAGE_SESSION_KEY, JSON.stringify(user));
    } catch (e) {
      console.warn('LocalStorage session save error:', e);
    }

    try {
      const userRef = doc(db, USERS_COLLECTION, user.id);
      await setDoc(userRef, {
        ...user,
        lastActiveAt: new Date().toISOString()
      }, { merge: true });
      return { success: true, source: 'firestore' };
    } catch (err) {
      console.warn('Firestore save user fallback to local:', err);
      return { success: true, source: 'local' };
    }
  },

  /**
   * ดึงข้อมูลโปรไฟล์ผู้ใช้งาน (Fetch User Profile)
   */
  async fetchUserProfile(userId: string): Promise<AuthUser | null> {
    try {
      const userRef = doc(db, USERS_COLLECTION, userId);
      const snap = await getDoc(userRef);
      if (snap.exists()) {
        return snap.data() as AuthUser;
      }
    } catch (err) {
      console.debug('Firestore user fetch note:', err);
    }

    try {
      const localStr = localStorage.getItem(LOCAL_STORAGE_SESSION_KEY);
      if (localStr) {
        const localUser: AuthUser = JSON.parse(localStr);
        if (localUser.id === userId) return localUser;
      }
    } catch {
      // ignore
    }

    return null;
  },

  /**
   * ซิงค์ร้านค้าและโรงอาหารทั้งหมดขึ้น Cloud Firestore
   */
  async syncStoresToFirestore(storesToSync: Store[] = STORES): Promise<void> {
    try {
      for (const store of storesToSync) {
        const storeRef = doc(db, STORES_COLLECTION, store.id);
        await setDoc(storeRef, {
          ...store,
          syncedAt: serverTimestamp(),
          updatedAt: new Date().toISOString()
        }, { merge: true });
      }
    } catch (error) {
      console.warn('Sync stores to Firestore note:', error);
    }
  },

  /**
   * ดึงข้อมูลร้านค้าและโรงอาหารจริงจาก Cloud Firestore (พร้อม fallback)
   */
  async fetchStoresFromFirestore(): Promise<Store[]> {
    try {
      const q = query(collection(db, STORES_COLLECTION));
      const snap = await getDocs(q);
      if (!snap.empty) {
        const cloudStores: Store[] = [];
        snap.forEach(docSnap => {
          cloudStores.push(docSnap.data() as Store);
        });

        // Merge with STORES to ensure all defaults exist
        const map = new Map<string, Store>();
        STORES.forEach(s => map.set(s.id, s));
        cloudStores.forEach(s => map.set(s.id, { ...(map.get(s.id) || {}), ...s }));
        return Array.from(map.values());
      } else {
        // If empty, seed to Firestore
        await this.syncStoresToFirestore();
        return STORES;
      }
    } catch (err) {
      console.warn('Fetch stores fallback:', err);
      return STORES;
    }
  },

  /**
   * ติดตามการเปลี่ยนแปลงข้อมูลร้านค้าและโรงอาหารแบบ Real-time จาก Cloud Firestore
   */
  subscribeStores(callback: (stores: Store[]) => void): () => void {
    try {
      const q = query(collection(db, STORES_COLLECTION));
      return onSnapshot(q, (snapshot) => {
        if (snapshot.empty) {
          this.syncStoresToFirestore().then(() => callback(STORES));
          return;
        }
        const map = new Map<string, Store>();
        STORES.forEach(s => map.set(s.id, s));
        snapshot.forEach(docSnap => {
          const store = docSnap.data() as Store;
          map.set(store.id, { ...(map.get(store.id) || {}), ...store });
        });
        callback(Array.from(map.values()));
      }, (error) => {
        console.warn('Realtime stores subscription error:', error);
      });
    } catch (err) {
      console.warn('Subscribe stores failed:', err);
      return () => {};
    }
  },

  /**
   * ซิงค์เมนูของร้านขึ้น Cloud Firestore ผ่าน Catalog API
   *
   * Sends each store's items to the endpoint that authorises the caller as that
   * store's operator. The browser used to write every store's menu directly,
   * which both bypassed ownership and wrote to the wrong collection; a visitor
   * seeding the shared catalogue is now correctly refused.
   */
  async syncFoodItemsToFirestore(itemsToSync: FoodItem[] = FOOD_ITEMS): Promise<void> {
    const byStore = new Map<string, FoodItem[]>();
    for (const item of itemsToSync) {
      if (!item.storeId) continue;
      const bucket = byStore.get(item.storeId) || [];
      bucket.push(item);
      byStore.set(item.storeId, bucket);
    }

    for (const [storeId, items] of byStore) {
      try {
        const res = await apiClient.put<{ success?: boolean; error?: string }>(
          `/catalog/stores/${encodeURIComponent(storeId)}/menu`,
          { items }
        );
        if (!res?.success) {
          // Expected for stores this account does not operate.
          console.info(`[FirebaseDataService] Menu sync skipped for ${storeId}:`, res?.error || 'not authorised');
        }
      } catch (error) {
        console.info(`[FirebaseDataService] Menu sync failed for ${storeId}:`, error);
      }
    }
  },

  /**
   * ดึงข้อมูลรายการอาหารจริงจาก Cloud Firestore (พร้อม fallback)
   */
  async fetchFoodItemsFromFirestore(): Promise<FoodItem[]> {
    try {
      const [canonicalSnap, legacySnap] = await Promise.all([
        getDocs(query(collection(db, MENU_ITEMS_COLLECTION))),
        getDocs(query(collection(db, LEGACY_FOOD_ITEMS_COLLECTION))).catch(() => null)
      ]);

      const snap = canonicalSnap;
      if (!snap.empty || (legacySnap && !legacySnap.empty)) {
        const cloudFoods: FoodItem[] = [];
        // Legacy first so a canonical record of the same id wins.
        legacySnap?.forEach(docSnap => {
          cloudFoods.push(docSnap.data() as FoodItem);
        });
        snap.forEach(docSnap => {
          cloudFoods.push(docSnap.data() as FoodItem);
        });

        const map = new Map<string, FoodItem>();
        FOOD_ITEMS.forEach(f => map.set(f.id, f));
        cloudFoods.forEach(f => map.set(f.id, { ...(map.get(f.id) || {}), ...f }));
        return Array.from(map.values());
      } else {
        await this.syncFoodItemsToFirestore();
        return FOOD_ITEMS;
      }
    } catch (err) {
      console.warn('Fetch food items fallback:', err);
      return FOOD_ITEMS;
    }
  },

  /**
   * ติดตามการเปลี่ยนแปลงรายการอาหารแบบ Real-time จาก Cloud Firestore
   */
  subscribeFoodItems(callback: (items: FoodItem[]) => void): () => void {
    try {
      const q = query(collection(db, MENU_ITEMS_COLLECTION));
      return onSnapshot(q, (snapshot) => {
        if (snapshot.empty) {
          this.syncFoodItemsToFirestore().then(() => callback(FOOD_ITEMS));
          return;
        }
        const map = new Map<string, FoodItem>();
        FOOD_ITEMS.forEach(f => map.set(f.id, f));
        snapshot.forEach(docSnap => {
          const item = docSnap.data() as FoodItem;
          map.set(item.id, { ...(map.get(item.id) || {}), ...item });
        });
        callback(Array.from(map.values()));
      }, (error) => {
        console.warn('Realtime food items subscription error:', error);
      });
    } catch (err) {
      console.warn('Subscribe food items failed:', err);
      return () => {};
    }
  },

  /**
   * ติดตามคำสั่งซื้อและสถานะคิวแบบ Real-time จาก Cloud Firestore
   */
  subscribeOrders(callback: (orders: QueueOrder[]) => void): () => void {
    try {
      const q = query(collection(db, ORDERS_COLLECTION), orderBy('createdAt', 'desc'), limit(50));
      return onSnapshot(q, (snapshot) => {
        if (!snapshot.empty) {
          const orders: QueueOrder[] = [];
          snapshot.forEach(docSnap => {
            orders.push(docSnap.data() as QueueOrder);
          });
          callback(orders);
        }
      }, (error) => {
        console.warn('Realtime orders subscription error:', error);
      });
    } catch (err) {
      console.warn('Subscribe orders failed:', err);
      return () => {};
    }
  },

  /**
   * เครื่องมือตรวจสอบการดึงและเก็บข้อมูลแบบครบวงจร (Full Data Pipeline Diagnostics)
   * ตรวจสอบ:
   * 1. การเชื่อมต่อ Cloud Firestore
   * 2. การทดสอบเขียนข้อมูล (Write Probe)
   * 3. การทดสอบดึงข้อมูล (Read Probe)
   * 4. การตรวจสอบความสอดคล้องของข้อมูล (Payload Verification & Checksum)
   * 5. การทดสอบ LocalStorage Persistence
   */
  async runDataDiagnostics(): Promise<DiagnosticReport> {
    const steps: DiagnosticStep[] = [];
    const testId = `probe_${Date.now()}`;
    const testPayload = {
      testId,
      system: 'QueueUp',
      type: 'HEALTH_CHECK_PROBE',
      timestamp: new Date().toISOString(),
      probeData: 'data_integrity_token_8892'
    };

    let firestoreConnected = false;
    let writeLatencyMs = 0;
    let readLatencyMs = 0;

    // STEP 1: ทดสอบการทำงานของ LocalStorage
    try {
      const localStart = performance.now();
      localStorage.setItem(`__queueup_test_${testId}`, JSON.stringify(testPayload));
      const readBackLocal = localStorage.getItem(`__queueup_test_${testId}`);
      localStorage.removeItem(`__queueup_test_${testId}`);
      const localLatency = Math.round(performance.now() - localStart);

      if (readBackLocal && JSON.parse(readBackLocal).probeData === testPayload.probeData) {
        steps.push({
          name: '1. ทดสอบการเก็บและดึงข้อมูลในเครื่อง (LocalStorage)',
          status: 'success',
          latencyMs: localLatency,
          details: `บันทึกและอ่านกลับสำเร็จ (${localLatency} ms) ข้อมูลตรงกัน 100%`
        });
      } else {
        steps.push({
          name: '1. ทดสอบการเก็บและดึงข้อมูลในเครื่อง (LocalStorage)',
          status: 'warning',
          latencyMs: localLatency,
          details: 'อ่านข้อมูลกลับได้ แต่โครงสร้างข้อมูลไม่ตรงกับต้นฉบับ'
        });
      }
    } catch (e) {
      steps.push({
        name: '1. ทดสอบการเก็บและดึงข้อมูลในเครื่อง (LocalStorage)',
        status: 'error',
        details: `LocalStorage ล้มเหลว: ${e instanceof Error ? e.message : String(e)}`
      });
    }

    // STEP 2: ทดสอบการเขียนข้อมูลไปยัง Firestore (Write Operation)
    const writeStart = performance.now();
    try {
      const testDocRef = doc(db, DIAGNOSTICS_COLLECTION, testId);
      await setDoc(testDocRef, testPayload);
      writeLatencyMs = Math.round(performance.now() - writeStart);
      firestoreConnected = true;

      steps.push({
        name: '2. ทดสอบการเขียนข้อมูลไปยัง Cloud Firestore (Write Operation)',
        status: 'success',
        latencyMs: writeLatencyMs,
        details: `ส่งข้อมูลบันทึกลงคอลเลกชัน "${DIAGNOSTICS_COLLECTION}/${testId}" สำเร็จ (${writeLatencyMs} ms)`
      });
    } catch (writeErr: unknown) {
      writeLatencyMs = Math.round(performance.now() - writeStart);
      const errMsg = writeErr instanceof Error ? writeErr.message : String(writeErr);
      const isRules = errMsg.includes('permission-denied') || errMsg.includes('insufficient permissions');
      
      steps.push({
        name: '2. ทดสอบการเขียนข้อมูลไปยัง Cloud Firestore (Write Operation)',
        status: isRules ? 'warning' : 'error',
        latencyMs: writeLatencyMs,
        details: isRules 
          ? `เชื่อมต่อ Firebase สำเร็จ แต่ติด Security Rules ("permission-denied") ระบบเปิดโหมด Local Fallback อัตโนมัติ`
          : `เกิดข้อผิดพลาดในการเขียน: ${errMsg}`
      });
    }

    // STEP 3: ทดสอบการดึงข้อมูลจาก Firestore (Read Operation)
    const readStart = performance.now();
    try {
      const testDocRef = doc(db, DIAGNOSTICS_COLLECTION, testId);
      const docSnap = await getDoc(testDocRef);
      readLatencyMs = Math.round(performance.now() - readStart);

      if (docSnap.exists()) {
        const data = docSnap.data();
        if (data.probeData === testPayload.probeData) {
          steps.push({
            name: '3. ทดสอบการดึงข้อมูลจาก Cloud Firestore (Read Operation & Checksum)',
            status: 'success',
            latencyMs: readLatencyMs,
            details: `ดึงเอกสารกลับมาและตรวจสอบ Checksum สำเร็จ (${readLatencyMs} ms) ข้อมูลสมบูรณ์`
          });
        } else {
          steps.push({
            name: '3. ทดสอบการดึงข้อมูลจาก Cloud Firestore (Read Operation & Checksum)',
            status: 'warning',
            latencyMs: readLatencyMs,
            details: `ดึงข้อมูลได้ แต่ Payload Token ไม่ตรงกัน`
          });
        }
      } else {
        steps.push({
          name: '3. ทดสอบการดึงข้อมูลจาก Cloud Firestore (Read Operation & Checksum)',
          status: 'warning',
          latencyMs: readLatencyMs,
          details: `ส่งคำขอดึงข้อมูลสำเร็จ แต่เอกสารยังไม่อยู่ในฐานข้อมูล`
        });
      }
    } catch (readErr: unknown) {
      readLatencyMs = Math.round(performance.now() - readStart);
      const errMsg = readErr instanceof Error ? readErr.message : String(readErr);
      steps.push({
        name: '3. ทดสอบการดึงข้อมูลจาก Cloud Firestore (Read Operation & Checksum)',
        status: errMsg.includes('permission-denied') ? 'warning' : 'error',
        latencyMs: readLatencyMs,
        details: `การดึงข้อมูลจากคลาวด์: ${errMsg.includes('permission-denied') ? 'ต้องอนุญาต Security Rules สำหรับการอ่าน' : errMsg}`
      });
    }

    // STEP 4: ตรวจสอบจำนวนข้อมูลที่จัดเก็บในระบบ (Storage Count Audit)
    let totalOrdersLocal = 0;
    try {
      const savedOrders = localStorage.getItem(LOCAL_STORAGE_ORDERS_KEY);
      if (savedOrders) {
        totalOrdersLocal = JSON.parse(savedOrders).length;
      }
    } catch {
      totalOrdersLocal = INITIAL_QUEUES.length;
    }

    let totalOrdersCloud = 0;
    try {
      const ordersSnap = await getDocs(collection(db, ORDERS_COLLECTION));
      totalOrdersCloud = ordersSnap.size;
    } catch {
      totalOrdersCloud = 0;
    }

    steps.push({
      name: '4. สรุปความพร้อมของพื้นที่จัดเก็บ (Storage Audit)',
      status: 'success',
      details: `ออเดอร์ใน LocalStorage: ${totalOrdersLocal} รายการ | ออเดอร์ใน Cloud Firestore: ${totalOrdersCloud} รายการ`
    });

    const hasErrors = steps.some(s => s.status === 'error');
    const hasWarnings = steps.some(s => s.status === 'warning');

    return {
      timestamp: new Date().toLocaleTimeString('th-TH'),
      overallStatus: hasErrors ? 'offline' : hasWarnings ? 'degraded' : 'healthy',
      firestoreConnected,
      localStorageConnected: true,
      totalOrdersLocal,
      totalOrdersCloud,
      writeLatencyMs,
      readLatencyMs,
      steps
    };
  },

  /**
   * บันทึกข้อมูลการค้นหา (Record Search Query Log to Cloud Firestore)
   */
  async recordSearchLog(queryText: string, userId?: string): Promise<void> {
    const trimmed = queryText.trim();
    if (!trimmed || trimmed.length < 2) return;

    try {
      const logId = `search-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
      const logRef = doc(db, 'search_logs', logId);
      await setDoc(logRef, {
        id: logId,
        query: trimmed,
        userId: userId || 'guest',
        timestamp: new Date().toISOString(),
        createdAt: serverTimestamp()
      }, { merge: true });
    } catch (e) {
      // Cloud logging is background best-effort, silent fallback to local
    }
  }
};
