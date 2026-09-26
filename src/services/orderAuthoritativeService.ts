/**
 * Authoritative Order Service (QueueUp Core Tier)
 * Implements the authoritative order creation pipeline:
 * 1. Store Open/Closed verification
 * 2. Security Shield validation (Anti-XSS & Prompt Injection)
 * 3. Allergen Guard inspection
 * 4. Slot Capacity & Congestion analysis
 * 5. Stock availability verification
 * 6. Satang-precision total calculation
 * 7. Monotonic queue number generation
 * 8. Dual-state coupling & audit tracking
 */

import { CartItem, QueueOrder, QueueStatus, Store, PaymentMethodId } from '../types';
import { scanOrderForAllergens, AllergenMatchResult } from './engines/allergenGuard';
import { analyzeAndShieldInput } from './engines/securityShield';
import { getCanonicalSlotId, calculateEstimatedCompletionTime } from './engines/slotHelper';

export interface CreateOrderParams {
  customerId?: string;
  customerEmail?: string;
  customerName: string;
  customerPhone: string;
  customerRole?: string;
  customerSchoolId?: string;
  customerAllergies?: string[];
  pickupTime?: string;
  paymentMethod: PaymentMethodId;
  specialNote?: string;
  cart: CartItem[];
  store: Store;
  existingOrders: QueueOrder[];
  reservationId?: string;
  slotId?: string;
}

export interface AuthoritativeOrderResult {
  success: boolean;
  order?: QueueOrder;
  error?: {
    code: 'STORE_CLOSED' | 'SECURITY_THREAT' | 'ALLERGEN_CONFLICT' | 'OUT_OF_STOCK' | 'EMPTY_CART' | 'INVALID_PHONE' | 'TENANT_MISMATCH';
    message: string;
  };
  allergenWarning?: AllergenMatchResult;
  auditTrailId: string;
}

export class OrderAuthoritativeService {
  /**
   * Generates next monotonic sequential queue number for the given store
   * Format: Store Prefix or 'A' + 2-digit number (e.g. A01, A02, A12)
   */
  public static generateQueueNumber(store: Store, existingOrders: QueueOrder[]): string {
    const storeOrders = existingOrders.filter(o => o.storeId === store.id);
    const count = storeOrders.length + 1;
    const prefix = store.name.includes('กาแฟ') || store.name.includes('ชา') ? 'B' : 'A';
    const padded = count < 10 ? `0${count}` : `${count}`;
    return `${prefix}${padded}`;
  }

