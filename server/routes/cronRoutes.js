/**
 * Scheduled job endpoints.
 *
 * The standalone server runs the pickup reminder on a setInterval, which a
 * serverless deployment has no equivalent for: a function instance only exists
 * while a request is in flight. Exposing the same check as an endpoint lets a
 * platform scheduler (Vercel Cron, Cloud Scheduler, or any external pinger)
 * drive it instead.
 *
 * The underlying check is idempotent — it skips orders already flagged
 * pickupReminderSent — so an overlapping or repeated invocation is harmless.
 */

import { Router } from 'express';
import { runPickupReminderCheck } from '../services/pickupReminderWorker.js';
import { runStaleOrderSweep, releaseDueHeldFunds } from '../services/settlementSweeps.js';
import { isProduction } from '../config/secrets.js';

export const cronRouter = Router();

/**
 * Cron endpoints are internet-reachable, so they authenticate with a shared
 * secret. Vercel Cron sends it as `Authorization: Bearer $CRON_SECRET`.
 */
function authorizeCron(req, res) {
  const secret = (process.env.CRON_SECRET || '').trim();

  if (!secret) {
    if (isProduction) {
      res.status(503).json({
        success: false,
        error: 'CRON_NOT_CONFIGURED',
        message: 'CRON_SECRET is not set on this deployment.'
      });
      return false;
    }
    // Development convenience: no secret configured, no secret required.
    return true;
  }

  const header = req.headers.authorization || '';
  const provided = header.startsWith('Bearer ') ? header.slice(7).trim() : '';

  if (provided !== secret) {
    res.status(401).json({ success: false, error: 'UNAUTHORIZED' });
    return false;
  }
  return true;
}

/**
 * GET|POST /api/cron/pickup-reminders
 * Notifies customers whose food has been ready for more than five minutes.
 */
async function handlePickupReminders(req, res) {
  if (!authorizeCron(req, res)) return;

  try {
    const startedAt = Date.now();
    await runPickupReminderCheck();
    return res.status(200).json({
      success: true,
      job: 'pickup-reminders',
      durationMs: Date.now() - startedAt
    });
  } catch (err) {
    console.error('[Cron] Pickup reminder run failed:', err);
    return res.status(500).json({ success: false, error: 'CRON_RUN_FAILED', message: err.message });
  }
}

cronRouter.get('/pickup-reminders', handlePickupReminders);
cronRouter.post('/pickup-reminders', handlePickupReminders);

/**
 * GET|POST /api/cron/settlement
 * Returns money nobody is holding on purpose: refunds orders whose merchant
 * never answered, drops abandoned unpaid orders so they stop holding a pickup
 * slot, and releases merchant funds whose hold period has elapsed.
 */
async function handleSettlement(req, res) {
  if (!authorizeCron(req, res)) return;

  try {
    const startedAt = Date.now();
    const stale = await runStaleOrderSweep();
    const released = await releaseDueHeldFunds();

    return res.status(200).json({
      success: true,
      job: 'settlement',
      expiredPaidOrders: stale.expiredPaid.length,
      expiredUnpaidOrders: stale.expiredUnpaid.length,
      refundedSatang: stale.refundedSatang,
      releasedOrders: released.releasedOrders.length,
      releasedSatang: released.releasedSatang,
      durationMs: Date.now() - startedAt
    });
  } catch (err) {
    console.error('[Cron] Settlement sweep failed:', err);
    return res.status(500).json({ success: false, error: 'CRON_RUN_FAILED', message: err.message });
  }
}

cronRouter.get('/settlement', handleSettlement);
cronRouter.post('/settlement', handleSettlement);
