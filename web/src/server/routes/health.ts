import { Router, type Request, type Response } from 'express';
import os from 'node:os';
import { createLogger } from '../utils/logger.js';

const logger = createLogger('health');

/**
 * System health status
 */
export interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  uptime: number;
  version: string;
  system: {
    platform: string;
    arch: string;
    nodeVersion: string;
    memoryUsage: {
      totalMB: number;
      usedMB: number;
      freeMB: number;
      percentUsed: number;
    };
    cpuUsage: {
      loadAverage: number[];
      cpuCount: number;
    };
  };
  checks: {
    memory: 'pass' | 'warn' | 'fail';
    cpu: 'pass' | 'warn' | 'fail';
    disk: 'pass' | 'warn' | 'fail';
  };
}

/**
 * Application metrics for monitoring
 */
export interface Metrics {
  timestamp: string;
  uptime: number;
  activeSessions: number;
  totalSessionsCreated: number;
  totalAuthAttempts: number;
  failedAuthAttempts: number;
  rateLimitHits: number;
  memory: {
    heapUsedMB: number;
    heapTotalMB: number;
    rssMB: number;
    externalMB: number;
  };
  system: {
    loadAverage: number[];
    freeMemoryMB: number;
    totalMemoryMB: number;
  };
}

/**
 * Metrics collector service
 */
class MetricsCollector {
  private startTime: number;
  private totalSessionsCreated: number = 0;
  private activeSessions: Set<string> = new Set();
  private totalAuthAttempts: number = 0;
  private failedAuthAttempts: number = 0;
  private rateLimitHits: number = 0;

  constructor() {
    this.startTime = Date.now();
  }

  public recordSessionStart(sessionId: string): void {
    this.activeSessions.add(sessionId);
    this.totalSessionsCreated++;
  }

  public recordSessionEnd(sessionId: string): void {
    this.activeSessions.delete(sessionId);
  }

  public recordAuthAttempt(success: boolean): void {
    this.totalAuthAttempts++;
    if (!success) {
      this.failedAuthAttempts++;
    }
  }

  public recordRateLimitHit(): void {
    this.rateLimitHits++;
  }

  public getMetrics(): Metrics {
    const memUsage = process.memoryUsage();
    const loadAvg = os.loadavg();

    return {
      timestamp: new Date().toISOString(),
      uptime: Math.floor((Date.now() - this.startTime) / 1000),
      activeSessions: this.activeSessions.size,
      totalSessionsCreated: this.totalSessionsCreated,
      totalAuthAttempts: this.totalAuthAttempts,
      failedAuthAttempts: this.failedAuthAttempts,
      rateLimitHits: this.rateLimitHits,
      memory: {
        heapUsedMB: Math.round(memUsage.heapUsed / 1024 / 1024),
        heapTotalMB: Math.round(memUsage.heapTotal / 1024 / 1024),
        rssMB: Math.round(memUsage.rss / 1024 / 1024),
        externalMB: Math.round(memUsage.external / 1024 / 1024),
      },
      system: {
        loadAverage: loadAvg,
        freeMemoryMB: Math.round(os.freemem() / 1024 / 1024),
        totalMemoryMB: Math.round(os.totalmem() / 1024 / 1024),
      },
    };
  }

  public reset(): void {
    this.totalAuthAttempts = 0;
    this.failedAuthAttempts = 0;
    this.rateLimitHits = 0;
    // Don't reset session counters as they're cumulative
  }
}

// Singleton metrics collector
let metricsCollector: MetricsCollector | null = null;

export function getMetricsCollector(): MetricsCollector {
  if (!metricsCollector) {
    metricsCollector = new MetricsCollector();
  }
  return metricsCollector;
}

/**
 * Get application version from package.json or environment
 */
const APP_VERSION = process.env.VIBETUNNEL_VERSION || '1.0.0-beta.16';

function getVersion(): string {
  return APP_VERSION;
}

/**
 * Check system health
 */
function checkSystemHealth(): HealthStatus {
  const totalMemMB = os.totalmem() / 1024 / 1024;
  const freeMemMB = os.freemem() / 1024 / 1024;
  const usedMemMB = totalMemMB - freeMemMB;
  const memPercentUsed = (usedMemMB / totalMemMB) * 100;

  const loadAvg = os.loadavg();
  const cpuCount = os.cpus().length;
  const normalizedLoad = loadAvg[0] / cpuCount;

  // Health checks
  const memoryCheck: 'pass' | 'warn' | 'fail' =
    memPercentUsed > 90 ? 'fail' : memPercentUsed > 80 ? 'warn' : 'pass';
  const cpuCheck: 'pass' | 'warn' | 'fail' =
    normalizedLoad > 0.9 ? 'fail' : normalizedLoad > 0.7 ? 'warn' : 'pass';
  const diskCheck: 'pass' | 'warn' | 'fail' = 'pass'; // TODO: Implement disk space check

  // Overall status
  let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
  const hasFail = [memoryCheck, cpuCheck, diskCheck].some(check => check === 'fail');
  const hasWarn = [memoryCheck, cpuCheck, diskCheck].some(check => check === 'warn');
  
  if (hasFail) {
    status = 'unhealthy';
  } else if (hasWarn) {
    status = 'degraded';
  }

  return {
    status,
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    version: getVersion(),
    system: {
      platform: os.platform(),
      arch: os.arch(),
      nodeVersion: process.version,
      memoryUsage: {
        totalMB: Math.round(totalMemMB),
        usedMB: Math.round(usedMemMB),
        freeMB: Math.round(freeMemMB),
        percentUsed: Math.round(memPercentUsed),
      },
      cpuUsage: {
        loadAverage: loadAvg,
        cpuCount,
      },
    },
    checks: {
      memory: memoryCheck,
      cpu: cpuCheck,
      disk: diskCheck,
    },
  };
}

