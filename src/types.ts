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
  items: CartItem[];
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
}

export interface CustomerProfile {
  id: string;
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


