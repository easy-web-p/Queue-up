import { Router } from 'express';
import Stripe from 'stripe';
import { adminDb } from '../firebaseAdmin.js';
import { authenticate, requireStoreOwnership, requireSuperAdmin } from '../middleware/authenticate.js';
import { optionalSecret } from '../config/secrets.js';
import {
  recordPayoutReserved,
  recordPayoutCompleted,
  recordPayoutFailed,
  recordFundsReleased
} from '../services/ledgerService.js';
import { resolveOrderBreakdown } from '../services/orderPricing.js';
import dotenv from 'dotenv';

dotenv.config();

export const walletRouter = Router();

const stripeSecretKey = optionalSecret('STRIPE_SECRET_KEY');
const stripe = stripeSecretKey ? new Stripe(stripeSecretKey) : null;

/** Guard for endpoints that cannot work without a configured Stripe key. */
function requireStripe(res) {
  if (stripe) return true;
  res.status(503).json({
    success: false,
    error: 'STRIPE_NOT_CONFIGURED',
    message: 'Stripe is not configured on this server.'
  });
  return false;
}

/**
 * GET /api/merchant/wallet/:storeId
 * Retrieve merchant balance summary
 */
walletRouter.get('/wallet/:storeId', authenticate, requireStoreOwnership(), async (req, res) => {
  try {
    const { storeId } = req.params;
    const balanceSnap = await adminDb.collection('merchant_balances').doc(storeId).get();

    const data = balanceSnap.exists ? balanceSnap.data() : {
      storeId,
      pendingSatang: 0,
      onHoldSatang: 0,
      availableSatang: 0,
      payoutReservedSatang: 0,
      totalPaidOutSatang: 0
    };

    return res.status(200).json({
      success: true,
      balance: {
        ...data,
        // Baht conversions for UI display
        pendingBaht: (data.pendingSatang || 0) / 100,
        onHoldBaht: (data.onHoldSatang || 0) / 100,
        availableBaht: (data.availableSatang || 0) / 100,
        payoutReservedBaht: (data.payoutReservedSatang || 0) / 100,
        totalPaidOutBaht: (data.totalPaidOutSatang || 0) / 100
      }
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/merchant/wallet/:storeId/ledger
 * Retrieve double-entry financial ledger history for store
 */
walletRouter.get('/wallet/:storeId/ledger', authenticate, requireStoreOwnership(), async (req, res) => {
  try {
    const storeId = req.storeId;
    const snapshot = await adminDb
      .collection('ledger_entries')
      .where('storeId', '==', storeId)
      .get();

    const entries = [];
    snapshot.forEach((doc) => {
      entries.push({ id: doc.id, ...doc.data() });
    });

    entries.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    return res.status(200).json({ success: true, entries: entries.slice(0, 100) });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/merchant/wallet/release-held-funds
 * Release held funds when fundReleaseAt deadline passes
 */
walletRouter.post('/wallet/release-held-funds', authenticate, requireStoreOwnership(), async (req, res) => {
  try {
    const storeId = req.storeId;
    const now = new Date().toISOString();
    const ordersSnap = await adminDb
      .collection('orders')
      .where('storeId', '==', storeId)
      .where('settlementStatus', '==', 'ON_HOLD')
      .get();

    const releasedOrders = [];

    for (const doc of ordersSnap.docs) {
      const order = doc.data();
      const releaseTime = order.fundReleaseAt ? new Date(order.fundReleaseAt) : new Date(0);
      if (new Date() < releaseTime) continue;

      const orderRef = adminDb.collection('orders').doc(doc.id);
      const { merchantNetSatang } = resolveOrderBreakdown(order);

      await adminDb.runTransaction(async (t) => {
        t.update(orderRef, {
          settlementStatus: 'AVAILABLE',
          updatedAt: now
        });

        await recordFundsReleased(t, adminDb, {
          orderId: doc.id,
          storeId,
          merchantNetSatang,
          now
        });
      });

      releasedOrders.push(doc.id);
    }

    return res.status(200).json({
      success: true,
      releasedCount: releasedOrders.length,
      releasedOrders
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/merchant/payouts
 * Request Payout: Atomically reserves available funds and dispatches payout
 */
walletRouter.post('/payouts', authenticate, requireStoreOwnership(), async (req, res) => {
  try {
    // requireStoreOwnership authorised this storeId; never trust req.body.storeId.
    const storeId = req.storeId;
    const { amountSatang, bankAccountSnapshot } = req.body;

    // A payout needs a real destination. Defaulting to a placeholder account
    // meant a request with no bank details recorded a fabricated one, which is
    // the worst possible thing to find in a money trail afterwards.
    const bank = bankAccountSnapshot || {};
    const hasBankDetails = Boolean(
      String(bank.bankName || '').trim() &&
      String(bank.accountName || '').trim() &&
      String(bank.accountNumberMasked || bank.accountNumber || '').trim()
    );
    if (!hasBankDetails) {
      return res.status(400).json({
        success: false,
        error: 'MISSING_BANK_ACCOUNT',
        message: 'กรุณาระบุบัญชีธนาคารปลายทาง (ชื่อธนาคาร, ชื่อบัญชี และเลขบัญชี) ก่อนขอถอนเงิน'
      });
    }

    if (!storeId || !amountSatang || amountSatang < 10000) {
      return res.status(400).json({
        success: false,
        error: 'INVALID_AMOUNT',
        message: 'Minimum payout amount is ฿100 (10,000 Satang).'
      });
    }

    const balanceRef = adminDb.collection('merchant_balances').doc(storeId);
    const payoutId = `payout_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const payoutRef = adminDb.collection('payout_requests').doc(payoutId);
    const now = new Date().toISOString();

    // 1. Atomic reservation of funds
    const payoutRecord = await adminDb.runTransaction(async (t) => {
      const balanceSnap = await t.get(balanceRef);
      const balance = balanceSnap.exists ? balanceSnap.data() : { availableSatang: 0 };

      if ((balance.availableSatang || 0) < amountSatang) {
        throw new Error(`INSUFFICIENT_FUNDS: ยอดเงินที่ถอนได้ไม่เพียงพอ (มี ฿${((balance.availableSatang || 0) / 100).toFixed(2)})`);
      }

      const newPayout = {
        id: payoutId,
        storeId,
        amountSatang,
        currency: 'thb',
        status: 'REQUESTED',
        bankAccountSnapshot: bank,
        requestedBy: req.user.uid,
        createdAt: now,
        updatedAt: now
      };

      t.set(payoutRef, newPayout);

      // Record double-entry reservation in ledger
      await recordPayoutReserved(t, adminDb, {
        payoutId,
        storeId,
        amountSatang,
        now
      });

      return newPayout;
    });

    // The payout stays REQUESTED with the funds reserved until a transfer is
    // actually confirmed, through /payouts/:id/complete.
    //
    // This used to auto-complete on a setTimeout 1.5 seconds after the response
    // was sent, which was wrong twice over: a serverless instance is frozen the
    // moment it responds, so the callback would usually never run and the
    // money would sit reserved forever — and when it did run it marked the
    // payout PAID without any transfer having happened.
    return res.status(201).json({
      success: true,
      payoutId,
      payout: payoutRecord,
      status: 'REQUESTED',
      message: 'ส่งคำขอถอนเงินเรียบร้อยแล้ว ยอดเงินถูกกันไว้รอการโอน ทีมงานจะดำเนินการให้ภายใน 1-2 วันทำการ'
    });
  } catch (err) {
    console.error('[Payout API] Payout error:', err);
    return res.status(400).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/merchant/payouts/:payoutId/complete
 * Confirms that the transfer actually left the platform's account.
 *
 * Restricted to platform administrators: only whoever performed the transfer
 * can attest that it happened. Idempotent, so a repeated confirmation after a
 * network blip does not pay the merchant twice.
 */
walletRouter.post('/payouts/:payoutId/complete', authenticate, requireSuperAdmin, async (req, res) => {
  try {
    const { payoutId } = req.params;
    const { providerTransferId = null } = req.body;
    const payoutRef = adminDb.collection('payout_requests').doc(payoutId);
    const now = new Date().toISOString();

    const result = await adminDb.runTransaction(async (t) => {
      const snap = await t.get(payoutRef);
      if (!snap.exists) throw new Error('PAYOUT_NOT_FOUND');

      const payout = snap.data();
      if (payout.status === 'PAID') {
        return { alreadyPaid: true, payoutId, amountSatang: payout.amountSatang };
      }
      if (payout.status !== 'REQUESTED') {
        throw new Error(`PAYOUT_NOT_PENDING: payout is ${payout.status}`);
      }

      t.update(payoutRef, {
        status: 'PAID',
        providerTransferId,
        completedBy: req.user.uid,
        completedAt: now,
        updatedAt: now
      });

      await recordPayoutCompleted(t, adminDb, {
        payoutId,
        storeId: payout.storeId,
        amountSatang: payout.amountSatang,
        now
      });

      return { alreadyPaid: false, payoutId, amountSatang: payout.amountSatang };
    });

    return res.status(200).json({ success: true, ...result });
  } catch (err) {
    console.error('[Payout API] Complete error:', err);
    const notFound = /PAYOUT_NOT_FOUND/.test(err.message);
    return res.status(notFound ? 404 : 400).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/merchant/payouts/:payoutId/fail
 * Marks a payout as failed and returns the reserved funds to the merchant's
 * available balance, so a transfer that bounced does not strand their money.
 */
walletRouter.post('/payouts/:payoutId/fail', authenticate, requireSuperAdmin, async (req, res) => {
  try {
    const { payoutId } = req.params;
    const { reason = 'ไม่สามารถโอนเงินได้' } = req.body;
    const payoutRef = adminDb.collection('payout_requests').doc(payoutId);
    const now = new Date().toISOString();

    const result = await adminDb.runTransaction(async (t) => {
      const snap = await t.get(payoutRef);
      if (!snap.exists) throw new Error('PAYOUT_NOT_FOUND');

      const payout = snap.data();
      if (payout.status === 'FAILED') {
        return { alreadyFailed: true, payoutId, amountSatang: payout.amountSatang };
      }
      if (payout.status !== 'REQUESTED') {
        throw new Error(`PAYOUT_NOT_PENDING: payout is ${payout.status}`);
      }

      t.update(payoutRef, {
        status: 'FAILED',
        failureReason: reason,
        failedBy: req.user.uid,
        failedAt: now,
        updatedAt: now
      });

      await recordPayoutFailed(t, adminDb, {
        payoutId,
        storeId: payout.storeId,
        amountSatang: payout.amountSatang,
        reason,
        now
      });

      return { alreadyFailed: false, payoutId, amountSatang: payout.amountSatang };
    });

    return res.status(200).json({ success: true, ...result });
  } catch (err) {
    console.error('[Payout API] Fail error:', err);
    const notFound = /PAYOUT_NOT_FOUND/.test(err.message);
    return res.status(notFound ? 404 : 400).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/merchant/connect/account
 * Create Stripe Connected Account for merchant onboarding
 */
walletRouter.post('/connect/account', authenticate, requireStoreOwnership(), async (req, res) => {
  try {
    if (!requireStripe(res)) return;
    const storeId = req.storeId;
    const { storeEmail, storeName } = req.body;

    // Create Stripe standard/express connected account
    const account = await stripe.accounts.create({
      type: 'express',
      country: 'TH',
      email: storeEmail || undefined,
      business_type: 'individual',
      capabilities: {
        transfers: { requested: true }
      },
      metadata: { storeId: storeId || 'unknown' }
    });

    // Save account id in merchant account doc
    await adminDb.collection('merchant_accounts').doc(storeId).set({
      storeId,
      stripeAccountId: account.id,
      chargesEnabled: account.charges_enabled,
      payoutsEnabled: account.payouts_enabled,
      detailsSubmitted: account.details_submitted,
      updatedAt: new Date().toISOString()
    }, { merge: true });

    return res.status(200).json({ success: true, accountId: account.id });
  } catch (err) {
    console.error('[Stripe Connect] Create account error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/merchant/connect/onboarding-link
 * Generate Stripe Account Link for onboarding
 */
walletRouter.post('/connect/onboarding-link', authenticate, requireStoreOwnership(), async (req, res) => {
  try {
    if (!requireStripe(res)) return;
    const { accountId, returnUrl, refreshUrl } = req.body;

    // The account must be the one registered to the store the caller operates.
    const accountSnap = await adminDb.collection('merchant_accounts').doc(req.storeId).get();
    if (!accountSnap.exists || accountSnap.data().stripeAccountId !== accountId) {
      return res.status(403).json({
        success: false,
        error: 'ACCOUNT_MISMATCH',
        message: 'This Stripe account is not registered to your store.'
      });
    }
    const origin = req.headers.origin || 'http://localhost:3000';

    const accountLink = await stripe.accountLinks.create({
      account: accountId,
      refresh_url: refreshUrl || `${origin}/merchant/wallet?connect=refresh`,
      return_url: returnUrl || `${origin}/merchant/wallet?connect=success`,
      type: 'account_onboarding'
    });

    return res.status(200).json({ success: true, url: accountLink.url });
  } catch (err) {
    console.error('[Stripe Connect] Onboarding link error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});
