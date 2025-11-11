/**
 * WebSocket Manager
 * Handles real-time streaming of telemetry data to connected clients
 */

import { FastifyInstance } from 'fastify';
import { WebSocketConfig } from '../config';
import { logger } from '../utils/logger';
import { SocketStream } from '@fastify/websocket';

interface WebSocketClient {
  id: string;
  connection: SocketStream;
  subscriptions: Set<string>; // Topic filters
  authenticated: boolean;
  userId?: string;
  connectedAt: Date;
  lastPing: Date;
}

export class WebSocketManager {
  private clients: Map<string, WebSocketClient> = new Map();
  private pingInterval?: NodeJS.Timeout;
  private messageBuffer: any[] = [];
  private maxBufferSize: number = 100;

  constructor(
    private fastify: FastifyInstance,
    private config: WebSocketConfig
  ) {
    this.setupWebSocket();
    this.startPingInterval();
    logger.info('WebSocket manager initialized');
  }

  private setupWebSocket() {
    this.fastify.get(this.config.path, { websocket: true }, (connection, req) => {
      const clientId = this.generateClientId();

      const client: WebSocketClient = {
        id: clientId,
        connection,
        subscriptions: new Set(['*']), // Subscribe to all topics by default
        authenticated: false,
        connectedAt: new Date(),
        lastPing: new Date(),
      };

      this.clients.set(clientId, client);

      logger.info(`WebSocket client connected: ${clientId}`);

      // Send welcome message
      this.sendToClient(client, {
        type: 'connected',
        clientId,
        timestamp: new Date().toISOString(),
      });

      // Send buffered messages
      this.sendBufferedMessages(client);

      // Handle incoming messages
      connection.socket.on('message', (message: any) => {
        this.handleClientMessage(client, message);
      });

      // Handle pong responses
      connection.socket.on('pong', () => {
        client.lastPing = new Date();
      });

      // Handle close
      connection.socket.on('close', () => {
        this.clients.delete(clientId);
        logger.info(`WebSocket client disconnected: ${clientId}`);
      });

      // Handle errors
      connection.socket.on('error', (error) => {
        logger.error(`WebSocket error for client ${clientId}:`, error);
        this.clients.delete(clientId);
      });
    });
  }

  private handleClientMessage(client: WebSocketClient, message: any) {
    try {
      const data = JSON.parse(message.toString());

      logger.debug(`WebSocket message from ${client.id}:`, data);

      switch (data.type) {
        case 'subscribe':
          this.handleSubscribe(client, data.topics || []);
          break;

        case 'unsubscribe':
          this.handleUnsubscribe(client, data.topics || []);
          break;

        case 'ping':
          this.sendToClient(client, { type: 'pong', timestamp: new Date().toISOString() });
          break;

        case 'auth':
          // Authentication handled by auth middleware in routes
          // This is for additional token verification if needed
          break;

        default:
          logger.warn(`Unknown message type from ${client.id}: ${data.type}`);
      }
    } catch (error) {
      logger.error(`Error handling client message from ${client.id}:`, error);
    }
  }

  private handleSubscribe(client: WebSocketClient, topics: string[]) {
    topics.forEach(topic => client.subscriptions.add(topic));

    this.sendToClient(client, {
      type: 'subscribed',
      topics,
      timestamp: new Date().toISOString(),
    });

    logger.info(`Client ${client.id} subscribed to topics:`, topics);
  }

  private handleUnsubscribe(client: WebSocketClient, topics: string[]) {
    topics.forEach(topic => client.subscriptions.delete(topic));

    this.sendToClient(client, {
      type: 'unsubscribed',
      topics,
      timestamp: new Date().toISOString(),
    });

    logger.info(`Client ${client.id} unsubscribed from topics:`, topics);
  }