/**
 * Create health and metrics routes
 */
export function createHealthRoutes(): Router {
  const router = Router();

  /**
   * Basic health check endpoint
   * GET /health
   * Returns 200 if service is running
   */
  router.get('/health', (_req: Request, res: Response) => {
    const health = checkSystemHealth();
    const statusCode = health.status === 'healthy' ? 200 : health.status === 'degraded' ? 200 : 503;

    res.status(statusCode).json({
      status: health.status,
      timestamp: health.timestamp,
      uptime: health.uptime,
      version: health.version,
    });
  });

  /**
   * Detailed health check endpoint
   * GET /health/detailed
   * Returns comprehensive system health information
   */
  router.get('/health/detailed', (_req: Request, res: Response) => {
    try {
      const health = checkSystemHealth();
      const statusCode =
        health.status === 'healthy' ? 200 : health.status === 'degraded' ? 200 : 503;

      res.status(statusCode).json(health);
    } catch (error) {
      logger.error('Error checking system health:', error);
      res.status(500).json({
        status: 'unhealthy',
        error: 'Failed to check system health',
      });
    }
  });

  /**
   * Liveness probe endpoint for Kubernetes
   * GET /health/live
   * Returns 200 if process is alive
   */
  router.get('/health/live', (_req: Request, res: Response) => {
    res.status(200).json({
      status: 'alive',
      timestamp: new Date().toISOString(),
    });
  });

  /**
   * Readiness probe endpoint for Kubernetes
   * GET /health/ready
   * Returns 200 if service is ready to accept traffic
   */
  router.get('/health/ready', (_req: Request, res: Response) => {
    const health = checkSystemHealth();
    const isReady = health.status !== 'unhealthy';

    if (isReady) {
      res.status(200).json({
        status: 'ready',
        timestamp: new Date().toISOString(),
      });
    } else {
      res.status(503).json({
        status: 'not_ready',
        timestamp: new Date().toISOString(),
        reason: 'System unhealthy',
      });
    }
  });

  /**
   * Metrics endpoint
   * GET /metrics
   * Returns application metrics (compatible with Prometheus text format)
   */
  router.get('/metrics', (_req: Request, res: Response) => {
    try {
      const metrics = getMetricsCollector().getMetrics();

      // Return Prometheus-compatible text format
      const prometheusMetrics = `
# HELP vibetunnel_uptime_seconds Application uptime in seconds
# TYPE vibetunnel_uptime_seconds gauge
vibetunnel_uptime_seconds ${metrics.uptime}

# HELP vibetunnel_active_sessions Number of active terminal sessions
# TYPE vibetunnel_active_sessions gauge
vibetunnel_active_sessions ${metrics.activeSessions}

# HELP vibetunnel_total_sessions_created Total number of sessions created
# TYPE vibetunnel_total_sessions_created counter
vibetunnel_total_sessions_created ${metrics.totalSessionsCreated}

# HELP vibetunnel_auth_attempts_total Total authentication attempts
# TYPE vibetunnel_auth_attempts_total counter
vibetunnel_auth_attempts_total ${metrics.totalAuthAttempts}

# HELP vibetunnel_auth_failures_total Failed authentication attempts
# TYPE vibetunnel_auth_failures_total counter
vibetunnel_auth_failures_total ${metrics.failedAuthAttempts}

# HELP vibetunnel_rate_limit_hits_total Rate limit hits
# TYPE vibetunnel_rate_limit_hits_total counter
vibetunnel_rate_limit_hits_total ${metrics.rateLimitHits}

# HELP vibetunnel_memory_heap_used_bytes Memory heap used in bytes
# TYPE vibetunnel_memory_heap_used_bytes gauge
vibetunnel_memory_heap_used_bytes ${metrics.memory.heapUsedMB * 1024 * 1024}

# HELP vibetunnel_memory_rss_bytes Resident set size in bytes
# TYPE vibetunnel_memory_rss_bytes gauge
vibetunnel_memory_rss_bytes ${metrics.memory.rssMB * 1024 * 1024}

# HELP vibetunnel_system_load_average System load average
# TYPE vibetunnel_system_load_average gauge
vibetunnel_system_load_average{period="1m"} ${metrics.system.loadAverage[0]}
vibetunnel_system_load_average{period="5m"} ${metrics.system.loadAverage[1]}
vibetunnel_system_load_average{period="15m"} ${metrics.system.loadAverage[2]}

# HELP vibetunnel_system_memory_free_bytes Free system memory in bytes
# TYPE vibetunnel_system_memory_free_bytes gauge
vibetunnel_system_memory_free_bytes ${metrics.system.freeMemoryMB * 1024 * 1024}
`.trim();

      res.set('Content-Type', 'text/plain; version=0.0.4; charset=utf-8');
      res.send(prometheusMetrics);
    } catch (error) {
      logger.error('Error generating metrics:', error);
      res.status(500).send('# Error generating metrics\n');
    }
  });

  /**
   * Metrics endpoint (JSON format)
   * GET /metrics/json
   * Returns application metrics in JSON format
   */
  router.get('/metrics/json', (_req: Request, res: Response) => {
    try {
      const metrics = getMetricsCollector().getMetrics();
      res.json(metrics);
    } catch (error) {
      logger.error('Error generating metrics:', error);
      res.status(500).json({ error: 'Failed to generate metrics' });
    }
  });

  return router;
}
