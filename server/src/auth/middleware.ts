/**
 * Authentication Middleware for Fastify
 */

import { FastifyRequest, FastifyReply } from 'fastify';
import { AuthManager } from './manager';
import { logger } from '../utils/logger';

export interface AuthenticatedRequest extends FastifyRequest {
  user?: {
    userId: string;
    username: string;
    role: string;
  };
}

export function createAuthMiddleware(authManager: AuthManager) {
  return async function authMiddleware(
    request: AuthenticatedRequest,
    reply: FastifyReply
  ): Promise<void> {
    try {
      const authHeader = request.headers.authorization;

      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        reply.code(401).send({
          error: 'Unauthorized',
          message: 'Missing or invalid authorization header',
        });
        return;
      }

      const token = authHeader.substring(7); // Remove 'Bearer ' prefix

      const payload = await authManager.verifyToken(token);

      if (!payload) {
        reply.code(401).send({
          error: 'Unauthorized',
          message: 'Invalid or expired token',
        });
        return;
      }

      // Attach user info to request
      request.user = payload;

    } catch (error) {
      logger.error('Auth middleware error', error);
      reply.code(500).send({
        error: 'Internal Server Error',
        message: 'Authentication failed',
      });
    }
  };
}

export function createRoleMiddleware(authManager: AuthManager, requiredRole: string) {
  return async function roleMiddleware(
    request: AuthenticatedRequest,
    reply: FastifyReply
  ): Promise<void> {
    if (!request.user) {
      reply.code(401).send({
        error: 'Unauthorized',
        message: 'User not authenticated',
      });
      return;
    }

    const hasPermission = authManager.hasPermission(request.user.role, requiredRole);

    if (!hasPermission) {
      reply.code(403).send({
        error: 'Forbidden',
        message: `Insufficient permissions. Required role: ${requiredRole}`,
      });
      return;
    }
  };
}
