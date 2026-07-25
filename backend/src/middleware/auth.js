// JWT authentication middleware - verifies Bearer tokens on protected routes
// Excludes /auth/login and health-check endpoints from authentication.
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'csms-fallback-secret';
const EXEMPT_PATHS = ['/api/login', '/api/logout', '/api/auth', '/api/test-db', '/api/health'];

// Role hierarchy: higher number = more privileges
const ROLE_HIERARCHY = {
  staff: 1,
  user: 2,
  admin: 3,
  superadmin: 4,
};

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

/**
 * Middleware factory: requires the user to have at least the specified role.
 * Usage: router.get('/admin-only', requireAuth, requireRole('admin'), handler)
 * 
 * Role hierarchy: staff(1) < user(2) < admin(3) < superadmin(4)
 */
export function requireRole(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const userRole = req.user.role;
    if (!allowedRoles.includes(userRole)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    next();
  };
}

/**
 * Middleware factory: requires the user's role level to be >= specified level.
 * More flexible than requireRole - allows any higher role.
 * Usage: router.get('/admin+', requireAuth, requireRoleLevel('admin'), handler)
 * 
 * This means admin AND superadmin can access.
 */
export function requireRoleLevel(minRole) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const userLevel = ROLE_HIERARCHY[req.user.role] || 0;
    const requiredLevel = ROLE_HIERARCHY[minRole] || 0;

    if (userLevel < requiredLevel) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    next();
  };
}

/** Helper: generate a signed JWT (called from auth.controller.js) */
export function signToken(payload, expiresIn = '7d') {
  return jwt.sign(payload, JWT_SECRET, { expiresIn });
}
