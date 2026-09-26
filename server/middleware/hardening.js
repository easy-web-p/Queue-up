/**
 * HTTP hardening: security headers, cross-origin policy and rate limits.
 *
 * Kept in one module so the policy is reviewable in a single place rather than
 * scattered through server.js.
 */

import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { isProduction } from '../config/secrets.js';

/**
 * Content Security Policy covering what index.html and the Firebase SDK
 * actually load. It ships in report-only mode by default: a CSP that is
 * slightly too strict breaks the page silently, so enforcement is opt-in via
 * CSP_ENFORCE=true once the report stream comes back clean.
 */
const contentSecurityPolicy = {
  useDefaults: false,
  reportOnly: process.env.CSP_ENFORCE !== 'true',
  directives: {
    defaultSrc: ["'self'"],
    // Firebase compat SDK for the messaging service worker.
    scriptSrc: ["'self'", 'https://www.gstatic.com', 'https://js.stripe.com'],
    // Tailwind and the Google Fonts stylesheet inject inline styles.
    styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com', 'https://cdn.jsdelivr.net'],
    fontSrc: ["'self'", 'https://fonts.gstatic.com', 'https://cdn.jsdelivr.net', 'data:'],
    // Store photos and user uploads come from arbitrary https hosts.
    imgSrc: ["'self'", 'data:', 'blob:', 'https:'],
    connectSrc: [
      "'self'",
      'https://*.googleapis.com',
      'https://*.firebaseio.com',
      'wss://*.firebaseio.com',
      'https://*.firebasestorage.app',
      'https://api.stripe.com'
    ],
    frameSrc: ['https://js.stripe.com', 'https://checkout.stripe.com'],
    objectSrc: ["'none'"],
    baseUri: ["'self'"],
    formAction: ["'self'"],
    frameAncestors: ["'none'"]
  }
};

/**
 * Cross-origin policy.
 *
 * The SPA is served by this same Express app, so same-origin is the norm and
 * no CORS headers are needed. ALLOWED_ORIGINS opens it to a specific list when
 * the frontend is hosted separately; development allows any origin so a vite
 * dev server on another port can talk to the API.
 */
function buildCorsOptions() {
  const configured = (process.env.ALLOWED_ORIGINS || '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  if (configured.length > 0) {
    return {
      origin(origin, callback) {
        // Same-origin and non-browser callers send no Origin header.
        if (!origin || configured.includes(origin)) return callback(null, true);
        return callback(new Error(`Origin ${origin} is not allowed by CORS.`));
      },
      credentials: true
    };
  }

  if (!isProduction) return { origin: true, credentials: true };

  // Production with no explicit allowlist: same-origin only.
  return { origin: false };
}

/** Shared limiter options: return JSON, and key on the real client IP. */
const limiterDefaults = {
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: 'RATE_LIMITED',
    message: 'คำขอถี่เกินไป กรุณารอสักครู่แล้วลองใหม่อีกครั้ง'
  }
};

/** Broad ceiling for the whole API surface. */
export const apiLimiter = rateLimit({
  ...limiterDefaults,
  windowMs: 15 * 60 * 1000,
  limit: 600
});

/**
 * Tighter ceiling for endpoints that create records, send messages or move
 * money — the ones where a flood costs Firestore writes or spams a merchant.
 */
export const writeLimiter = rateLimit({
  ...limiterDefaults,
  windowMs: 60 * 1000,
  limit: 30
});

/**
 * Pickup PIN verification. The order document already locks out after 5 wrong
 * attempts; this stops an attacker spreading guesses across many orders.
 */
export const pinLimiter = rateLimit({
  ...limiterDefaults,
  windowMs: 10 * 60 * 1000,
  limit: 20,
  message: {
    success: false,
    error: 'RATE_LIMITED',
    message: 'ตรวจสอบรหัส PIN ถี่เกินไป กรุณารอสักครู่'
  }
});

/** Security headers + CORS, applied before any route. */
export function applyHardening(app) {
  app.set('trust proxy', 1);
  app.use(helmet({ contentSecurityPolicy }));
  app.use(cors(buildCorsOptions()));
}

/**
 * Terminal error handler. Express only routes to a 4-argument middleware, and
 * without one a thrown error falls through to the default HTML error page —
 * an API client then gets markup where it expected JSON.
 */
export function errorHandler(err, req, res, next) {
  if (res.headersSent) return next(err);

  if (err?.type === 'entity.parse.failed') {
    return res.status(400).json({
      success: false,
      error: 'INVALID_JSON',
      message: 'Request body is not valid JSON.'
    });
  }

  if (err?.message?.includes('not allowed by CORS')) {
    return res.status(403).json({ success: false, error: 'CORS_REJECTED', message: err.message });
  }

  console.error('[Server] Unhandled error:', err);
  return res.status(500).json({
    success: false,
    error: 'INTERNAL_ERROR',
    // Error text can carry record ids and query details; keep it out of
    // production responses and read it from the logs instead.
    message: isProduction ? 'Internal server error.' : (err?.message || 'Internal server error.')
  });
}
