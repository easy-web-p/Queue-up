/**
 * Campus Wallet endpoints (customer side).
 *
 * Balances are server-authoritative: firestore.rules denies clients any access
 * to customer_wallets and wallet_transactions, so every read and write goes
 * through here.
 */

import { Router } from 'express';
import { adminDb } from '../firebaseAdmin.js';
import { authenticate, requireSchoolAdmin, isSuperAdmin } from '../middleware/authenticate.js';
import {
  readWallet,
  listWalletTransactions,
  applyWalletDelta
} from '../services/customerWalletService.js';

export const customerWalletRouter = Router();

/** Counter top-ups are bounded so a mistyped amount cannot create ฿1,000,000. */
const MAX_CREDIT_SATANG = 500000; // ฿5,000

/**
 * Whether this account is on that school's roster and claimed by them.
 *
 * A counter top-up creates spendable money, and a school administrator's
 * authority reaches their own institution and no further. requireSchoolAdmin
 * only checks that the caller administers the school they named — it knows
 * nothing about whose wallet is being credited — so on its own it let an
 * administrator of one school credit a student of another, an account on no
 * roster at all, or their own personal account under another institution's name.
 */
async function isMemberOfSchool(uid, schoolId) {
  if (!uid || !schoolId) return false;
  const snap = await adminDb.collection('school_members')
    .where('claimedByUid', '==', uid)
    .where('schoolId', '==', schoolId)
    .where('status', '==', 'active')
    .limit(1)
    .get();
  return !snap.empty;
}

/**
 * GET /api/wallet
 * The signed-in user's own balance and recent transactions.
 */
customerWalletRouter.get('/', authenticate, async (req, res) => {
  try {
    const wallet = await readWallet(adminDb, req.user.uid);
    const transactions = await listWalletTransactions(adminDb, req.user.uid, 50);

    return res.status(200).json({
      success: true,
      wallet: {
        ...wallet,
        balanceBaht: wallet.balanceSatang / 100
      },
      transactions
    });
  } catch (err) {
    console.error('[Wallet API] Read error:', err);
    return res.status(500).json({ success: false, error: 'WALLET_READ_FAILED', message: err.message });
  }
});

/**
 * GET /api/wallet/:uid
 * Administrative read of a member's wallet, for the campus counter.
 */
customerWalletRouter.get('/:uid', authenticate, async (req, res) => {
  try {
    const { uid } = req.params;

    if (uid !== req.user.uid && !isSuperAdmin(req.user) && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: 'FORBIDDEN',
        message: 'You can only view your own wallet.'
      });
    }

    const wallet = await readWallet(adminDb, uid);
    const transactions = await listWalletTransactions(adminDb, uid, 50);

    return res.status(200).json({
      success: true,
      wallet: { ...wallet, balanceBaht: wallet.balanceSatang / 100 },
      transactions
    });
  } catch (err) {
    console.error('[Wallet API] Admin read error:', err);
    return res.status(500).json({ success: false, error: 'WALLET_READ_FAILED', message: err.message });
  }
});

/**
 * POST /api/wallet/:uid/credit
 * Campus counter top-up, performed by an institution or platform admin.
 *
 * Idempotent on idempotencyKey: a retried request after a network blip must not
 * credit the student twice.
 */
customerWalletRouter.post(
  '/:uid/credit',
  authenticate,
  // Resolved from the caller's own claim. Reading req.body.schoolId first let a
  // request name the institution it was acting for, which requireSchoolAdmin
  // then had to match against the same caller's claim anyway.
  requireSchoolAdmin((req) => req.user?.schoolId),
  async (req, res) => {
    try {
      const { uid } = req.params;
      const { amountSatang, note = 'เติมเงินที่เคาน์เตอร์', idempotencyKey } = req.body;

      // A platform administrator credits anyone; a school administrator credits
      // the people on their own roster.
      if (!isSuperAdmin(req.user)) {
        const schoolId = req.user?.schoolId;
        if (!(await isMemberOfSchool(uid, schoolId))) {
          return res.status(403).json({
            success: false,
            error: 'NOT_YOUR_MEMBER',
            message: 'เติมเงินได้เฉพาะสมาชิกในรายชื่อของสถานศึกษาที่คุณดูแลเท่านั้น'
          });
        }
      }

      const amount = Number(amountSatang);
      if (!Number.isInteger(amount) || amount <= 0) {
        return res.status(400).json({
          success: false,
          error: 'INVALID_AMOUNT',
          message: 'amountSatang must be a positive integer.'
        });
      }
      if (amount > MAX_CREDIT_SATANG) {
        return res.status(400).json({
          success: false,
          error: 'AMOUNT_TOO_LARGE',
          message: `เติมได้สูงสุดครั้งละ ฿${(MAX_CREDIT_SATANG / 100).toLocaleString()}`
        });
      }

      const key = idempotencyKey || req.headers['x-idempotency-key'];
      if (key) {
        const seen = await adminDb.collection('idempotency_records').doc(`wallet_${key}`).get();
        if (seen.exists) {
          return res.status(200).json(seen.data().response);
        }
      }

      const now = new Date().toISOString();
      const result = await adminDb.runTransaction(async (t) => applyWalletDelta(t, adminDb, {
        uid,
        deltaSatang: amount,
        type: 'TOPUP',
        note,
        actorUid: req.user.uid,
        now
      }));

      const response = {
        success: true,
        uid,
        creditedSatang: amount,
        balanceSatang: result.balanceSatang,
        balanceBaht: result.balanceSatang / 100,
        transactionId: result.transactionId
      };

      if (key) {
        await adminDb.collection('idempotency_records').doc(`wallet_${key}`).set({
          key: `wallet_${key}`,
          response,
          createdAt: now
        });
      }

      return res.status(201).json(response);
    } catch (err) {
      console.error('[Wallet API] Credit error:', err);
      return res.status(400).json({ success: false, error: 'CREDIT_FAILED', message: err.message });
    }
  }
);
