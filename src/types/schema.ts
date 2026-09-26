import { QueueStatus, FulfillmentStatus, StoreContactChannels, StoreExchangeTerms, UserRole } from './index';

/**
 * Public User Profile
 * Path: /public_profiles/{uid}
 * Publicly viewable by any user (e.g. at /users/:userId)
 * MUST NOT contain: email, phone, allergens, addresses, tokens, OTP states.
 */
export interface PublicUserProfile {
  id: string; // Firebase Auth UID
  displayName: string;
  avatar: string | null;
  role: UserRole;
  memberSince: string; // ISO date string
  publicBio: string | null;
}

/**
 * Private User Profile
 * Path: /users/{uid}
 * Sensitive private info. Readable only by owner and Admin.
 */
export interface PrivateUserProfile {
  id: string; // Firebase Auth UID
  displayName: string;
  email: string;
  phone: string;
  role: UserRole;
  avatar: string | null;
  studentOrStoreId?: string;
  storeId?: string;
  schoolId?: string;
  schoolName?: string;
  allergies: string[];
  address?: string;
  memberSince: string;
  phoneVerified?: boolean;
  otpVerifiedAt?: string;
  lastLoginAt?: string;
  updatedAt?: string;
}

/**
 * User Order Summary & Statistics
 * Path: /users/{uid}/stats/summary
 * Aggregated server-side to avoid reading entire order collection into client memory.
 */
export interface UserStats {
  totalOrders: number;
  completedOrders: number;
  cancelledOrders: number;
  followedStoreCount: number;
  totalSpent: number;
  lastOrderAt: string | null;
  updatedAt: string;
}

/**
 * Store Member
 * Path: /stores/{storeId}/members/{uid}
 * Supports multiple owners, managers, kitchen staff, and cashiers per store.
 */
export interface StoreMember {
  userId: string;
  role: 'owner' | 'manager' | 'kitchen' | 'cashier';
  permissions: string[]; // e.g. ['orders.read', 'orders.update_status', 'menu.manage', 'kds.view']
  status: 'active' | 'invited' | 'disabled';
  joinedAt: string;
}

/**
 * Store Daily Statistics
 * Path: /stores/{storeId}/daily_stats/{yyyy-mm-dd}
 */
export interface StoreDailyStats {
  date: string; // YYYY-MM-DD
  orderCount: number;
  completedCount: number;
  cancelledCount: number;
  grossSales: number;
  averagePreparationMinutes: number;
  updatedAt: string;
}

/**
 * Order Item Snapshot
 * Freeze menu item details at the moment of order placement.
 */
export interface OrderItemSnapshot {
  menuItemId: string;
  name: string;
  nameEn?: string;
  price: number; // Authoritative price at order time
  quantity: number;
  selectedOptions: {
    groupName: string;
    choiceName: string;
    priceDelta: number;
  }[];
  specialNote?: string;
  subtotal: number;
}

/**
 * Order Status Audit Event
 * Path: /orders/{orderId}/events/{eventId}
 * Immutable audit trail for every status transition.
 */
export interface OrderEvent {
  id: string;
  orderId: string;
  fromStatus: QueueStatus | null;
  toStatus: QueueStatus;
  changedBy: string; // UID or 'SYSTEM'
  changerRole: 'customer' | 'merchant' | 'system' | 'admin';
  note?: string;
  timestamp: string; // ISO date string
}

/**
 * Financial State Machine Types
 */
export type PaymentStatus =
  | 'REQUIRES_PAYMENT'
  | 'PROCESSING'
  | 'PAID'
  | 'PAYMENT_FAILED'
  | 'REFUND_PENDING'
  | 'REFUNDED'
  | 'PARTIALLY_REFUNDED'
  | 'DISPUTED';

export type SettlementStatus =
  | 'NOT_APPLICABLE'
  | 'PENDING_ORDER_ACCEPTANCE'
  | 'PENDING_FULFILLMENT'
  | 'ON_HOLD'
  | 'AVAILABLE'
  | 'PAYOUT_RESERVED'
  | 'TRANSFERRED'
  | 'REVERSED';

export type PayoutStatus =
  | 'REQUESTED'
  | 'PROCESSING'
  | 'PAID'
  | 'FAILED'
  | 'CANCELLED'
  | 'REVERSED';

export type LedgerAccount =
  | 'PLATFORM_CASH'
  | 'MERCHANT_PENDING'
  | 'MERCHANT_ON_HOLD'
  | 'MERCHANT_AVAILABLE'
  | 'PLATFORM_REVENUE'
  | 'GATEWAY_FEE_EXPENSE'
  | 'PAYMENT_CLEARING'
  | 'MERCHANT_PAYOUT_RESERVE'
  | 'STRIPE_CONNECTED_ACCOUNT';

/**
 * Customer Payment Record
 * Path: /payments/{paymentId}
 */
