export type QueueStatus = 'waiting' | 'pending_slip' | 'cooking' | 'ready' | 'completed' | 'cancelled';

export interface MenuItem {
  id: string;
  name: string;
  category: string;
  price: number;
  originalPrice?: number;
  description?: string;
  image?: string;
  isAvailable?: boolean;
  stock?: number;
  dailyLimit?: number;
  preparationTime?: number;
  isSpicy?: boolean;
  isBestseller?: boolean;
  storeId?: string;
  shopName?: string;
  rating?: number;
  salesCount?: number;
}

export interface MenuCategory {
  id: string;
  name: string;
  icon?: string;
  displayOrder?: number;
}

export interface CartItem {
  menuItem: MenuItem;
  quantity: number;
  customInstructions?: string;
  selectedModifiers?: Record<string, string | string[]>;
}

export interface Order {
  id: string;
  queueNumber: string;
  customerName: string;
  customerPhone?: string;
  totalAmount: number;
  finalAmount?: number;
  discountApplied?: number;
  pointsEarned?: number;
  items: CartItem[];
  queueStatus: QueueStatus;
  paymentMethod: 'promptpay' | 'cash' | 'card';
  paymentStatus: 'pending' | 'verified' | 'failed';
  pickupTime: string;
  createdAt: string;
  estimatedReadyTime?: string;
  slipUrl?: string;
  storeId?: string;
  shopName?: string;
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
}
