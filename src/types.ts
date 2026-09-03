export type QueueStatus = 'waiting' | 'pending_slip' | 'cooking' | 'ready' | 'completed' | 'cancelled';

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
  name: string;                // e.g. "ระดับความหวาน", "ท็อปปิ้ง"
  isRequired: boolean;
  selectionType: 'single' | 'multiple';
  minSelect?: number;
  maxSelect?: number;
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
  stockMode?: 'unlimited' | 'daily_tracked';
  dailyLimit?: number;
  prepTimeMinutes?: number;
  preparationTime?: number;
  isSpicy?: boolean;
  isBestseller?: boolean;
  storeId?: string;
  shopName?: string;
  modifierGroupIds?: string[]; // 🔒 Normalized Modifier References
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

export interface CartItem {
  menuItem: MenuItem;
  quantity: number;
  customInstructions?: string;
  selectedModifiers?: Record<string, string | string[]>;
}

export interface Order {
  id: string;
  orderId?: string;
  userId?: string;
  queueNumber: string;
  customerName: string;
  customerPhone?: string;
  subtotal?: number;
  totalAmount: number;
  totalSatang?: number;        // 🔒 Exact satang
  finalAmount?: number;
  discountApplied?: number;
  pointsEarned?: number;
  items: CartItem[];
  queueStatus: QueueStatus;
  status?: string;
  paymentMethod: 'promptpay' | 'cash' | 'card' | string;
  paymentStatus: 'pending' | 'paid' | 'verified' | 'failed' | 'cancelled' | 'refunded' | 'refund_pending';
  pickupTime: string;
  createdAt: string;
  updatedAt?: string;
  estimatedReadyTime?: string;
  slipUrl?: string;
  storeId?: string;
  shopName?: string;
  storeName?: string;
  customInstructions?: string;
}

export interface CustomerProfile {
  id: string;
  name: string;
  phone?: string;
  email?: string;
  points: number;
  tier?: 'Bronze' | 'Silver' | 'Gold' | 'Platinum';
  totalOrders?: number;
  totalSpent?: number;
  favoriteItems?: string[];
  lastOrderDate?: string;
}

export interface MerchantShop {
  id: string;
  name: string;
  location: string;
  hours: string;
  rating: number;
  reviewsCount: number;
  isOpen: boolean;
  status: 'open' | 'closed';
  contactPhone?: string;
  ownerUid?: string;
  slotCapacity?: number;
  maxOrdersPerSlot?: number;
  pickupSlots?: string[];
}
