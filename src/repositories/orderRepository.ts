import {
  collection,
  doc,
  query,
  where,
  orderBy,
  limit,
  getDoc,
  onSnapshot,
  Unsubscribe
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { authoritativeOrderConverter, orderEventConverter } from './converter';
import { AuthoritativeOrder, OrderEvent } from '../types/schema';
import { QueueStatus } from '../types';

const ORDERS_COLLECTION = 'orders';
const EVENTS_SUBCOLLECTION = 'events';

export const ACTIVE_QUEUE_STATUSES: QueueStatus[] = [
  'PAYMENT_PENDING',
  'PAID_AWAITING_MERCHANT',
  'MERCHANT_ACCEPTED',
  'PREPARING',
  'READY',
  'READY_FOR_PICKUP'
];

export const orderRepository = {
  /**
   * Realtime subscription for customer's complete order history
   * Queries strictly by customerId (Firebase Auth UID)
   */
  subscribeCustomerOrders(
    customerId: string,
    callback: (orders: AuthoritativeOrder[]) => void,
    maxLimit: number = 50
  ): Unsubscribe {
    if (!customerId) {
      callback([]);
      return () => {};
    }

    const q = query(
      collection(db, ORDERS_COLLECTION).withConverter(authoritativeOrderConverter),
      where('customerId', '==', customerId),
      orderBy('createdAt', 'desc'),
      limit(maxLimit)
    );

    return onSnapshot(
      q,
      (snapshot) => {
        const orders = snapshot.docs.map((doc) => doc.data());
        callback(orders);
      },
      (error) => {
        console.warn(`[orderRepository] Customer orders query error for ${customerId}:`, error);
        callback([]);
      }
    );
  },

  /**
   * Realtime subscription for customer's active queues (waiting for food)
   */
  subscribeCustomerActiveOrders(
    customerId: string,
    callback: (orders: AuthoritativeOrder[]) => void
  ): Unsubscribe {
    if (!customerId) {
      callback([]);
      return () => {};
    }

    const q = query(
      collection(db, ORDERS_COLLECTION).withConverter(authoritativeOrderConverter),
      where('customerId', '==', customerId),
      where('status', 'in', ACTIVE_QUEUE_STATUSES),
      orderBy('createdAt', 'desc')
    );

    return onSnapshot(
      q,
      (snapshot) => {
        const orders = snapshot.docs.map((doc) => doc.data());
        callback(orders);
      },
      (error) => {
        console.warn(`[orderRepository] Active orders query error for ${customerId}:`, error);
        callback([]);
      }
    );
  },

  /**
   * Realtime subscription for Store's active queues (used in KDS and Merchant dashboard)
   */
  subscribeStoreActiveQueues(
    storeId: string,
    callback: (orders: AuthoritativeOrder[]) => void
  ): Unsubscribe {
    if (!storeId) {
      callback([]);
      return () => {};
    }

    const q = query(
      collection(db, ORDERS_COLLECTION).withConverter(authoritativeOrderConverter),
      where('storeId', '==', storeId),
      where('status', 'in', ACTIVE_QUEUE_STATUSES),
      orderBy('createdAt', 'asc')
    );

    return onSnapshot(
      q,
      (snapshot) => {
        const orders = snapshot.docs.map((doc) => doc.data());
        callback(orders);
      },
      (error) => {
        console.warn(`[orderRepository] KDS active queue subscription error for store ${storeId}:`, error);
        callback([]);
      }
    );
  },

  /**
   * Realtime subscription for a single order's details
   */
  subscribeOrder(
    orderId: string,
    callback: (order: AuthoritativeOrder | null) => void
  ): Unsubscribe {
    if (!orderId) {
      callback(null);
      return () => {};
    }

    const ref = doc(db, ORDERS_COLLECTION, orderId).withConverter(authoritativeOrderConverter);
    return onSnapshot(
      ref,
      (snap) => {
        callback(snap.exists() ? snap.data() : null);
      },
      (error) => {
        console.warn(`[orderRepository] Single order subscription error for ${orderId}:`, error);
        callback(null);
      }
    );
  },

  /**
   * Realtime subscription for order audit events subcollection
   */
  subscribeOrderEvents(
    orderId: string,
    callback: (events: OrderEvent[]) => void
  ): Unsubscribe {
    if (!orderId) {
      callback([]);
      return () => {};
    }

    const q = query(
      collection(db, ORDERS_COLLECTION, orderId, EVENTS_SUBCOLLECTION).withConverter(orderEventConverter),
      orderBy('timestamp', 'asc')
    );

    return onSnapshot(
      q,
      (snapshot) => {
        const events = snapshot.docs.map((d) => d.data());
        callback(events);
      },
      (error) => {
        console.warn(`[orderRepository] Events subcollection error for order ${orderId}:`, error);
        callback([]);
      }
    );
  },

  /**
   * One-time fetch for order
   */
  async getOrderById(orderId: string): Promise<AuthoritativeOrder | null> {
    if (!orderId) return null;
    const ref = doc(db, ORDERS_COLLECTION, orderId).withConverter(authoritativeOrderConverter);
    const snap = await getDoc(ref);
    return snap.exists() ? snap.data() : null;
  }
};
