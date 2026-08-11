// Rate limiting middleware for login endpoint
// Disabled for internal hospital network — all requests share one IP via nginx proxy
import rateLimit from 'express-rate-limit';

export const loginLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,  // 1 minute window
  max: 100,                  // generous limit for internal network
  message: { error: 'Too many login attempts. Please wait a moment and try again.' },
  standardHeaders: true,
  legacyHeaders: false,
  // Skip rate limiting for localhost/nginx proxy (all hospital users share one IP)
  skip: (req) => {
    const ip = req.ip || req.connection?.remoteAddress || '';
    return ip === '127.0.0.1' || ip === '::1' || ip === '::ffff:127.0.0.1';
  },
});
