/**
 * InfluxDB Database Backend
 * Optimized for time-series telemetry data
 */

import { InfluxDB, Point, WriteApi, QueryApi, HttpError } from '@influxdata/influxdb-client';
import { DatabaseBackend, QueryOptions } from '../manager';
import { DatabaseConfig } from '../../config';
import { logger } from '../../utils/logger';

export class InfluxDBBackend implements DatabaseBackend {
  private client!: InfluxDB;
  private writeApi!: WriteApi;
  private queryApi!: QueryApi;
  private bucket!: string;
  private org!: string;

  constructor(private config: DatabaseConfig) {}

  async initialize(): Promise<void> {
    const influxConfig = this.config.influxdb;

    if (!influxConfig) {
      throw new Error('InfluxDB configuration not found');
    }

    const url = influxConfig.url || 'http://localhost:8086';
    const token = influxConfig.token;
    this.org = influxConfig.org || 'mqtt-telemetry';
    this.bucket = influxConfig.bucket || 'telemetry';

    if (!token) {
      throw new Error('InfluxDB token is required');
    }

    this.client = new InfluxDB({ url, token });
    this.writeApi = this.client.getWriteApi(this.org, this.bucket, 'ns');
    this.queryApi = this.client.getQueryApi(this.org);

    // Configure write options
    this.writeApi.useDefaultTags({ source: 'mqtt-telemetry-server' });

    logger.info(`InfluxDB backend initialized (url: ${url}, bucket: ${this.bucket})`);
  }

  async store(message: any): Promise<boolean> {
    try {
      const point = this.messageToPoint(message);
      this.writeApi.writePoint(point);

      // Flush to ensure write
      await this.writeApi.flush();

      return true;
    } catch (error) {
      logger.error('Failed to store message in InfluxDB', error);
      return false;
    }
  }

  async storeBatch(messages: any[]): Promise<boolean> {
    try {
      const points = messages.map(msg => this.messageToPoint(msg));
      this.writeApi.writePoints(points);

      // Flush to ensure all writes
      await this.writeApi.flush();

      return true;
    } catch (error) {
      logger.error('Failed to store batch in InfluxDB', error);
      return false;
    }
  }

  private messageToPoint(message: any): Point {
    const point = new Point('mqtt_message')
      .timestamp(message.timestamp)
      .tag('topic', message.topic);

    // Extract numeric fields from payload for efficient querying
    const payload = message.payload;

    if (typeof payload === 'object' && payload !== null) {
      // Add all numeric values as fields
      for (const [key, value] of Object.entries(payload)) {
        if (typeof value === 'number') {
          point.floatField(key, value);
        } else if (typeof value === 'boolean') {
          point.booleanField(key, value);
        } else if (typeof value === 'string') {
          point.stringField(key, value);
        }
      }

      // Store full payload as string for complex objects
      if (Object.keys(payload).some(k => typeof payload[k] === 'object')) {
        point.stringField('payload_json', JSON.stringify(payload));
      }
    } else {
      // Store primitive values directly
      point.stringField('payload', String(payload));
    }

    // Add received_at as a field for query purposes
    point.timestamp(message.timestamp);
    point.intField('received_at_ms', message.receivedAt.getTime());

    return point;
  }

  async query(options: QueryOptions): Promise<any[]> {
    try {
      let fluxQuery = `from(bucket: "${this.bucket}")`;

      // Time range
      if (options.startTime) {
        const startMs = options.startTime.getTime();
        fluxQuery += `\n  |> range(start: ${Math.floor(startMs / 1000)})`;
      } else {
        fluxQuery += `\n  |> range(start: -30d)`;
      }

      if (options.endTime) {
        const endMs = options.endTime.getTime();
        fluxQuery += `\n  |> range(stop: ${Math.floor(endMs / 1000)})`;
      }

      // Filter by measurement
      fluxQuery += `\n  |> filter(fn: (r) => r._measurement == "mqtt_message")`;

      // Filter by topic
      if (options.topic) {
        fluxQuery += `\n  |> filter(fn: (r) => r.topic == "${options.topic}")`;
      }

      // Sort by time descending
      fluxQuery += `\n  |> sort(columns: ["_time"], desc: true)`;

      // Limit
      if (options.limit) {
        fluxQuery += `\n  |> limit(n: ${options.limit})`;
      }

      logger.debug('InfluxDB query:', fluxQuery);

      const rows: any[] = [];
      const messagesMap = new Map<string, any>();

      await this.queryApi.queryRows(fluxQuery, {
        next: (row: string[], tableMeta: any) => {
          const record = tableMeta.toObject(row);

          const timestamp = new Date(record._time);
          const key = `${timestamp.getTime()}_${record.topic}`;

          if (!messagesMap.has(key)) {
            messagesMap.set(key, {
              topic: record.topic,
              payload: {},
              timestamp: timestamp,
              receivedAt: new Date(record.received_at_ms || record._time),
            });
          }

          const message = messagesMap.get(key);

          // Reconstruct payload from fields
          if (record._field === 'payload_json') {
            message.payload = JSON.parse(record._value);
          } else if (record._field !== 'received_at_ms') {
            message.payload[record._field] = record._value;
          }
        },
        error: (error: HttpError) => {
          logger.error('InfluxDB query error', error);
        },
        complete: () => {
          // Query completed
        },
      });

      // Convert map to array
      rows.push(...Array.from(messagesMap.values()));

      return rows;
    } catch (error) {
      logger.error('Failed to query InfluxDB', error);
      return [];
    }
  }

  async cleanup(before: Date): Promise<number> {
    try {
      const startMs = 0;
      const stopMs = Math.floor(before.getTime() / 1000);

      const deleteQuery = `
        from(bucket: "${this.bucket}")
          |> range(start: ${startMs}, stop: ${stopMs})
          |> filter(fn: (r) => r._measurement == "mqtt_message")
      `;

      // Note: InfluxDB delete requires a predicate
      // This is a simplified version - in production, use the Delete API
      logger.warn('InfluxDB cleanup not fully implemented - use retention policies instead');

      return 0;
    } catch (error) {
      logger.error('Failed to cleanup InfluxDB', error);
      return 0;
    }
  }

  async getStats(): Promise<any> {
    try {
      // Count total messages
      const countQuery = `
        from(bucket: "${this.bucket}")
          |> range(start: 0)
          |> filter(fn: (r) => r._measurement == "mqtt_message")
          |> count()
      `;

      let totalMessages = 0;

      await this.queryApi.queryRows(countQuery, {
        next: (row: string[], tableMeta: any) => {
          const record = tableMeta.toObject(row);
          totalMessages += record._value || 0;
        },
        error: (error: HttpError) => {
          logger.error('InfluxDB stats query error', error);
        },
        complete: () => {},
      });

      return {
        total_messages: totalMessages,
        backend: 'influxdb',
        bucket: this.bucket,
        org: this.org,
      };
    } catch (error) {
      logger.error('Failed to get InfluxDB stats', error);
      return null;
    }
  }

  async close(): Promise<void> {
    if (this.writeApi) {
      try {
        await this.writeApi.close();
        logger.info('InfluxDB write API closed');
      } catch (error) {
        logger.error('Error closing InfluxDB write API', error);
      }
    }
  }
}
