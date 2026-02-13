import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { createLogger } from '../utils/logger.js';

const logger = createLogger('audit');

/**
 * Audit event severity levels
 */
export enum AuditSeverity {
  INFO = 'INFO',
  WARNING = 'WARNING',
  ERROR = 'ERROR',
  CRITICAL = 'CRITICAL',
}

/**
 * Audit event categories
 */
export enum AuditCategory {
  AUTHENTICATION = 'AUTHENTICATION',
  AUTHORIZATION = 'AUTHORIZATION',
  SESSION = 'SESSION',
  CONFIGURATION = 'CONFIGURATION',
  ACCESS = 'ACCESS',
  SECURITY = 'SECURITY',
  SYSTEM = 'SYSTEM',
}

/**
 * Structured audit event
 */
export interface AuditEvent {
  timestamp: string;
  severity: AuditSeverity;
  category: AuditCategory;
  action: string;
  userId?: string;
  sessionId?: string;
  sourceIp?: string;
  userAgent?: string;
  resource?: string;
  result: 'SUCCESS' | 'FAILURE' | 'DENIED';
  details?: Record<string, unknown>;
  message: string;
}

/**
 * Audit logging configuration
 */
export interface AuditLogConfig {
  enabled: boolean;
  logFile: string;
  maxFileSize: number; // in bytes
  maxFiles: number;
  logToConsole: boolean;
  logToSyslog: boolean;
  minSeverity: AuditSeverity;
}

const DEFAULT_CONFIG: AuditLogConfig = {
  enabled: true,
  logFile: path.join(os.homedir(), '.vibetunnel', 'audit.log'),
  maxFileSize: 100 * 1024 * 1024, // 100MB
  maxFiles: 10,
  logToConsole: false,
  logToSyslog: false,
  minSeverity: AuditSeverity.INFO,
};

/**
 * Audit logger service
 */
export class AuditLogger {
  private config: AuditLogConfig;
  private fileStream?: fs.WriteStream;
  private currentFileSize: number = 0;

  constructor(config?: Partial<AuditLogConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.initializeLogFile();
  }

