// JWT authentication middleware - verifies Bearer tokens on protected routes
// Excludes /auth/login and health-check endpoints from authentication.
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'csms-fallback-secret';
const EXEMPT_PATHS = ['/api/login', '/api/auth', '/api/test-db', '/api/health'];

/**
 * Express middleware that enforces JWT authentication.
 * - Reads `Authorization: Bearer <token>` header
 * - Verifies token and attaches decoded payload to `req.user`
 * - Skips paths in EXEMPT_PATHS
 * - Returns 401 on missing/invalid token
 */
export function requireAuth(req, res, next) {
  const url = req.originalUrl.split('?')[0];

  if (EXEMPT_PATHS.some((p) => url === p || url.startsWith(p + '/'))) {
    return next();
  }

  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

  if (!token) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    const message = err.name === 'TokenExpiredError' ? 'Token expired' : 'Invalid token';
    return res.status(401).json({ error: message });
  }
}

/** Helper: generate a signed JWT (called from auth.controller.js) */
export function signToken(payload, expiresIn = '7d') {
  return jwt.sign(payload, JWT_SECRET, { expiresIn });
}
