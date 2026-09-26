/**
 * Merchant Data Access Layer (DAL) & Store Operations
 * Provides encapsulated data access, real-time analytics, inventory management,
 * and immutable audit logging for Merchant Portals.
 */

import { FoodItem, QueueOrder, QueueStatus, Store } from '../types';

export interface MerchantOverviewMetrics {
  totalRevenue: number;
  todayOrderCount: number;
  pendingCount: number;
  completedCount: number;
  cancelledCount: number;
  completionRate: number; // percentage e.g. 98.5
  averageTicketSize: number; // Baht
  outOfStockCount: number;
  activeOrderVelocity: number; // Orders per hour estimate
}

export interface MerchantAuditRecord {
  id: string;
  storeId: string;
  timestamp: string;
  actor: string;
  action: 'STOCK_TOGGLE' | 'STATUS_UPDATE' | 'PRICE_CHANGE' | 'BATCH_STOCK_UPDATE' | 'KDS_EXPEDITE';
  details: string;
  targetId?: string;
  severity: 'info' | 'warning' | 'critical';
}

// In-memory persistent audit log for the current session
let merchantAuditLogs: MerchantAuditRecord[] = [
  {
    id: 'aud-001',
    storeId: 'store-1',
    timestamp: new Date(Date.now() - 45 * 60000).toISOString(),
    actor: 'เจ้าหน้าที่ร้าน (Merchant Staff)',
    action: 'STOCK_TOGGLE',
    details: 'เปิดการขาย: ข้าวกะเพราหมูกรอบไข่ดาว (สต็อกพร้อมจำหน่าย)',
    targetId: 'f1',
    severity: 'info'
  },
  {
    id: 'aud-002',
    storeId: 'store-1',
    timestamp: new Date(Date.now() - 20 * 60000).toISOString(),
    actor: 'จอครัว KDS',
    action: 'STATUS_UPDATE',
    details: 'อัปเดตสถานะคิว A01 -> READY (พร้อมรับอาหาร)',
    targetId: 'order-101',
    severity: 'info'
  }
];

export class MerchantService {
  /**
   * Computes authoritative overview metrics for a given store
   */
  public static getMerchantOverview(
    storeId: string,
    queues: QueueOrder[],
    foodItems: FoodItem[]
  ): MerchantOverviewMetrics {
    const storeOrders = queues.filter(q => q.storeId === storeId);
    const storeFoods = foodItems.filter(f => f.storeId === storeId);

    const paidOrders = storeOrders.filter(q => q.paymentStatus === 'PAID');
    const totalRevenue = paidOrders.reduce((sum, q) => sum + q.total, 0);
    const todayOrderCount = storeOrders.length;

    const pendingCount = storeOrders.filter(
      q => q.status === 'PREPARING' || q.status === 'PAYMENT_PENDING'
    ).length;

    const completedCount = storeOrders.filter(q => q.status === 'COMPLETED').length;
    const cancelledCount = storeOrders.filter(q => q.status === 'CANCELLED').length;

    const resolvedCount = completedCount + cancelledCount;
    const completionRate = resolvedCount > 0 ? Math.round((completedCount / resolvedCount) * 1000) / 10 : 100;
    const averageTicketSize = paidOrders.length > 0 ? Math.round(totalRevenue / paidOrders.length) : 0;
    const outOfStockCount = storeFoods.filter(f => !f.isAvailable).length;

    return {
      totalRevenue,
      todayOrderCount,
      pendingCount,
      completedCount,
      cancelledCount,
      completionRate,
      averageTicketSize,
      outOfStockCount,
      activeOrderVelocity: Math.max(1, Math.round(todayOrderCount * 1.8))
    };
  }

  /**
   * Retrieves orders belonging strictly to the merchant store with optional status filtering
   */
  public static getStoreOrders(
    storeId: string,
    queues: QueueOrder[],
    filterStatus?: QueueStatus | 'ALL'
  ): QueueOrder[] {
    let list = queues.filter(q => q.storeId === storeId);
    if (filterStatus && filterStatus !== 'ALL') {
      list = list.filter(q => q.status === filterStatus);
    }
    // Sort latest first
    return [...list].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  /**
   * Retrieves food items for the store
   */
  public static getStoreFoods(
    storeId: string,
    foodItems: FoodItem[],
    category?: string
  ): FoodItem[] {
    let list = foodItems.filter(f => f.storeId === storeId);
    if (category && category !== 'all') {
      list = list.filter(f => f.category === category);
    }
    return list;
  }

  /**
   * Toggles item stock status and automatically appends to merchant audit ledger
   */
  public static toggleItemStock(
    storeId: string,
    foodId: string,
    foodItems: FoodItem[]
  ): { updatedItems: FoodItem[]; audit: MerchantAuditRecord; isNowAvailable: boolean } {
    let isNowAvailable = false;
    let targetFoodName = '';

    const updatedItems = foodItems.map(item => {
      if (item.id === foodId && item.storeId === storeId) {
        isNowAvailable = !item.isAvailable;
        targetFoodName = item.name;
        return { ...item, isAvailable: isNowAvailable };
      }
      return item;
    });

    const audit: MerchantAuditRecord = {
      id: `aud-${Date.now()}`,
      storeId,
      timestamp: new Date().toISOString(),
      actor: 'เจ้าหน้าที่ร้าน (Merchant Staff)',
      action: 'STOCK_TOGGLE',
      details: `${isNowAvailable ? 'เปิดการขาย' : 'ปิดการขาย (ของหมด)'}: ${targetFoodName || foodId}`,
      targetId: foodId,
      severity: isNowAvailable ? 'info' : 'warning'
    };

    merchantAuditLogs = [audit, ...merchantAuditLogs];

    return { updatedItems, audit, isNowAvailable };
  }

  /**
   * Batch updates availability for multiple items (e.g., mark all active or all sold out)
   */
  public static batchUpdateStock(
    storeId: string,
    foodIds: string[],
    isAvailable: boolean,
    foodItems: FoodItem[]
  ): { updatedItems: FoodItem[]; audit: MerchantAuditRecord } {
    const idSet = new Set(foodIds);
    const updatedItems = foodItems.map(item => {
      if (item.storeId === storeId && idSet.has(item.id)) {
        return { ...item, isAvailable };
      }
      return item;
    });

    const audit: MerchantAuditRecord = {
      id: `aud-${Date.now()}`,
      storeId,
      timestamp: new Date().toISOString(),
      actor: 'เจ้าหน้าที่ร้าน (Merchant Staff)',
      action: 'BATCH_STOCK_UPDATE',
      details: `${isAvailable ? 'เปิดขายเมนูแบบกลุ่ม' : 'ปิดสต็อกเมนูแบบกลุ่ม'} จำนวน ${foodIds.length} รายการ`,
      severity: 'info'
    };

    merchantAuditLogs = [audit, ...merchantAuditLogs];
    return { updatedItems, audit };
  }

  /**
   * Retrieves audit logs for the store
   */
  public static getAuditLogs(storeId: string): MerchantAuditRecord[] {
    return merchantAuditLogs.filter(log => log.storeId === storeId);
  }

  /**
   * Appends an external action to the store audit ledger
   */
  public static recordAudit(record: Omit<MerchantAuditRecord, 'id' | 'timestamp'>): MerchantAuditRecord {
    const entry: MerchantAuditRecord = {
      ...record,
      id: `aud-${Date.now()}`,
      timestamp: new Date().toISOString()
    };
    merchantAuditLogs = [entry, ...merchantAuditLogs];
    return entry;
  }
}
