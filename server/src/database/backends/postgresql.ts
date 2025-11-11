/**
 * PostgreSQL/TimescaleDB Database Backend
 * Supports both standard PostgreSQL and TimescaleDB for time-series optimization
 */

import { Pool, PoolClient } from 'pg';
import { DatabaseBackend, QueryOptions } from '../manager';
import { DatabaseConfig } from '../../config';
import { logger } from '../../utils/logger';

export class PostgreSQLBackend implements DatabaseBackend {
  private pool!: Pool;
  private isTimescaleDB: boolean = false;

  constructor(private config: DatabaseConfig) {}

  async initialize(): Promise<void> {
    const pgConfig = this.config.postgresql || this.config.timescaledb;

    if (!pgConfig) {
      throw new Error('PostgreSQL configuration not found');
    }

    this.pool = new Pool({
      host: pgConfig.host || 'localhost',
      port: pgConfig.port || 5432,
      database: pgConfig.database || 'mqtt_telemetry',
      user: pgConfig.user || 'postgres',
      password: pgConfig.password,
      max: pgConfig.poolSize || 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    });

    // Check if TimescaleDB extension is available
    this.isTimescaleDB = this.config.primary === 'timescaledb';

    await this.createTables();

    logger.info(`PostgreSQL backend initialized (TimescaleDB: ${this.isTimescaleDB})`);
  }

  private async createTables(): Promise<void> {
    const client = await this.pool.connect();

    try {
      // Create messages table
      await client.query(`
        CREATE TABLE IF NOT EXISTS messages (
          id BIGSERIAL PRIMARY KEY,
          topic VARCHAR(512) NOT NULL,
          payload JSONB NOT NULL,
          timestamp TIMESTAMPTZ NOT NULL,
          received_at TIMESTAMPTZ NOT NULL,
          created_at TIMESTAMPTZ DEFAULT NOW()
        )
      `);

      // If TimescaleDB is enabled, convert to hypertable
      if (this.isTimescaleDB) {
        try {
          await client.query(`
            SELECT create_hypertable('messages', 'timestamp',
              if_not_exists => TRUE,
              chunk_time_interval => INTERVAL '1 day'
            )
          `);
          logger.info('TimescaleDB hypertable created');
        } catch (error: any) {
          if (!error.message.includes('already a hypertable')) {
            logger.warn('Failed to create hypertable', error);
          }
        }
      }

      // Create indexes
      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_messages_topic ON messages(topic)
      `);

      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_messages_timestamp ON messages(timestamp DESC)
      `);

      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_messages_payload ON messages USING GIN(payload)
      `);

      // Create retention policy for TimescaleDB (optional)
      if (this.isTimescaleDB && this.config.retention?.enabled) {
        const retentionDays = this.config.retention.days || 90;
        try {
          await client.query(`
            SELECT add_retention_policy('messages',
              INTERVAL '${retentionDays} days',
              if_not_exists => TRUE
            )
          `);
          logger.info(`TimescaleDB retention policy set to ${retentionDays} days`);
        } catch (error) {
          logger.warn('Failed to set retention policy', error);
        }
      }

    } finally {
      client.release();
    }
  }

  async store(message: any): Promise<boolean> {
    try {
      await this.pool.query(
        `INSERT INTO messages (topic, payload, timestamp, received_at)
         VALUES ($1, $2, $3, $4)`,
        [
          message.topic,
          JSON.stringify(message.payload),
          message.timestamp,
          message.receivedAt,
        ]
      );

      return true;
    } catch (error) {
      logger.error('Failed to store message', error);
      return false;
    }
  }

  async storeBatch(messages: any[]): Promise<boolean> {
    if (messages.length === 0) return true;

    const client = await this.pool.connect();

    try {
      await client.query('BEGIN');

      const query = `
        INSERT INTO messages (topic, payload, timestamp, received_at)
        VALUES ($1, $2, $3, $4)
      `;

      for (const msg of messages) {
        await client.query(query, [
          msg.topic,
          JSON.stringify(msg.payload),
          msg.timestamp,
          msg.receivedAt,
        ]);
      }

      await client.query('COMMIT');
      return true;
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('Failed to store batch', error);
      return false;
    } finally {
      client.release();
    }
  }

  async query(options: QueryOptions): Promise<any[]> {
    let sql = 'SELECT id, topic, payload, timestamp, received_at FROM messages WHERE 1=1';
    const params: any[] = [];
    let paramIndex = 1;

    if (options.topic) {
      sql += ` AND topic = $${paramIndex++}`;
      params.push(options.topic);
    }

    if (options.startTime) {
      sql += ` AND timestamp >= $${paramIndex++}`;
      params.push(options.startTime);
    }

    if (options.endTime) {
      sql += ` AND timestamp <= $${paramIndex++}`;
      params.push(options.endTime);
    }

    sql += ' ORDER BY timestamp DESC';

    if (options.limit) {
      sql += ` LIMIT $${paramIndex++}`;
      params.push(options.limit);
    }

    if (options.offset) {
      sql += ` OFFSET $${paramIndex++}`;
      params.push(options.offset);
    }

    try {
      const result = await this.pool.query(sql, params);

      return result.rows.map((row) => ({
        id: row.id,
        topic: row.topic,
        payload: typeof row.payload === 'string' ? JSON.parse(row.payload) : row.payload,
        timestamp: new Date(row.timestamp),
        receivedAt: new Date(row.received_at),
      }));
    } catch (error) {
      logger.error('Failed to query messages', error);
      return [];
    }
  }

  async cleanup(before: Date): Promise<number> {
    try {
      const result = await this.pool.query(
        'DELETE FROM messages WHERE timestamp < $1',
        [before]
      );

      const deleted = result.rowCount || 0;
      logger.info(`Cleaned up ${deleted} old messages`);
      return deleted;
    } catch (error) {
      logger.error('Failed to cleanup old messages', error);
      return 0;
    }
  }

  async getStats(): Promise<any> {
    try {
      const result = await this.pool.query(`
        SELECT
          COUNT(*) as total_messages,
          COUNT(DISTINCT topic) as unique_topics,
          MIN(timestamp) as oldest_message,
          MAX(timestamp) as newest_message,
          pg_size_pretty(pg_total_relation_size('messages')) as table_size
        FROM messages
      `);

      return result.rows[0];
    } catch (error) {
      logger.error('Failed to get stats', error);
      return null;
    }
  }

  async close(): Promise<void> {
    if (this.pool) {
      await this.pool.end();
      logger.info('PostgreSQL connection pool closed');
    }
  }
}
