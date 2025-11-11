/**
 * API Routes
 * Complete REST API for the MQTT Telemetry Server
 */

import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { DatabaseManager } from '../database/manager';
import { SchemaValidator } from '../schema/validator';
import { MessageBuffer } from '../buffer';
import { MonitoringService } from '../monitoring/service';
import { PrometheusMetrics } from '../monitoring/metrics';
import { AuthManager } from '../auth/manager';
import { createAuthMiddleware, createRoleMiddleware, AuthenticatedRequest } from '../auth/middleware';
import { ExportManager, ExportFormat } from '../export/manager';
import { HealthService } from '../health/service';
import { RetentionScheduler } from '../retention/scheduler';
import { WebSocketManager } from '../websocket/manager';

export interface RoutesDependencies {
  databaseManager: DatabaseManager;
  schemaValidator: SchemaValidator;
  buffer: MessageBuffer;
  monitoring: MonitoringService;
  metrics: PrometheusMetrics;
  authManager: AuthManager;
  exportManager: ExportManager;
  healthService: HealthService;
  retentionScheduler?: RetentionScheduler;
  websocketManager?: WebSocketManager;
}

export function setupApiRoutes(
  fastify: FastifyInstance,
  deps: RoutesDependencies
) {
  const authMiddleware = createAuthMiddleware(deps.authManager);
  const adminMiddleware = createRoleMiddleware(deps.authManager, 'admin');

  // ============ PUBLIC ENDPOINTS ============

  // Health checks (no auth required)
  fastify.get('/health', async () => {
    return {
      status: 'ok',
      alive: deps.healthService.isAlive(),
      timestamp: new Date().toISOString(),
    };
  });

  fastify.get('/health/liveness', async () => {
    return {
      alive: deps.healthService.isAlive(),
    };
  });

  fastify.get('/health/readiness', async () => {
    const ready = await deps.healthService.isReady();
    return {
      ready,
    };
  });

  fastify.get('/health/detailed', async () => {
    return await deps.healthService.getHealth();
  });

  // Prometheus metrics (no auth required)
  fastify.get('/metrics', async (request, reply) => {
    const metrics = deps.metrics.getPrometheusFormat();
    reply.header('Content-Type', 'text/plain; version=0.0.4');
    return metrics;
  });

  // ============ AUTH ENDPOINTS ============

  // Login
  fastify.post<{ Body: { username: string; password: string } }>(
    '/api/auth/login',
    async (request, reply) => {
      const { username, password } = request.body;

      if (!username || !password) {
        return reply.code(400).send({
          error: 'Bad Request',
          message: 'Username and password required',
        });
      }

      const token = await deps.authManager.login(username, password);

      if (!token) {
        return reply.code(401).send({
          error: 'Unauthorized',
          message: 'Invalid credentials',
        });
      }

      return {
        token,
        expiresIn: '24h',
      };
    }
  );

  // Get current user info (requires auth)
  fastify.get(
    '/api/auth/me',
    { preHandler: authMiddleware },
    async (request: AuthenticatedRequest) => {
      return {
        user: request.user,
      };
    }
  );

  // ============ DATA ENDPOINTS (requires auth) ============

  // Query telemetry data
  fastify.get(
    '/api/data',
    { preHandler: authMiddleware },
    async (request, reply) => {
      const { topic, start, end, limit = 1000, offset = 0 } = request.query as any;

      const data = await deps.databaseManager.query({
        topic,
        startTime: start ? new Date(start) : undefined,
        endTime: end ? new Date(end) : undefined,
        limit: parseInt(limit),
        offset: parseInt(offset),
      });

      return {
        data,
        count: data.length,
        offset: parseInt(offset),
      };
    }
  );

  // Export data
  fastify.get<{ Querystring: { format?: ExportFormat } }>(
    '/api/data/export',
    { preHandler: authMiddleware },
    async (request, reply) => {
      const { topic, start, end, limit = 10000, format = 'json' } = request.query as any;

      const data = await deps.databaseManager.query({
        topic,
        startTime: start ? new Date(start) : undefined,
        endTime: end ? new Date(end) : undefined,
        limit: parseInt(limit),
      });

      const contentType = deps.exportManager.getContentType(format);
      const extension = deps.exportManager.getFileExtension(format);
      const filename = `telemetry_${Date.now()}.${extension}`;

      reply.header('Content-Type', contentType);
      reply.header('Content-Disposition', `attachment; filename="${filename}"`);

      // For small datasets, export directly
      if (data.length < 5000) {
        let output: string;

        switch (format) {
          case 'csv':
            output = deps.exportManager.exportCSV(data);
            break;
          case 'ndjson':
            output = deps.exportManager.exportNDJSON(data);
            break;
          case 'json':
          default:
            output = deps.exportManager.exportJSON(data, true);
        }

        return output;
      }

      // For large datasets, use streaming
      const stream = deps.exportManager.createExportStream(data, format);
      return reply.send(stream);
    }
  );

  // Get data summary
  fastify.get(
    '/api/data/summary',
    { preHandler: authMiddleware },
    async (request) => {
      const { topic, start, end } = request.query as any;

      const data = await deps.databaseManager.query({
        topic,
        startTime: start ? new Date(start) : undefined,
        endTime: end ? new Date(end) : undefined,
        limit: 10000,
      });

      return deps.exportManager.exportSummary(data);
    }
  );

  // ============ SCHEMA ENDPOINTS (requires auth) ============

  // List schemas
  fastify.get(
    '/api/schemas',
    { preHandler: authMiddleware },
    async () => {
      return {
        schemas: deps.schemaValidator.listSchemas(),
      };
    }
  );

  // Get specific schema
  fastify.get<{ Params: { name: string } }>(
    '/api/schemas/:name',
    { preHandler: authMiddleware },
    async (request, reply) => {
      const schema = deps.schemaValidator.getSchema(request.params.name);

      if (!schema) {
        return reply.code(404).send({
          error: 'Not Found',
          message: 'Schema not found',
        });
      }

      return schema;
    }
  );

  // ============ STATS & MONITORING ENDPOINTS (requires auth) ============

  // System statistics
  fastify.get(
    '/api/stats',
    { preHandler: authMiddleware },
    async () => {
      const dbStats = await deps.databaseManager.getStats();
      const metricsData = deps.metrics.getMetrics();

      return {
        ...deps.monitoring.getStats(),
        database: dbStats,
        metrics: metricsData,
      };
    }
  );

  // Buffer status
  fastify.get(
    '/api/buffer',
    { preHandler: authMiddleware },
    async () => {
      return {
        size: deps.buffer.size(),
        capacity: deps.buffer.getCapacity?.() || 0,
        usagePercent: deps.buffer.usagePercent(),
        dropped: deps.buffer.getDroppedCount(),
      };
    }
  );

  // Metrics (JSON format)
  fastify.get(
    '/api/metrics',
    { preHandler: authMiddleware },
    async () => {
      return deps.metrics.getMetrics();
    }
  );

  // WebSocket connections
  if (deps.websocketManager) {
    fastify.get(
      '/api/websocket/clients',
      { preHandler: authMiddleware },
      async () => {
        return {
          count: deps.websocketManager!.getConnectionCount(),
          clients: deps.websocketManager!.getClients(),
        };
      }
    );
  }

  // ============ ADMIN ENDPOINTS (requires admin role) ============

  // User management
  fastify.get(
    '/api/admin/users',
    { preHandler: [authMiddleware, adminMiddleware] },
    async () => {
      return {
        users: deps.authManager.getAllUsers(),
      };
    }
  );

  fastify.post<{ Body: { username: string; password: string; role?: string } }>(
    '/api/admin/users',
    { preHandler: [authMiddleware, adminMiddleware] },
    async (request, reply) => {
      const { username, password, role } = request.body;

      if (!username || !password) {
        return reply.code(400).send({
          error: 'Bad Request',
          message: 'Username and password required',
        });
      }

      const user = await deps.authManager.createUser(
        username,
        password,
        role as any || 'user'
      );

      if (!user) {
        return reply.code(409).send({
          error: 'Conflict',
          message: 'User already exists',
        });
      }

      return {
        user: {
          id: user.id,
          username: user.username,
          role: user.role,
        },
      };
    }
  );

  fastify.delete<{ Params: { username: string } }>(
    '/api/admin/users/:username',
    { preHandler: [authMiddleware, adminMiddleware] },
    async (request, reply) => {
      const deleted = await deps.authManager.deleteUser(request.params.username);

      if (!deleted) {
        return reply.code(404).send({
          error: 'Not Found',
          message: 'User not found or cannot be deleted',
        });
      }

      return {
        message: 'User deleted',
      };
    }
  );

  // Retention status
  if (deps.retentionScheduler) {
    fastify.get(
      '/api/admin/retention',
      { preHandler: [authMiddleware, adminMiddleware] },
      async () => {
        return deps.retentionScheduler!.getStatus();
      }
    );

    // Manually trigger retention policy
    fastify.post(
      '/api/admin/retention/execute',
      { preHandler: [authMiddleware, adminMiddleware] },
      async () => {
        await deps.retentionScheduler!.executeRetentionPolicy();
        return {
          message: 'Retention policy executed',
        };
      }
    );
  }

  // Database cleanup
  fastify.post<{ Body: { before: string } }>(
    '/api/admin/cleanup',
    { preHandler: [authMiddleware, adminMiddleware] },
    async (request, reply) => {
      const { before } = request.body;

      if (!before) {
        return reply.code(400).send({
          error: 'Bad Request',
          message: 'before date required (ISO format)',
        });
      }

      const beforeDate = new Date(before);
      const deleted = await deps.databaseManager.cleanup(beforeDate);

      return {
        deleted,
        before: beforeDate.toISOString(),
      };
    }
  );
}
