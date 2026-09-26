export type UserRole = 'customer' | 'merchant' | 'admin' | 'staff' | 'student' | 'super_admin';

export interface AuthUser {
  id: string;
  fullName: string;
  email: string;
  phone: string;
  role: UserRole;
  avatar?: string;
  authProvider?: 'google' | 'email';
  studentOrStoreId?: string;
  storeId?: string;
  schoolId?: string;
  schoolName?: string;
  allergies?: string[];
  registeredAt: string;
  phoneVerified?: boolean;
  isFirstTime?: boolean;
  otpVerifiedAt?: string;
  password?: string;
}

export type OrderStatus =
  | 'DRAFT'
  | 'PAYMENT_PENDING'
  | 'PAID_AWAITING_MERCHANT'
  | 'MERCHANT_ACCEPTED'
  | 'PREPARING'
  | 'READY'
  | 'READY_FOR_PICKUP'
  | 'COMPLETED'
  | 'MERCHANT_REJECTED'
  | 'CUSTOMER_CANCELLED'
  | 'CANCELLED'
  | 'EXPIRED';

export type QueueStatus = OrderStatus;

export interface FoodOptionChoice {
  id: string;
  name: string;
  priceDelta: number;
}

export interface FoodOptionGroup {
  id: string;
  name: string;
  required: boolean;
  maxChoices?: number;
  choices: FoodOptionChoice[];
}

export interface ReviewItem {
  id: string;
  authorName: string;
  avatar: string;
  rating: number;
  date: string;
  comment: string;
  likes: number;
  foodName?: string;
  isVerifiedBuyer?: boolean;
}

export interface CreatorVideoReview {
  id: string;
  title: string;
  creatorName: string;
  creatorHandle: string;
  creatorAvatar: string;
  views: string;
  likes: string;
  thumbnail: string;
  videoUrl?: string;
  duration: string;
  tag: string;
}

export interface FoodVideoPreview {
  title: string;
  duration: string;
  videoUrl: string;
  poster: string;
  description: string;
}

export interface FoodItem {
  id: string;
  storeId: string;
  storeName: string;
  name: string;
  nameEn: string;
  price: number;
  originalPrice?: number;
  description: string;
  category: string;
  image: string;
  rating: number;
  orderCount: number;
  isAvailable: boolean;
  spicyLevel?: 0 | 1 | 2 | 3;
  preparationMinutes: number;
  tags: string[];
  optionGroups?: FoodOptionGroup[];
  // Booking & Reservation Days
  availableDays?: string[];
  bookingNotice?: string;
  availableHours?: string;
  // Video preview & customer reviews
  videoPreview?: FoodVideoPreview;
  reviews?: ReviewItem[];
}

export interface Store {
  id: string;
  ownerId?: string;
  ownerName?: string;
  ownerEmail?: string;
  ownerPhone?: string;
  promptPayNumber?: string;
  name: string;
  nameEn: string;
  description: string;
  category: string;
  image: string;
  coverImage?: string;
  logo: string;
  rating: number;
  reviewCount: number;
  distanceKm: number;
  averageWaitMinutes: number;
  currentQueueCount: number;
  isOpen: boolean;
  priceRange: '฿' | '฿฿' | '฿฿฿';
  address: string;
  tags: string[];
  featuredMenuIds: string[];
  // Location & Store details
  addressDetail?: string;
  landmark?: string;
  nearestStation?: string;
  openingHours?: string;
  coordinates?: {
    lat: number;
    lng: number;
    googleMapUrl?: string;
  };
  // Reviews & creator video UGC
  reviews?: ReviewItem[];
  creatorReviews?: CreatorVideoReview[];
  similarStoreIds?: string[];
  // Educational institution multi-tenant partition
  schoolId?: string;
  schoolName?: string;
  // Direct Buyer-Seller Contact Channels & Exchange Terms from Store's Perspective
  contactChannels?: StoreContactChannels;
  exchangeTerms?: StoreExchangeTerms;
}

export interface StoreContactChannels {
  phone: string;
  lineId?: string;
  facebookPage?: string;
  pickupCounterLocation: string; // e.g. "อาคารโรงอาหารกลาง 1 บูธ C-04"
  inAppChatEnabled: boolean;
  staffOnDutyName?: string;
}

export interface StoreExchangeTerms {
  pickupWindowMinutes: number; // e.g. 15 mins after ready notification
  pickupPolicy: string; // e.g. "แสดงบัตรคิวดิจิทัลหรือรหัส PIN 4 หลักที่หน้าร้านเพื่อแลกรับอาหาร"
  cancellationPolicy: string; // e.g. "ยกเลิกหรือแก้ไขได้เฉพาะก่อนร้านค้ากดยืนยัน/เริ่มปรุง (PREPARING) อาหารปรุงสดไม่สามารถคืนเงินได้หลังเริ่มปรุง"
  paymentTerms: string; // e.g. "รองรับ PromptPay QR สแกนทันที, กระเป๋าเงิน Campus Wallet หรือชำระที่หน้าร้าน (PAY_AT_STORE)"
  allergenWarningNotice: string; // e.g. "หากแพ้อาหารต้องระบุในคำสั่งซื้อล่วงหน้า ทางร้านจะแยกภาชนะปรุงให้อย่างเคร่งครัด"
  disputeContactInfo: string; // e.g. "ติดต่อโดยตรงที่จุดบริการร้าน หรือผ่านแชทในระบบเพื่อความรวดเร็ว"
  termsVersion?: string;
  lastUpdated?: string;
}

