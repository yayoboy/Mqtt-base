/**
 * Message Buffer
 */

import { EventEmitter } from 'events';
import { BufferConfig } from '../config';
import { logger } from '../utils/logger';

export interface BufferedMessage {
  topic: string;
  payload: any;
  timestamp: Date;
  receivedAt: Date;
}

export class MessageBuffer extends EventEmitter {
  private buffer: BufferedMessage[] = [];
  private droppedCount = 0;

  constructor(private config: BufferConfig) {
    super();
  }

  async push(message: BufferedMessage): Promise<boolean> {
    if (this.buffer.length >= this.config.size) {
      this.droppedCount++;
      logger.warn(`Buffer full! Dropped ${this.droppedCount} messages`);
      this.emit('full');
      return false;
    }

    this.buffer.push(message);

    // Check high water mark
    if (this.buffer.length >= this.config.highWaterMark) {
      this.emit('highWaterMark');
    }

    this.emit('message', message);
    return true;
  }

  async pop(): Promise<BufferedMessage | undefined> {
    return this.buffer.shift();
  }

  async getBatch(size?: number): Promise<BufferedMessage[]> {
    const batchSize = Math.min(
      size || this.config.batchSize,
      this.buffer.length
    );

    return this.buffer.splice(0, batchSize);
  }

  async flush(): Promise<BufferedMessage[]> {
    const messages = [...this.buffer];
    this.buffer = [];
    return messages;
  }

  size(): number {
    return this.buffer.length;
  }

  usagePercent(): number {
    return (this.buffer.length / this.config.size) * 100;
  }

  isEmpty(): boolean {
    return this.buffer.length === 0;
  }

  isFull(): boolean {
    return this.buffer.length >= this.config.size;
  }

  getDroppedCount(): number {
    return this.droppedCount;
  }

  clear(): void {
    this.buffer = [];
  }
}