  private initializeLogFile(): void {
    if (!this.config.enabled) {
      return;
    }

    // Ensure directory exists
    const logDir = path.dirname(this.config.logFile);
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true });
    }

    // Check current file size
    try {
      const stats = fs.statSync(this.config.logFile);
      this.currentFileSize = stats.size;

      // Rotate if needed
      if (this.currentFileSize >= this.config.maxFileSize) {
        this.rotateLogFile();
      }
    } catch {
      // File doesn't exist yet
      this.currentFileSize = 0;
    }

    // Open file stream in append mode
    this.fileStream = fs.createWriteStream(this.config.logFile, { flags: 'a' });
  }

  private rotateLogFile(): void {
    if (!this.fileStream) {
      return;
    }

    // Close current stream
    this.fileStream.end();

    // Rotate existing log files
    for (let i = this.config.maxFiles - 1; i >= 1; i--) {
      const oldFile = `${this.config.logFile}.${i}`;
      const newFile = `${this.config.logFile}.${i + 1}`;

      if (fs.existsSync(oldFile)) {
        if (i === this.config.maxFiles - 1) {
          // Delete oldest file
          fs.unlinkSync(oldFile);
        } else {
          fs.renameSync(oldFile, newFile);
        }
      }
    }

    // Rename current log file
    if (fs.existsSync(this.config.logFile)) {
      fs.renameSync(this.config.logFile, `${this.config.logFile}.1`);
    }

    // Create new log file
    this.currentFileSize = 0;
    this.fileStream = fs.createWriteStream(this.config.logFile, { flags: 'a' });
  }

  /**
   * Log an audit event
   */
  public log(event: AuditEvent): void {
    if (!this.config.enabled) {
      return;
    }

    // Check severity filter
    const severityOrder = {
      [AuditSeverity.INFO]: 0,
      [AuditSeverity.WARNING]: 1,
      [AuditSeverity.ERROR]: 2,
      [AuditSeverity.CRITICAL]: 3,
    };

    if (severityOrder[event.severity] < severityOrder[this.config.minSeverity]) {
      return;
    }

    // Format as JSON
    const logLine = JSON.stringify(event) + '\n';

    // Write to file
    if (this.fileStream) {
      this.fileStream.write(logLine);
      this.currentFileSize += logLine.length;

      // Check if rotation is needed
      if (this.currentFileSize >= this.config.maxFileSize) {
        this.rotateLogFile();
      }
    }

    // Log to console if enabled
    if (this.config.logToConsole) {
      switch (event.severity) {
        case AuditSeverity.INFO:
          logger.info(event.message);
          break;
        case AuditSeverity.WARNING:
          logger.warn(event.message);
          break;
        case AuditSeverity.ERROR:
        case AuditSeverity.CRITICAL:
          logger.error(event.message);
          break;
      }
    }

    // Log to syslog if enabled (placeholder for future implementation)
    if (this.config.logToSyslog) {
      // TODO: Implement syslog integration
    }
  }

  /**
   * Convenience methods for logging common audit events
   */

  public logAuthSuccess(userId: string, method: string, sourceIp?: string, userAgent?: string): void {
    this.log({
      timestamp: new Date().toISOString(),
      severity: AuditSeverity.INFO,
      category: AuditCategory.AUTHENTICATION,
      action: 'LOGIN',
      userId,
      sourceIp,
      userAgent,
      result: 'SUCCESS',
      message: `User ${userId} authenticated successfully using ${method}`,
      details: { method },
    });
  }

  public logAuthFailure(
    userId: string | undefined,
    method: string,
    reason: string,
    sourceIp?: string,
    userAgent?: string
  ): void {
    this.log({
      timestamp: new Date().toISOString(),
      severity: AuditSeverity.WARNING,
      category: AuditCategory.AUTHENTICATION,
      action: 'LOGIN_FAILED',
      userId,
      sourceIp,
      userAgent,
      result: 'FAILURE',
      message: `Authentication failed for user ${userId || 'unknown'}: ${reason}`,
      details: { method, reason },
    });
  }

  public logSessionStart(
    sessionId: string,
    userId: string,
    command?: string,
    sourceIp?: string
  ): void {
    this.log({
      timestamp: new Date().toISOString(),
      severity: AuditSeverity.INFO,
      category: AuditCategory.SESSION,
      action: 'SESSION_START',
      userId,
      sessionId,
      sourceIp,
      result: 'SUCCESS',
      message: `Session ${sessionId} started by ${userId}`,
      details: { command },
    });
  }

  public logSessionEnd(sessionId: string, userId: string, exitCode?: number): void {
    this.log({
      timestamp: new Date().toISOString(),
      severity: AuditSeverity.INFO,
      category: AuditCategory.SESSION,
      action: 'SESSION_END',
      userId,
      sessionId,
      result: 'SUCCESS',
      message: `Session ${sessionId} ended for ${userId}`,
      details: { exitCode },
    });
  }

  public logAccessDenied(
    resource: string,
    userId?: string,
    reason?: string,
    sourceIp?: string
  ): void {
    this.log({
      timestamp: new Date().toISOString(),
      severity: AuditSeverity.ERROR,
      category: AuditCategory.AUTHORIZATION,
      action: 'ACCESS_DENIED',
      userId,
      sourceIp,
      resource,
      result: 'DENIED',
      message: `Access denied to ${resource} for ${userId || 'unknown user'}`,
      details: { reason },
    });
  }

  public logConfigChange(userId: string, setting: string, oldValue?: unknown, newValue?: unknown): void {
    this.log({
      timestamp: new Date().toISOString(),
      severity: AuditSeverity.WARNING,
      category: AuditCategory.CONFIGURATION,
      action: 'CONFIG_CHANGE',
      userId,
      result: 'SUCCESS',
      message: `Configuration changed by ${userId}: ${setting}`,
      details: { setting, oldValue, newValue },
    });
  }

  public logSecurityEvent(
    event: string,
    severity: AuditSeverity,
    details?: Record<string, unknown>,
    sourceIp?: string
  ): void {
    this.log({
      timestamp: new Date().toISOString(),
      severity,
      category: AuditCategory.SECURITY,
      action: 'SECURITY_EVENT',
      sourceIp,
      result: severity === AuditSeverity.INFO ? 'SUCCESS' : 'FAILURE',
      message: `Security event: ${event}`,
      details,
    });
  }

  /**
   * Close the audit logger
   */
  public close(): void {
    if (this.fileStream) {
      this.fileStream.end();
      this.fileStream = undefined;
    }
  }
}

// Singleton instance
let auditLoggerInstance: AuditLogger | null = null;

/**
 * Get or create the audit logger instance
 */
export function getAuditLogger(config?: Partial<AuditLogConfig>): AuditLogger {
  if (!auditLoggerInstance) {
    auditLoggerInstance = new AuditLogger(config);
  }
  return auditLoggerInstance;
}

/**
 * Initialize audit logger with custom config
 */
export function initAuditLogger(config?: Partial<AuditLogConfig>): AuditLogger {
  if (auditLoggerInstance) {
    auditLoggerInstance.close();
  }
  auditLoggerInstance = new AuditLogger(config);
  return auditLoggerInstance;
}
