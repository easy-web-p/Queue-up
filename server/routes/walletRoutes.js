import { Router } from 'express';
import Stripe from 'stripe';
import { adminDb } from '../firebaseAdmin.js';
import { optionalAuthenticate } from '../middleware/authenticate.js';
import { recordPayoutReserved, recordPayoutCompleted, recordFundsReleased } from '../services/ledgerService.js';
import dotenv from 'dotenv';

dotenv.config();

export const walletRouter = Router();

const stripeSecretKey = process.env.STRIPE_SECRET_KEY || 'dummy_stripe_secret_key';
const stripe = new Stripe(stripeSecretKey);

/**
 * GET /api/merchant/wallet/:storeId
 * Retrieve merchant balance summary
 */
walletRouter.get('/wallet/:storeId', optionalAuthenticate, async (req, res) => {
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
walletRouter.get('/wallet/:storeId/ledger', optionalAuthenticate, async (req, res) => {
  try {
    const { storeId } = req.params;
    const snapshot = await adminDb.collection('ledger_entries').get();
    const entries = [];

    snapshot.forEach((doc) => {
      const data = doc.data();
      if (data.storeId === storeId) {
        entries.push({ id: doc.id, ...data });
      }
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
walletRouter.post('/wallet/release-held-funds', optionalAuthenticate, async (req, res) => {
  try {
    const { storeId } = req.body;
    const now = new Date().toISOString();
    const ordersSnap = await adminDb.collection('orders').get();

    const releasedOrders = [];

    for (const doc of ordersSnap.docs) {
      const order = doc.data();
      if (order.storeId === storeId && order.settlementStatus === 'ON_HOLD') {
        const releaseTime = order.fundReleaseAt ? new Date(order.fundReleaseAt) : new Date(0);

        if (new Date() >= releaseTime) {
          const orderRef = adminDb.collection('orders').doc(doc.id);
          const merchantNetSatang = order.merchantNetSatang || Math.max(0, (order.totalSatang || (order.total * 100)) - (order.platformFeeSatang || 0));

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
      }
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
walletRouter.post('/payouts', optionalAuthenticate, async (req, res) => {
  try {
    const { storeId, amountSatang, bankAccountSnapshot } = req.body;

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
        bankAccountSnapshot: bankAccountSnapshot || {
          bankName: 'ธนาคารกสิกรไทย',
          accountNumberMasked: 'xxx-x-xx123-x',
          accountName: 'ร้านค้า QueueUp'
        },
        requestedBy: req.user?.uid || 'merchant-owner',
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

    // 2. Dispatch Payout (Simulated or via Stripe Connect if connected)
    setTimeout(async () => {
      try {
        await adminDb.runTransaction(async (t) => {
          t.update(payoutRef, {
            status: 'PAID',
            updatedAt: new Date().toISOString()
          });

          await recordPayoutCompleted(t, adminDb, {
            payoutId,
            storeId,
            amountSatang,
            now: new Date().toISOString()
          });
        });
        console.log(`[Payout Worker] Payout ${payoutId} completed successfully.`);
      } catch (workerErr) {
        console.error('[Payout Worker] Payout dispatch error:', workerErr);
      }
    }, 1500);

    return res.status(201).json({
      success: true,
      payoutId,
      payout: payoutRecord,
      message: 'คำขอถอนเงินถูกส่งเรียบร้อยแล้ว ยอดเงินจะโอนเข้าบัญชีภายใน 1-2 วันทำการ'
    });
  } catch (err) {
    console.error('[Payout API] Payout error:', err);
    return res.status(400).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/merchant/connect/account
 * Create Stripe Connected Account for merchant onboarding
 */
walletRouter.post('/connect/account', optionalAuthenticate, async (req, res) => {
  try {
    const { storeId, storeEmail, storeName } = req.body;

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
walletRouter.post('/connect/onboarding-link', optionalAuthenticate, async (req, res) => {
  try {
    const { accountId, returnUrl, refreshUrl } = req.body;
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
