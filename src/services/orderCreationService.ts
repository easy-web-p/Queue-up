/**
 * 📦 orderCreationService.ts (Zero-Payment Architecture)
 * Comprehensive Order Creation Boundary.
 * Enforces Store Availability, Pickup Date/Time validation in Bangkok Timezone (Asia/Bangkok),
 * Required Modifier Enforcement, Product Price/Stock Integrity, Option Verification,
 * Date-scoped Slot Capacity Reservation (Quantity-based), Sequential Atomic Queue Numbering (Q001, Q002...),
 * and Immediate Order Creation in PENDING / waiting state.
 */

import {
  doc,
  collection,
  runTransaction,
  serverTimestamp,
  type Firestore
} from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../firebase/config.js';
import { evaluateStoreAvailability, type StoreOperationalState } from './storeOperationsService';
import type { MenuItem, ModifierGroup, Order, OrderStatus, QueueStatus } from '../types';

export interface SelectedModifierOption {
  modifierGroupId: string;
  optionId: string;
  name?: string;
  priceModifier?: number;
  priceModifierSatang?: number;
}

export interface OrderItemRequest {
  productId: string;
  quantity: number;
  selectedModifiers?: SelectedModifierOption[];
  customNotes?: string;
}

export interface ValidatedOrderItem {
  productId: string;
  name: string;
  quantity: number;
  unitPriceSatang: number;
  unitPrice: number;
  subtotalSatang: number;
  subtotal: number;
  customNotes: string;
  selectedModifiers: SelectedModifierOption[];
}

export interface CreateOrderRequest {
  storeId: string;
  userId: string;
  customerName: string;
  customerPhone: string;
  items: OrderItemRequest[];
  pickupTime: string; // Must match HH:mm (e.g. "12:15")
  pickupDate?: string; // e.g. "2026-09-04" (YYYY-MM-DD or YYYYMMDD)
}

export interface OrderCreationResult {
  success: boolean;
  orderId: string;
  queueNumber: string; // e.g. "Q001"
  totalAmountSatang: number;
  totalAmountBaht: number;
  orderStatus: OrderStatus;
  order: Partial<Order>;
}

/**
 * 🕒 Helper: Get authoritative Bangkok YYYY-MM-DD date string
 */
export function getBangkokYmd(date: Date = new Date()): { ymd: string; ymdClean: string; dayOfWeekIndex: number } {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Bangkok',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
  const ymd = formatter.format(date); // Format: "YYYY-MM-DD"
  const ymdClean = ymd.replace(/-/g, ''); // Format: "YYYYMMDD"

  // Get day of week in Bangkok timezone
  const dayFormatter = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Bangkok', weekday: 'short' });
  const weekdayShort = dayFormatter.format(date).toLowerCase();
  const weekdayMap: Record<string, number> = { sun: 0, mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6 };
  const dayOfWeekIndex = weekdayMap[weekdayShort] ?? 0;

  return { ymd, ymdClean, dayOfWeekIndex };
}

/**
 * 🔒 Atomic Store Order Creation Transaction (Direct to Q001)
 * Enforces strict Server-Authoritative Cloud Function execution with fallback to 3-Phase Transaction
 */
