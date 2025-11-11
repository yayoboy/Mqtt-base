/**
 * Database Manager
 * Handles multiple database backends
 */

import { DatabaseConfig } from '../config';
import { logger } from '../utils/logger';

export interface QueryOptions {
  topic?: string;
  startTime?: Date;
  endTime?: Date;
  limit?: number;
  offset?: number;
}

export interface DatabaseBackend {
  initialize(): Promise<void>;
  store(message: any): Promise<boolean>;
  storeBatch(messages: any[]): Promise<boolean>;
  query(options: QueryOptions): Promise<any[]>;
  close(): Promise<void>;
}

export class DatabaseManager {
  private backend!: DatabaseBackend;

  constructor(private config: DatabaseConfig) {}

  async initialize(): Promise<void> {
    // Load appropriate backend
    const backendType = this.config.primary;

    try {
      switch (backendType) {
        case 'timescaledb':
        case 'postgresql':
          const { PostgreSQLBackend } = await import('./backends/postgresql');
          this.backend = new PostgreSQLBackend(this.config);
          break;

        case 'influxdb':
          const { InfluxDBBackend } = await import('./backends/influxdb');
          this.backend = new InfluxDBBackend(this.config);
          break;

        case 'sqlite':
          const { SQLiteBackend } = await import('./backends/sqlite');
          this.backend = new SQLiteBackend(this.config);
          break;

        default:
          throw new Error(`Unknown database backend: ${backendType}`);
      }

      await this.backend.initialize();
      logger.info(`Database backend initialized: ${backendType}`);

    } catch (error) {
      logger.error('Failed to initialize database', error);
      throw error;
    }
  }

  async store(message: any): Promise<boolean> {
    return this.backend.store(message);
  }

  async storeBatch(messages: any[]): Promise<boolean> {
    return this.backend.storeBatch(messages);
  }

  async query(options: QueryOptions): Promise<any[]> {
    return this.backend.query(options);
  }

  async close(): Promise<void> {
    if (this.backend) {
      await this.backend.close();
    }
  }

  getBackend(): DatabaseBackend {
    return this.backend;
  }
}
