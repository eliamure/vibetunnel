import type { Request, Response, NextFunction } from 'express';
import { z, ZodError, ZodSchema } from 'zod';
import { createLogger } from '../utils/logger.js';

const logger = createLogger('validation');

/**
 * Express middleware to validate request body against a Zod schema
 */
export function validateBody<T>(schema: ZodSchema<T>) {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      req.body = schema.parse(req.body);
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        logger.warn(`Validation error for ${req.method} ${req.path}: ${error.message}`);
        return res.status(400).json({
          error: 'Validation failed',
          details: error.issues.map((err) => ({
            path: err.path.join('.'),
            message: err.message,
          })),
        });
      }
      next(error);
    }
  };
}

/**
 * Express middleware to validate query parameters against a Zod schema
 */
export function validateQuery<T>(schema: ZodSchema<T>) {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      req.query = schema.parse(req.query) as typeof req.query;
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        logger.warn(`Query validation error for ${req.method} ${req.path}: ${error.message}`);
        return res.status(400).json({
          error: 'Invalid query parameters',
          details: error.issues.map((err) => ({
            path: err.path.join('.'),
            message: err.message,
          })),
        });
      }
      next(error);
    }
  };
}

/**
 * Express middleware to validate path parameters against a Zod schema
 */
export function validateParams<T>(schema: ZodSchema<T>) {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      req.params = schema.parse(req.params) as typeof req.params;
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        logger.warn(`Params validation error for ${req.method} ${req.path}: ${error.message}`);
        return res.status(400).json({
          error: 'Invalid path parameters',
          details: error.issues.map((err) => ({
            path: err.path.join('.'),
            message: err.message,
          })),
        });
      }
      next(error);
    }
  };
}

/**
 * Common validation schemas
 */

// Session ID validation
export const sessionIdSchema = z.object({
  sessionId: z
    .string()
    .regex(/^[a-zA-Z0-9_-]+$/, 'Session ID must be alphanumeric with dashes and underscores'),
});

// Authentication challenge request
export const authChallengeSchema = z.object({
  userId: z.string().min(1, 'User ID is required').max(255, 'User ID too long').optional(),
  publicKey: z.string().min(1, 'Public key is required').optional(),
});

// SSH key authentication request
export const sshKeyAuthSchema = z.object({
  publicKey: z.string().min(1, 'Public key is required'),
  signature: z.string().min(1, 'Signature is required'),
  challenge: z.string().min(1, 'Challenge is required'),
});

// Password authentication request
export const passwordAuthSchema = z.object({
  userId: z.string().min(1, 'User ID is required').max(255, 'User ID too long').optional(),
  username: z.string().min(1, 'Username is required').max(255, 'Username too long').optional(),
  password: z.string().min(1, 'Password is required').max(1024, 'Password too long'),
});

// Session creation request
export const createSessionSchema = z.object({
  command: z.string().optional(),
  args: z.array(z.string()).optional(),
  cwd: z.string().optional(),
  cols: z.number().int().positive().optional(),
  rows: z.number().int().positive().optional(),
  env: z.record(z.string(), z.string()).optional(),
});

// Configuration update request
export const configUpdateSchema = z.object({
  quickStartCommands: z.array(z.string()).optional(),
  repositoryPaths: z.array(z.string()).optional(),
  settings: z
    .object({
      port: z.number().int().positive().max(65535).optional(),
      authMode: z.enum(['ssh-key', 'password', 'both', 'none']).optional(),
      cleanupOnExit: z.boolean().optional(),
    })
    .optional(),
});

// Git operation request
export const gitOperationSchema = z.object({
  operation: z.enum(['status', 'log', 'diff', 'branch', 'remote']),
  path: z.string().min(1, 'Path is required'),
  args: z.array(z.string()).optional(),
});

/**
 * Input sanitization utilities
 */

/**
 * Sanitize string input to prevent XSS and injection attacks
 */
export function sanitizeString(input: string, maxLength = 1000): string {
  // Trim whitespace
  let sanitized = input.trim();

  // Enforce max length
  if (sanitized.length > maxLength) {
    sanitized = sanitized.substring(0, maxLength);
  }

  // Remove null bytes
  sanitized = sanitized.replace(/\0/g, '');

  // Remove control characters except newline, carriage return, and tab
  sanitized = sanitized.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');

  return sanitized;
}

/**
 * Sanitize file path to prevent directory traversal
 */
export function sanitizePath(inputPath: string): string {
  // Remove null bytes
  let sanitized = inputPath.replace(/\0/g, '');

  // Normalize path separators
  sanitized = sanitized.replace(/\\/g, '/');

  // Remove consecutive slashes
  sanitized = sanitized.replace(/\/+/g, '/');

  // Remove path traversal attempts
  sanitized = sanitized.replace(/\.\.+/g, '');

  // Remove leading/trailing slashes
  sanitized = sanitized.replace(/^\/+|\/+$/g, '');

  return sanitized;
}

/**
 * Validate and sanitize command for execution
 */
export function sanitizeCommand(command: string): string {
  // Remove null bytes and control characters
  let sanitized = command.replace(/\0/g, '');
  sanitized = sanitized.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');

  // Trim
  sanitized = sanitized.trim();

  // Basic validation - should not be empty after sanitization
  if (sanitized.length === 0) {
    throw new Error('Invalid command: empty after sanitization');
  }

  return sanitized;
}

/**
 * Validate IP address format
 */
export function isValidIP(ip: string): boolean {
  // IPv4 regex
  const ipv4Regex =
    /^(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;

  // IPv6 regex (simplified)
  const ipv6Regex = /^([0-9a-fA-F]{0,4}:){7}[0-9a-fA-F]{0,4}$/;

  return ipv4Regex.test(ip) || ipv6Regex.test(ip);
}
