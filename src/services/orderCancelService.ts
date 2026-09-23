/**
 * ============================================================================
 * ↩️ CANCEL AN ORDER
 * ============================================================================
 *
 * One call, because a cancellation on a wallet-paid order is a refund and a
 * refund is not something a browser can do.
 *
 * Cancelling used to be a direct `updateDoc(orders/{id}, { status: 'CANCELLED' })`
 * from the merchant dashboard, and the security rules allowed the same from a
 * customer before the kitchen started. The wallet was debited when the order was
 * created and nothing credited it back — `wallets` is closed to clients, so
 * nothing could. The food was cancelled and the money stayed gone.
 */

import { httpsCallable } from 'firebase/functions';
import { functions } from '../firebase/config.js';

export interface CancelResult {
  success: boolean;
  orderId: string;
  cancelled: boolean;
  /** 0 for a counter-paid order — the app never held that money. */
  refundSatang: number;
  refundReason: string;
  newBalanceSatang?: number;
  message: string;
}

/**
 * Cancel an order and return whatever was paid for it.
 *
 * Throws when the server refuses — the order is already cancelled, already
 * collected, or the kitchen has started and the caller is the customer. That
 * message has to reach them: reported as success, someone walks away believing
 * their lunch is cancelled while a stall is still cooking it.
 */
export async function cancelOrderWithRefund(
  orderId: string,
  reason?: string
): Promise<CancelResult> {
  const callable = httpsCallable<{ orderId: string; reason?: string }, CancelResult>(
    functions,
    'cancelOrderWithRefund'
  );
  const res = await callable({ orderId, reason });
  return res.data;
}
