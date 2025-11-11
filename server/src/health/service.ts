/**
 * Health Check Service
 * Provides detailed health status for all system components
 */

import { DatabaseManager } from '../database/manager';
import { PrometheusMetrics } from '../monitoring/metrics';
import { logger } from '../utils/logger';

export interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  uptime: number;
  components: {
    [key: string]: ComponentHealth;
  };
}

export interface ComponentHealth {
  status: 'healthy' | 'degraded' | 'unhealthy';
  message?: string;
  latency?: number;
  details?: any;
}

export class HealthService {
  private startTime: number;

  constructor(
    private databaseManager?: DatabaseManager,
    private metrics?: PrometheusMetrics
  ) {
    this.startTime = Date.now();
    logger.info('Health service initialized');
  }

  /**
   * Get overall health status
   */
  async getHealth(): Promise<HealthStatus> {
    const components: { [key: string]: ComponentHealth } = {};

    // Check database
    if (this.databaseManager) {
      components.database = await this.checkDatabase();
    }

    // Check memory
    components.memory = this.checkMemory();

    // Check metrics
    if (this.metrics) {
      components.metrics = this.checkMetrics();
    }

    // Determine overall status
    const componentStatuses = Object.values(components).map(c => c.status);
    let overallStatus: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';

    if (componentStatuses.some(s => s === 'unhealthy')) {
      overallStatus = 'unhealthy';
    } else if (componentStatuses.some(s => s === 'degraded')) {
      overallStatus = 'degraded';
    }

    return {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      uptime: Math.floor((Date.now() - this.startTime) / 1000),
      components,
    };
  }

  /**
   * Simple readiness check
   */
  async isReady(): Promise<boolean> {
    const health = await this.getHealth();
    return health.status !== 'unhealthy';
  }

  /**
   * Simple liveness check
   */
  isAlive(): boolean {
    return true; // If this code runs, we're alive
  }

  /**
   * Check database health
   */
  private async checkDatabase(): Promise<ComponentHealth> {
    try {
      const start = Date.now();

      // Try to get stats from database
      const stats = await this.databaseManager!.getStats();
      const latency = Date.now() - start;

      if (!stats) {
        return {
          status: 'degraded',
          message: 'Database stats unavailable',
          latency,
        };
      }

      // Check if latency is acceptable
      if (latency > 1000) {
        return {
          status: 'degraded',
          message: 'Database responding slowly',
          latency,
          details: stats,
        };
      }

      return {
        status: 'healthy',
        message: 'Database operational',
        latency,
        details: stats,
      };
    } catch (error: any) {
      logger.error('Database health check failed:', error);
      return {
        status: 'unhealthy',
        message: `Database error: ${error.message}`,
      };
    }
  }

  /**
   * Check memory health
   */
  private checkMemory(): ComponentHealth {
    const usage = process.memoryUsage();
    const heapUsedMB = Math.round(usage.heapUsed / 1024 / 1024);
    const heapTotalMB = Math.round(usage.heapTotal / 1024 / 1024);
    const heapUsagePercent = (usage.heapUsed / usage.heapTotal) * 100;

    let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
    let message = 'Memory usage normal';

    if (heapUsagePercent > 90) {
      status = 'unhealthy';
      message = 'Critical memory usage';
    } else if (heapUsagePercent > 75) {
      status = 'degraded';
      message = 'High memory usage';
    }

    return {
      status,
      message,
      details: {
        heapUsed: `${heapUsedMB} MB`,
        heapTotal: `${heapTotalMB} MB`,
        heapUsagePercent: `${heapUsagePercent.toFixed(1)}%`,
        rss: `${Math.round(usage.rss / 1024 / 1024)} MB`,
        external: `${Math.round(usage.external / 1024 / 1024)} MB`,
      },
    };
  }

  /**
   * Check metrics health
   */
  private checkMetrics(): ComponentHealth {
    if (!this.metrics) {
      return {
        status: 'unhealthy',
        message: 'Metrics not available',
      };
    }

    const m = this.metrics.getMetrics();

    // Check for excessive failures
    const failureRate = m.messagesReceived > 0
      ? (m.messagesFailed / m.messagesReceived) * 100
      : 0;

    let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
    let message = 'Metrics normal';

    if (failureRate > 20) {
      status = 'unhealthy';
      message = `High failure rate: ${failureRate.toFixed(1)}%`;
    } else if (failureRate > 10) {
      status = 'degraded';
      message = `Elevated failure rate: ${failureRate.toFixed(1)}%`;
    }

    // Check buffer usage
    if (m.bufferUsagePercent > 90) {
      status = 'unhealthy';
      message = 'Buffer near capacity';
    } else if (m.bufferUsagePercent > 75) {
      if (status === 'healthy') {
        status = 'degraded';
        message = 'High buffer usage';
      }
    }

    return {
      status,
      message,
      details: {
        messagesReceived: m.messagesReceived,
        messagesStored: m.messagesStored,
        messagesFailed: m.messagesFailed,
        failureRate: `${failureRate.toFixed(2)}%`,
        bufferUsage: `${m.bufferUsagePercent.toFixed(1)}%`,
        messagesPerSecond: m.messagesPerSecond.toFixed(2),
        storageLatencyMs: m.storageLatencyMs.toFixed(2),
      },
    };
  }
}
