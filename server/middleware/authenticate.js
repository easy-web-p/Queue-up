import { adminAuth, adminDb } from '../firebaseAdmin.js';
import { isProduction } from '../config/secrets.js';

/**
 * Header-based mock identity is a development affordance ONLY.
 *
 * It is opt-in via ALLOW_MOCK_AUTH=true and is additionally refused whenever
 * NODE_ENV=production, so a deployment that forgets to set NODE_ENV cannot
 * accidentally leave it enabled. When it is off, x-mock-* headers carry no
 * authority at all: callers without a verified Firebase ID token are treated
 * as anonymous guests.
 */
function mockAuthEnabled() {
  return process.env.ALLOW_MOCK_AUTH === 'true' && !isProduction;
}

if (process.env.ALLOW_MOCK_AUTH === 'true' && isProduction) {
  console.warn('[Auth Middleware] ALLOW_MOCK_AUTH is ignored because NODE_ENV=production.');
}

/**
 * Builds a req.user from x-mock-* headers. Only ever called when
 * mockAuthEnabled() is true.
 */
function buildMockUser(req) {
  let mockName = req.headers['x-mock-user-name'] || 'Mock User';
  try { mockName = decodeURIComponent(mockName); } catch { /* keep raw value */ }

  const role = req.headers['x-mock-user-role'] || 'customer';
  return {
    uid: String(req.headers['x-mock-user-id']),
    email: req.headers['x-mock-user-email'] || 'test@queueup.app',
    name: mockName,
    role,
    storeId: req.headers['x-mock-store-id'] || null,
    schoolId: req.headers['x-mock-school-id'] || 'school-default',
    admin: role === 'admin',
    // Mock auth is an explicit, opt-in development mode, so the identity it
    // produces is accepted as authentic; isMock records where it came from.
    verified: true,
    isMock: true
  };
}

function buildVerifiedUser(decodedToken) {
  return {
    uid: decodedToken.uid,
    email: decodedToken.email || '',
    name: decodedToken.name || '',
    role: decodedToken.role || 'customer',
    storeId: decodedToken.storeId || null,
    schoolId: decodedToken.schoolId || null,
    admin: decodedToken.admin === true || decodedToken.role === 'super_admin',
    verified: true,
    isMock: false
  };
}

/**
 * Express Middleware: Verify Firebase ID Token.
 * Decodes claims and attaches verified user info to req.user.
 */
export async function authenticate(req, res, next) {
  const authHeader = req.headers.authorization || '';

  if (mockAuthEnabled() && req.headers['x-mock-user-id']) {
    req.user = buildMockUser(req);
    return next();
  }

  if (!authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      success: false,
      error: 'UNAUTHORIZED',
      message: 'Missing or malformed Authorization header with Bearer token.'
    });
  }

  const token = authHeader.split('Bearer ')[1].trim();

  try {
    req.user = buildVerifiedUser(await adminAuth.verifyIdToken(token));
    return next();
  } catch (err) {
    console.warn('[Auth Middleware] Invalid Firebase token:', err.message);
    return res.status(401).json({
      success: false,
      error: 'INVALID_TOKEN',
      message: 'Firebase ID Token is expired or invalid.'
    });
  }
}

/**
 * Optional Authentication: attaches req.user when a token is present and valid,
 * continues as an anonymous guest (req.user = null) otherwise.
 *
 * Routes using this MUST NOT grant any privilege based on request-supplied
 * identity fields — see requireRole / requireStoreOwnership.
 */
export async function optionalAuthenticate(req, res, next) {
  const authHeader = req.headers.authorization || '';

  if (mockAuthEnabled() && req.headers['x-mock-user-id']) {
    req.user = buildMockUser(req);
    return next();
  }

  if (!authHeader.startsWith('Bearer ')) {
    req.user = null;
    return next();
  }

  const token = authHeader.split('Bearer ')[1].trim();
  try {
    req.user = buildVerifiedUser(await adminAuth.verifyIdToken(token));
  } catch {
    req.user = null;
  }
  return next();
}

/**
 * Platform super admins.
 *
 * Mirrors the break-glass clause in firestore.rules so the two tiers agree on
 * who may approve a school or issue custom claims. Configure the real list via
 * SUPER_ADMIN_EMAILS; the default keeps the address the rules already trust.
 */
function superAdminEmails() {
  return (process.env.SUPER_ADMIN_EMAILS || 'hi00000087@gmail.com')
    .split(',')
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}

