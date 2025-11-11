"""
Integrated server with web interface, WebSocket, and Prometheus metrics
"""

import asyncio
import logging
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import uvicorn

from .config import Config
from .client import MqttTelemetryClient
from .web import WebInterface
from .prometheus_metrics import PrometheusMetrics, MetricsMiddleware
from .retention import RetentionScheduler

logger = logging.getLogger(__name__)


class TelemetryServer:
    """
    Integrated MQTT Telemetry Server
    Combines MQTT client, web interface, WebSocket, and monitoring
    """

    def __init__(self, config: Config):
        self.config = config

        # Create FastAPI app
        self.app = FastAPI(
            title="MQTT Telemetry API",
            description="MQTT Telemetry Storage System with real-time monitoring",
            version="1.0.0"
        )

        # CORS
        if config.web.get('cors_enabled', True):
            origins = config.web.get('cors_origins', ['*'])
            self.app.add_middleware(
                CORSMiddleware,
                allow_origins=origins,
                allow_credentials=True,
                allow_methods=["*"],
                allow_headers=["*"],
            )

        # Prometheus metrics
        self.metrics = PrometheusMetrics()

        # MQTT Telemetry Client
        self.mqtt_client = MqttTelemetryClient(config=config)

        # Web Interface
        self.web = WebInterface(
            app=self.app,
            config=config.to_dict(),
            dependencies={
                'database': self.mqtt_client.storage,
                'schema_validator': self.mqtt_client.validator,
                'buffer': self.mqtt_client.buffer,
                'stats': self.mqtt_client.stats
            }
        )

        # Metrics middleware
        self.metrics_middleware = MetricsMiddleware(
            self.metrics,
            self.mqtt_client.stats
        )

        # Retention scheduler
        self.retention = RetentionScheduler(
            storage=self.mqtt_client.storage,
            config=config.to_dict()
        )

        # Register Prometheus endpoint
        self._register_prometheus()

        # Hooks
        self._setup_mqtt_hooks()

    def _register_prometheus(self):
        """Register Prometheus metrics endpoint"""
        prometheus_config = self.config.monitoring.get('prometheus', {})

        if prometheus_config.get('enabled', True):
            path = prometheus_config.get('path', '/metrics')

            @self.app.get(path)
            async def metrics():
                await self.metrics_middleware.update_from_stats()
                return self.metrics.get_metrics()

            logger.info(f"Prometheus metrics enabled at {path}")

    def _setup_mqtt_hooks(self):
        """Setup hooks to track metrics on MQTT events"""
        original_callback = self.mqtt_client.message_callback

        async def metrics_callback(topic, payload):
            self.metrics.record_message_received()

            # Update metrics
            if self.mqtt_client.buffer:
                self.metrics.set_buffer_size(len(self.mqtt_client.buffer))
                self.metrics.set_buffer_usage(self.mqtt_client.buffer.usage_percent())

            # Broadcast to WebSocket
            try:
                await self.web.broadcast_message(topic, payload)
            except Exception as e:
                logger.error(f"Error broadcasting to WebSocket: {e}")

            if original_callback:
                await original_callback(topic, payload)

        self.mqtt_client.set_message_callback(metrics_callback)

    async def start(self):
        """Start all services"""
        logger.info("Starting MQTT Telemetry Server")

        # Start MQTT client
        await self.mqtt_client.start()

        # Start retention scheduler
        await self.retention.start()

        logger.info("MQTT Telemetry Server started successfully")

    async def stop(self):
        """Stop all services"""
        logger.info("Stopping MQTT Telemetry Server")

        # Stop retention
        await self.retention.stop()

        # Stop MQTT client
        await self.mqtt_client.stop()

        logger.info("MQTT Telemetry Server stopped")

    def run(self, host: str = None, port: int = None):
        """
        Run the server with uvicorn

        Args:
            host: Server host (default from config)
            port: Server port (default from config)
        """
        host = host or self.config.web.get('host', '0.0.0.0')
        port = port or self.config.web.get('port', 8080)

        # Start MQTT and retention in background
        @self.app.on_event("startup")
        async def startup():
            await self.start()

        @self.app.on_event("shutdown")
        async def shutdown():
            await self.stop()

        # Run uvicorn
        uvicorn.run(
            self.app,
            host=host,
            port=port,
            log_level=self.config.logging.get('level', 'info').lower()
        )


async def run_server_async(config: Config):
    """Run server asynchronously (for use in existing event loop)"""
    server = TelemetryServer(config)
    await server.start()

    try:
        # Keep running
        while True:
            await asyncio.sleep(1)
    except KeyboardInterrupt:
        pass
    finally:
        await server.stop()
