/**
 * Campus Wallet (customer side).
 *
 * types/index.ts has declared PaymentMode 'CAMPUS_WALLET' and the UI has
 * offered it since the first release, but no balance, ledger or debit path
 * existed — merchant_balances tracks what a store is owed, not what a student
 * has. This is that missing half.
 *
 * Every mutation runs inside a Firestore transaction and records a
 * wallet_transactions row carrying the resulting balance, so the ledger and the
 * balance can always be reconciled against each other.
 */

const WALLETS = 'customer_wallets';
const TRANSACTIONS = 'wallet_transactions';

/** Wallets are keyed by uid, so the document id is the owner. */
export function walletRef(adminDb, uid) {
  return adminDb.collection(WALLETS).doc(uid);
}

function emptyWallet(uid) {
  return { uid, balanceSatang: 0, schoolId: null, createdAt: null, updatedAt: null };
}

/**
 * Reads a wallet, returning a zero balance for an account that has never been
 * credited rather than a missing document the callers would each have to handle.
 */
export async function readWallet(adminDb, uid) {
  const snap = await walletRef(adminDb, uid).get();
  return snap.exists ? { ...emptyWallet(uid), ...snap.data() } : emptyWallet(uid);
}

/**
 * Applies a signed delta to a wallet inside an existing transaction.
 *
 * @param {object} t Firestore transaction
 * @param {object} adminDb
 * @param {object} params
 * @param {string} params.uid Wallet owner
 * @param {number} params.deltaSatang Positive to credit, negative to debit
 * @param {'TOPUP'|'SPEND'|'REFUND'|'ADJUSTMENT'} params.type
 * @param {string} [params.orderId]
 * @param {string} [params.note]
 * @param {string} [params.actorUid] Who performed it, for the audit row
 * @param {string} params.now ISO timestamp
 * @returns {Promise<{ balanceSatang: number, transactionId: string }>}
 * @throws When a debit would take the balance below zero
 */
export async function applyWalletDelta(t, adminDb, {
  uid,
  deltaSatang,
  type,
  orderId = null,
  note = '',
  actorUid = null,
  now
}) {
  if (!uid) throw new Error('WALLET_UID_REQUIRED');
  if (!Number.isInteger(deltaSatang) || deltaSatang === 0) {
    throw new Error('WALLET_DELTA_INVALID: amount must be a non-zero integer in satang');
  }

  const ref = walletRef(adminDb, uid);
  const snap = await t.get(ref);
  const current = snap.exists ? Number(snap.data().balanceSatang || 0) : 0;
  const next = current + deltaSatang;

  if (next < 0) {
    throw new Error(
      `WALLET_INSUFFICIENT_FUNDS: ยอดเงินในกระเป๋าไม่พอ (มี ฿${(current / 100).toFixed(2)} ต้องใช้ ฿${(Math.abs(deltaSatang) / 100).toFixed(2)})`
    );
  }

  t.set(ref, {
    uid,
    balanceSatang: next,
    createdAt: snap.exists ? (snap.data().createdAt || now) : now,
    updatedAt: now
  }, { merge: true });

  const transactionId = `wtx_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
  t.set(adminDb.collection(TRANSACTIONS).doc(transactionId), {
    id: transactionId,
    uid,
    type,
    amountSatang: deltaSatang,
    balanceAfterSatang: next,
    orderId,
    note,
    actorUid,
    createdAt: now
  });

  return { balanceSatang: next, transactionId };
}

/**
 * Lists a wallet's recent transactions, newest first.
 * Sorted in memory so the endpoint works before the composite index exists.
 */
export async function listWalletTransactions(adminDb, uid, limit = 50) {
  const snap = await adminDb.collection(TRANSACTIONS).where('uid', '==', uid).get();
  return snap.docs
    .map((doc) => ({ id: doc.id, ...doc.data() }))
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, limit);
}

/** True when an order's payment method means "pay from the campus wallet". */
export function isWalletPayment(paymentMethod) {
  return String(paymentMethod || '').toUpperCase() === 'CAMPUS_WALLET'
    || String(paymentMethod || '').toLowerCase() === 'wallet';
}

export { WALLETS, TRANSACTIONS };
