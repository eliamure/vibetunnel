import rateLimit from 'express-rate-limit';
import { createLogger } from '../utils/logger.js';

const logger = createLogger('rate-limit');

/**
 * Rate limiter for authentication endpoints
 * Limits to 5 attempts per 15 minutes per IP
 */
export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // Limit each IP to 5 requests per windowMs
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  handler: (req, res) => {
    logger.warn(
      `Rate limit exceeded for ${req.method} ${req.path} from IP: ${req.ip || 'unknown'}`
    );
    res.status(429).json({
      error: 'Too many authentication attempts, please try again later',
      retryAfter: 900, // 15 minutes in seconds
    });
  },
  skip: (req) => {
    // Skip rate limiting for localhost in development
    const isLocalhost = req.ip === '127.0.0.1' || req.ip === '::1' || req.ip === '::ffff:127.0.0.1';
    return process.env.NODE_ENV === 'development' && isLocalhost;
  },
});

/**
 * Rate limiter for general API endpoints
 * Limits to 100 requests per minute per IP
 */
export const apiRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 100, // Limit each IP to 100 requests per minute
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    logger.warn(`API rate limit exceeded for ${req.method} ${req.path} from IP: ${req.ip || 'unknown'}`);
    res.status(429).json({
      error: 'Too many requests, please slow down',
      retryAfter: 60, // 1 minute in seconds
    });
  },
  skip: (req) => {
    const isLocalhost = req.ip === '127.0.0.1' || req.ip === '::1' || req.ip === '::ffff:127.0.0.1';
    return process.env.NODE_ENV === 'development' && isLocalhost;
  },
});

/**
 * Strict rate limiter for sensitive operations
 * Limits to 3 attempts per hour per IP
 * Note: This counts all requests, not just failed ones. For more precise
 * failed-attempt tracking, implement custom logic in the auth route handler.
 */
export const strictRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    logger.error(
      `Strict rate limit exceeded for ${req.method} ${req.path} from IP: ${req.ip || 'unknown'}`
    );
    res.status(429).json({
      error: 'Too many failed attempts, account may be locked',
      retryAfter: 3600, // 1 hour in seconds
    });
  },
});
