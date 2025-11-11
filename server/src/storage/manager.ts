/**
 * Storage Manager
 * Coordinates buffer and database storage
 */

import { EventEmitter } from 'events';
import { DatabaseManager } from '../database/manager';
import { MessageBuffer } from '../buffer';
import { StorageConfig } from '../config';
import { logger } from '../utils/logger';

export class StorageManager extends EventEmitter {
  private running = false;
  private flushTimer?: NodeJS.Timer;
  private stats = {
    messagesStored: 0,
    batchesProcessed: 0,
    errors: 0,
  };

  constructor(
    private database: DatabaseManager,
    private buffer: MessageBuffer,
    private config: StorageConfig
  ) {
    super();
  }

  async initialize(): Promise<void> {
    logger.info('Storage manager initialized');
  }

  async start(): Promise<void> {
    if (this.running) {
      return;
    }

    this.running = true;

    // Start periodic flush
    this.flushTimer = setInterval(
      () => this.processBuffer(),
      5000 // Every 5 seconds
    );

    logger.info('Storage manager started');
  }

  async stop(): Promise<void> {
    if (!this.running) {
      return;
    }

    this.running = false;

    if (this.flushTimer) {
      clearInterval(this.flushTimer);
    }

    // Final flush
    await this.processBuffer();

    logger.info('Storage manager stopped');
  }

  private async processBuffer(): Promise<void> {
    if (this.buffer.isEmpty()) {
      return;
    }

    try {
      const messages = await this.buffer.getBatch();

      if (messages.length === 0) {
        return;
      }

      // Store to database
      const success = await this.database.storeBatch(messages);

      if (success) {
        this.stats.messagesStored += messages.length;
        this.stats.batchesProcessed++;
        logger.debug(`Stored batch of ${messages.length} messages`);
      } else {
        this.stats.errors++;
        logger.error('Failed to store batch');

        // Put messages back in buffer
        for (const msg of messages) {
          await this.buffer.push(msg);
        }
      }

    } catch (error) {
      logger.error('Error processing buffer', error);
      this.stats.errors++;
    }
  }

  getStats() {
    return { ...this.stats };
  }
}
