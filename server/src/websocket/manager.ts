/**
 * WebSocket Manager
 */

import { FastifyInstance } from 'fastify';
import { WebSocketConfig } from '../config';
import { logger } from '../utils/logger';

export class WebSocketManager {
  private connections: Set<any> = new Set();

  constructor(
    private fastify: FastifyInstance,
    private config: WebSocketConfig
  ) {
    this.setupWebSocket();
  }

  private setupWebSocket() {
    this.fastify.get(this.config.path, { websocket: true }, (connection, req) => {
      this.connections.add(connection);

      logger.info('WebSocket client connected');

      connection.socket.on('message', (message: any) => {
        logger.debug('WebSocket message received', message.toString());
      });

      connection.socket.on('close', () => {
        this.connections.delete(connection);
        logger.info('WebSocket client disconnected');
      });
    });
  }

  broadcast(data: any) {
    const message = JSON.stringify(data);

    for (const conn of this.connections) {
      try {
        conn.socket.send(message);
      } catch (error) {
        logger.error('Error broadcasting to websocket', error);
      }
    }
  }

  getConnectionCount(): number {
    return this.connections.size;
  }
}