export interface PaymentRecord {
  id: string;
  orderId: string;
  storeId: string;
  customerId: string;
  amountSatang: number;
  currency: 'thb';
  provider: 'stripe' | 'cash';
  providerPaymentIntentId?: string | null;
  providerCheckoutSessionId?: string | null;
  paymentMethodType?: string;
  status: PaymentStatus;
  paidAt?: string | null;
  refundedSatang?: number;
  failureReason?: string | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * Merchant Wallet Balance Summary
 * Path: /merchant_balances/{storeId}
 */
export interface MerchantBalance {
  storeId: string;
  pendingSatang: number;         // รอตอบรับ / อยู่ระหว่างทำอาหาร
  onHoldSatang: number;          // ส่งมอบแล้ว อยู่ระหว่างพักตรวจ (เช่น 1 ชม.)
  availableSatang: number;       // พร้อมถอน
  payoutReservedSatang: number;  // ยอดที่ส่งคำขอถอนแล้ว
  totalPaidOutSatang: number;    // ถอนสำเร็จสะสมทั้งหมด
  updatedAt: string;
}

/**
 * Double-Entry Financial Ledger Entry
 * Path: /ledger_entries/{entryId}
 */
export interface LedgerEntry {
  id: string;
  transactionGroupId: string;
  storeId?: string;
  orderId?: string;
  payoutId?: string;
  account: LedgerAccount;
  debitSatang: number;
  creditSatang: number;
  type:
    | 'CUSTOMER_PAYMENT'
    | 'MERCHANT_ACCEPT'
    | 'ORDER_FULFILLED'
    | 'FUNDS_RELEASED'
    | 'PAYOUT_RESERVE'
    | 'PAYOUT_COMPLETED'
    | 'REFUND';
  description: string;
  createdAt: string;
}

/**
 * Merchant Payout Request
 * Path: /payout_requests/{payoutRequestId}
 */
export interface PayoutRequest {
  id: string;
  storeId: string;
  amountSatang: number;
  currency: 'thb';
  status: PayoutStatus;
  stripeTransferId?: string | null;
  stripePayoutId?: string | null;
  bankAccountSnapshot?: {
    bankName: string;
    accountNumberMasked: string;
    accountName: string;
  };
  failureReason?: string | null;
  requestedBy: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * Order Refund Request (Outbox)
 * Path: /refund_requests/{refundRequestId}
 */
export interface RefundRequest {
  id: string;
  orderId: string;
  paymentId?: string;
  storeId: string;
  amountSatang: number;
  reason: string;
  status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
  stripeRefundId?: string | null;
  failureReason?: string | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * Authoritative Order Document
 * Path: /orders/{orderId}
 */
export interface AuthoritativeOrder {
  id: string;
  orderNumber: string; // Queue number e.g. "A01", "B12" (or "รอร้านค้ายืนยัน" before merchant acceptance)
  customerId: string; // Customer Firebase Auth UID
  customerName: string;
  customerPhone: string;
  storeId: string;
  storeName: string;
  storeLogo?: string;
  items: OrderItemSnapshot[];
  
  // Monetary Amounts in Satang (Integer)
  subtotalSatang: number;
  discountSatang: number;
  totalSatang: number;
  platformFeeSatang: number;
  estimatedGatewayFeeSatang: number;
  merchantNetSatang: number;

  // Baht equivalents for backward compatibility / display
  subtotal: number;
  discount: number;
  total: number;

  status: QueueStatus;
  canonicalStatus?: FulfillmentStatus;
  paymentMethod: 'promptpay' | 'credit_card' | 'cash';
  paymentStatus: PaymentStatus | 'PAID' | 'PENDING';
  settlementStatus: SettlementStatus;

  // Pickup PIN security
  exchangePin?: string; // Only returned on order creation to customer
  exchangePinHash?: string; // HMAC SHA-256 stored in DB
  exchangePinFailedAttempts?: number;
  exchangePinLockedUntil?: string | null;

  pickupTime: string;
  estimatedCompletionTime: string;
  specialNote?: string;
  allergenAcknowledged: boolean;
  contactChannelsSnapshot?: StoreContactChannels;
  exchangeTermsSnapshot?: StoreExchangeTerms;

  // Deadlines & Lifecycle Timestamps
  merchantResponseDeadlineAt?: string | null; // paidAt + 5 mins
  paidAt?: string | null;
  acceptedAt?: string | null;
  completedAt?: string | null;
  fundReleaseAt?: string | null; // completedAt + hold period

  version: number; // Optimistic concurrency lock
  idempotencyKey: string; // Duplicate submission guard
  createdAt: string; // ISO date
  updatedAt: string;
}

/**
 * Chat Thread
 * Path: /chats/{chatId}
 */
export interface ChatThread {
  id: string;
  storeId: string;
  schoolId?: string;
  customerId: string;
  customerName: string;
  customerAvatar?: string;
  participantIds: string[]; // [customerId, storeMember1, storeMember2, ...]
  lastMessage: string;
  lastTimestamp: string;
  unreadCountCustomer: number;
  unreadCountMerchant: number;
  orderId?: string;
  queueNumber?: string;
  aiAutoReply?: boolean;          // ร้านเปิด/ปิดระบบตอบอัตโนมัติเองได้
  aiSilencedUntil?: string | null;// ร้านพิมพ์ตอบเอง -> AI เงียบชั่วคราว (เช่น 30 นาที)
  createdAt: string;
  updatedAt: string;
}

/**
 * Chat Message
 * Path: /chats/{chatId}/messages/{messageId}
 */
export interface ChatMessage {
  id: string;
  chatId: string;
  senderId: string;
  senderName: string;
  senderRole: 'customer' | 'merchant' | 'system' | 'ai_assistant';
  message: string;
  timestamp: string;
  read: boolean;
  messageType?: 'text' | 'order_card' | 'booking_card';
  aiMeta?: {                      // เขียนโดย Admin SDK / Backend เท่านั้น
    layer: 1 | 2;                 // 1 = Deterministic Router, 2 = LLM Tool Calling
    toolsUsed: string[];          // เช่น ['getQueueStatus']
    escalated: boolean;           // ส่งต่อเจ้าของร้านหรือไม่
    model?: string;
    latencyMs: number;
  };
  orderSnapshot?: {
    queueNumber?: string;
    itemsSummary?: string;
    total?: number;
    status?: string;
  };
  bookingSnapshot?: {
    bookingDate?: string;
    bookingTime?: string;
    guestCount?: number;
    itemsSummary?: string;
    total?: number;
    status?: string;
    canPay?: boolean;
    foodId?: string;
    quantity?: number;
    specialNote?: string;
  };
}
