/**
 * Express application factory.
 *
 * Kept separate from server.js so the same app can be used two ways:
 * - a long-lived process that listens on a port (local dev, Cloud Run, any VM)
 * - a serverless handler that is invoked per request (Vercel)
 *
 * A serverless platform serves the built SPA from its own CDN, so static file
 * handling is opt-out via `serveStatic`.
 */

import express from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

import { orderRouter } from './routes/orderRoutes.js';
import { paymentRouter } from './routes/paymentRoutes.js';
import { webhookRouter } from './routes/webhookRoutes.js';
import { merchantRouter } from './routes/merchantRoutes.js';
import { walletRouter } from './routes/walletRoutes.js';
import { notificationRouter } from './routes/notificationRoutes.js';
import { capacityRouter } from './routes/capacityRoutes.js';
import { chatRouter } from './routes/chatRoutes.js';
import { schoolRouter } from './routes/schoolRoutes.js';
import { catalogRouter } from './routes/catalogRoutes.js';
import { customerWalletRouter } from './routes/customerWalletRoutes.js';
import { cronRouter } from './routes/cronRoutes.js';
import { platformRouter } from './routes/platformRoutes.js';
import { firebaseAdminStatus } from './firebaseAdmin.js';
import { optionalSecret, isProduction, missingRequiredSecrets } from './config/secrets.js';
import {
  applyHardening,
  errorHandler,
  apiLimiter,
  writeLimiter,
  pinLimiter
} from './middleware/hardening.js';

const __filename = fileURLToPath(import.meta.url);
const projectRoot = path.resolve(path.dirname(__filename), '..');

/**
 * @param {object} [options]
 * @param {boolean} [options.serveStatic=true] Serve dist/ and the SPA fallback.
 *        False on platforms whose CDN already serves the build.
 * @returns {import('express').Express}
 */
