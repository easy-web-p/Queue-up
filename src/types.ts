/**
 * A Firestore timestamp as it arrives on the client.
 *
 * Reads return a Timestamp instance, writes send serverTimestamp() (a sentinel), and
 * a document echoed straight back from a Cloud Function may carry neither yet — so
 * this is deliberately a union rather than Timestamp. Previously every one of these
 * fields was `any`.
 */
export type FirestoreTimestamp =
  | { toDate: () => Date; toMillis: () => number }
  | { seconds: number; nanoseconds: number }
  | Date
  | string
  | null;

/**
 * A FirestoreTimestamp as milliseconds since the epoch, or 0 when it has none.
 *
 * All four shapes, not just the Firestore Timestamp object. A sort written as
 * `ts?.toMillis ? ts.toMillis() : 0` scores a Date, an ISO string and a raw
 * {seconds} pair all as zero — so in a list holding a mix, every order that is
 * not a Timestamp object collapses to the end in arbitrary order. Firestore
 * hands back a Timestamp, but a locally-created or cached record often does
 * not.
 */
export function timestampToMillis(ts: FirestoreTimestamp): number {
  if (!ts) return 0;
  if (typeof ts === 'string') {
    const parsed = Date.parse(ts);
    return Number.isNaN(parsed) ? 0 : parsed;
  }
  if (ts instanceof Date) {
    const time = ts.getTime();
    return Number.isNaN(time) ? 0 : time;
  }
  if ('toMillis' in ts && typeof ts.toMillis === 'function') return ts.toMillis();
  if ('toDate' in ts && typeof ts.toDate === 'function') {
    const time = ts.toDate().getTime();
    return Number.isNaN(time) ? 0 : time;
  }
  if ('seconds' in ts && typeof ts.seconds === 'number') return ts.seconds * 1000;
  return 0;
}

/** Renders a FirestoreTimestamp as a short local time string. */
export function formatTimestamp(ts: FirestoreTimestamp, locale = 'th-TH'): string {
  if (!ts) return '';
  if (typeof ts === 'string') return ts;
  const date =
    ts instanceof Date
      ? ts
      : 'toDate' in ts
        ? ts.toDate()
        : 'seconds' in ts
          ? new Date(ts.seconds * 1000)
          : null;
  if (!date || Number.isNaN(date.getTime())) return '';
  return date.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' }) + ' น.';
}

export type QueueStatus = 'waiting' | 'confirmed' | 'cooking' | 'ready' | 'completed' | 'cancelled';

export type OrderStatus = 'PENDING' | 'CONFIRMED' | 'PREPARING' | 'READY' | 'COMPLETED' | 'CANCELLED';

export interface ModifierOption {
  id: string;
  name: string;
  priceModifier: number;       // In Baht for display (e.g. 10)
  priceModifierSatang: number; // 🔒 Invariant: Integer satangs (e.g. 1000)
  isDefault?: boolean;
  isOutOfStock?: boolean;
}

export interface ModifierGroup {
  id: string;
  storeId: string;             // 🔒 Store isolation
  name: string;                // e.g. "ระดับความเผ็ด", "เพิ่มไข่"
  isRequired?: boolean;
  required?: boolean;
  selectionType?: 'single' | 'multiple';
  minSelect?: number;
  maxSelect?: number;
  minSelections?: number;
  maxSelections?: number;
  options: ModifierOption[];
}

export interface MenuItem {
  id: string;
  name: string;
  category: string;
  categoryId?: string;
  price: number;               // In Baht for display (e.g. 65)
  priceSatang?: number;        // 🔒 Invariant: Integer satangs (e.g. 6500)
  originalPrice?: number;
  description?: string;
  image?: string;
  imageUrl?: string;
  isAvailable?: boolean;
  stock?: number;
  maxStock?: number;
  stockMode?: 'unlimited' | 'daily_tracked';
  dailyLimit?: number;
  prepTimeMinutes?: number;
  preparationTime?: number;
  isSpicy?: boolean;
  isBestseller?: boolean;
  popular?: boolean;
  storeId?: string;
  shopName?: string;
  /** Alias of shopName carried by some catalogue writers. */
  storeName?: string;
  modifierGroupIds?: string[]; // 🔒 Normalized Modifier References
  /**
   * Allergens the store declares this dish contains, as ALLERGEN_PRESET_DICTIONARY
   * ids (e.g. 'peanut', 'seafood'). This is the only reliable allergen signal the
   * system has — everything else is inferred from the dish's name. An empty or
   * missing list means "not declared", never "contains none".
   */
  allergens?: string[];
  rating?: number;
  salesCount?: number;
}

export interface MenuCategory {
  id: string;
  storeId?: string;            // null for system categories, storeId for custom
  name: string;
  icon?: string;
  displayOrder?: number;
  isActive?: boolean;
}

export interface CapacitySlot {
  id: string;                  // format: STORE_YYYYMMDD_HHmm
  storeId: string;
  date: string;                // YYYY-MM-DD
  timeSlot: string;            // HH:mm
  capacity: number;
  currentOrders: number;       // 🔒 Invariant: <= capacity
  isLocked?: boolean;
}

export interface SelectedModifierOption {
  modifierGroupId: string;
  optionId: string;
  name?: string;
  priceModifier?: number;
  priceModifierSatang?: number;
}

export interface CartItem {
  menuItem: MenuItem;
  quantity: number;
  customInstructions?: string;
  customNotes?: string;
  selectedModifiers?: SelectedModifierOption[] | Record<string, string | string[]>;
}

