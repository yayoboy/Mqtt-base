/**
 * Prometheus Metrics Service
 * Provides monitoring metrics for the telemetry server
 */

import { logger } from '../utils/logger';

export interface Metrics {
  // Message metrics
  messagesReceived: number;
  messagesStored: number;
  messagesFailed: number;
  messagesPerSecond: number;

  // Buffer metrics
  bufferSize: number;
  bufferCapacity: number;
  bufferUsagePercent: number;

  // Storage metrics
  storageLatencyMs: number;
  storageErrorsTotal: number;

  // WebSocket metrics
  websocketConnections: number;
  websocketMessagesSent: number;

  // MQTT metrics
  mqttConnected: boolean;
  mqttReconnects: number;

  // System metrics
  uptimeSeconds: number;
  memoryUsageMB: number;
}

export class PrometheusMetrics {
  private metrics: Metrics;
  private startTime: number;
  private messageTimestamps: number[] = [];

  constructor() {
    this.startTime = Date.now();
    this.metrics = this.initializeMetrics();

    logger.info('Prometheus metrics service initialized');
  }

  private initializeMetrics(): Metrics {
    return {
      messagesReceived: 0,
      messagesStored: 0,
      messagesFailed: 0,
      messagesPerSecond: 0,
      bufferSize: 0,
      bufferCapacity: 0,
      bufferUsagePercent: 0,
      storageLatencyMs: 0,
      storageErrorsTotal: 0,
      websocketConnections: 0,
      websocketMessagesSent: 0,
      mqttConnected: false,
      mqttReconnects: 0,
      uptimeSeconds: 0,
      memoryUsageMB: 0,
    };
  }

  incrementMessagesReceived(): void {
    this.metrics.messagesReceived++;
    this.messageTimestamps.push(Date.now());

    // Keep only last 60 seconds of timestamps
    const cutoff = Date.now() - 60000;
    this.messageTimestamps = this.messageTimestamps.filter(ts => ts > cutoff);

    this.metrics.messagesPerSecond = this.messageTimestamps.length / 60;
  }

  incrementMessagesStored(): void {
    this.metrics.messagesStored++;
  }

  incrementMessagesFailed(): void {
    this.metrics.messagesFailed++;
  }

  setBufferMetrics(size: number, capacity: number): void {
    this.metrics.bufferSize = size;
    this.metrics.bufferCapacity = capacity;
    this.metrics.bufferUsagePercent = capacity > 0 ? (size / capacity) * 100 : 0;
  }

  recordStorageLatency(latencyMs: number): void {
    // Exponential moving average
    const alpha = 0.1;
    this.metrics.storageLatencyMs =
      this.metrics.storageLatencyMs * (1 - alpha) + latencyMs * alpha;
  }

  incrementStorageErrors(): void {
    this.metrics.storageErrorsTotal++;
  }

  setWebSocketConnections(count: number): void {
    this.metrics.websocketConnections = count;
  }

  incrementWebSocketMessagesSent(): void {
    this.metrics.websocketMessagesSent++;
  }

  setMqttConnected(connected: boolean): void {
    this.metrics.mqttConnected = connected;
  }

  incrementMqttReconnects(): void {
    this.metrics.mqttReconnects++;
  }

  getMetrics(): Metrics {
    // Update dynamic metrics
    this.metrics.uptimeSeconds = Math.floor((Date.now() - this.startTime) / 1000);
    this.metrics.memoryUsageMB = Math.round(process.memoryUsage().heapUsed / 1024 / 1024);

    return { ...this.metrics };
  }

  getPrometheusFormat(): string {
    const m = this.getMetrics();

    return `
# HELP mqtt_messages_received_total Total number of MQTT messages received
# TYPE mqtt_messages_received_total counter
mqtt_messages_received_total ${m.messagesReceived}

# HELP mqtt_messages_stored_total Total number of messages successfully stored
# TYPE mqtt_messages_stored_total counter
mqtt_messages_stored_total ${m.messagesStored}

# HELP mqtt_messages_failed_total Total number of messages that failed to store
# TYPE mqtt_messages_failed_total counter
mqtt_messages_failed_total ${m.messagesFailed}

# HELP mqtt_messages_per_second Current message rate (messages per second)
# TYPE mqtt_messages_per_second gauge
mqtt_messages_per_second ${m.messagesPerSecond.toFixed(2)}

# HELP mqtt_buffer_size Current number of messages in buffer
# TYPE mqtt_buffer_size gauge
mqtt_buffer_size ${m.bufferSize}

# HELP mqtt_buffer_capacity Maximum buffer capacity
# TYPE mqtt_buffer_capacity gauge
mqtt_buffer_capacity ${m.bufferCapacity}

# HELP mqtt_buffer_usage_percent Buffer usage percentage
# TYPE mqtt_buffer_usage_percent gauge
mqtt_buffer_usage_percent ${m.bufferUsagePercent.toFixed(2)}

# HELP mqtt_storage_latency_ms Average storage latency in milliseconds
# TYPE mqtt_storage_latency_ms gauge
mqtt_storage_latency_ms ${m.storageLatencyMs.toFixed(2)}

# HELP mqtt_storage_errors_total Total number of storage errors
# TYPE mqtt_storage_errors_total counter
mqtt_storage_errors_total ${m.storageErrorsTotal}

# HELP mqtt_websocket_connections Current number of WebSocket connections
# TYPE mqtt_websocket_connections gauge
mqtt_websocket_connections ${m.websocketConnections}

# HELP mqtt_websocket_messages_sent_total Total WebSocket messages sent
# TYPE mqtt_websocket_messages_sent_total counter
mqtt_websocket_messages_sent_total ${m.websocketMessagesSent}

# HELP mqtt_connected MQTT broker connection status (1=connected, 0=disconnected)
# TYPE mqtt_connected gauge
mqtt_connected ${m.mqttConnected ? 1 : 0}

# HELP mqtt_reconnects_total Total number of MQTT reconnections
# TYPE mqtt_reconnects_total counter
mqtt_reconnects_total ${m.mqttReconnects}

# HELP mqtt_uptime_seconds Server uptime in seconds
# TYPE mqtt_uptime_seconds counter
mqtt_uptime_seconds ${m.uptimeSeconds}

# HELP mqtt_memory_usage_mb Memory usage in megabytes
# TYPE mqtt_memory_usage_mb gauge
mqtt_memory_usage_mb ${m.memoryUsageMB}
`.trim();
  }

  reset(): void {
    this.metrics = this.initializeMetrics();
    this.startTime = Date.now();
    this.messageTimestamps = [];
    logger.info('Metrics reset');
  }
}
