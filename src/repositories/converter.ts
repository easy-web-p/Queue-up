import {
  FirestoreDataConverter,
  QueryDocumentSnapshot,
  SnapshotOptions,
  Timestamp,
  serverTimestamp
} from 'firebase/firestore';
import {
  PublicUserProfile,
  PrivateUserProfile,
  UserStats,
  AuthoritativeOrder,
  OrderEvent,
  StoreMember
} from '../types/schema';
import { Store, FoodItem } from '../types';

/**
 * Safely converts Firestore Timestamp, Date, or string into an ISO 8601 string.
 */
export function toIsoString(value: unknown, fallback: string = new Date().toISOString()): string {
  if (!value) return fallback;
  if (value instanceof Timestamp) {
    return value.toDate().toISOString();
  }
  if (typeof (value as { toDate?: () => Date }).toDate === 'function') {
    return (value as { toDate: () => Date }).toDate().toISOString();
  }
  if (value instanceof Date) {
    return value.toISOString();
  }
  if (typeof value === 'string') {
    return value;
  }
  if (typeof value === 'number') {
    return new Date(value).toISOString();
  }
  return fallback;
}

/**
 * Public User Profile Converter
 * Strips any sensitive properties from leaving Firestore.
 */
export const publicProfileConverter: FirestoreDataConverter<PublicUserProfile> = {
  toFirestore(profile: PublicUserProfile) {
    return {
      displayName: profile.displayName || '',
      avatar: profile.avatar || null,
      role: profile.role || 'customer',
      memberSince: profile.memberSince || new Date().toISOString(),
      publicBio: profile.publicBio || null,
      updatedAt: serverTimestamp()
    };
  },
  fromFirestore(snapshot: QueryDocumentSnapshot, options?: SnapshotOptions): PublicUserProfile {
    const data = snapshot.data(options);
    return {
      id: snapshot.id,
      displayName: data.displayName || 'ผู้ใช้งาน',
      avatar: data.avatar || null,
      role: data.role || 'customer',
      memberSince: toIsoString(data.memberSince),
      publicBio: data.publicBio || null
    };
  }
};

/**
 * Private User Profile Converter
 */
export const privateProfileConverter: FirestoreDataConverter<PrivateUserProfile> = {
  toFirestore(profile: PrivateUserProfile) {
    const { id, ...rest } = profile;
    return {
      ...rest,
      updatedAt: serverTimestamp()
    };
  },
  fromFirestore(snapshot: QueryDocumentSnapshot, options?: SnapshotOptions): PrivateUserProfile {
    const data = snapshot.data(options);
    return {
      id: snapshot.id,
      displayName: data.displayName || '',
      email: data.email || '',
      phone: data.phone || '',
      role: data.role || 'customer',
      avatar: data.avatar || null,
      studentOrStoreId: data.studentOrStoreId,
      storeId: data.storeId,
      allergies: Array.isArray(data.allergies) ? data.allergies : [],
      address: data.address,
      memberSince: toIsoString(data.memberSince),
      phoneVerified: !!data.phoneVerified,
      otpVerifiedAt: data.otpVerifiedAt ? toIsoString(data.otpVerifiedAt) : undefined,
      lastLoginAt: data.lastLoginAt ? toIsoString(data.lastLoginAt) : undefined,
      updatedAt: data.updatedAt ? toIsoString(data.updatedAt) : undefined
    };
  }
};

/**
 * User Stats Summary Converter
 */
export const userStatsConverter: FirestoreDataConverter<UserStats> = {
  toFirestore(stats: UserStats) {
    return {
      ...stats,
      updatedAt: serverTimestamp()
    };
  },
  fromFirestore(snapshot: QueryDocumentSnapshot, options?: SnapshotOptions): UserStats {
    const data = snapshot.data(options);
    return {
      totalOrders: Number(data.totalOrders || 0),
      completedOrders: Number(data.completedOrders || 0),
      cancelledOrders: Number(data.cancelledOrders || 0),
      followedStoreCount: Number(data.followedStoreCount || 0),
      totalSpent: Number(data.totalSpent || 0),
      lastOrderAt: data.lastOrderAt ? toIsoString(data.lastOrderAt) : null,
      updatedAt: toIsoString(data.updatedAt)
    };
  }
};

/**
 * Authoritative Order Converter
 */
