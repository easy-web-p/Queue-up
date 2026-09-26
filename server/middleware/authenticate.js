import { adminAuth } from '../firebaseAdmin.js';

/**
 * Express Middleware: Verify Firebase ID Token
 * Decodes claims and attaches verified user info to req.user.
 */
export async function authenticate(req, res, next) {
  const authHeader = req.headers.authorization || '';

  // In development/test mode, allow mock user header without live Bearer token
  if (process.env.NODE_ENV !== 'production' && req.headers['x-mock-user-id']) {
    let mockName = req.headers['x-mock-user-name'] || 'Mock User';
    try { mockName = decodeURIComponent(mockName); } catch {}
    req.user = {
      uid: String(req.headers['x-mock-user-id']),
      email: req.headers['x-mock-user-email'] || 'test@queueup.app',
      name: mockName,
      role: req.headers['x-mock-user-role'] || 'customer',
      storeId: req.headers['x-mock-store-id'] || null,
      schoolId: req.headers['x-mock-school-id'] || 'school-default',
      admin: req.headers['x-mock-user-role'] === 'admin'
    };
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
    const decodedToken = await adminAuth.verifyIdToken(token);
    req.user = {
      uid: decodedToken.uid,
      email: decodedToken.email || '',
      name: decodedToken.name || '',
      role: decodedToken.role || 'customer',
      storeId: decodedToken.storeId || null,
      admin: !!decodedToken.admin
    };
    next();
  } catch (err) {
    // If running in development emulator or sandbox without live token
    if (process.env.NODE_ENV !== 'production' && req.headers['x-mock-user-id']) {
      req.user = {
        uid: String(req.headers['x-mock-user-id']),
        email: req.headers['x-mock-user-email'] || 'test@queueup.app',
        role: req.headers['x-mock-user-role'] || 'customer',
        storeId: req.headers['x-mock-store-id'] || null
      };
      return next();
    }

    console.warn('[Auth Middleware] Invalid Firebase token:', err.message);
    return res.status(401).json({
      success: false,
      error: 'INVALID_TOKEN',
      message: 'Firebase ID Token is expired or invalid.'
    });
  }
}

/**
 * Optional Authentication: Attaches req.user if token is present, continues otherwise.
 */
export async function optionalAuthenticate(req, res, next) {
  const authHeader = req.headers.authorization || '';

  if (process.env.NODE_ENV !== 'production' && req.headers['x-mock-user-id']) {
    let mockName = req.headers['x-mock-user-name'] || 'Mock User';
    try { mockName = decodeURIComponent(mockName); } catch {}
    req.user = {
      uid: String(req.headers['x-mock-user-id']),
      email: req.headers['x-mock-user-email'] || 'test@queueup.app',
      name: mockName,
      role: req.headers['x-mock-user-role'] || 'customer',
      storeId: req.headers['x-mock-store-id'] || null,
      schoolId: req.headers['x-mock-school-id'] || 'school-default',
      admin: req.headers['x-mock-user-role'] === 'admin'
    };
    return next();
  }

  if (!authHeader.startsWith('Bearer ')) {
    req.user = null;
    return next();
  }

  const token = authHeader.split('Bearer ')[1].trim();
  try {
    const decodedToken = await adminAuth.verifyIdToken(token);
    req.user = {
      uid: decodedToken.uid,
      email: decodedToken.email || '',
      name: decodedToken.name || '',
      role: decodedToken.role || 'customer',
      storeId: decodedToken.storeId || null,
      admin: !!decodedToken.admin
    };
  } catch {
    req.user = null;
  }
  next();
}

/**
 * Role-Based Access Control Middleware
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
