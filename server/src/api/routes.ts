/**
 * API Routes
 */

import { FastifyInstance } from 'fastify';
import { DatabaseManager } from '../database/manager';
import { SchemaValidator } from '../schema/validator';
import { MessageBuffer } from '../buffer';
import { MonitoringService } from '../monitoring/service';

export interface RoutesDependencies {
  databaseManager: DatabaseManager;
  schemaValidator: SchemaValidator;
  buffer: MessageBuffer;
  monitoring: MonitoringService;
}

export function setupApiRoutes(
  fastify: FastifyInstance,
  deps: RoutesDependencies
) {
  // Query telemetry data
  fastify.get('/api/data', async (request, reply) => {
    const { topic, start, end, limit = 1000 } = request.query as any;

    const data = await deps.databaseManager.query({
      topic,
      startTime: start ? new Date(start) : undefined,
      endTime: end ? new Date(end) : undefined,
      limit: parseInt(limit),
    });

    return {
      data,
      count: data.length,
    };
  });

  // List schemas
  fastify.get('/api/schemas', async () => {
    return {
      schemas: deps.schemaValidator.listSchemas(),
    };
  });

  // Get specific schema
  fastify.get<{ Params: { name: string } }>(
    '/api/schemas/:name',
    async (request) => {
      const schema = deps.schemaValidator.getSchema(request.params.name);

      if (!schema) {
        return {
          error: 'Schema not found',
        };
      }

      return schema;
    }
  );

  // System statistics
  fastify.get('/api/stats', async () => {
    return deps.monitoring.getStats();
  });

  // Buffer status
  fastify.get('/api/buffer', async () => {
    return {
      size: deps.buffer.size(),
      usagePercent: deps.buffer.usagePercent(),
      dropped: deps.buffer.getDroppedCount(),
    };
  });

  // Health check
  fastify.get('/api/health', async () => {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
    };
  });
}
