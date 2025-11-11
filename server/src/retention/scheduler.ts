/**
 * Data Retention Scheduler
 * Automatically cleans up old telemetry data based on configured policies
 */

import { DatabaseManager } from '../database/manager';
import { logger } from '../utils/logger';

export interface RetentionPolicy {
  enabled: boolean;
  duration: string; // e.g., '90d', '12w', '6M', '2y'
  checkInterval: string; // e.g., '1h', '1d'
}

export class RetentionScheduler {
  private intervalId?: NodeJS.Timeout;
  private isRunning: boolean = false;

  constructor(
    private databaseManager: DatabaseManager,
    private policy: RetentionPolicy
  ) {
    logger.info(`Retention scheduler initialized (duration: ${policy.duration})`);
  }

  start(): void {
    if (!this.policy.enabled) {
      logger.info('Retention scheduler disabled');
      return;
    }

    if (this.isRunning) {
      logger.warn('Retention scheduler already running');
      return;
    }

    const intervalMs = this.parseDuration(this.policy.checkInterval);

    this.intervalId = setInterval(async () => {
      await this.executeRetentionPolicy();
    }, intervalMs);

    this.isRunning = true;

    logger.info(`Retention scheduler started (check interval: ${this.policy.checkInterval})`);

    // Execute immediately on start
    setImmediate(() => this.executeRetentionPolicy());
  }

  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = undefined;
    }

    this.isRunning = false;

    logger.info('Retention scheduler stopped');
  }

  async executeRetentionPolicy(): Promise<void> {
    try {
      const durationMs = this.parseDuration(this.policy.duration);
      const cutoffDate = new Date(Date.now() - durationMs);

      logger.info(`Executing retention policy: deleting data before ${cutoffDate.toISOString()}`);

      const deleted = await this.databaseManager.cleanup(cutoffDate);

      if (deleted > 0) {
        logger.info(`Retention policy executed: deleted ${deleted} messages`);
      } else {
        logger.debug('Retention policy executed: no messages to delete');
      }
    } catch (error) {
      logger.error('Failed to execute retention policy', error);
    }
  }

  /**
   * Parse duration string to milliseconds
   * Supports: s (seconds), m (minutes), h (hours), d (days), w (weeks), M (months), y (years)
   */
  private parseDuration(duration: string): number {
    const regex = /^(\d+)([smhdwMy])$/;
    const match = duration.match(regex);

    if (!match) {
      logger.warn(`Invalid duration format: ${duration}, defaulting to 90 days`);
      return 90 * 24 * 60 * 60 * 1000; // 90 days default
    }

    const value = parseInt(match[1], 10);
    const unit = match[2];

    const multipliers: { [key: string]: number } = {
      s: 1000,                    // seconds
      m: 60 * 1000,              // minutes
      h: 60 * 60 * 1000,         // hours
      d: 24 * 60 * 60 * 1000,    // days
      w: 7 * 24 * 60 * 60 * 1000, // weeks
      M: 30 * 24 * 60 * 60 * 1000, // months (approximated to 30 days)
      y: 365 * 24 * 60 * 60 * 1000, // years (approximated to 365 days)
    };

    return value * (multipliers[unit] || 1);
  }

  isEnabled(): boolean {
    return this.policy.enabled;
  }

  getDuration(): string {
    return this.policy.duration;
  }

  getStatus(): any {
    return {
      enabled: this.policy.enabled,
      running: this.isRunning,
      duration: this.policy.duration,
      checkInterval: this.policy.checkInterval,
      nextCheck: this.intervalId ? 'scheduled' : 'not scheduled',
    };
  }
}
