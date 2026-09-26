/**
 * Platform operator endpoints.
 *
 * Two things only a platform administrator can do were reachable solely by
 * hand-crafting an API call: attesting that a merchant payout actually left the
 * bank account, and clearing money that arrived but could not be applied. An
 * operation nobody can see is an operation nobody does, and both of these are
 * about real money, so they get a listing an operator can work from.
 */

import { Router } from 'express';
import { adminDb } from '../firebaseAdmin.js';
import { authenticate, requireSuperAdmin } from '../middleware/authenticate.js';

export const platformRouter = Router();

/** Sorted in memory so the endpoints work before any composite index exists. */
function byNewest(a, b) {
  return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
}

/**
 * GET /api/platform/payouts?status=REQUESTED
 * Merchant withdrawal requests across every store, newest first.
 *
 * Each row carries the store's name and the destination account, because
 * confirming a transfer means having made it — the operator needs to see what
 * they are attesting to.
 */
platformRouter.get('/payouts', authenticate, requireSuperAdmin, async (req, res) => {
  try {
    const status = String(req.query.status || '').trim().toUpperCase();
    const limit = Math.min(Number(req.query.limit) || 100, 300);

    const snap = await adminDb.collection('payout_requests').get();
    let payouts = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    if (status) payouts = payouts.filter((p) => String(p.status).toUpperCase() === status);
    payouts.sort(byNewest);
    payouts = payouts.slice(0, limit);

    // Store names, one lookup per distinct store rather than per row.
    const storeIds = [...new Set(payouts.map((p) => p.storeId).filter(Boolean))];
    const storeNames = {};
    await Promise.all(storeIds.map(async (storeId) => {
      const storeSnap = await adminDb.collection('stores').doc(storeId).get();
      storeNames[storeId] = storeSnap.exists ? (storeSnap.data().name || storeId) : storeId;
    }));

    return res.status(200).json({
      success: true,
      payouts: payouts.map((p) => ({ ...p, storeName: storeNames[p.storeId] || p.storeId })),
      counts: {
        requested: payouts.filter((p) => p.status === 'REQUESTED').length,
        returned: payouts.length
      }
    });
  } catch (err) {
    console.error('[Platform API] List payouts error:', err);
    return res.status(500).json({ success: false, error: 'PAYOUT_LIST_FAILED', message: err.message });
  }
});

/**
 * GET /api/platform/payment-exceptions?status=OPEN
 * Money that arrived and could not be applied to its order.
 */
platformRouter.get('/payment-exceptions', authenticate, requireSuperAdmin, async (req, res) => {
  try {
    const status = String(req.query.status || 'OPEN').trim().toUpperCase();
    const limit = Math.min(Number(req.query.limit) || 100, 300);

    const snap = await adminDb.collection('payment_exceptions').get();
    let exceptions = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    if (status !== 'ALL') {
      exceptions = exceptions.filter((e) => String(e.status).toUpperCase() === status);
    }
    exceptions.sort(byNewest);

    return res.status(200).json({
      success: true,
      exceptions: exceptions.slice(0, limit),
      openCount: exceptions.filter((e) => e.status === 'OPEN').length
    });
  } catch (err) {
    console.error('[Platform API] List payment exceptions error:', err);
    return res.status(500).json({ success: false, error: 'EXCEPTION_LIST_FAILED', message: err.message });
  }
});

/**
 * POST /api/platform/payment-exceptions/:id/resolve
 * Records that an operator has dealt with one — refunded it at the gateway,
 * reconciled it by hand, or decided it needed nothing.
 *
 * Resolving does not move money. It records a decision and who made it, so the
 * queue reflects what is still outstanding rather than everything that ever was.
 */
platformRouter.post('/payment-exceptions/:id/resolve', authenticate, requireSuperAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { note = '', action = 'RECONCILED' } = req.body || {};
    const ref = adminDb.collection('payment_exceptions').doc(id);
    const snap = await ref.get();

    if (!snap.exists) {
      return res.status(404).json({ success: false, error: 'EXCEPTION_NOT_FOUND' });
    }
    if (snap.data().status === 'RESOLVED') {
      return res.status(200).json({ success: true, alreadyResolved: true, exception: snap.data() });
    }

    const now = new Date().toISOString();
    await ref.set({
      status: 'RESOLVED',
      resolvedAction: String(action).slice(0, 40),
      resolvedNote: String(note).slice(0, 500),
      resolvedBy: req.user.uid,
      resolvedByEmail: req.user.email || null,
      resolvedAt: now,
      updatedAt: now
    }, { merge: true });

    return res.status(200).json({
      success: true,
      exception: { id, ...snap.data(), status: 'RESOLVED', resolvedAt: now }
    });
  } catch (err) {
    console.error('[Platform API] Resolve exception error:', err);
    return res.status(500).json({ success: false, error: 'EXCEPTION_RESOLVE_FAILED', message: err.message });
  }
});
