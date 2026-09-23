/**
 * ============================================================================
 * 🔔 ONE ORDER, AS A NOTIFICATION
 * ============================================================================
 *
 * The header bell showed four notifications written into ShopeeSearchBar.jsx:
 * "ร้านสเต็กพี่ตั้ม School Food", "ร้านป้าแดง ตามสั่ง", a queue number A05, a
 * pickup at 12:15 at counter 1. Every visitor saw the same four, signed in or
 * not, on every page — and tapping one opened a bookings tab showing something
 * else entirely.
 *
 * A notification is a claim that something happened to you, so there is one
 * source for it: the person's own orders. This module is the mapping, kept free
 * of Firestore so the suite can call it rather than model it — importing the
 * subscription would pull in firebase/config and its `import.meta.env`, which
 * does not exist outside Vite.
 */

// Explicit .ts: `../types` is ambiguous on disk — src/types.ts and src/types/
// both exist — and Node resolves the directory.
import { timestampToMillis, type FirestoreTimestamp } from '../types.ts';

/** Order states worth telling someone about. A finished order is not news. */
export const NOTIFIABLE_STATUSES = ['PENDING', 'CONFIRMED', 'PREPARING', 'READY'] as const;

export type NotificationTone = 'READY' | 'COOKING' | 'WAITING';

export interface OrderNotification {
  id: string;
  tone: NotificationTone;
  /** The shop, as the order recorded it. Never invented. */
  storeName: string;
  queueNumber: string;
  /** The dishes actually ordered, joined for one line. */
  itemsLabel: string;
  pickupTime: string;
  statusLabel: string;
  createdAtMs: number;
  /** True while the order needs the person to do something — collect it. */
  actionable: boolean;
}

const STATUS_LABEL: Record<string, string> = {
  PENDING: 'รอร้านยืนยัน',
  CONFIRMED: 'ร้านรับออเดอร์แล้ว',
  PREPARING: 'กำลังปรุงอาหาร',
  READY: 'พร้อมรับแล้ว',
};

const TONE_BY_STATUS: Record<string, NotificationTone> = {
  PENDING: 'WAITING',
  CONFIRMED: 'WAITING',
  PREPARING: 'COOKING',
  READY: 'READY',
};

interface RawOrder {
  id?: string;
  orderId?: string;
  storeName?: string;
  storeId?: string;
  queueNumber?: string;
  status?: string;
  pickupTime?: string;
  createdAt?: FirestoreTimestamp;
  items?: Array<{ name?: string; menuItem?: { name?: string }; quantity?: number }>;
}

/**
 * One order as a notification.
 *
 * Exported and pure so the suite can call it. Every field comes from the order
 * document; where a field is missing the text says so rather than filling the
 * gap with something plausible — "ร้านค้า" is visibly a placeholder in a way
 * that "ร้านป้าแดง ตามสั่ง" is not.
 */
export function orderToNotification(order: RawOrder): OrderNotification | null {
  const status = String(order.status || '').toUpperCase();
  if (!(NOTIFIABLE_STATUSES as readonly string[]).includes(status)) return null;

  const items = Array.isArray(order.items) ? order.items : [];
  const names = items
    .map((it) => it?.name || it?.menuItem?.name)
    .filter((n): n is string => typeof n === 'string' && n.length > 0);

  return {
    id: String(order.id || order.orderId || ''),
    tone: TONE_BY_STATUS[status] || 'WAITING',
    storeName: order.storeName || order.storeId || 'ร้านค้า',
    queueNumber: order.queueNumber || '—',
    itemsLabel: names.length > 0 ? names.join(', ') : `${items.length} รายการ`,
    pickupTime: order.pickupTime || '—',
    statusLabel: STATUS_LABEL[status] || status,
    createdAtMs: timestampToMillis(order.createdAt ?? null),
    // READY is the only state that needs the person to move. The badge counts
    // these, so it reads 0 when there is genuinely nothing to do — which the
    // hardcoded "4" could never do.
    actionable: status === 'READY',
  };
}
