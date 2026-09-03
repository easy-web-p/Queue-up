/**
 * 📦 orderCreationService.ts (Wave 4.2.5.x Production-Hardened)
 * Comprehensive Order Creation Boundary.
 * Enforces Store Availability, Pickup Time validation, Product Price/Stock Integrity, Modifier Verification,
 * Atomic Slot Capacity Reservation with YYYYMMDD prefix, Sequential Atomic Queue Numbering,
 * and Clear Separation of Order Status vs Payment Status.
 */

import {
  doc,
  collection,
  runTransaction,
  serverTimestamp,
  type Firestore
} from 'firebase/firestore';
import { evaluateStoreAvailability, type StoreOperationalState } from './storeOperationsService';
import type { MenuItem, ModifierGroup, Order } from '../types';

export interface OrderItemRequest {
  productId: string;
  quantity: number;
  selectedModifiers?: { modifierGroupId: string; optionId: string }[];
  customNotes?: string;
}

export interface CreateOrderRequest {
  storeId: string;
  userId: string;
  customerName: string;
  customerPhone: string;
  items: OrderItemRequest[];
  pickupTime: string; // e.g. "12:15"
  pickupDate?: string; // e.g. "2026-09-03"
  paymentMethod: 'promptpay' | 'cash';
}

export interface OrderCreationResult {
  success: boolean;
  orderId: string;
  queueNumber: string;
  totalAmountSatang: number;
  totalAmountBaht: number;
  paymentStatus: 'pending';
  orderStatus: 'PENDING_PAYMENT' | 'WAITING_CASH_CONFIRMATION';
  order: Partial<Order>;
}

/**
 * 🔒 Atomic Store Order Creation Transaction
 * Executes ALL checks (Store hours, pickup time within operating window, product price,
 * normalized stock decrement, modifier rule verification, atomic capacity slot with date,
 * and atomic per-store queue sequence increment) inside a single atomic Transaction.
 */
