/**
 * Data Export Manager
 * Supports exporting telemetry data in multiple formats
 */

import { QueryOptions } from '../database/manager';
import { logger } from '../utils/logger';
import { Readable } from 'stream';

export type ExportFormat = 'json' | 'csv' | 'ndjson';

export interface ExportOptions extends QueryOptions {
  format: ExportFormat;
  includeMetadata?: boolean;
}

export class ExportManager {
  constructor() {
    logger.info('Export manager initialized');
  }

  /**
   * Export data as JSON array
   */
  exportJSON(data: any[], includeMetadata: boolean = false): string {
    if (includeMetadata) {
      return JSON.stringify({
        metadata: {
          exportedAt: new Date().toISOString(),
          count: data.length,
          format: 'json',
        },
        data,
      }, null, 2);
    }

    return JSON.stringify(data, null, 2);
  }

  /**
   * Export data as newline-delimited JSON (NDJSON)
   * Better for streaming large datasets
   */
  exportNDJSON(data: any[]): string {
    return data.map(item => JSON.stringify(item)).join('\n');
  }

  /**
   * Export data as CSV
   */
  exportCSV(data: any[]): string {
    if (data.length === 0) {
      return '';
    }

    // Extract all unique keys from all records
    const allKeys = new Set<string>();
    data.forEach(record => {
      Object.keys(record).forEach(key => allKeys.add(key));

      // If payload is an object, include its keys too
      if (record.payload && typeof record.payload === 'object') {
        Object.keys(record.payload).forEach(key => {
          allKeys.add(`payload.${key}`);
        });
      }
    });

    const headers = Array.from(allKeys);

    // CSV header row
    const csvRows: string[] = [headers.map(h => this.escapeCSV(h)).join(',')];

    // CSV data rows
    for (const record of data) {
      const row = headers.map(header => {
        if (header.startsWith('payload.')) {
          const payloadKey = header.substring(8);
          const value = record.payload?.[payloadKey];
          return this.escapeCSV(this.formatValue(value));
        } else {
          const value = record[header];
          return this.escapeCSV(this.formatValue(value));
        }
      });

      csvRows.push(row.join(','));
    }

    return csvRows.join('\n');
  }

  /**
   * Create a readable stream for large exports
   */
  createExportStream(data: any[], format: ExportFormat): Readable {
    const stream = new Readable({
      read() {},
    });

    // Push data in chunks
    const chunkSize = 1000;
    let index = 0;

    const pushChunk = () => {
      if (index >= data.length) {
        stream.push(null); // End stream
        return;
      }

      const chunk = data.slice(index, index + chunkSize);
      index += chunkSize;

      let output: string;

      switch (format) {
        case 'json':
          if (index === chunkSize) {
            output = '[\n' + JSON.stringify(chunk[0]);
          } else {
            output = chunk.map(item => ',\n' + JSON.stringify(item)).join('');
          }

          if (index >= data.length) {
            output += '\n]';
          }
          break;

        case 'ndjson':
          output = chunk.map(item => JSON.stringify(item)).join('\n') + '\n';
          break;

        case 'csv':
          if (index === chunkSize) {
            output = this.exportCSV(chunk);
          } else {
            output = '\n' + this.exportCSV(chunk).split('\n').slice(1).join('\n');
          }
          break;

        default:
          output = '';
      }

      stream.push(output);

      // Schedule next chunk
      setImmediate(pushChunk);
    };

    // Start streaming
    setImmediate(pushChunk);

    return stream;
  }

  /**
   * Get content type for export format
   */
  getContentType(format: ExportFormat): string {
    switch (format) {
      case 'json':
        return 'application/json';
      case 'ndjson':
        return 'application/x-ndjson';
      case 'csv':
        return 'text/csv';
      default:
        return 'application/octet-stream';
    }
  }

  /**
   * Get file extension for export format
   */
  getFileExtension(format: ExportFormat): string {
    return format === 'ndjson' ? 'ndjson' : format;
  }

  private formatValue(value: any): string {
    if (value === null || value === undefined) {
      return '';
    }

    if (value instanceof Date) {
      return value.toISOString();
    }

    if (typeof value === 'object') {
      return JSON.stringify(value);
    }

    return String(value);
  }

  private escapeCSV(value: string): string {
    if (value.includes(',') || value.includes('"') || value.includes('\n')) {
      return `"${value.replace(/"/g, '""')}"`;
    }
    return value;
  }

  /**
   * Export summary statistics
   */
  exportSummary(data: any[]): any {
    if (data.length === 0) {
      return {
        count: 0,
        topics: [],
        dateRange: null,
      };
    }

    const topics = new Set<string>();
    const timestamps: Date[] = [];

    data.forEach(record => {
      if (record.topic) {
        topics.add(record.topic);
      }
      if (record.timestamp) {
        timestamps.push(new Date(record.timestamp));
      }
    });

    timestamps.sort((a, b) => a.getTime() - b.getTime());

    return {
      count: data.length,
      topics: Array.from(topics),
      topicCount: topics.size,
      dateRange: {
        start: timestamps[0]?.toISOString(),
        end: timestamps[timestamps.length - 1]?.toISOString(),
      },
      exportedAt: new Date().toISOString(),
    };
  }
}
