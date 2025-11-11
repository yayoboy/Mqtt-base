/**
 * Monitoring Service
 */

import { MonitoringConfig } from '../config';
import { logger } from '../utils/logger';

export class MonitoringService {
  private startTime = Date.now();

  constructor(
    private config: MonitoringConfig,
    private components: any
  ) {}

  async start() {
    logger.info('Monitoring service started');
  }

  async stop() {
    logger.info('Monitoring service stopped');
  }

  getStats() {
    return {
      uptime: Date.now() - this.startTime,
      memory: process.memoryUsage(),
      buffer: {
        size: this.components.buffer?.size() || 0,
        usage: this.components.buffer?.usagePercent() || 0,
      },
      mqtt: {
        connected: this.components.mqttClient?.isConnected() || false,
        stats: this.components.mqttClient?.getStats() || {},
      },
      storage: this.components.storageManager?.getStats() || {},
    };
  }
}
