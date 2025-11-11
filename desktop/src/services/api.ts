/**
 * API Service
 * Client for MQTT Telemetry Server REST API
 */

import axios, { AxiosInstance } from 'axios';
import type {
  TelemetryMessage,
  QueryOptions,
  Schema,
  SystemStats,
  User,
  LoginCredentials,
  AuthToken,
  ExportFormat,
  HealthStatus,
  DataSummary,
} from '../types';

class ApiService {
  private client: AxiosInstance;
  private token: string | null = null;

  constructor(baseURL: string = 'http://localhost:3000') {
    this.client = axios.create({
      baseURL,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Request interceptor to add auth token
    this.client.interceptors.request.use((config) => {
      if (this.token) {
        config.headers.Authorization = `Bearer ${this.token}`;
      }
      return config;
    });

    // Load token from localStorage
    const savedToken = localStorage.getItem('authToken');
    if (savedToken) {
      this.token = savedToken;
    }
  }

  setBaseURL(url: string) {
    this.client.defaults.baseURL = url;
  }

  // ============ Authentication ============

  async login(credentials: LoginCredentials): Promise<AuthToken> {
    const response = await this.client.post<AuthToken>('/api/auth/login', credentials);
    this.token = response.data.token;
    localStorage.setItem('authToken', this.token);
    return response.data;
  }

  async getCurrentUser(): Promise<{ user: User }> {
    const response = await this.client.get<{ user: User }>('/api/auth/me');
    return response.data;
  }

  logout() {
    this.token = null;
    localStorage.removeItem('authToken');
  }

  isAuthenticated(): boolean {
    return this.token !== null;
  }

  // ============ Telemetry Data ============

  async queryData(options: QueryOptions): Promise<{ data: TelemetryMessage[]; count: number }> {
    const response = await this.client.get('/api/data', { params: options });
    return response.data;
  }

  async exportData(options: QueryOptions & { format: ExportFormat }): Promise<Blob> {
    const response = await this.client.get('/api/data/export', {
      params: options,
      responseType: 'blob',
    });
    return response.data;
  }

  async getDataSummary(options: Omit<QueryOptions, 'limit' | 'offset'>): Promise<DataSummary> {
    const response = await this.client.get('/api/data/summary', { params: options });
    return response.data;
  }

  // ============ Schemas ============

  async listSchemas(): Promise<{ schemas: Schema[] }> {
    const response = await this.client.get('/api/schemas');
    return response.data;
  }

  async getSchema(name: string): Promise<Schema> {
    const response = await this.client.get(`/api/schemas/${name}`);
    return response.data;
  }

  // ============ Statistics & Monitoring ============

  async getStats(): Promise<SystemStats> {
    const response = await this.client.get('/api/stats');
    return response.data;
  }

  async getBuffer(): Promise<{ size: number; capacity: number; usagePercent: number; dropped: number }> {
    const response = await this.client.get('/api/buffer');
    return response.data;
  }

  async getMetrics(): Promise<any> {
    const response = await this.client.get('/api/metrics');
    return response.data;
  }

  async getWebSocketClients(): Promise<{ count: number; clients: any[] }> {
    const response = await this.client.get('/api/websocket/clients');
    return response.data;
  }

  // ============ Health ============

  async getHealth(): Promise<{ status: string; alive: boolean; timestamp: string }> {
    const response = await this.client.get('/health');
    return response.data;
  }

  async getDetailedHealth(): Promise<HealthStatus> {
    const response = await this.client.get('/health/detailed');
    return response.data;
  }

  // ============ Admin Operations ============

  async listUsers(): Promise<{ users: User[] }> {
    const response = await this.client.get('/api/admin/users');
    return response.data;
  }

  async createUser(username: string, password: string, role: string = 'user'): Promise<{ user: User }> {
    const response = await this.client.post('/api/admin/users', { username, password, role });
    return response.data;
  }

  async deleteUser(username: string): Promise<{ message: string }> {
    const response = await this.client.delete(`/api/admin/users/${username}`);
    return response.data;
  }

  async getRetentionStatus(): Promise<any> {
    const response = await this.client.get('/api/admin/retention');
    return response.data;
  }

  async executeRetention(): Promise<{ message: string }> {
    const response = await this.client.post('/api/admin/retention/execute');
    return response.data;
  }

  async cleanup(before: string): Promise<{ deleted: number; before: string }> {
    const response = await this.client.post('/api/admin/cleanup', { before });
    return response.data;
  }
}

// Export singleton instance
export const api = new ApiService();
export default api;