export interface CustomerChatMessage {
  id: string;
  senderRole: 'customer' | 'merchant' | 'ai_assistant';
  senderName: string;
  message: string;
  timestamp: string;
  read: boolean;
  aiMeta?: {
    layer: 1 | 2;
    toolsUsed: string[];
    escalated: boolean;
    latencyMs: number;
  };
}

export interface StoreCustomerChatThread {
  id: string;
  storeId: string;
  customerId: string;
  customerName: string;
  customerPhone?: string;
  customerAvatar?: string;
  queueId?: string;
  queueNumber?: string;
  orderSummary?: string;
  orderTotal?: number;
  orderStatus?: string;
  lastMessage: string;
  lastTimestamp: string;
  unreadCount: number;
  aiAutoReply?: boolean;
  aiSilencedUntil?: string | null;
  messages: CustomerChatMessage[];
}

export interface StoreChatMessage {
  id: string;
  storeId: string;
  orderId?: string;
  senderId: string;
  senderName: string;
  senderRole: 'buyer' | 'seller' | 'ai_assistant'; // buyer = customer, seller = merchant staff, ai_assistant = automated helper
  message: string;
  timestamp: string;
  read: boolean;
  messageType?: 'text' | 'order_card' | 'booking_card';
  aiMeta?: {
    layer: 1 | 2;
    toolsUsed: string[];
    escalated: boolean;
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

export type FulfillmentStatus =
  | 'AWAITING_CONFIRMATION'
  | 'CONFIRMED'
  | 'PREPARING'
  | 'READY'
  | 'COMPLETED'
  | 'CANCELLED'
  | 'EXPIRED';

export const customerStatusLabels: Record<FulfillmentStatus, string> = {
  AWAITING_CONFIRMATION: 'รอร้านยืนยัน',
  CONFIRMED: 'ร้านรับรายการแล้ว',
  PREPARING: 'กำลังเตรียมอาหาร',
  READY: 'พร้อมรับอาหาร',
  COMPLETED: 'รับอาหารแล้ว',
  CANCELLED: 'ยกเลิกแล้ว',
  EXPIRED: 'หมดอายุ',
};

export type PaymentMode = 'PAY_AT_STORE' | 'CAMPUS_WALLET' | 'PROMPTPAY';

/**
 * Payment method as it travels to the API and is stored on the order.
 * 'CAMPUS_WALLET' settles from the student's wallet balance at order time.
 */
export type PaymentMethodId = 'promptpay' | 'credit_card' | 'cash' | 'CAMPUS_WALLET';
export type ExtendedPaymentStatus =
  | 'NOT_REQUIRED'
  | 'PENDING'
  | 'VERIFYING'
  | 'PAID'
  | 'FAILED'
  | 'EXPIRED'
  | 'REFUND_PENDING'
  | 'REFUNDED';

export interface CartItem {
  cartItemId: string;
  food: FoodItem;
  quantity: number;
  selectedOptions: {
    groupName: string;
    choiceName: string;
    priceDelta: number;
  }[];
  specialNote: string;
  subtotal: number;
}

export interface QueueOrder {
  id: string;
  queueNumber: string; // e.g. "A05", "B12"
  customerId?: string;
  customerName: string;
  customerPhone: string;
  storeId: string;
  storeName: string;
  storeLogo?: string;
  items: CartItem[];
  subtotal: number;
  discount: number;
  total: number;
  status: QueueStatus;
  createdAt: string; // ISO string
  estimatedCompletionTime: string; // e.g. "12:45"
  pickupTime: string; // e.g. "ทันที" or "12:30 น."
  paymentMethod: PaymentMethodId;
  paymentStatus: 'PAID' | 'PENDING';
  specialNote?: string;
  // Exchange and buyer-seller fulfillment fields
  exchangePin?: string; // 4-digit code e.g. "8421" for buyer to hand over to seller
  exchangeTermsAccepted?: boolean;
  canonicalStatus?: FulfillmentStatus;
  contactChannelsSnapshot?: StoreContactChannels;
  exchangeTermsSnapshot?: StoreExchangeTerms;
  // Production hardening & Multi-tenant fields
  schoolId?: string;
  serverCreatedAt?: string; // Server-authoritative timestamp
  version?: number; // Optimistic concurrency version
  idempotencyKey?: string; // Duplicate submission guard
  reservationId?: string; // Pre-order capacity reservation ID
  slotId?: string; // 15-minute slot ID
  workload?: number; // Calculated kitchen workload points
}

export interface Category {
  id: string;
  name: string;
  icon: string;
  itemCount: number;
}

export type ThemeMode = 'light' | 'dark' | 'auto';

export interface UserDevice {
  deviceId: string;
  uid: string;
  schoolId?: string;
  fcmToken: string;
  platform: 'android' | 'ios' | 'desktop';
  isPWA: boolean;
  userAgent: string;
  isActive: boolean;
  createdAt: number;
  lastSeenAt: number;
}

export type NotificationType =
  | 'ORDER_CREATED'
  | 'ORDER_ACCEPTED'
  | 'ORDER_PREPARING'
  | 'ORDER_READY'
  | 'PICKUP_REMINDER'
  | 'ORDER_COMPLETED'
  | 'ORDER_CANCELLED'
  | 'CHAT_MESSAGE'
  | 'STORE_OPEN'
  | 'NEW_MENU'
  | 'COUPON'
  | 'coupon'
  | 'new_menu'
  | 'store_open'
  | 'system'
  | 'queue_call';

export interface AppNotification {
  notificationId?: string;
  recipientId?: string;
  schoolId?: string;
  type: NotificationType;
  title: string;
  message: string;
  relatedId?: string;
  relatedType?: 'order' | 'chat' | 'store' | 'promo';
  deepLink?: string;
  isRead: boolean;
  createdAt?: number | string;
  expiresAt?: number;
  // UI & backwards-compatibility fields
  id?: string;
  data?: any;
  storeId?: string;
  storeName?: string;
  storeLogo?: string;
  couponCode?: string;
  discountValue?: string;
  menuItemName?: string;
  menuItemPrice?: number;
  menuItemImage?: string;
  queueNumber?: string;
  queueId?: string;
  timestamp?: string;
}

export interface Canteen {
  id: number;
  nameTh: string;
  nameEn: string;
  zone: string;
  lat: number;
  lng: number;
  openingHours: string;
  storeCount: number;
  smartTransit: string;
  popularMenus: string;
  mapsUrl: string;
}

// ==========================================
// Educational Institutions & School Modules
// ==========================================

export interface School {
  schoolId: string; // e.g. "SCH001" (Primary Key / Tenant Partition)
  schoolCode: string; // e.g. "SCH001"
  schoolName: string; // e.g. "โรงเรียนขอนแก่นวิทยายน"
  province: string; // e.g. "ขอนแก่น"
  contactEmail: string; // e.g. "admin@kkw.ac.th"
  contactPhone: string; // e.g. "043-123456"
  emailDomain?: string; // e.g. "kkw.ac.th"
  status: 'active' | 'suspended' | 'pending';
  totalStudents: number;
  totalAdmins: number;
  totalStores: number;
  createdAt: string;
  approvedAt?: string;
}

export interface SchoolApplication {
  id: string; // e.g. "app_1727263901"
  schoolData: {
    schoolCode: string;
    schoolName: string;
    province: string;
    contactEmail: string;
    contactPhone: string;
    emailDomain?: string;
  };
  adminData: {
    employeeId: string;
    fullName: string;
    position: string;
    email: string;
    phone: string;
  };
  memberStats: {
    adminCount: number;
    studentCount: number;
    errorCount: number;
  };
  uploadedFileName?: string;
  parsedMembers: Array<{
    type: 'admin' | 'student';
    id: string; // employeeId or studentId
    fullName: string;
    email: string;
    phone?: string;
    classRoom?: string;
  }>;
  status: 'pending' | 'approved' | 'rejected';
  rejectionReason?: string;
  submittedAt: string;
  reviewedAt?: string;
  reviewedBy?: string;
}

export interface SchoolMember {
  id: string; // e.g. "SCH001_65001"
  schoolId: string; // e.g. "SCH001"
  identifier: string; // studentId or employeeId
  fullName: string;
  email: string;
  phone?: string;
  classRoom?: string; // e.g. "ม.4/2"
  role: 'admin' | 'student';
  status: 'active' | 'suspended';
  isRegistered: boolean; // true when user claims their account upon login
  userId?: string; // Firebase Auth UID
  claimedByUid?: string;
  claimedAt?: string;
  createdAt: string;
}

export interface ExcelValidationError {
  sheetName: string;
  rowNumber: number;
  field: string;
  message: string;
  rawValue?: string;
}

export interface ExcelPreviewData {
  schoolCount: number;
  adminCount: number;
  studentCount: number;
  schoolInfo?: {
    schoolCode: string;
    schoolName: string;
    province: string;
    contactEmail: string;
    contactPhone: string;
    emailDomain?: string;
  };
  admins: Array<{
    employeeId: string;
    fullName: string;
    position: string;
    email: string;
    phone?: string;
  }>;
  students: Array<{
    studentId: string;
    fullName: string;
    email: string;
    phone?: string;
    classRoom?: string;
  }>;
  errors: ExcelValidationError[];
  isValid: boolean;
}

// Re-export production schema models
export * from './schema';

