/**
 * 📦 orderCreationService.ts (Zero-Payment Architecture)
 * Comprehensive Order Creation Boundary.
 * Enforces Store Availability, Pickup Date/Time validation in Bangkok Timezone (Asia/Bangkok),
 * Required Modifier Enforcement, Product Price/Stock Integrity, Option Verification,
 * Date-scoped Slot Capacity Reservation (Quantity-based), Sequential Atomic Queue Numbering (Q001, Q002...),
 * and Immediate Order Creation in PENDING / waiting state.
 */

import { httpsCallable } from 'firebase/functions';
import { functions } from '../firebase/config.js';
import type { Order, OrderStatus } from '../types';

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
  paymentMode?: 'CAMPUS_WALLET' | 'DIRECT_ZERO_PAYMENT';
  studentId?: string;
  /** Set only after the customer has confirmed an ALLERGEN_ALERT warning. */
  acknowledgeAllergenWarning?: boolean;
}

export interface AllergenTriggerDetail {
  allergenName: string;
  triggerSource: 'DECLARED' | 'TITLE' | 'CATEGORY' | 'DESCRIPTION' | 'MODIFIER';
  triggerWord: string;
  /** DECLARED = the store stated the ingredient; INFERRED = read off the dish name. */
  confidence?: 'DECLARED' | 'INFERRED';
  details?: string;
}

export interface AllergenFlaggedItem {
  productId: string;
  name: string;
  matchedAllergenNames: string[];
  confidence?: 'DECLARED' | 'INFERRED';
  details: AllergenTriggerDetail[];
}

/**
 * Thrown when the server's allergen guard blocks the order.
 *
 * Carries what matched so the UI can explain it and offer to proceed. Retrying with
 * `acknowledgeAllergenWarning: true` is what the customer's confirmation means; the
 * server records every such override in audit_logs.
 */
export class AllergenAlertError extends Error {
  readonly code = 'ALLERGEN_ALERT';
  readonly matchedAllergenNames: string[];
  readonly flaggedItems: AllergenFlaggedItem[];
  /** True when at least one match came from an ingredient the store declared. */
  readonly hasDeclaredMatch: boolean;

  constructor(
    message: string,
    matchedAllergenNames: string[],
    flaggedItems: AllergenFlaggedItem[],
    hasDeclaredMatch = false
  ) {
    super(message);
    this.name = 'AllergenAlertError';
    this.matchedAllergenNames = matchedAllergenNames;
    this.flaggedItems = flaggedItems;
    this.hasDeclaredMatch = hasDeclaredMatch;
  }
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

export function isValidCalendarDate(year: number, month: number, day: number): boolean {
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) return false;
  if (month < 1 || month > 12 || day < 1 || day > 31) return false;
  const d = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
  return d.getUTCFullYear() === year && (d.getUTCMonth() + 1) === month && d.getUTCDate() === day;
}

export function getBangkokCurrentTime(date: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Bangkok',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  }).format(date);
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
 * 🔒 Store Order Creation (Direct to Q001)
 *
 * Validates locally for fast feedback, then delegates to the server-authoritative
 * createOrderAuthoritative Cloud Function, which re-checks everything against
 * Firestore. No Firestore handle is needed here — the function does not touch the
 * database directly.
 */
export async function createAuthoritativeStoreOrder(
  request: CreateOrderRequest
): Promise<OrderCreationResult> {
  const { storeId, userId, customerPhone, items, pickupTime } = request;

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
  if (!isValidCalendarDate(pYear, pMonth, pDay)) {
    throw new Error('INVALID_CALENDAR_DATE: วันที่ระบุไม่มีอยู่จริงในปฏิทิน');
  }
  // Strict same-day past pickup time validation
  if (targetYmdClean === currentBangkok.ymdClean) {
    const currentBangkokTime = getBangkokCurrentTime(now);
    if (cleanPickupTime <= currentBangkokTime) {
      throw new Error(`PAST_PICKUP_TIME_NOT_ALLOWED: เวลารับอาหาร (${cleanPickupTime} น.) ผ่านไปแล้วสำหรับวันนี้ (เวลาปัจจุบัน ${currentBangkokTime} น.)`);
    }
  }

  // 4. In Browser Runtime: Mandate HTTPS Callable Cloud Function (Server-Authoritative Only, Zero Client Fallback)
  if (typeof window !== 'undefined') {
    if (!functions) {
      throw new Error('FUNCTIONS_UNAVAILABLE: ระบบเชื่อมต่อ Cloud Functions ไม่พร้อมใช้งาน');
    }
    try {
      const createOrderCallable = httpsCallable<CreateOrderRequest, OrderCreationResult>(
        functions,
        'createOrderAuthoritative'
      );
      const response = await createOrderCallable(request);
      if (response && response.data && response.data.success) {
        return response.data;
      }
      throw new Error('ORDER_CREATION_FAILED: ไม่สามารถสร้างคำสั่งซื้อได้');
    } catch (callableErr: any) {
      // Direct pass-through of authoritative server error message
      const serverMessage = callableErr?.message || 'เกิดข้อผิดพลาดในการสร้างคำสั่งซื้อ';

      // Preserve the structured payload of an allergen block so the UI can render
      // the warning instead of a bare error string.
      const details = callableErr?.details;
      if (details && typeof details === 'object' && details.code === 'ALLERGEN_ALERT') {
        throw new AllergenAlertError(
          serverMessage,
          Array.isArray(details.matchedAllergenNames) ? details.matchedAllergenNames : [],
          Array.isArray(details.flaggedItems) ? details.flaggedItems : [],
          details.hasDeclaredMatch === true
        );
      }

      throw new Error(serverMessage, { cause: callableErr });
    }
  }

  // Reached only outside a browser. This module used to carry a second, full copy of
  // the ordering transaction for that case — ~390 lines duplicating
  // createOrderAuthoritative, already drifted (it had no Campus Wallet or allergen
  // logic) and shipped in the client bundle despite nothing calling it: the browser
  // path above mandates the Cloud Function, and the test suite reimplements the rules
  // itself rather than importing this. It was removed rather than left to drift
  // further. The Cloud Function is the only implementation.
  throw new Error(
    'FUNCTIONS_UNAVAILABLE: การสร้างคำสั่งซื้อต้องผ่าน Cloud Function createOrderAuthoritative เท่านั้น'
  );
}