export const authoritativeOrderConverter: FirestoreDataConverter<AuthoritativeOrder> = {
  toFirestore(order: AuthoritativeOrder) {
    const { id, ...rest } = order;
    return {
      ...rest,
      updatedAt: serverTimestamp()
    };
  },
  fromFirestore(snapshot: QueryDocumentSnapshot, options?: SnapshotOptions): AuthoritativeOrder {
    const data = snapshot.data(options);
    return {
      id: snapshot.id,
      orderNumber: data.orderNumber || data.queueNumber || 'A00',
      customerId: data.customerId || '',
      customerName: data.customerName || 'คุณลูกค้า',
      customerPhone: data.customerPhone || '',
      storeId: data.storeId || '',
      storeName: data.storeName || '',
      storeLogo: data.storeLogo,
      items: Array.isArray(data.items) ? data.items : [],
      subtotalSatang: Number(data.subtotalSatang || Math.round(Number(data.subtotal || 0) * 100)),
      discountSatang: Number(data.discountSatang || Math.round(Number(data.discount || 0) * 100)),
      totalSatang: Number(data.totalSatang || Math.round(Number(data.total || 0) * 100)),
      platformFeeSatang: Number(data.platformFeeSatang || 0),
      estimatedGatewayFeeSatang: Number(data.estimatedGatewayFeeSatang || 0),
      merchantNetSatang: Number(data.merchantNetSatang || 0),
      subtotal: Number(data.subtotal || (Number(data.subtotalSatang || 0) / 100)),
      discount: Number(data.discount || (Number(data.discountSatang || 0) / 100)),
      total: Number(data.total || (Number(data.totalSatang || 0) / 100)),
      status: data.status || 'PAYMENT_PENDING',
      canonicalStatus: data.canonicalStatus,
      paymentMethod: data.paymentMethod || 'cash',
      paymentStatus: data.paymentStatus || 'PENDING',
      settlementStatus: data.settlementStatus || 'PENDING_ORDER_ACCEPTANCE',
      exchangePin: data.exchangePin,
      exchangePinHash: data.exchangePinHash,
      exchangePinFailedAttempts: Number(data.exchangePinFailedAttempts || 0),
      exchangePinLockedUntil: data.exchangePinLockedUntil || null,
      pickupTime: data.pickupTime || 'ทันที',
      estimatedCompletionTime: data.estimatedCompletionTime || '',
      specialNote: data.specialNote,
      allergenAcknowledged: !!data.allergenAcknowledged,
      contactChannelsSnapshot: data.contactChannelsSnapshot,
      exchangeTermsSnapshot: data.exchangeTermsSnapshot,
      merchantResponseDeadlineAt: data.merchantResponseDeadlineAt || null,
      paidAt: data.paidAt ? toIsoString(data.paidAt) : null,
      acceptedAt: data.acceptedAt ? toIsoString(data.acceptedAt) : null,
      completedAt: data.completedAt ? toIsoString(data.completedAt) : null,
      fundReleaseAt: data.fundReleaseAt ? toIsoString(data.fundReleaseAt) : null,
      version: Number(data.version || 1),
      idempotencyKey: data.idempotencyKey || '',
      createdAt: toIsoString(data.createdAt || data.serverCreatedAt),
      updatedAt: toIsoString(data.updatedAt)
    };
  }
};

/**
 * Order Event Converter
 */
export const orderEventConverter: FirestoreDataConverter<OrderEvent> = {
  toFirestore(event: OrderEvent) {
    const { id, ...rest } = event;
    return {
      ...rest,
      timestamp: serverTimestamp()
    };
  },
  fromFirestore(snapshot: QueryDocumentSnapshot, options?: SnapshotOptions): OrderEvent {
    const data = snapshot.data(options);
    return {
      id: snapshot.id,
      orderId: data.orderId || '',
      fromStatus: data.fromStatus || null,
      toStatus: data.toStatus,
      changedBy: data.changedBy || 'SYSTEM',
      changerRole: data.changerRole || 'system',
      note: data.note,
      timestamp: toIsoString(data.timestamp)
    };
  }
};

/**
 * Store Member Converter
 */
export const storeMemberConverter: FirestoreDataConverter<StoreMember> = {
  toFirestore(member: StoreMember) {
    return {
      ...member,
      updatedAt: serverTimestamp()
    };
  },
  fromFirestore(snapshot: QueryDocumentSnapshot, options?: SnapshotOptions): StoreMember {
    const data = snapshot.data(options);
    return {
      userId: data.userId || snapshot.id,
      role: data.role || 'kitchen',
      permissions: Array.isArray(data.permissions) ? data.permissions : [],
      status: data.status || 'active',
      joinedAt: toIsoString(data.joinedAt)
    };
  }
};

/**
 * Menu Item Converter
 */
export const menuItemConverter: FirestoreDataConverter<FoodItem> = {
  toFirestore(item: FoodItem) {
    const { id, ...rest } = item;
    return {
      ...rest,
      updatedAt: serverTimestamp()
    };
  },
  fromFirestore(snapshot: QueryDocumentSnapshot, options?: SnapshotOptions): FoodItem {
    const data = snapshot.data(options);
    return {
      id: snapshot.id,
      storeId: data.storeId || '',
      storeName: data.storeName || '',
      name: data.name || '',
      nameEn: data.nameEn || '',
      price: Number(data.price || 0),
      originalPrice: data.originalPrice ? Number(data.originalPrice) : undefined,
      description: data.description || '',
      category: data.category || 'ทั่วไป',
      image: data.image || '',
      rating: Number(data.rating || 5),
      orderCount: Number(data.orderCount || 0),
      isAvailable: data.isAvailable !== false,
      spicyLevel: data.spicyLevel,
      preparationMinutes: Number(data.preparationMinutes || 10),
      tags: Array.isArray(data.tags) ? data.tags : [],
      optionGroups: Array.isArray(data.optionGroups) ? data.optionGroups : []
    };
  }
};