export function createApp({ serveStatic = true } = {}) {
  const app = express();
  const distDir = path.join(projectRoot, 'dist');
  const indexPath = path.join(distDir, 'index.html');

  // 0. Security headers and cross-origin policy, before anything else.
  applyHardening(app);

  // 1. Mount Webhook routes with RAW body parser BEFORE express.json()
  // This is strictly required by Stripe to verify webhook cryptographic signatures.
  app.use('/api/webhooks', express.raw({ type: 'application/json' }), webhookRouter);

  // 2. Parse JSON body for all standard API requests
  app.use(express.json({ limit: '5mb' }));

  // Health check, used by platform probes, by the E2E harness, and — most
  // usefully — by whoever is trying to work out why a fresh deployment is
  // refusing requests. It reports WHICH configuration is missing by name.
  // Names and booleans only: a probe that echoed a secret's value would be a
  // far worse problem than the one it diagnoses.
  app.get(['/healthz', '/_health', '/api/health'], (req, res) => {
    const firebase = firebaseAdminStatus();
    const configured = {
      FIREBASE_SERVICE_ACCOUNT: Boolean(optionalSecret('FIREBASE_SERVICE_ACCOUNT')),
      GOOGLE_APPLICATION_CREDENTIALS: Boolean(optionalSecret('GOOGLE_APPLICATION_CREDENTIALS')),
      HMAC_SECRET: Boolean(optionalSecret('HMAC_SECRET')),
      STRIPE_SECRET_KEY: Boolean(optionalSecret('STRIPE_SECRET_KEY')),
      STRIPE_WEBHOOK_SECRET: Boolean(optionalSecret('STRIPE_WEBHOOK_SECRET')),
      CRON_SECRET: Boolean(optionalSecret('CRON_SECRET')),
      GEMINI_API_KEY: Boolean(optionalSecret('GEMINI_API_KEY'))
    };

    const missingRequired = missingRequiredSecrets().slice();
    if (!configured.FIREBASE_SERVICE_ACCOUNT && !configured.GOOGLE_APPLICATION_CREDENTIALS && !firebase.ready) {
      missingRequired.push('FIREBASE_SERVICE_ACCOUNT');
    }
    if (isProduction && !configured.STRIPE_WEBHOOK_SECRET) {
      missingRequired.push('STRIPE_WEBHOOK_SECRET');
    }

    const ready = firebase.ready && missingRequired.length === 0;

    res.status(ready ? 200 : 503).json({
      status: ready ? 'ok' : 'degraded',
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || 'development',
      database: firebase.ready
        ? (firebase.usingLocalStore ? 'local-file-store' : 'firestore')
        : 'unavailable',
      reason: firebase.reason || undefined,
      missingRequired: missingRequired.length ? missingRequired : undefined,
      configured
    });
  });

  // Every API route below touches Firestore. Without it, answer with the
  // reason rather than letting each handler fail on a null client.
  app.use('/api', (req, res, next) => {
    const firebase = firebaseAdminStatus();
    const missingSecrets = missingRequiredSecrets();

    if (firebase.ready && missingSecrets.length === 0) return next();

    return res.status(503).json({
      success: false,
      error: firebase.ready ? 'CONFIGURATION_INCOMPLETE' : 'DATABASE_UNAVAILABLE',
      message: firebase.reason
        || `Missing required environment variables: ${missingSecrets.join(', ')}.`,
      missingRequired: missingSecrets.length ? missingSecrets : undefined,
      hint: 'GET /api/health lists which environment variables are missing.'
    });
  });

  // 3. Rate limits, tightest first so the specific rules win.
  app.post('/api/merchant/orders/:id/complete', pinLimiter);
  app.post('/api/orders', writeLimiter);
  app.post('/api/chat/messages', writeLimiter);
  app.post('/api/capacity/reserve', writeLimiter);
  app.post('/api/merchant/payouts', writeLimiter);
  // Attesting or reversing a transfer is the highest-value write in the system.
  app.post('/api/merchant/payouts/:payoutId/complete', writeLimiter);
  app.post('/api/merchant/payouts/:payoutId/fail', writeLimiter);
  app.post('/api/platform/payment-exceptions/:id/resolve', writeLimiter);
  app.post('/api/schools/membership/claim', writeLimiter);
  app.use('/api', apiLimiter);

  // 4. Mount Command & Financial API routes
  app.use('/api/orders', orderRouter);
  app.use('/api/payment', paymentRouter);
  app.use('/api/merchant', merchantRouter);
  app.use('/api/merchant', walletRouter);
  app.use('/api/capacity', capacityRouter);
  app.use('/api/chat', chatRouter);
  app.use('/api/schools', schoolRouter);
  app.use('/api/catalog', catalogRouter);
  app.use('/api/wallet', customerWalletRouter);
  app.use('/api/cron', cronRouter);
  app.use('/api/platform', platformRouter);
  app.use('/api', notificationRouter);

  // Unmatched API paths must not fall through to the SPA fallback below, which
  // would answer an API client with index.html and a 200.
  app.use('/api', (req, res) => {
    res.status(404).json({
      success: false,
      error: 'NOT_FOUND',
      message: `No API route matches ${req.method} ${req.originalUrl}`
    });
  });

  if (serveStatic) {
    // Explicit route for the Firebase Messaging service worker, so the SPA
    // rewrite below cannot hijack it.
    app.get('/firebase-messaging-sw.js', (req, res) => {
      const swDistPath = path.join(distDir, 'firebase-messaging-sw.js');
      const swPublicPath = path.join(projectRoot, 'public', 'firebase-messaging-sw.js');
      const targetPath = fs.existsSync(swDistPath) ? swDistPath : swPublicPath;

      if (fs.existsSync(targetPath)) {
        res.setHeader('Content-Type', 'application/javascript; charset=UTF-8');
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        res.setHeader('Service-Worker-Allowed', '/');
        res.sendFile(targetPath);
      } else {
        res.status(404).send('Service worker file not found');
      }
    });

    app.use(express.static(distDir, { maxAge: '1h', index: false }));

    // SPA routing fallback
    app.get('*', (req, res) => {
      if (fs.existsSync(indexPath)) {
        res.sendFile(indexPath);
      } else {
        res.status(500).send('Application build in progress or failed. Please refresh shortly.');
      }
    });
  }

  // Terminal error handler: must be registered after every route.
  app.use(errorHandler);

  return app;
}
