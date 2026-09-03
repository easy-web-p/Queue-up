/**
 * 📦 orderCreationService.ts (Wave 4.2.5.x Hardened)
 * Authoritative Server-Style Order Creation Boundary.
 * Enforces Store Availability, Product Price/Stock Integrity, Modifier Verification, and Atomic Capacity Reservation.
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
  slotId?: string;    // e.g. "slot_20260903_1215"
  paymentMethod: 'promptpay' | 'cash';
}

export interface OrderCreationResult {
  success: boolean;
  orderId: string;
  queueNumber: string;
  totalAmountSatang: number;
  totalAmountBaht: number;
  paymentStatus: 'pending' | 'paid';
  order: Partial<Order>;
}

/**
 * 🔒 Authoritative Atomic Order Creation Transaction
 * Executes ALL checks (Store hours, product price, stock decrement, modifiers, slot capacity)
 * inside a single atomic Firestore Transaction.
 */
export async function createAuthoritativeStoreOrder(
  db: Firestore,
  request: CreateOrderRequest
): Promise<OrderCreationResult> {
  const { storeId, userId, customerName, customerPhone, items, pickupTime, slotId, paymentMethod } = request;

  if (!storeId || !userId) throw new Error('storeId and userId are required');
  if (!items || items.length === 0) throw new Error('Order items cannot be empty');

  return await runTransaction(db, async (tx) => {
    // -------------------------------------------------------------
    // 1. Authoritative Store Pre-read & Operating Availability Check
    // -------------------------------------------------------------
    const shopRef = doc(db, 'shops', storeId);
    const shopSnap = await tx.get(shopRef);
    if (!shopSnap.exists()) {
      throw new Error(`STORE_NOT_FOUND: Store ${storeId} does not exist`);
    }

    const shopData = shopSnap.data() as StoreOperationalState;
    const availability = evaluateStoreAvailability(shopData, new Date());
    if (!availability.canAcceptOrder) {
      throw new Error(`STORE_UNAVAILABLE: Cannot accept order (${availability.reason})`);
    }

    // -------------------------------------------------------------
    // 2. Authoritative Products & Stock Pre-read
    // -------------------------------------------------------------
    let calculatedTotalSatang = 0;
    const validatedOrderItems: any[] = [];

    for (const itemReq of items) {
      if (!itemReq.productId) throw new Error('productId is required for every item');
      if (!Number.isInteger(itemReq.quantity) || itemReq.quantity <= 0) {
        throw new Error('Item quantity must be a positive integer');
      }

      const prodRef = doc(db, 'products', itemReq.productId);
      const prodSnap = await tx.get(prodRef);
      if (!prodSnap.exists()) {
        throw new Error(`PRODUCT_NOT_FOUND: Product ${itemReq.productId} does not exist`);
      }

      const prodData = prodSnap.data() as MenuItem;
      if (prodData.storeId !== storeId) {
        throw new Error(`CROSS_STORE_PRODUCT_VIOLATION: Product ${prodData.name} does not belong to store ${storeId}`);
      }
      if (prodData.isAvailable === false) {
        throw new Error(`PRODUCT_UNAVAILABLE: Product ${prodData.name} is currently unavailable`);
      }

      // Check & Decrement Stock
      const currentStock = typeof prodData.stock === 'number' ? prodData.stock : 0;
      if (currentStock < itemReq.quantity) {
        throw new Error(`INSUFFICIENT_STOCK: Product ${prodData.name} has only ${currentStock} in stock`);
      }

      // Canonical Satang Price from Authoritative Database Doc (Ignore any client-supplied price)
      const basePriceSatang = prodData.priceSatang ?? Math.round((Number(prodData.price) || 0) * 100);
      let itemModifierSatang = 0;

      // Validate Modifiers against Database
      if (itemReq.selectedModifiers && itemReq.selectedModifiers.length > 0) {
        for (const selMod of itemReq.selectedModifiers) {
          const modRef = doc(db, 'modifier_groups', selMod.modifierGroupId);
          const modSnap = await tx.get(modRef);
          if (!modSnap.exists()) {
            throw new Error(`MODIFIER_NOT_FOUND: Modifier group ${selMod.modifierGroupId} not found`);
          }
          const modData = modSnap.data() as ModifierGroup;
          if (modData.storeId !== storeId) {
            throw new Error(`CROSS_STORE_MODIFIER_VIOLATION: Modifier group does not belong to store ${storeId}`);
          }

          const opt = (modData.options || []).find((o: any) => o.id === selMod.optionId);
          if (!opt) {
            throw new Error(`OPTION_NOT_FOUND: Option ${selMod.optionId} not found in modifier group`);
          }
          if (opt.isOutOfStock) {
            throw new Error(`OPTION_OUT_OF_STOCK: Option ${opt.name} is out of stock`);
          }

          const optPriceSatang = opt.priceModifierSatang ?? Math.round((Number(opt.priceModifier) || 0) * 100);
          itemModifierSatang += optPriceSatang;
        }
      }

      const unitPriceSatang = basePriceSatang + itemModifierSatang;
      const subtotalSatang = unitPriceSatang * itemReq.quantity;
      calculatedTotalSatang += subtotalSatang;

      // Mutate Product Stock
      tx.update(prodRef, {
        stock: currentStock - itemReq.quantity,
        updatedAt: serverTimestamp()
      });

      validatedOrderItems.push({
        productId: prodData.id,
        name: prodData.name,
        quantity: itemReq.quantity,
        unitPriceSatang,
        unitPrice: unitPriceSatang / 100,
        subtotalSatang,
        subtotal: subtotalSatang / 100,
        customNotes: itemReq.customNotes || '',
        selectedModifiers: itemReq.selectedModifiers || []
      });
    }

    // -------------------------------------------------------------
    // 3. Authoritative Capacity Slot Reservation
    // -------------------------------------------------------------
    const targetSlotId = slotId || `slot_${storeId}_${pickupTime.replace(':', '')}`;
    const authoritativeCapacity = typeof shopData.maxOrdersPerSlot === 'number' && shopData.maxOrdersPerSlot > 0
      ? shopData.maxOrdersPerSlot
      : 20;

    const slotRef = doc(db, 'store_slots', targetSlotId);
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
      throw new Error(`SLOT_CAPACITY_EXCEEDED: Slot is full (${currentSlotOrders}/${authoritativeCapacity})`);
    }

    tx.set(
      slotRef,
      {
        slotId: targetSlotId,
        storeId,
        capacity: authoritativeCapacity,
        currentOrders: currentSlotOrders + 1,
        updatedAt: new Date()
      },
      { merge: true }
    );

    // -------------------------------------------------------------
    // 4. Create Canonical Order Document
    // -------------------------------------------------------------
    const orderDocRef = doc(collection(db, 'orders'));
    const orderId = orderDocRef.id;
    const queueNumber = `Q${Math.floor(100 + Math.random() * 900)}`;

    const orderPayload = {
      id: orderId,
      orderId,
      storeId,
      userId,
      customerName: customerName || 'ลูกค้า QueueUp',
      customerPhone: customerPhone || '',
      queueNumber,
      status: 'TO_SHIP',
      queueStatus: 'waiting',
      paymentMethod,
      paymentStatus: paymentMethod === 'cash' ? 'pending' : 'pending',
      totalAmountSatang: calculatedTotalSatang,
      totalAmount: calculatedTotalSatang / 100,
      finalAmountSatang: calculatedTotalSatang,
      finalAmount: calculatedTotalSatang / 100,
      discountAppliedSatang: 0,
      pointsEarned: Math.floor(calculatedTotalSatang / 1000), // 1 point per 10 THB
      items: validatedOrderItems,
      pickupTime,
      slotId: targetSlotId,
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
      order: orderPayload as any
    };
  });
}