/**
 * One line of a placed order, as createOrderAuthoritative stores it.
 *
 * Deliberately NOT CartItem. A cart line holds a whole `menuItem` object that
 * the browser assembled; an order line holds a flat snapshot the server priced
 * from the product document, so that what the kitchen cooks and what the
 * customer was charged cannot drift from each other — or be changed by editing
 * the product afterwards.
 *
 * `Order.items` was typed as CartItem[] regardless, which is why every screen
 * reading an order had to reach through `(it as any).name`: the field is there
 * at runtime, and the type said it was not.
 */
export interface OrderItem {
  productId: string;
  name: string;
  category?: string;
  quantity: number;
  /** 🔒 Authoritative. The baht fields below are these divided by 100, for display. */
  unitPriceSatang: number;
  subtotalSatang: number;
  unitPrice: number;
  subtotal: number;
  customNotes?: string;
  selectedModifiers?: SelectedModifierOption[];
}

export interface Order {
  id: string;
  orderId?: string;
  storeId?: string;
  userId?: string;
  customerName: string;
  customerPhone?: string;
  queueNumber: string;         // e.g. "Q001"
  status: OrderStatus;
  queueStatus: QueueStatus;
  totalAmountSatang?: number;  // 🔒 Exact satang
  totalAmount: number;
  finalAmountSatang?: number;
  finalAmount?: number;
  discountAppliedSatang?: number;
  discountApplied?: number;
  pointsEarned?: number;
  items: OrderItem[];
  pickupTime: string;
  pickupDate?: string;
  slotId?: string;
  slipUrl?: string;
  createdAt: FirestoreTimestamp;
  updatedAt?: FirestoreTimestamp;
  estimatedReadyTime?: string;
  shopName?: string;
  storeName?: string;
  customInstructions?: string;

  // Fields createOrderAuthoritative writes that this type did not declare.
  // MerchantKDS reached them through `(order as any).paymentMode`, which is a
  // cast admitting the type is wrong rather than fixing it — and a cast that
  // would keep compiling after the field was renamed on the server.
  /** 'CAMPUS_WALLET' | 'DIRECT_ZERO_PAYMENT' — how the order was paid for. */
  paymentMode?: string;
  paymentStatus?: string;
  /** Set only for campus-wallet orders: whose wallet was debited. */
  studentId?: string;
  couponCode?: string | null;
  couponTitle?: string | null;
  discountAppliedBaht?: number;
  /** True when the customer confirmed an order over a recorded allergy. */
  allergenWarningAcknowledged?: boolean;
  acknowledgedAllergenNames?: string[];
}

/**
 * The signed-in user as the Redux auth slice holds it.
 *
 * Distinct from CustomerProfile, which is the customer *record* a merchant sees
 * (id, points, tier, order history). The slice holds a session: who is signed
 * in, what roles their verified token grants, and whether the object came from
 * a real Firebase Auth callback or from the localStorage cache.
 *
 * That distinction is not academic. `isFromCache` and `isVerifiedAuth` are what
 * authRoles.js checks before honouring any privileged role — a cached session
 * can never claim admin — so a component that treats the two shapes as
 * interchangeable is one that has lost track of whether its user is verified.
 *
 * Optional profile-ish fields are declared because pages legitimately probe for
 * them: a page may be handed either shape, and the payload Login dispatches
 * carries a name and a photo alongside the session fields.
 */
export interface AuthSessionUser {
  uid: string;
  email?: string;
  displayName?: string;
  photoURL?: string;

  /** Roles derived from verified ID token claims — never from the profile document. */
  roles?: string[];
  activeRole?: string;
  isSuperAdmin?: boolean;
  isMerchantVerified?: boolean;
  isMerchantRegistered?: boolean;

  /** 🔒 False on anything restored from localStorage. Privileged roles require true. */
  isVerifiedAuth?: boolean;
  isTokenVerified?: boolean;
  isFromCache?: boolean;

  storeId?: string;
  school?: string;
  accountId?: string;

  /** Verified ID token custom claims, when the session carries them. */
  tokenClaims?: Record<string, unknown>;

  // Carried through from the profile document by the sign-in path.
  id?: string;
  name?: string;
  fullName?: string;
  phone?: string;
  phoneNumber?: string;
  photo?: string;
  provider?: string;
  isGoogleUser?: boolean;
  lastLoginAt?: string;
  role?: string;
}

export interface CustomerProfile {
  id: string;
  /**
   * The Firebase Auth uid.
   *
   * A customer profile document lives at `users/{uid}`, so `id` and `uid` are
   * the same value — but pages that may be handed either this or an
   * AuthSessionUser read `user?.uid || user?.id`, and declaring it here lets
   * that read type-check instead of forcing a cast.
   */
  uid?: string;
  name: string;
  phone?: string;
  phoneNumber?: string;
  displayName?: string;
  fullName?: string;
  email?: string;
  address?: string;
  points: number;
  tier?: 'Bronze' | 'Silver' | 'Gold' | 'Platinum';
  totalOrders?: number;
  ordersCount?: number;
  totalSpent?: number;
  favoriteItems?: string[];
  favoriteDish?: string;
  lastOrderDate?: string;
}

export interface MerchantShop {
  id: string;
  name: string;
  shopName?: string;
  location: string;
  building?: string;
  hours: string;
  rating: number;
  reviewsCount: number;
  isOpen: boolean;
  status: 'open' | 'closed';
  contactPhone?: string;
  ownerUid?: string;
  ownerName?: string;
  promptpayNumber?: string;
  logoUrl?: string;
  bannerUrl?: string;
  slotCapacity?: number;
  maxOrdersPerSlot?: number;
  pickupSlots?: string[];
}

export interface ChatMessage {
  id: string;
  sender: 'user' | 'store' | 'system' | 'client' | 'merchant';
  senderName?: string;
  text: string;
  timestamp: FirestoreTimestamp;
  isRead?: boolean;
}


