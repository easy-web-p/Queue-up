export type QueueStatus = 'waiting' | 'cooking' | 'ready' | 'completed' | 'cancelled';

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
  createdAt: any;
  updatedAt?: any;
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
  timestamp: any;
  isRead?: boolean;
}


