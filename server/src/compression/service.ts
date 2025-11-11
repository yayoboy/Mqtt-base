/**
 * Compression Service
 * Provides message compression/decompression for storage optimization
 */

import zlib from 'zlib';
import { promisify } from 'util';
import { logger } from '../utils/logger';

const gzip = promisify(zlib.gzip);
const gunzip = promisify(zlib.gunzip);
const deflate = promisify(zlib.deflate);
const inflate = promisify(zlib.inflate);

export type CompressionAlgorithm = 'gzip' | 'deflate' | 'none';

export interface CompressionConfig {
  enabled: boolean;
  algorithm: CompressionAlgorithm;
  level?: number; // 1-9, default 6
  minSizeBytes?: number; // Only compress if payload > this size
}

export class CompressionService {
  private config: CompressionConfig;

  constructor(config: CompressionConfig) {
    this.config = {
      enabled: config.enabled ?? true,
      algorithm: config.algorithm || 'gzip',
      level: config.level || 6,
      minSizeBytes: config.minSizeBytes || 100,
    };

    logger.info(`Compression service initialized (algorithm: ${this.config.algorithm}, enabled: ${this.config.enabled})`);
  }

  /**
   * Compress data
   */
  async compress(data: string | Buffer): Promise<Buffer> {
    if (!this.config.enabled) {
      return Buffer.from(data);
    }

    const input = typeof data === 'string' ? Buffer.from(data) : data;

    // Skip compression for small payloads
    if (input.length < (this.config.minSizeBytes || 100)) {
      return input;
    }

    try {
      const options = { level: this.config.level };

      switch (this.config.algorithm) {
        case 'gzip':
          return await gzip(input, options);

        case 'deflate':
          return await deflate(input, options);

        case 'none':
        default:
          return input;
      }
    } catch (error) {
      logger.error('Compression error:', error);
      return input; // Return uncompressed on error
    }
  }

  /**
   * Decompress data
   */
  async decompress(data: Buffer, algorithm?: CompressionAlgorithm): Promise<Buffer> {
    if (!this.config.enabled) {
      return data;
    }

    const algo = algorithm || this.config.algorithm;

    try {
      switch (algo) {
        case 'gzip':
          return await gunzip(data);

        case 'deflate':
          return await inflate(data);

        case 'none':
        default:
          return data;
      }
    } catch (error) {
      logger.error('Decompression error:', error);
      return data; // Return as-is on error
    }
  }

  /**
   * Compress JSON object
   */
  async compressJSON(obj: any): Promise<{ data: Buffer; compressed: boolean; algorithm: CompressionAlgorithm }> {
    const json = JSON.stringify(obj);
    const originalSize = Buffer.byteLength(json);

    if (originalSize < (this.config.minSizeBytes || 100)) {
      return {
        data: Buffer.from(json),
        compressed: false,
        algorithm: 'none',
      };
    }

    const compressed = await this.compress(json);
    const compressionRatio = (compressed.length / originalSize) * 100;

    logger.debug(`Compressed JSON: ${originalSize} -> ${compressed.length} bytes (${compressionRatio.toFixed(1)}%)`);

    return {
      data: compressed,
      compressed: true,
      algorithm: this.config.algorithm,
    };
  }

  /**
   * Decompress to JSON object
   */
  async decompressJSON(data: Buffer, algorithm?: CompressionAlgorithm): Promise<any> {
    try {
      const decompressed = await this.decompress(data, algorithm);
      const json = decompressed.toString('utf-8');
      return JSON.parse(json);
    } catch (error) {
      logger.error('JSON decompression error:', error);
      throw error;
    }
  }

  /**
   * Get compression ratio
   */
  getCompressionRatio(original: number, compressed: number): number {
    return ((compressed / original) * 100);
  }

  /**
   * Get compression stats
   */
  getStats(originalSize: number, compressedSize: number) {
    const ratio = this.getCompressionRatio(originalSize, compressedSize);
    const saved = originalSize - compressedSize;
    const savedPercent = ((saved / originalSize) * 100);

    return {
      originalSize,
      compressedSize,
      compressionRatio: `${ratio.toFixed(1)}%`,
      bytesSaved: saved,
      savedPercent: `${savedPercent.toFixed(1)}%`,
    };
  }

  isEnabled(): boolean {
    return this.config.enabled;
  }

  getAlgorithm(): CompressionAlgorithm {
    return this.config.algorithm;
  }
}
