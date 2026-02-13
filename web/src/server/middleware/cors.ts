import type { Request } from 'express';
import { createLogger } from '../utils/logger.js';

const logger = createLogger('cors');

export interface CorsConfig {
  allowedOrigins?: string[];
  allowCredentials?: boolean;
  maxAge?: number;
  allowedHeaders?: string[];
  exposedHeaders?: string[];
  allowedMethods?: string[];
}

const DEFAULT_CONFIG: Required<CorsConfig> = {
  allowedOrigins: ['*'], // Allow all origins by default (configure in production)
  allowCredentials: true,
  maxAge: 86400, // 24 hours
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'X-Requested-With',
    'X-VibeTunnel-Local',
    'Accept',
    'Origin',
  ],
  exposedHeaders: ['X-Total-Count', 'X-Session-ID'],
  allowedMethods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS', 'HEAD'],
};

/**
 * Check if origin is allowed based on configuration
 */
function isOriginAllowed(origin: string | undefined, allowedOrigins: string[]): boolean {
  // If no origin (same-origin requests), allow
  if (!origin) {
    return true;
  }

  // If wildcard is in allowed origins, allow all
  if (allowedOrigins.includes('*')) {
    return true;
  }

  // Check exact match
  if (allowedOrigins.includes(origin)) {
    return true;
  }

  // Check wildcard patterns (e.g., "https://*.example.com")
  for (const pattern of allowedOrigins) {
    if (pattern.includes('*')) {
      // Escape all special regex characters, then replace \* with .*
      const escapedPattern = pattern
        .replace(/[.+?^${}()|[\]\\]/g, '\\$&')  // Escape all special chars including backslash
        .replace(/\\\*/g, '.*');  // Replace escaped * with .*
      const regex = new RegExp('^' + escapedPattern + '$');
      if (regex.test(origin)) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Create CORS middleware with security configuration
 */
export function createCorsMiddleware(config?: CorsConfig) {
  const finalConfig = { ...DEFAULT_CONFIG, ...config };

  // Log CORS configuration
  if (finalConfig.allowedOrigins.includes('*')) {
    logger.warn(
      'CORS configured to allow all origins (*). This is not recommended for production.'
    );
  } else {
    logger.info(`CORS configured with allowed origins: ${finalConfig.allowedOrigins.join(', ')}`);
  }

  return (req: Request, res: any, next: () => void) => {
    const origin = req.headers.origin;

    // Check if origin is allowed
    if (isOriginAllowed(origin, finalConfig.allowedOrigins)) {
      // Set CORS headers
      if (origin) {
        res.setHeader('Access-Control-Allow-Origin', origin);
      } else if (finalConfig.allowedOrigins.includes('*')) {
        res.setHeader('Access-Control-Allow-Origin', '*');
      }

      if (finalConfig.allowCredentials) {
        res.setHeader('Access-Control-Allow-Credentials', 'true');
      }

      res.setHeader('Access-Control-Allow-Methods', finalConfig.allowedMethods.join(', '));
      res.setHeader('Access-Control-Allow-Headers', finalConfig.allowedHeaders.join(', '));
      res.setHeader('Access-Control-Expose-Headers', finalConfig.exposedHeaders.join(', '));
      res.setHeader('Access-Control-Max-Age', String(finalConfig.maxAge));

      // Handle preflight requests
      if (req.method === 'OPTIONS') {
        return res.status(204).end();
      }
    } else {
      logger.warn(`CORS: Origin ${origin} not allowed`);
    }

    next();
  };
}

/**
 * Parse allowed origins from environment variable
 * Format: comma-separated list of origins or patterns
 * Example: "https://example.com,https://*.example.com,http://localhost:*"
 */
export function parseAllowedOrigins(envVar: string | undefined): string[] | undefined {
  if (!envVar) {
    return undefined;
  }

  return envVar
    .split(',')
    .map((o) => o.trim())
    .filter((o) => o.length > 0);
}