/** True for accounts carrying an admin claim, or on the configured allowlist. */
export function isSuperAdmin(user) {
  if (!user || user.verified !== true) return false;
  if (user.admin === true || user.role === 'super_admin') return true;
  return Boolean(user.email) && superAdminEmails().includes(user.email.toLowerCase());
}

/** Guards endpoints that administer the platform itself. */
export function requireSuperAdmin(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ success: false, error: 'UNAUTHORIZED' });
  }
  if (!isSuperAdmin(req.user)) {
    return res.status(403).json({
      success: false,
      error: 'FORBIDDEN',
      message: 'This action is restricted to platform administrators.'
    });
  }
  return next();
}

/**
 * Guards endpoints scoped to one institution: the school's own admin, or a
 * platform admin.
 */
export function requireSchoolAdmin(resolveSchoolId = (req) => req.params?.schoolId) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ success: false, error: 'UNAUTHORIZED' });
    }
    if (isSuperAdmin(req.user)) return next();

    const schoolId = resolveSchoolId(req);
    if (!schoolId) {
      return res.status(400).json({ success: false, error: 'MISSING_SCHOOL_ID' });
    }
    if (req.user.role === 'admin' && req.user.schoolId === schoolId) return next();

    return res.status(403).json({
      success: false,
      error: 'FORBIDDEN',
      message: 'You do not administer this institution.'
    });
  };
}

/**
 * Role-Based Access Control Middleware.
 */
export function requireRole(allowedRoles = []) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ success: false, error: 'UNAUTHORIZED' });
    }
    if (req.user.admin || allowedRoles.includes(req.user.role)) {
      return next();
    }
    return res.status(403).json({
      success: false,
      error: 'FORBIDDEN',
      message: 'You do not have permission to perform this action.'
    });
  };
}

/** Default resolver: reads storeId from route params, body, then query. */
export function storeIdFromRequest(req) {
  return req.params?.storeId || req.body?.storeId || req.query?.storeId || null;
}

/** Resolver for order-scoped routes: reads the order's storeId. */
export async function storeIdFromOrderParam(req) {
  const orderId = req.params?.id || req.params?.orderId;
  if (!orderId) return null;
  const snap = await adminDb.collection('orders').doc(orderId).get();
  // A missing order yields null; the handler reports 404 from inside its own
  // transaction, where the read is consistent with the write.
  return snap.exists ? (snap.data().storeId || null) : null;
}

/**
 * True when the user is a platform admin, the store's owner, or an account
 * whose custom claims pin it to that store (the staff model in firestore.rules).
 *
 * @param {object|null} user req.user
 * @param {string|null} storeId
 * @returns {Promise<boolean>}
 */
export async function isStoreOperator(user, storeId) {
  if (!user || user.verified !== true || !storeId) return false;
  if (user.admin) return true;
  if (user.storeId && user.storeId === storeId) return true;

  const snap = await adminDb.collection('stores').doc(storeId).get();
  return snap.exists && snap.data().ownerId === user.uid;
}

/**
 * Authorises the caller as an operator of the store the request targets.
 *
 * Accepts: platform admins, the store's ownerId, and accounts whose custom
 * claims pin them to that storeId (the staff model used by firestore.rules).
 *
 * @param {(req: import('express').Request) => string|null|Promise<string|null>} resolveStoreId
 */
export function requireStoreOwnership(resolveStoreId = storeIdFromRequest) {
  return async (req, res, next) => {
    try {
      if (!req.user || req.user.verified !== true) {
        return res.status(401).json({
          success: false,
          error: 'UNAUTHORIZED',
          message: 'This action requires a signed-in merchant account.'
        });
      }

      const storeId = await resolveStoreId(req);
      if (!storeId) {
        return res.status(400).json({
          success: false,
          error: 'MISSING_STORE_ID',
          message: 'Could not determine which store this request targets.'
        });
      }

      if (!(await isStoreOperator(req.user, storeId))) {
        return res.status(403).json({
          success: false,
          error: 'FORBIDDEN',
          message: 'You do not operate this store.'
        });
      }

      req.storeId = storeId;
      return next();
    } catch (err) {
      console.error('[Auth Middleware] Store ownership check failed:', err);
      return res.status(500).json({ success: false, error: 'AUTHORIZATION_CHECK_FAILED' });
    }
  };
}

export { mockAuthEnabled };
