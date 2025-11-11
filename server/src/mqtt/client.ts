/**
 * MQTT Client
 */

import * as mqtt from 'mqtt';
import { MqttConfig } from '../config';
import { SchemaValidator } from '../schema/validator';
import { MessageBuffer } from '../buffer';
import { logger } from '../utils/logger';

export interface MqttClientOptions {
  schemaValidator: SchemaValidator;
  buffer: MessageBuffer;
  onMessage?: (topic: string, payload: any) => Promise<void>;
  onError?: (error: Error) => void;
}

export class MqttClient {
  private client?: mqtt.MqttClient;
  private connected = false;
  private stats = {
    messagesReceived: 0,
    messagesValid: 0,
    messagesInvalid: 0,
    reconnects: 0,
  };

  constructor(
    private config: MqttConfig,
    private options: MqttClientOptions
  ) {}

  async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.client = mqtt.connect(this.config.broker, {
        clientId: this.config.clientId,
        username: this.config.username,
        password: this.config.password,
        reconnectPeriod: this.config.reconnectPeriod,
        clean: true,
      });

      this.client.on('connect', () => {
        logger.info('Connected to MQTT broker');
        this.connected = true;
        resolve();
      });

      this.client.on('error', (error) => {
        logger.error('MQTT error', error);
        if (this.options.onError) {
          this.options.onError(error);
        }
        reject(error);
      });

      this.client.on('reconnect', () => {
        logger.info('Reconnecting to MQTT broker');
        this.stats.reconnects++;
      });

      this.client.on('close', () => {
        logger.info('MQTT connection closed');
        this.connected = false;
      });

      this.client.on('message', async (topic, payload) => {
        await this.handleMessage(topic, payload);
      });
    });
  }

  async disconnect(): Promise<void> {
    if (this.client) {
      return new Promise((resolve) => {
        this.client!.end(false, {}, () => {
          logger.info('Disconnected from MQTT broker');
          resolve();
        });
      });
    }
  }

  async subscribe(topic: string, qos: mqtt.QoS = this.config.qos): Promise<void> {
    if (!this.client) {
      throw new Error('Not connected to MQTT broker');
    }

    return new Promise((resolve, reject) => {
      this.client!.subscribe(topic, { qos }, (error) => {
        if (error) {
          logger.error(`Failed to subscribe to ${topic}`, error);
          reject(error);
        } else {
          logger.info(`Subscribed to topic: ${topic}`);
          resolve();
        }
      });
    });
  }

  async unsubscribe(topic: string): Promise<void> {
    if (!this.client) {
      return;
    }

    return new Promise((resolve, reject) => {
      this.client!.unsubscribe(topic, (error) => {
        if (error) {
          reject(error);
        } else {
          logger.info(`Unsubscribed from topic: ${topic}`);
          resolve();
        }
      });
    });
  }

  async publish(topic: string, payload: any, qos: mqtt.QoS = this.config.qos): Promise<void> {
    if (!this.client) {
      throw new Error('Not connected to MQTT broker');
    }

    const payloadStr = typeof payload === 'string' ? payload : JSON.stringify(payload);

    return new Promise((resolve, reject) => {
      this.client!.publish(topic, payloadStr, { qos }, (error) => {
        if (error) {
          reject(error);
        } else {
          resolve();
        }
      });
    });
  }

  private async handleMessage(topic: string, payload: Buffer): Promise<void> {
    try {
      this.stats.messagesReceived++;

      const payloadStr = payload.toString();

      // Validate schema
      if (this.options.schemaValidator) {
        const validation = await this.options.schemaValidator.validate(topic, payloadStr);

        if (!validation.valid) {
          this.stats.messagesInvalid++;
          logger.warn(`Schema validation failed for ${topic}: ${validation.error}`);
          return;
        }
      }

      this.stats.messagesValid++;

      // Parse payload
      let data: any;
      try {
        data = JSON.parse(payloadStr);
      } catch {
        data = payloadStr;
      }

      // Add to buffer
      await this.options.buffer.push({
        topic,
        payload: data,
        timestamp: new Date(),
        receivedAt: new Date(),
      });

      // Call user callback
      if (this.options.onMessage) {
        await this.options.onMessage(topic, data);
      }

    } catch (error) {
      logger.error('Error handling message', error);
    }
  }

  isConnected(): boolean {
    return this.connected;
  }

  getStats() {
    return { ...this.stats };
  }
}
