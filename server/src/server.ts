/**
 * Main server implementation
 */

import Fastify, { FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import websocket from '@fastify/websocket';
import { Config } from './config';
import { MqttClient } from './mqtt/client';
import { DatabaseManager } from './database/manager';
import { SchemaValidator } from './schema/validator';
import { MessageBuffer } from './buffer';
import { StorageManager } from './storage/manager';
import { setupApiRoutes } from './api/routes';
import { setupGraphQL } from './api/graphql';
import { WebSocketManager } from './websocket/manager';
import { MonitoringService } from './monitoring/service';
import { logger } from './utils/logger';

export interface Server {
  start(): Promise<void>;
  stop(): Promise<void>;
  getInstance(): FastifyInstance;
}

export async function createServer(config: Config): Promise<Server> {
  // Create Fastify instance
  const fastify = Fastify({
    logger: {
      level: config.logging.level,
      transport: {
        target: 'pino-pretty',
      },
    },
  });

  // Register CORS
  if (config.api.cors.enabled) {
    await fastify.register(cors, {
      origin: config.api.cors.origins,
    });
  }

  // Register WebSocket
  if (config.websocket.enabled) {
    await fastify.register(websocket);
  }

  // Initialize components
  const schemaValidator = new SchemaValidator(config.schema);
  await schemaValidator.initialize();

  const databaseManager = new DatabaseManager(config.database);
  await databaseManager.initialize();

  const buffer = new MessageBuffer(config.buffer);

  const storageManager = new StorageManager(
    databaseManager,
    buffer,
    config.storage
  );
  await storageManager.initialize();

  const mqttClient = new MqttClient(config.mqtt, {
    schemaValidator,
    buffer,
    onMessage: async (topic, payload) => {
      logger.debug(`Message received: ${topic}`);
    },
  });

  let wsManager: WebSocketManager | undefined;
  if (config.websocket.enabled) {
    wsManager = new WebSocketManager(fastify, config.websocket);
  }

  const monitoring = new MonitoringService(config.monitoring, {
    mqttClient,
    buffer,
    storageManager,
  });

  // Setup API routes
  setupApiRoutes(fastify, {
    databaseManager,
    schemaValidator,
    buffer,
    monitoring,
  });

  // Setup GraphQL
  if (config.graphql.enabled) {
    await setupGraphQL(fastify, config.graphql, databaseManager);
  }

  // Health check endpoint
  fastify.get('/health', async () => {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      mqtt: mqttClient.isConnected(),
      buffer: {
        size: buffer.size(),
        usage: buffer.usagePercent(),
      },
    };
  });

  return {
    async start() {
      // Start MQTT client
      await mqttClient.connect();

      // Subscribe to topics
      for (const topic of config.mqtt.topics) {
        await mqttClient.subscribe(topic);
      }

      // Start storage manager
      await storageManager.start();

      // Start monitoring
      await monitoring.start();

      // Start HTTP server
      await fastify.listen({
        host: config.api.host,
        port: config.api.port,
      });

      logger.info('Server started successfully');
    },

    async stop() {
      logger.info('Stopping server...');

      // Stop monitoring
      await monitoring.stop();

      // Stop storage
      await storageManager.stop();

      // Disconnect MQTT
      await mqttClient.disconnect();

      // Close database
      await databaseManager.close();

      // Close HTTP server
      await fastify.close();

      logger.info('Server stopped');
    },

    getInstance() {
      return fastify;
    },
  };
}