  private startPingInterval() {
    // Send ping every 30 seconds to keep connections alive
    this.pingInterval = setInterval(() => {
      const now = Date.now();

      for (const [clientId, client] of this.clients) {
        const lastPingAge = now - client.lastPing.getTime();

        // Disconnect clients that haven't responded to ping in 60 seconds
        if (lastPingAge > 60000) {
          logger.warn(`Client ${clientId} timeout, disconnecting`);
          client.connection.socket.close();
          this.clients.delete(clientId);
          continue;
        }

        // Send ping
        try {
          client.connection.socket.ping();
        } catch (error) {
          logger.error(`Failed to ping client ${clientId}:`, error);
        }
      }
    }, 30000);
  }

  /**
   * Broadcast message to all clients (with topic filtering)
   */
  broadcast(data: any) {
    const message = JSON.stringify(data);
    const topic = data.topic || '';

    let sentCount = 0;

    for (const client of this.clients.values()) {
      // Check if client is subscribed to this topic
      if (this.isSubscribed(client, topic)) {
        try {
          client.connection.socket.send(message);
          sentCount++;
        } catch (error) {
          logger.error(`Error broadcasting to client ${client.id}:`, error);
        }
      }
    }

    logger.debug(`Broadcast message to ${sentCount} clients`);

    // Buffer message for new clients
    this.bufferMessage(data);
  }

  /**
   * Send message to specific client
   */
  sendToClient(client: WebSocketClient, data: any) {
    try {
      const message = JSON.stringify(data);
      client.connection.socket.send(message);
    } catch (error) {
      logger.error(`Error sending to client ${client.id}:`, error);
    }
  }

  /**
   * Check if client is subscribed to topic
   */
  private isSubscribed(client: WebSocketClient, topic: string): boolean {
    // Check for wildcard subscription
    if (client.subscriptions.has('*')) {
      return true;
    }

    // Check exact match
    if (client.subscriptions.has(topic)) {
      return true;
    }

    // Check pattern matching (e.g., "sensors/+" matches "sensors/temp")
    for (const subscription of client.subscriptions) {
      if (this.matchTopic(subscription, topic)) {
        return true;
      }
    }

    return false;
  }

  /**
   * MQTT-style topic matching
   */
  private matchTopic(pattern: string, topic: string): boolean {
    const patternParts = pattern.split('/');
    const topicParts = topic.split('/');

    if (patternParts.length !== topicParts.length && !pattern.includes('#')) {
      return false;
    }

    for (let i = 0; i < patternParts.length; i++) {
      if (patternParts[i] === '#') {
        return true; // # matches everything after
      }

      if (patternParts[i] !== '+' && patternParts[i] !== topicParts[i]) {
        return false;
      }
    }

    return true;
  }

  /**
   * Buffer recent messages for new clients
   */
  private bufferMessage(data: any) {
    this.messageBuffer.push(data);

    if (this.messageBuffer.length > this.maxBufferSize) {
      this.messageBuffer.shift(); // Remove oldest
    }
  }

  /**
   * Send buffered messages to a new client
   */
  private sendBufferedMessages(client: WebSocketClient) {
    if (this.messageBuffer.length === 0) return;

    for (const message of this.messageBuffer) {
      if (this.isSubscribed(client, message.topic || '')) {
        this.sendToClient(client, message);
      }
    }

    logger.debug(`Sent ${this.messageBuffer.length} buffered messages to ${client.id}`);
  }

  private generateClientId(): string {
    return `ws_${Date.now()}_${Math.random().toString(36).substring(7)}`;
  }

  getConnectionCount(): number {
    return this.clients.size;
  }

  getClients(): any[] {
    return Array.from(this.clients.values()).map(client => ({
      id: client.id,
      authenticated: client.authenticated,
      subscriptions: Array.from(client.subscriptions),
      connectedAt: client.connectedAt,
      userId: client.userId,
    }));
  }

  close() {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
    }

    // Close all connections
    for (const client of this.clients.values()) {
      try {
        client.connection.socket.close();
      } catch (error) {
        logger.error(`Error closing client ${client.id}:`, error);
      }
    }

    this.clients.clear();
    logger.info('WebSocket manager closed');
  }
}
