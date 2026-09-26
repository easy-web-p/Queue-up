/**
 * Checks that bind a Stripe Checkout Session to the order it is settling.
 *
 * A session with payment_status 'paid' proves only that *something* was paid.
 * Without binding it to this order and this amount, a customer could pay ฿45
 * for a small order and then present that same session id alongside a ฿2,000
 * order to have it marked paid.
 *
 * Kept as a pure function so the rules can be asserted without a Stripe key.
 */

/**
 * @param {object} params
 * @param {object} params.session Stripe Checkout Session
 * @param {string} params.orderId Order the caller says the session settles
 * @param {object} params.order The stored order document
 * @param {object|null} params.user req.user, or null for an anonymous caller
 * @returns {{ ok: true } | { ok: false, status: number, error: string, message: string }}
 */
export function verifySessionAgainstOrder({ session, orderId, order, user }) {
  // 1. The session must have been created for this order. Checkout sessions
  //    carry the order id in metadata when they are opened.
  const sessionOrderId = session?.metadata?.orderId;
  if (sessionOrderId && sessionOrderId !== orderId) {
    return {
      ok: false,
      status: 403,
      error: 'SESSION_ORDER_MISMATCH',
      message: 'ใบชำระเงินนี้ไม่ได้เป็นของคำสั่งซื้อนี้'
    };
  }

  // 2. Only the customer who placed the order may settle it. Guest orders have
  //    no account to match against, so they are settled by whoever holds the
  //    order id — the same trade-off guest checkout makes everywhere else.
  const isOrderCustomer = Boolean(user?.uid) && user.uid === order?.customerId;
  if (!isOrderCustomer && order?.customerId !== 'guest-user') {
    return {
      ok: false,
      status: 403,
      error: 'FORBIDDEN_ORDER',
      message: 'คำสั่งซื้อนี้เป็นของลูกค้าท่านอื่น'
    };
  }

  // 3. The amount captured must cover the order. Stripe reports THB in satang,
  //    the same unit orders are priced in.
  const paidSatang = Number(session?.amount_total);
  const orderTotalSatang = Number(order?.totalSatang) || Math.round(Number(order?.total || 0) * 100);
  if (Number.isFinite(paidSatang) && paidSatang < orderTotalSatang) {
    return {
      ok: false,
      status: 409,
      error: 'AMOUNT_MISMATCH',
      message: `ยอดที่ชำระ (฿${(paidSatang / 100).toFixed(2)}) น้อยกว่ายอดของคำสั่งซื้อ (฿${(orderTotalSatang / 100).toFixed(2)})`
    };
  }

  return { ok: true };
}