export async function createAuthoritativeStoreOrder(
  db: Firestore,
  request: CreateOrderRequest
): Promise<OrderCreationResult> {
  const { storeId, userId, customerName, customerPhone, items, pickupTime } = request;

  // 1. Strict Fail-Fast Validation (Zero fake defaults)
  if (!userId || userId === 'guest_user') {
    throw new Error('AUTHENTICATION_REQUIRED: กรุณาเข้าสู่ระบบก่อนทำการสั่งจองอาหาร');
  }
  if (!customerPhone || !customerPhone.trim()) {
    throw new Error('CUSTOMER_PHONE_REQUIRED: กรุณาระบุเบอร์โทรศัพท์สำหรับรับการแจ้งเตือนคิว');
  }
  if (!storeId || !storeId.trim()) {
    throw new Error('STORE_ID_REQUIRED: ไม่พบรหัสร้านค้า');
  }
  if (!items || items.length === 0) {
    throw new Error('ORDER_ITEMS_EMPTY: รายการอาหารในคำสั่งซื้อว่างเปล่า');
  }

  // 2. Strict Pickup Time Format Validation (HH:mm format 00:00 - 23:59)
  if (!pickupTime || !/^([01]\d|2[0-3]):[0-5]\d$/.test(pickupTime.trim())) {
    throw new Error('INVALID_PICKUP_TIME_FORMAT: รูปแบบเวลารับอาหารไม่ถูกต้อง (ต้องเป็น HH:mm เช่น 12:15)');
  }
  const cleanPickupTime = pickupTime.trim();

  // 3. Authoritative Bangkok Time Resolution & Validation
  const now = new Date();
  const currentBangkok = getBangkokYmd(now);

  let targetYmd = currentBangkok.ymd;
  let targetYmdClean = currentBangkok.ymdClean;

  if (request.pickupDate) {
    const rawDate = request.pickupDate.trim();
    const isIsoDate = /^\d{4}-\d{2}-\d{2}$/.test(rawDate);
    const isCleanDate = /^\d{8}$/.test(rawDate);
    if (!isIsoDate && !isCleanDate) {
      throw new Error('INVALID_DATE_FORMAT: รูปแบบวันที่ไม่ถูกต้อง (ต้องเป็น YYYY-MM-DD)');
    }
    const clean = rawDate.replace(/-/g, '');
    if (clean < currentBangkok.ymdClean) {
      throw new Error('PAST_DATE_NOT_ALLOWED: ไม่สามารถเลือกวันที่ย้อนหลังได้');
    }
    targetYmd = isIsoDate ? rawDate : `${rawDate.slice(0, 4)}-${rawDate.slice(4, 6)}-${rawDate.slice(6, 8)}`;
    targetYmdClean = clean;
  }

  // Parse Target Date to find correct DayOfWeek for the pickup day
  const [pYear, pMonth, pDay] = targetYmd.split('-').map(Number);
  const targetPickupDateObj = new Date(Date.UTC(pYear, pMonth - 1, pDay, 12, 0, 0));
  const targetBangkok = getBangkokYmd(targetPickupDateObj);

  // 4. Try HTTPS Callable Cloud Function (Server-Authoritative) in Browser
  if (typeof window !== 'undefined' && functions) {
    try {
      const createOrderCallable = httpsCallable<CreateOrderRequest, OrderCreationResult>(
        functions,
        'createOrderAuthoritative'
      );
      const response = await createOrderCallable(request);
      if (response && response.data && response.data.success) {
        return response.data;
      }
    } catch (callableErr: any) {
      if (callableErr?.code && callableErr?.message) {
        if (callableErr.code !== 'functions/unavailable' && callableErr.code !== 'functions/not-found') {
          throw new Error(callableErr.message);
        }
      }
      console.warn('Falling back to direct Firestore transaction execution:', callableErr);
    }
  }

  // 5. Normalize Items by unique item variant
  const productTotalQuantityMap = new Map<string, number>();
  let totalOrderItemsCount = 0;

  for (const it of items) {
    if (!it.productId) throw new Error('PRODUCT_ID_REQUIRED: ทุกรายการต้องระบุ productId');
    if (!Number.isInteger(it.quantity) || it.quantity <= 0) {
      throw new Error('INVALID_QUANTITY: จำนวนสินค้าต้องเป็นจำนวนเต็มบวก');
    }
    totalOrderItemsCount += it.quantity;
    const currentQty = productTotalQuantityMap.get(it.productId) || 0;
    productTotalQuantityMap.set(it.productId, currentQty + it.quantity);
  }

  return await runTransaction(db, async (tx) => {

    // =========================================================================
    // 📖 PHASE 1: READ ALL REQUIRED DOCUMENTS FIRST (Strict Read-Before-Write)
    // =========================================================================

    // 1.1 Read Shop doc
    const shopRef = doc(db, 'shops', storeId);
    const shopSnap = await tx.get(shopRef);
    if (!shopSnap.exists()) {
      throw new Error(`STORE_NOT_FOUND: ร้านค้ารหัส ${storeId} ไม่มีอยู่ในระบบ`);
    }
    const shopData = shopSnap.data() as StoreOperationalState;

    // 1.2 Read all unique Product docs
    const productSnapMap = new Map<string, MenuItem>();
    const referencedModifierGroupIds = new Set<string>();

    for (const prodId of productTotalQuantityMap.keys()) {
      const prodRef = doc(db, 'products', prodId);
      const prodSnap = await tx.get(prodRef);
      if (!prodSnap.exists()) {
        throw new Error(`PRODUCT_NOT_FOUND: ไม่พบสินค้ารหัส ${prodId} ในระบบ`);
      }
      const prodData = prodSnap.data() as MenuItem;
      productSnapMap.set(prodId, prodData);

      if (Array.isArray(prodData.modifierGroupIds)) {
        prodData.modifierGroupIds.forEach((mgId) => referencedModifierGroupIds.add(mgId));
      }
    }

    // Collect any additional modifierGroupIds selected in items
    for (const it of items) {
      if (Array.isArray(it.selectedModifiers)) {
        it.selectedModifiers.forEach((m) => {
          if (m.modifierGroupId) referencedModifierGroupIds.add(m.modifierGroupId);
        });
      }
    }

    // 1.3 Read all referenced Modifier Group docs
    const modifierGroupMap = new Map<string, ModifierGroup>();
    for (const mgId of referencedModifierGroupIds) {
      const modRef = doc(db, 'modifier_groups', mgId);
      const modSnap = await tx.get(modRef);
      if (modSnap.exists()) {
        modifierGroupMap.set(mgId, modSnap.data() as ModifierGroup);
      }
    }

    // 1.4 Read Slot Capacity doc
    const cleanTime = cleanPickupTime.replace(':', '');
    const dateScopedSlotId = `slot_${storeId}_${targetYmdClean}_${cleanTime}`;
    const slotRef = doc(db, 'store_slots', dateScopedSlotId);
    const slotSnap = await tx.get(slotRef);

    // 1.5 Read Sequence Counter doc
    const counterDocId = `counter_${storeId}_${targetYmdClean}`;
    const counterRef = doc(db, 'queue_counters', counterDocId);
    const counterSnap = await tx.get(counterRef);

    // =========================================================================
    // 🧠 PHASE 2: VALIDATE BUSINESS INVARIANTS & COMPUTE TOTALS (Pure Logic)
    // =========================================================================

    // 2.1 Store Availability Check
    const availability = evaluateStoreAvailability(shopData, now);
    if (!availability.canAcceptOrder) {
      throw new Error(`STORE_UNAVAILABLE: ร้านค้าไม่สามารถรับออเดอร์ได้ในขณะนี้ (${availability.reason})`);
    }

    // 2.2 Target Pickup Date & Pickup Time Operating Hours Check
    if (shopData.operatingHours) {
      const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'] as const;
      const targetDayName = days[targetBangkok.dayOfWeekIndex];
      const targetDaySchedule = shopData.operatingHours[targetDayName];

      if (targetDaySchedule) {
        if (!targetDaySchedule.isOpen) {
          throw new Error(`STORE_CLOSED_ON_DATE: ร้านค้าปิดทำการในวัน${targetDayName} (${targetYmd})`);
        }
        const { open, close } = targetDaySchedule;
        const isPickupAllowed =
          open <= close
            ? cleanPickupTime >= open && cleanPickupTime <= close
            : cleanPickupTime >= open || cleanPickupTime <= close;
        if (!isPickupAllowed) {
          throw new Error(`INVALID_PICKUP_TIME: เวลารับอาหาร ${cleanPickupTime} น. อยู่นอกเวลาเปิดทำการของร้าน (${open} - ${close}) ในวันที่ ${targetYmd}`);
        }
      }
    }


    // 2.3 Product Stock & Availability Verification
    for (const [prodId, requiredTotalQty] of productTotalQuantityMap.entries()) {
      const prodData = productSnapMap.get(prodId)!;
      if (prodData.storeId !== storeId) {
        throw new Error(`CROSS_STORE_PRODUCT_VIOLATION: สินค้า ${prodData.name} ไม่ได้เป็นของร้าน ${storeId}`);
      }
      if (prodData.isAvailable === false) {
        throw new Error(`PRODUCT_UNAVAILABLE: สินค้า ${prodData.name} ปิดรับออเดอร์ชั่วคราว`);
      }
      const currentStock = typeof prodData.stock === 'number' ? prodData.stock : 0;
      if (currentStock < requiredTotalQty) {
        throw new Error(`INSUFFICIENT_STOCK: สินค้า "${prodData.name}" คงเหลือในสต็อกเพียง ${currentStock} ชุด (ต้องการ ${requiredTotalQty})`);
      }
    }

    // 2.4 Modifier Constraints & Price Calculation
    let calculatedTotalSatang = 0;
    const validatedOrderItems: ValidatedOrderItem[] = [];

    for (const itemReq of items) {
      const prodData = productSnapMap.get(itemReq.productId)!;
      const basePriceSatang = prodData.priceSatang ?? Math.round((Number(prodData.price) || 0) * 100);
      let itemModifierSatang = 0;

      const selectedModifiers = itemReq.selectedModifiers || [];
      const allowedGroupIds = new Set(prodData.modifierGroupIds || []);

      // Validate required modifier groups
      if (prodData.modifierGroupIds && prodData.modifierGroupIds.length > 0) {
        for (const mgId of prodData.modifierGroupIds) {
          const modData = modifierGroupMap.get(mgId);
          if (!modData) {
            throw new Error(`MODIFIER_GROUP_NOT_FOUND: ไม่พบกลุ่มตัวเลือก ${mgId} ในระบบสำหรับเมนู "${prodData.name}"`);
          }
          if (modData.storeId !== storeId) {
            throw new Error(`CROSS_STORE_MODIFIER_VIOLATION: กลุ่มตัวเลือก ${mgId} ไม่ได้เป็นของร้าน ${storeId}`);
          }

          const groupSelections = selectedModifiers.filter((m) => m.modifierGroupId === mgId);
          const minSelections = modData.minSelections ?? modData.minSelect ?? (modData.required || modData.isRequired ? 1 : 0);
          const maxSelections = modData.maxSelections ?? modData.maxSelect ?? ((modData.selectionType === 'single' || (modData as any).type === 'single') ? 1 : null);
          const isSingle = modData.selectionType === 'single' || (modData as any).type === 'single';

          if (groupSelections.length < minSelections) {
            throw new Error(`REQUIRED_MODIFIER_MISSING: กรุณาเลือก ${modData.name || 'ตัวเลือกที่จำเป็น'} อย่างน้อย ${minSelections} รายการ สำหรับเมนู "${prodData.name}"`);
          }
          if (maxSelections !== null && groupSelections.length > maxSelections) {
            throw new Error(`MAX_SELECTIONS_EXCEEDED: กลุ่มตัวเลือก "${modData.name}" เลือกได้สูงสุดไม่เกิน ${maxSelections} รายการ`);
          }
          if (isSingle && groupSelections.length > 1) {
            throw new Error(`SINGLE_SELECTION_VIOLATED: กลุ่มตัวเลือก "${modData.name}" สามารถเลือกได้เพียง 1 ตัวเลือกเท่านั้น`);
          }
        }
      }

      // Validate chosen modifier options
      if (selectedModifiers.length > 0) {
        for (const selMod of selectedModifiers) {
          if (!allowedGroupIds.has(selMod.modifierGroupId)) {
            throw new Error(`INVALID_PRODUCT_MODIFIER: กลุ่มตัวเลือก ${selMod.modifierGroupId} ไม่ได้เป็นของสินค้า "${prodData.name}"`);
          }
          const modData = modifierGroupMap.get(selMod.modifierGroupId);
          if (!modData) {
            throw new Error(`MODIFIER_GROUP_NOT_FOUND: ไม่พบกลุ่มตัวเลือก ${selMod.modifierGroupId}`);
          }
          if (modData.storeId !== storeId) {
            throw new Error(`CROSS_STORE_MODIFIER_VIOLATION: กลุ่มตัวเลือกไม่ได้เป็นของร้าน ${storeId}`);
          }

          const opt = (modData.options || []).find((o) => o.id === selMod.optionId);
          if (!opt) {
            throw new Error(`OPTION_NOT_FOUND: ไม่พบตัวเลือก ${selMod.optionId}`);
          }
          if (opt.isOutOfStock) {
            throw new Error(`OPTION_OUT_OF_STOCK: ตัวเลือก "${opt.name}" หมดชั่วคราว`);
          }

          const optPriceSatang = opt.priceModifierSatang ?? Math.round((Number(opt.priceModifier) || 0) * 100);
          itemModifierSatang += optPriceSatang;
        }
      }

      const unitPriceSatang = basePriceSatang + itemModifierSatang;
      const subtotalSatang = unitPriceSatang * itemReq.quantity;
      calculatedTotalSatang += subtotalSatang;

      validatedOrderItems.push({
        productId: prodData.id,
        name: prodData.name,
        quantity: itemReq.quantity,
        unitPriceSatang,
        unitPrice: unitPriceSatang / 100,
        subtotalSatang,
        subtotal: subtotalSatang / 100,
        customNotes: itemReq.customNotes || '',
        selectedModifiers
      });
    }

    // 2.5 Slot Capacity Reservation Check
    if (typeof shopData.maxOrdersPerSlot !== 'number' || shopData.maxOrdersPerSlot <= 0) {
      throw new Error('STORE_CAPACITY_NOT_CONFIGURED: ร้านค้ายังไม่ได้กำหนดขีดจำกัดโควตาคิวรับอาหาร');
    }
    const authoritativeCapacity = shopData.maxOrdersPerSlot;
    let currentSlotOrders = 0;
    if (slotSnap.exists()) {
      const slotData = slotSnap.data();
      if (slotData.storeId && slotData.storeId !== storeId) {
        throw new Error('Unauthorized: Capacity slot belongs to another store');
      }
      currentSlotOrders = Number(slotData.currentOrders) || 0;
    }

    if (currentSlotOrders + 1 > authoritativeCapacity) {
      throw new Error(`SLOT_CAPACITY_EXCEEDED: รอบเวลารับอาหาร ${cleanPickupTime} น. ของวันที่ ${targetYmd} คิวเต็มแล้ว (${currentSlotOrders}/${authoritativeCapacity})`);
    }

    // 2.6 Sequential Atomic Queue Numbering (Q001, Q002...)
    let sequenceNumber = 1;
    if (counterSnap.exists()) {
      sequenceNumber = (Number(counterSnap.data().lastSequence) || 0) + 1;
    }
    const queueNumber = `Q${String(sequenceNumber).padStart(3, '0')}`;

    // =========================================================================
    // ✍️ PHASE 3: WRITE ALL MUTATIONS (Strict Write Phase)
    // =========================================================================

    // 3.1 Update Stock for each unique product
    for (const [prodId, requiredTotalQty] of productTotalQuantityMap.entries()) {
      const prodRef = doc(db, 'products', prodId);
      const prodData = productSnapMap.get(prodId)!;
      const currentStock = typeof prodData.stock === 'number' ? prodData.stock : 0;
      tx.update(prodRef, {
        stock: currentStock - requiredTotalQty,
        updatedAt: serverTimestamp()
      });
    }

    // 3.2 Update Capacity Slot
    tx.set(
      slotRef,
      {
        slotId: dateScopedSlotId,
        storeId,
        date: targetYmd,
        timeSlot: cleanPickupTime,
        capacity: authoritativeCapacity,
        currentOrders: currentSlotOrders + 1,
        totalItemsReserved: (slotSnap.exists() ? Number(slotSnap.data().totalItemsReserved || 0) : 0) + totalOrderItemsCount,
        updatedAt: new Date()
      },
      { merge: true }
    );

    // 3.3 Update Queue Counter
    tx.set(
      counterRef,
      {
        storeId,
        date: targetYmd,
        lastSequence: sequenceNumber,
        updatedAt: serverTimestamp()
      },
      { merge: true }
    );

    // 3.4 Create Canonical Order
    const orderDocRef = doc(collection(db, 'orders'));
    const orderId = orderDocRef.id;

    const initialOrderStatus: OrderStatus = 'PENDING';
    const initialQueueStatus: QueueStatus = 'waiting';

    const orderPayload = {
      id: orderId,
      orderId,
      storeId,
      userId,
      customerName: customerName.trim(),
      customerPhone: customerPhone.trim(),
      queueNumber,
      status: initialOrderStatus,
      queueStatus: initialQueueStatus,
      totalAmountSatang: calculatedTotalSatang,
      totalAmount: calculatedTotalSatang / 100,
      finalAmountSatang: calculatedTotalSatang,
      finalAmount: calculatedTotalSatang / 100,
      discountAppliedSatang: 0,
      pointsEarned: Math.floor(calculatedTotalSatang / 1000),
      items: validatedOrderItems,
      pickupTime: cleanPickupTime,
      pickupDate: targetYmd,
      slotId: dateScopedSlotId,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };

    tx.set(orderDocRef, orderPayload);

    return {
      success: true,
      orderId,
      queueNumber,
      totalAmountSatang: calculatedTotalSatang,
      totalAmountBaht: calculatedTotalSatang / 100,
      orderStatus: initialOrderStatus,
      order: orderPayload as unknown as Partial<Order>
    };
  });
}


