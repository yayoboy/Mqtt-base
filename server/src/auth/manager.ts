/**
 * Authentication Manager
 * JWT-based authentication with bcrypt password hashing
 */

import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import { logger } from '../utils/logger';

export interface User {
  id: string;
  username: string;
  password: string;
  role: 'admin' | 'user' | 'readonly';
  createdAt: Date;
}

export interface TokenPayload {
  userId: string;
  username: string;
  role: string;
}

export interface AuthConfig {
  jwtSecret: string;
  jwtExpiresIn: string;
  bcryptRounds: number;
  users?: User[];
}

export class AuthManager {
  private users: Map<string, User> = new Map();
  private jwtSecret: string;
  private jwtExpiresIn: string;
  private bcryptRounds: number;

  constructor(private config: AuthConfig) {
    this.jwtSecret = config.jwtSecret || this.generateSecret();
    this.jwtExpiresIn = config.jwtExpiresIn || '24h';
    this.bcryptRounds = config.bcryptRounds || 10;

    // Initialize default admin user if no users configured
    if (!config.users || config.users.length === 0) {
      this.initializeDefaultUser();
    } else {
      config.users.forEach(user => {
        this.users.set(user.username, user);
      });
    }

    logger.info(`Auth manager initialized with ${this.users.size} users`);
  }

  private generateSecret(): string {
    const crypto = require('crypto');
    return crypto.randomBytes(64).toString('hex');
  }

  private async initializeDefaultUser(): Promise<void> {
    const defaultPassword = 'admin123';
    const hashedPassword = await bcrypt.hash(defaultPassword, this.bcryptRounds);

    const adminUser: User = {
      id: 'admin-1',
      username: 'admin',
      password: hashedPassword,
      role: 'admin',
      createdAt: new Date(),
    };

    this.users.set('admin', adminUser);

    logger.warn('Default admin user created (username: admin, password: admin123) - CHANGE THIS IN PRODUCTION!');
  }

  async login(username: string, password: string): Promise<string | null> {
    try {
      const user = this.users.get(username);

      if (!user) {
        logger.warn(`Login attempt for non-existent user: ${username}`);
        return null;
      }

      // Verify password
      const isValid = await bcrypt.compare(password, user.password);

      if (!isValid) {
        logger.warn(`Invalid password for user: ${username}`);
        return null;
      }

      // Generate JWT token
      const payload: TokenPayload = {
        userId: user.id,
        username: user.username,
        role: user.role,
      };

      const token = jwt.sign(payload, this.jwtSecret, {
        expiresIn: this.jwtExpiresIn,
      });

      logger.info(`User logged in: ${username}`);

      return token;
    } catch (error) {
      logger.error('Login error', error);
      return null;
    }
  }

  async verifyToken(token: string): Promise<TokenPayload | null> {
    try {
      const payload = jwt.verify(token, this.jwtSecret) as TokenPayload;
      return payload;
    } catch (error) {
      logger.error('Token verification failed', error);
      return null;
    }
  }

  async createUser(username: string, password: string, role: 'admin' | 'user' | 'readonly' = 'user'): Promise<User | null> {
    try {
      if (this.users.has(username)) {
        logger.warn(`User already exists: ${username}`);
        return null;
      }

      const hashedPassword = await bcrypt.hash(password, this.bcryptRounds);

      const user: User = {
        id: `user-${Date.now()}`,
        username,
        password: hashedPassword,
        role,
        createdAt: new Date(),
      };

      this.users.set(username, user);

      logger.info(`User created: ${username} (role: ${role})`);

      return user;
    } catch (error) {
      logger.error('Failed to create user', error);
      return null;
    }
  }

  async updatePassword(username: string, oldPassword: string, newPassword: string): Promise<boolean> {
    try {
      const user = this.users.get(username);

      if (!user) {
        return false;
      }

      // Verify old password
      const isValid = await bcrypt.compare(oldPassword, user.password);

      if (!isValid) {
        logger.warn(`Invalid old password for user: ${username}`);
        return false;
      }

      // Hash and update new password
      const hashedPassword = await bcrypt.hash(newPassword, this.bcryptRounds);
      user.password = hashedPassword;

      logger.info(`Password updated for user: ${username}`);

      return true;
    } catch (error) {
      logger.error('Failed to update password', error);
      return false;
    }
  }

  async deleteUser(username: string): Promise<boolean> {
    if (username === 'admin') {
      logger.warn('Cannot delete admin user');
      return false;
    }

    const deleted = this.users.delete(username);

    if (deleted) {
      logger.info(`User deleted: ${username}`);
    }

    return deleted;
  }

  getUser(username: string): User | undefined {
    return this.users.get(username);
  }

  getAllUsers(): User[] {
    return Array.from(this.users.values()).map(user => ({
      ...user,
      password: '[REDACTED]', // Don't expose passwords
    })) as User[];
  }

  hasPermission(role: string, requiredRole: string): boolean {
    const roleHierarchy: { [key: string]: number } = {
      readonly: 1,
      user: 2,
      admin: 3,
    };

    return (roleHierarchy[role] || 0) >= (roleHierarchy[requiredRole] || 0);
  }
}
