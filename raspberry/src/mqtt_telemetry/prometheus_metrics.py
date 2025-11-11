"""
Prometheus metrics exporter
"""

from prometheus_client import Counter, Gauge, Histogram, generate_latest, CONTENT_TYPE_LATEST
from fastapi import Response
import time
import logging

logger = logging.getLogger(__name__)


class PrometheusMetrics:
    """Prometheus metrics collector"""

    def __init__(self):
        # Counters
        self.messages_received = Counter(
            'mqtt_messages_received_total',
            'Total number of MQTT messages received'
        )

        self.messages_stored = Counter(
            'mqtt_messages_stored_total',
            'Total number of messages successfully stored'
        )

        self.messages_dropped = Counter(
            'mqtt_messages_dropped_total',
            'Total number of messages dropped due to buffer full'
        )

        self.validation_errors = Counter(
            'mqtt_validation_errors_total',
            'Total number of schema validation errors'
        )

        self.storage_errors = Counter(
            'mqtt_storage_errors_total',
            'Total number of storage errors'
        )

        self.mqtt_reconnects = Counter(
            'mqtt_reconnects_total',
            'Total number of MQTT reconnections'
        )

        # Gauges
        self.buffer_size = Gauge(
            'mqtt_buffer_size',
            'Current number of messages in buffer'
        )

        self.buffer_usage_percent = Gauge(
            'mqtt_buffer_usage_percent',
            'Buffer usage percentage'
        )

        self.connected = Gauge(
            'mqtt_connected',
            'MQTT connection status (1=connected, 0=disconnected)'
        )

        self.websocket_connections = Gauge(
            'websocket_connections_active',
            'Number of active WebSocket connections'
        )

        # Histograms
        self.storage_latency = Histogram(
            'mqtt_storage_latency_seconds',
            'Storage operation latency in seconds',
            buckets=[0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1.0, 5.0]
        )

        self.message_size = Histogram(
            'mqtt_message_size_bytes',
            'MQTT message size in bytes',
            buckets=[100, 500, 1000, 5000, 10000, 50000]
        )

    def record_message_received(self):
        """Record a message received"""
        self.messages_received.inc()

    def record_message_stored(self):
        """Record a message stored"""
        self.messages_stored.inc()

    def record_message_dropped(self):
        """Record a message dropped"""
        self.messages_dropped.inc()

    def record_validation_error(self):
        """Record a validation error"""
        self.validation_errors.inc()

    def record_storage_error(self):
        """Record a storage error"""
        self.storage_errors.inc()

    def record_mqtt_reconnect(self):
        """Record an MQTT reconnection"""
        self.mqtt_reconnects.inc()

    def set_buffer_size(self, size: int):
        """Set current buffer size"""
        self.buffer_size.set(size)

    def set_buffer_usage(self, percent: float):
        """Set buffer usage percentage"""
        self.buffer_usage_percent.set(percent)

    def set_connected(self, connected: bool):
        """Set MQTT connection status"""
        self.connected.set(1 if connected else 0)

    def set_websocket_connections(self, count: int):
        """Set number of WebSocket connections"""
        self.websocket_connections.set(count)

    def observe_storage_latency(self, latency: float):
        """Observe storage operation latency"""
        self.storage_latency.observe(latency)

    def observe_message_size(self, size: int):
        """Observe message size"""
        self.message_size.observe(size)

    def get_metrics(self) -> Response:
        """Generate Prometheus metrics response"""
        return Response(
            content=generate_latest(),
            media_type=CONTENT_TYPE_LATEST
        )


class MetricsMiddleware:
    """Middleware to automatically track metrics"""

    def __init__(self, metrics: PrometheusMetrics, stats):
        self.metrics = metrics
        self.stats = stats
        self.start_time = time.time()

    async def update_from_stats(self):
        """Update Prometheus metrics from statistics"""
        if not self.stats:
            return

        all_stats = self.stats.get_all()

        # Update gauges from stats
        if 'buffer_usage' in all_stats:
            self.metrics.set_buffer_usage(all_stats['buffer_usage'])

        # Note: Counters are updated directly when events occur,
        # not from stats to avoid duplicate counting
