/**
 * Configuration management
 */

import { readFile } from 'fs/promises';
import { resolve } from 'path';
import * as yaml from 'js-yaml';

export interface Config {
  mqtt: MqttConfig;
  database: DatabaseConfig;
  schema: SchemaConfig;
  buffer: BufferConfig;
  api: ApiConfig;
  graphql: GraphQLConfig;
  websocket: WebSocketConfig;
  storage: StorageConfig;
  aggregation: AggregationConfig;
  retention: RetentionConfig;
  monitoring: MonitoringConfig;
  logging: LoggingConfig;
  plugins: PluginsConfig;
  multiTenant: MultiTenantConfig;
}

export interface MqttConfig {
  broker: string;
  clientId: string;
  username?: string;
  password?: string;
  qos: 0 | 1 | 2;
  reconnectPeriod: number;
  topics: string[];
  tls?: {
    enabled: boolean;
    rejectUnauthorized: boolean;
    ca?: string;
    cert?: string;
    key?: string;
  };
}

export interface DatabaseConfig {
  primary: 'postgresql' | 'timescaledb' | 'influxdb' | 'sqlite';
  postgresql?: any;
  timescaledb?: any;
  influxdb?: any;
  sqlite?: any;
  redis?: any;
}

export interface SchemaConfig {
  path: string;
  validationEnabled: boolean;
  strictMode: boolean;
  autoDiscovery: boolean;
  cacheEnabled: boolean;
}

export interface BufferConfig {
  size: number;
  flushInterval: number;
  batchSize: number;
  highWaterMark: number;
  persistence?: {
    enabled: boolean;
    path: string;
  };
}

export interface ApiConfig {
  host: string;
  port: number;
  cors: {
    enabled: boolean;
    origins: string[];
  };
  rateLimit?: {
    enabled: boolean;
    max: number;
    timeWindow: number;
  };
  auth?: {
    enabled: boolean;
    jwtSecret: string;
    jwtExpiry: string;
  };
}

export interface GraphQLConfig {
  enabled: boolean;
  path: string;
  playground: boolean;
}

export interface WebSocketConfig {
  enabled: boolean;
  path: string;
  maxConnections: number;
  heartbeatInterval: number;
}

export interface StorageConfig {
  compression?: {
    enabled: boolean;
    algorithm: 'gzip' | 'zstd' | 'lz4';
    level: number;
  };
  encryption?: {
    enabled: boolean;
    algorithm: string;
    keyPath: string;
  };
}

export interface AggregationConfig {
  enabled: boolean;
  intervals: Array<{
    duration: string;
    functions: string[];
  }>;
}

export interface RetentionConfig {
  enabled: boolean;
  policies: Array<{
    name: string;
    duration: string;
    resolution: string;
  }>;
}

export interface MonitoringConfig {
  prometheus?: {
    enabled: boolean;
    port: number;
    path: string;
  };
  healthCheck?: {
    enabled: boolean;
    interval: number;
  };
  alerts?: any;
}

export interface LoggingConfig {
  level: string;
  format: string;
  destination: string;
  rotation?: any;
}

export interface PluginsConfig {
  enabled: boolean;
  path: string;
  autoload: boolean;
}

export interface MultiTenantConfig {
  enabled: boolean;
  isolation: 'schema' | 'database';
}

/**
 * Load configuration from file
 */
export async function loadConfig(): Promise<Config> {
  const configPath = process.env.CONFIG_PATH || resolve(__dirname, '../config.json');

  try {
    const content = await readFile(configPath, 'utf-8');

    let config: Config;

    if (configPath.endsWith('.yaml') || configPath.endsWith('.yml')) {
      config = yaml.load(content) as Config;
    } else {
      config = JSON.parse(content);
    }

    // Override with environment variables
    if (process.env.MQTT_BROKER) {
      config.mqtt.broker = process.env.MQTT_BROKER;
    }

    if (process.env.API_PORT) {
      config.api.port = parseInt(process.env.API_PORT);
    }

    if (process.env.DATABASE_URL) {
      // Parse DATABASE_URL for PostgreSQL
      const url = new URL(process.env.DATABASE_URL);
      config.database.postgresql = {
        host: url.hostname,
        port: parseInt(url.port) || 5432,
        database: url.pathname.slice(1),
        username: url.username,
        password: url.password,
      };
    }

    return config;

  } catch (error) {
    throw new Error(`Failed to load configuration: ${error}`);
  }
}

/**
 * Default configuration
 */
export function defaultConfig(): Config {
  return {
    mqtt: {
      broker: 'mqtt://localhost:1883',
      clientId: 'telemetry-server',
      qos: 1,
      reconnectPeriod: 5000,
      topics: [],
    },
    database: {
      primary: 'sqlite',
      sqlite: {
        path: './data/telemetry.db',
      },
    },
    schema: {
      path: '../shared/schemas',
      validationEnabled: true,
      strictMode: false,
      autoDiscovery: true,
      cacheEnabled: true,
    },
    buffer: {
      size: 50000,
      flushInterval: 5000,
      batchSize: 500,
      highWaterMark: 40000,
    },
    api: {
      host: '0.0.0.0',
      port: 3000,
      cors: {
        enabled: true,
        origins: ['*'],
      },
    },
    graphql: {
      enabled: true,
      path: '/graphql',
      playground: true,
    },
    websocket: {
      enabled: true,
      path: '/ws',
      maxConnections: 1000,
      heartbeatInterval: 30000,
    },
    storage: {},
    aggregation: {
      enabled: false,
      intervals: [],
    },
    retention: {
      enabled: false,
      policies: [],
    },
    monitoring: {},
    logging: {
      level: 'info',
      format: 'json',
      destination: './logs/telemetry.log',
    },
    plugins: {
      enabled: false,
      path: './plugins',
      autoload: false,
    },
    multiTenant: {
      enabled: false,
      isolation: 'schema',
    },
  };
}
