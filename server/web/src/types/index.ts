/**
 * Type Definitions for MQTT Telemetry Desktop App
 */

// ============ Telemetry Data ============

export interface TelemetryMessage {
  id?: string;
  topic: string;
  payload: any;
  timestamp: string;
  receivedAt?: string;
}

export interface QueryOptions {
  topic?: string;
  startTime?: string;
  endTime?: string;
  limit?: number;
  offset?: number;
}

export interface DataSummary {
  count: number;
  topics: string[];
  topicCount: number;
  dateRange: {
    start: string;
    end: string;
  };
  exportedAt: string;
}

// ============ Schema ============

export interface Schema {
  name: string;
  version: string;
  description?: string;
  schema: any; // JSON Schema
}

// ============ Statistics ============

export interface SystemStats {
  messagesReceived: number;
  messagesStored: number;
  messagesFailed: number;
  messagesPerSecond: number;
  bufferSize: number;
  bufferCapacity: number;
  bufferUsagePercent: number;
  storageLatencyMs: number;
  websocketConnections: number;
  uptimeSeconds: number;
  memoryUsageMB: number;
  database?: any;
}

// ============ Authentication ============

export interface User {
  userId: string;
  username: string;
  role: 'admin' | 'user' | 'readonly';
}

export interface LoginCredentials {
  username: string;
  password: string;
}

export interface AuthToken {
  token: string;
  expiresIn: string;
}

// ============ WebSocket ============

export interface WebSocketMessage {
  type: 'connected' | 'message' | 'subscribed' | 'unsubscribed' | 'pong';
  clientId?: string;
  topic?: string;
  payload?: any;
  timestamp: string;
}

// ============ Export ============

export type ExportFormat = 'json' | 'csv' | 'ndjson';

// ============ Settings ============

export interface AppSettings {
  server: {
    url: string;
    autoConnect: boolean;
  };
  mqtt: {
    broker: string;
    port: number;
    username?: string;
    password?: string;
  };
  display: {
    theme: 'light' | 'dark';
    messageLimit: number;
    autoRefresh: boolean;
    refreshInterval: number; // seconds
  };
}

// ============ Health ============

export interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  uptime: number;
  components: {
    [key: string]: ComponentHealth;
  };
}

export interface ComponentHealth {
  status: 'healthy' | 'degraded' | 'unhealthy';
  message?: string;
  latency?: number;
  details?: any;
}
