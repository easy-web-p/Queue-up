/**
 * ============================================================================
 * 🔔 NOTIFICATIONS — THE LIVE SUBSCRIPTION
 * ============================================================================
 *
 * Watches the signed-in person's own orders and hands them to the header as
 * notifications. The mapping itself lives in orderNotification.ts, which has no
 * Firestore import and is therefore testable directly.
 */

import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '../firebase/config.js';
import {
  NOTIFIABLE_STATUSES,
  orderToNotification,
  type OrderNotification,
} from './orderNotification';

export {
  NOTIFIABLE_STATUSES,
  orderToNotification,
  type OrderNotification,
  type NotificationTone,
} from './orderNotification';

/**
 * Watch this person's live orders.
 *
 * Filtered on `userId` because that is the clause the security rule can prove;
 * an unfiltered query is refused outright rather than trimmed to what they may
 * see. Sorted here rather than in the query so no composite index is needed for
 * something this small.
 *
 * @returns the unsubscribe function
 */
export function subscribeToMyNotifications(
  uid: string,
  onChange: (notifications: OrderNotification[]) => void,
  onError?: (err: unknown) => void
): () => void {
  if (!uid) {
    onChange([]);
    return () => {};
  }

  return onSnapshot(
    query(
      collection(db, 'orders'),
      where('userId', '==', uid),
      where('status', 'in', [...NOTIFIABLE_STATUSES])
    ),
    (snap) => {
      const rows = snap.docs
        .map((d) => orderToNotification({ id: d.id, ...d.data() }))
        .filter((n): n is OrderNotification => n !== null)
        // Ready first — that is the one someone is standing up for — then newest.
        .sort((a, b) => {
          if (a.actionable !== b.actionable) return a.actionable ? -1 : 1;
          return b.createdAtMs - a.createdAtMs;
        });
      onChange(rows);
    },
    (err) => {
      console.warn('[notifications] snapshot error:', err);
      // An empty list, not the last known one and certainly not a default set.
      onChange([]);
      onError?.(err);
    }
  );
}