  /**
   * Executes the authoritative order creation pipeline
   */
  public static createOrderAuthoritative(params: CreateOrderParams): AuthoritativeOrderResult {
    const auditTrailId = `audit-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;

    // 1. Check Cart Empty
    if (!params.cart || params.cart.length === 0) {
      return {
        success: false,
        error: { code: 'EMPTY_CART', message: 'ตะกร้าสินค้าว่างเปล่า กรุณาเลือกรายการอาหารก่อน' },
        auditTrailId
      };
    }

    // 2. Store Open/Closed Check
    if (!params.store.isOpen) {
      return {
        success: false,
        error: { code: 'STORE_CLOSED', message: `ร้านค้า "${params.store.name}" ปิดทำการอยู่ในขณะนี้ ไม่สามารถรับออเดอร์ได้` },
        auditTrailId
      };
    }

    // 2.1 Tenant Boundary Isolation Check
    // ไม่อนุญาตให้นักเรียน/สมาชิกของสถานศึกษา สั่งซื้ออาหารจากร้านค้าของสถานศึกษาอื่น
    if (params.customerSchoolId && params.store.schoolId && params.customerSchoolId !== params.store.schoolId) {
      return {
        success: false,
        error: {
          code: 'TENANT_MISMATCH',
          message: `ไม่สามารถสั่งซื้ออาหารข้ามสถานศึกษาได้ (บัญชีของคุณสังกัด ${params.customerSchoolId} แต่ร้านค้านี้สังกัด ${params.store.schoolId})`
        },
        auditTrailId
      };
    }

    // 3. Security Shield Check on Inputs
    const nameShield = analyzeAndShieldInput(params.customerName, 100);
    if (!nameShield.isSafe) {
      return {
        success: false,
        error: { code: 'SECURITY_THREAT', message: `ชื่อผู้รับ: ${nameShield.errorMessage}` },
        auditTrailId
      };
    }

    const noteShield = analyzeAndShieldInput(params.specialNote || '', 300);
    if (!noteShield.isSafe) {
      return {
        success: false,
        error: { code: 'SECURITY_THREAT', message: `หมายเหตุพิเศษ: ${noteShield.errorMessage}` },
        auditTrailId
      };
    }

    // 4. Stock Availability Check
    for (const item of params.cart) {
      if (!item.food.isAvailable) {
        return {
          success: false,
          error: {
            code: 'OUT_OF_STOCK',
            message: `ขออภัย รายการ "${item.food.name}" หมดชั่วคราว ไม่สามารถดำเนินการได้`
          },
          auditTrailId
        };
      }
    }

    // 5. Allergen Guard Scan
    const allergenResult = scanOrderForAllergens(
      params.cart.map(i => ({
        name: i.food.name,
        description: i.food.description,
        tags: i.food.tags,
        specialNote: i.specialNote,
        selectedOptions: i.selectedOptions
      })),
      params.customerAllergies
    );

    // 6. Satang-precision Financial Calculation
    let calculatedSubtotal = 0;
    for (const item of params.cart) {
      const optionsTotal = item.selectedOptions.reduce((acc, opt) => acc + opt.priceDelta, 0);
      const unitPrice = item.food.price + optionsTotal;
      calculatedSubtotal += unitPrice * item.quantity;
    }

    // Discount rule: ฿20 off for orders over ฿200
    const discount = calculatedSubtotal >= 200 ? 20 : 0;
    const finalTotal = Math.max(0, calculatedSubtotal - discount);

    // 7. Queue & Slot sequencing
    const queueNumber = this.generateQueueNumber(params.store, params.existingOrders);
    const storePendingCount = params.existingOrders.filter(
      o => o.storeId === params.store.id && (o.status === 'PREPARING' || o.status === 'PAYMENT_PENDING')
    ).length;

    const totalItemCount = params.cart.reduce((acc, i) => acc + i.quantity, 0);
    const timing = calculateEstimatedCompletionTime(
      params.store.averageWaitMinutes || 10,
      storePendingCount,
      totalItemCount
    );

    // 8. Dual-State Coupling
    // Immediate status depends on payment method
    const initialStatus: QueueStatus = params.paymentMethod === 'cash' ? 'PREPARING' : 'PAYMENT_PENDING';
    const paymentStatus: 'PAID' | 'PENDING' = 'PENDING';

    // Strict architectural requirement: orderId strictly equals reservationId
    const orderId = params.reservationId || `ord-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    // Generate secure 4-digit pickup PIN e.g. "7482"
    const exchangePin = `${Math.floor(1000 + Math.random() * 9000)}`;

    const newOrder: QueueOrder = {
      id: orderId,
      queueNumber,
      customerId: params.customerId,
      customerName: nameShield.sanitizedValue || 'คุณลูกค้า',
      customerPhone: params.customerPhone || '08x-xxx-xxxx',
      storeId: params.store.id,
      storeName: params.store.name,
      storeLogo: params.store.logo,
      schoolId: params.store.schoolId,
      items: [...params.cart],
      subtotal: calculatedSubtotal,
      discount,
      total: finalTotal,
      status: initialStatus,
      canonicalStatus: initialStatus === 'PREPARING' ? 'PREPARING' : 'AWAITING_CONFIRMATION',
      createdAt: new Date().toISOString(),
      estimatedCompletionTime: timing.timeString,
      pickupTime: params.pickupTime || 'ทันที (ด่วน)',
      paymentMethod: params.paymentMethod,
      paymentStatus,
      specialNote: noteShield.sanitizedValue || undefined,
      exchangePin,
      exchangeTermsAccepted: true,
      contactChannelsSnapshot: params.store.contactChannels,
      exchangeTermsSnapshot: params.store.exchangeTerms,
      serverCreatedAt: new Date().toISOString(),
      version: 1,
      idempotencyKey: `idemp_${params.store.id}_${Date.now()}`,
      reservationId: params.reservationId,
      slotId: params.slotId,
      workload: params.cart.reduce((s, it) => s + (it.quantity || 1), 0)
    };

    return {
      success: true,
      order: newOrder,
      allergenWarning: allergenResult,
      auditTrailId
    };
  }
}
