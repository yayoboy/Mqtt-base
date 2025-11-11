/**
 * SQLite Database Backend
 */

import Database from 'better-sqlite3';
import { DatabaseBackend, QueryOptions } from '../manager';
import { DatabaseConfig } from '../../config';
import { logger } from '../../utils/logger';

export class SQLiteBackend implements DatabaseBackend {
  private db!: Database.Database;

  constructor(private config: DatabaseConfig) {}

  async initialize(): Promise<void> {
    const dbPath = this.config.sqlite?.path || './data/telemetry.db';

    this.db = new Database(dbPath);

    // Create tables
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        topic TEXT NOT NULL,
        payload TEXT NOT NULL,
        timestamp DATETIME NOT NULL,
        received_at DATETIME NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_topic ON messages(topic)
    `);

    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_timestamp ON messages(timestamp)
    `);

    logger.info('SQLite backend initialized');
  }

  async store(message: any): Promise<boolean> {
    try {
      const stmt = this.db.prepare(`
        INSERT INTO messages (topic, payload, timestamp, received_at)
        VALUES (?, ?, ?, ?)
      `);

      stmt.run(
        message.topic,
        JSON.stringify(message.payload),
        message.timestamp.toISOString(),
        message.receivedAt.toISOString()
      );

      return true;
    } catch (error) {
      logger.error('Failed to store message', error);
      return false;
    }
  }

  async storeBatch(messages: any[]): Promise<boolean> {
    try {
      const stmt = this.db.prepare(`
        INSERT INTO messages (topic, payload, timestamp, received_at)
        VALUES (?, ?, ?, ?)
      `);

      const transaction = this.db.transaction((msgs: any[]) => {
        for (const msg of msgs) {
          stmt.run(
            msg.topic,
            JSON.stringify(msg.payload),
            msg.timestamp.toISOString(),
            msg.receivedAt.toISOString()
          );
        }
      });

      transaction(messages);
      return true;
    } catch (error) {
      logger.error('Failed to store batch', error);
      return false;
    }
  }

  async query(options: QueryOptions): Promise<any[]> {
    let sql = 'SELECT * FROM messages WHERE 1=1';
    const params: any[] = [];

    if (options.topic) {
      sql += ' AND topic = ?';
      params.push(options.topic);
    }

    if (options.startTime) {
      sql += ' AND timestamp >= ?';
      params.push(options.startTime.toISOString());
    }

    if (options.endTime) {
      sql += ' AND timestamp <= ?';
      params.push(options.endTime.toISOString());
    }

    sql += ' ORDER BY timestamp DESC';

    if (options.limit) {
      sql += ' LIMIT ?';
      params.push(options.limit);
    }

    if (options.offset) {
      sql += ' OFFSET ?';
      params.push(options.offset);
    }

    const stmt = this.db.prepare(sql);
    const rows = stmt.all(...params);

    return rows.map((row: any) => ({
      topic: row.topic,
      payload: JSON.parse(row.payload),
      timestamp: new Date(row.timestamp),
      receivedAt: new Date(row.received_at),
    }));
  }

  async cleanup(before: Date): Promise<number> {
    try {
      const stmt = this.db.prepare('DELETE FROM messages WHERE timestamp < ?');
      const result = stmt.run(before.toISOString());
      const deleted = result.changes || 0;
      logger.info(`Cleaned up ${deleted} old messages`);
      return deleted;
    } catch (error) {
      logger.error('Failed to cleanup old messages', error);
      return 0;
    }
  }

  async getStats(): Promise<any> {
    try {
      const stmt = this.db.prepare(`
        SELECT
          COUNT(*) as total_messages,
          COUNT(DISTINCT topic) as unique_topics,
          MIN(timestamp) as oldest_message,
          MAX(timestamp) as newest_message
        FROM messages
      `);

      const stats = stmt.get();
      return stats;
    } catch (error) {
      logger.error('Failed to get stats', error);
      return null;
    }
  }

  async close(): Promise<void> {
    if (this.db) {
      this.db.close();
    }
  }
}
