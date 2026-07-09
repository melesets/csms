// Rate limiting middleware for login endpoint
// Prevents brute-force attacks by limiting failed attempts per IP
import rateLimit from 'express-rate-limit';

export const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 8,                    // 8 attempts per window
  message: { error: 'Too many login attempts. Please try again in 15 minutes.' },
  standardHeaders: true,
  legacyHeaders: false,
  validate: { ipKeyGeneratorFallback: false },
});