export async function createAuthoritativeStoreOrder(
  db: Firestore,
  request: CreateOrderRequest
): Promise<OrderCreationResult> {
  const { storeId, userId, customerName, customerPhone, items, pickupTime, paymentMethod } = request;

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

  // 2. Normalize and Aggregate Cart Items to prevent multiple loops on same product
  const normalizedItemMap = new Map<string, { quantity: number; selectedModifiers: any[]; customNotes: string }>();
  for (const it of items) {
    if (!it.productId) throw new Error('PRODUCT_ID_REQUIRED: ทุกรายการต้องระบุ productId');
    if (!Number.isInteger(it.quantity) || it.quantity <= 0) {
      throw new Error('INVALID_QUANTITY: จำนวนสินค้าต้องเป็นจำนวนเต็มบวก');
    }
    const existing = normalizedItemMap.get(it.productId);
    if (existing) {
      existing.quantity += it.quantity;
    } else {
      normalizedItemMap.set(it.productId, {
        quantity: it.quantity,
        selectedModifiers: it.selectedModifiers || [],
        customNotes: it.customNotes || ''
      });
    }
  }

  // 3. Format Business Date (Bangkok Timezone)
  const now = new Date();
  const thaiYmd = request.pickupDate || `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;

  return await runTransaction(db, async (tx) => {
    // -------------------------------------------------------------
    // 3.1 Store Pre-read & Live Operating Availability Check
    // -------------------------------------------------------------
    const shopRef = doc(db, 'shops', storeId);
    const shopSnap = await tx.get(shopRef);
    if (!shopSnap.exists()) {
      throw new Error(`STORE_NOT_FOUND: ร้านค้ารหัส ${storeId} ไม่มีอยู่ในระบบ`);
    }

    const shopData = shopSnap.data() as StoreOperationalState;
    const availability = evaluateStoreAvailability(shopData, now);
    if (!availability.canAcceptOrder) {
      throw new Error(`STORE_UNAVAILABLE: ร้านค้าไม่สามารถรับออเดอร์ได้ในขณะนี้ (${availability.reason})`);
    }

    // -------------------------------------------------------------
    // 3.2 Pickup Time Operating Hours Boundary Verification
    // -------------------------------------------------------------
    if (pickupTime && shopData.operatingHours) {
      const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'] as const;
      const todaySchedule = shopData.operatingHours[days[now.getDay()]];
      if (todaySchedule && todaySchedule.isOpen) {
        const { open, close } = todaySchedule;
        let isPickupAllowed = false;
        if (open <= close) {
          isPickupAllowed = pickupTime >= open && pickupTime <= close;
        } else {
          isPickupAllowed = pickupTime >= open || pickupTime <= close;
        }
        if (!isPickupAllowed) {
          throw new Error(`INVALID_PICKUP_TIME: เวลารับอาหาร ${pickupTime} น. อยู่นอกเวลาเปิดทำการของร้าน (${open} - ${close})`);
        }
      }
    }

    // -------------------------------------------------------------
    // 3.3 Authoritative Products & Stock Pre-read
    // -------------------------------------------------------------
    let calculatedTotalSatang = 0;
    const validatedOrderItems: any[] = [];

    for (const [prodId, reqData] of normalizedItemMap.entries()) {
      const prodRef = doc(db, 'products', prodId);
      const prodSnap = await tx.get(prodRef);
      if (!prodSnap.exists()) {
        throw new Error(`PRODUCT_NOT_FOUND: ไม่พบสินค้ารหัส ${prodId} ในระบบ`);
      }

      const prodData = prodSnap.data() as MenuItem;
      if (prodData.storeId !== storeId) {
        throw new Error(`CROSS_STORE_PRODUCT_VIOLATION: สินค้า ${prodData.name} ไม่ได้เป็นของร้าน ${storeId}`);
      }
      if (prodData.isAvailable === false) {
        throw new Error(`PRODUCT_UNAVAILABLE: สินค้า ${prodData.name} ปิดรับออเดอร์ชั่วคราว`);
      }

      // Check & Decrement Normalized Stock
      const currentStock = typeof prodData.stock === 'number' ? prodData.stock : 0;
      if (currentStock < reqData.quantity) {
        throw new Error(`INSUFFICIENT_STOCK: สินค้า "${prodData.name}" คงเหลือในสต็อกเพียง ${currentStock} ชุด`);
      }

      // Canonical Database Satang Price
      const basePriceSatang = prodData.priceSatang ?? Math.round((Number(prodData.price) || 0) * 100);
      let itemModifierSatang = 0;

      // Validate Modifiers against Store Modifier Groups
      if (reqData.selectedModifiers && reqData.selectedModifiers.length > 0) {
        for (const selMod of reqData.selectedModifiers) {
          const modRef = doc(db, 'modifier_groups', selMod.modifierGroupId);
          const modSnap = await tx.get(modRef);
          if (!modSnap.exists()) {
            throw new Error(`MODIFIER_NOT_FOUND: ไม่พบกลุ่มตัวเลือก ${selMod.modifierGroupId}`);
          }
          const modData = modSnap.data() as ModifierGroup;
          if (modData.storeId !== storeId) {
            throw new Error(`CROSS_STORE_MODIFIER_VIOLATION: กลุ่มตัวเลือกไม่ได้เป็นของร้าน ${storeId}`);
          }

          const opt = (modData.options || []).find((o: any) => o.id === selMod.optionId);
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
      const subtotalSatang = unitPriceSatang * reqData.quantity;
      calculatedTotalSatang += subtotalSatang;

      // Mutate Product Stock
      tx.update(prodRef, {
        stock: currentStock - reqData.quantity,
        updatedAt: serverTimestamp()
      });

      validatedOrderItems.push({
        productId: prodData.id,
        name: prodData.name,
        quantity: reqData.quantity,
        unitPriceSatang,
        unitPrice: unitPriceSatang / 100,
        subtotalSatang,
        subtotal: subtotalSatang / 100,
        customNotes: reqData.customNotes || '',
        selectedModifiers: reqData.selectedModifiers || []
      });
    }

    // -------------------------------------------------------------
    // 3.4 Date-Scoped Slot Capacity Reservation (e.g. slot_store01_20260903_1215)
    // -------------------------------------------------------------
    if (typeof shopData.maxOrdersPerSlot !== 'number' || shopData.maxOrdersPerSlot <= 0) {
      throw new Error('STORE_CAPACITY_NOT_CONFIGURED: ร้านค้ายังไม่ได้กำหนดขีดจำกัดโควตาคิวรับอาหาร');
    }
    const authoritativeCapacity = shopData.maxOrdersPerSlot;
    const cleanTime = pickupTime.replace(':', '');
    const dateScopedSlotId = `slot_${storeId}_${thaiYmd}_${cleanTime}`;

    const slotRef = doc(db, 'store_slots', dateScopedSlotId);
    const slotSnap = await tx.get(slotRef);

    let currentSlotOrders = 0;
    if (slotSnap.exists()) {
      const slotData = slotSnap.data();
      if (slotData.storeId && slotData.storeId !== storeId) {
        throw new Error('Unauthorized: Capacity slot belongs to another store');
      }
      currentSlotOrders = Number(slotData.currentOrders) || 0;
    }

    if (currentSlotOrders + 1 > authoritativeCapacity) {
      throw new Error(`SLOT_CAPACITY_EXCEEDED: รอบเวลารับอาหาร ${pickupTime} น. คิวเต็มแล้ว (${currentSlotOrders}/${authoritativeCapacity})`);
    }

    tx.set(
      slotRef,
      {
        slotId: dateScopedSlotId,
        storeId,
        date: thaiYmd,
        timeSlot: pickupTime,
        capacity: authoritativeCapacity,
        currentOrders: currentSlotOrders + 1,
        updatedAt: new Date()
      },
      { merge: true }
    );

    // -------------------------------------------------------------
    // 3.5 Atomic Sequential Queue Numbering per Store & Date
    // -------------------------------------------------------------
    const counterDocId = `counter_${storeId}_${thaiYmd}`;
    const counterRef = doc(db, 'queue_counters', counterDocId);
    const counterSnap = await tx.get(counterRef);

    let sequenceNumber = 1;
    if (counterSnap.exists()) {
      sequenceNumber = (Number(counterSnap.data().lastSequence) || 0) + 1;
    }
    tx.set(
      counterRef,
      {
        storeId,
        date: thaiYmd,
        lastSequence: sequenceNumber,
        updatedAt: serverTimestamp()
      },
      { merge: true }
    );

    const queueNumber = `Q${String(sequenceNumber).padStart(3, '0')}`;

    // -------------------------------------------------------------
    // 3.6 Create Canonical Order with Clear Separation of Statuses
    // -------------------------------------------------------------
    const orderDocRef = doc(collection(db, 'orders'));
    const orderId = orderDocRef.id;

    const initialOrderStatus = paymentMethod === 'promptpay' ? 'PENDING_PAYMENT' : 'WAITING_CASH_CONFIRMATION';

    const orderPayload = {
      id: orderId,
      orderId,
      storeId,
      userId,
      customerName: customerName.trim(),
      customerPhone: customerPhone.trim(),
      queueNumber,
      status: initialOrderStatus,
      queueStatus: 'waiting_payment',
      paymentMethod,
      paymentStatus: 'pending', // Strictly pending until webhook or cashier confirmation
      totalAmountSatang: calculatedTotalSatang,
      totalAmount: calculatedTotalSatang / 100,
      finalAmountSatang: calculatedTotalSatang,
      finalAmount: calculatedTotalSatang / 100,
      discountAppliedSatang: 0,
      pointsEarned: Math.floor(calculatedTotalSatang / 1000),
      items: validatedOrderItems,
      pickupTime,
      pickupDate: thaiYmd,
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
      paymentStatus: 'pending',
      orderStatus: initialOrderStatus,
      order: orderPayload as any
    };
  });
}
