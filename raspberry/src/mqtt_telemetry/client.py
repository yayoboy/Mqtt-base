"""
Main MQTT Telemetry Client
"""

import asyncio
import logging
from typing import Optional, Callable, Dict, Any, List
from datetime import datetime
import json

import paho.mqtt.client as mqtt
from asyncio_mqtt import Client as AsyncMqttClient

from .config import Config
from .schema import SchemaValidator
from .storage import get_storage_backend
from .buffer import MessageBuffer
from .stats import Statistics

logger = logging.getLogger(__name__)


class MqttTelemetryClient:
    """
    Main MQTT Telemetry Client for Raspberry Pi

    Handles MQTT connections, message validation, buffering, and storage.
    """

    def __init__(
        self,
        config: Optional[Config] = None,
        broker: Optional[str] = None,
        storage_backend: Optional[str] = None,
        **kwargs
    ):
        """
        Initialize the MQTT Telemetry Client

        Args:
            config: Configuration object
            broker: MQTT broker address
            storage_backend: Storage backend type
            **kwargs: Additional configuration options
        """
        self.config = config or Config.from_dict({
            "mqtt": {"broker": broker or "localhost"},
            "storage": {"backend": storage_backend or "sqlite"},
            **kwargs
        })

        self.mqtt_client: Optional[AsyncMqttClient] = None
        self.validator = SchemaValidator(
            schema_path=self.config.schema.get("path"),
            enabled=self.config.schema.get("validation_enabled", True)
        )

        self.storage = get_storage_backend(
            self.config.storage["backend"],
            self.config.storage
        )

        self.buffer = MessageBuffer(
            size=self.config.buffer.get("size", 10000),
            flush_interval=self.config.buffer.get("flush_interval_sec", 5),
            batch_size=self.config.buffer.get("batch_size", 100)
        )

        self.stats = Statistics()
        self.running = False
        self.tasks: List[asyncio.Task] = []

        # Callbacks
        self.message_callback: Optional[Callable] = None
        self.error_callback: Optional[Callable] = None

        logger.info("MQTT Telemetry Client initialized")

    async def connect(self) -> bool:
        """Connect to MQTT broker"""
        try:
            mqtt_config = self.config.mqtt

            self.mqtt_client = AsyncMqttClient(
                hostname=mqtt_config["broker"],
                port=mqtt_config.get("port", 1883),
                username=mqtt_config.get("username"),
                password=mqtt_config.get("password"),
                client_id=mqtt_config.get("client_id", "raspberry-telemetry"),
                keepalive=mqtt_config.get("keepalive", 60)
            )

            await self.mqtt_client.__aenter__()
            logger.info(f"Connected to MQTT broker: {mqtt_config['broker']}")
            self.stats.increment("mqtt_connects")
            return True

        except Exception as e:
            logger.error(f"Failed to connect to MQTT broker: {e}")
            if self.error_callback:
                await self.error_callback("mqtt_connection_failed", str(e))
            return False

    async def disconnect(self):
        """Disconnect from MQTT broker"""
        if self.mqtt_client:
            await self.mqtt_client.__aexit__(None, None, None)
            logger.info("Disconnected from MQTT broker")

    async def subscribe(self, topic: str, qos: int = 0):
        """
        Subscribe to MQTT topic

        Args:
            topic: MQTT topic pattern
            qos: Quality of Service level
        """
        if not self.mqtt_client:
            raise RuntimeError("Not connected to MQTT broker")

        await self.mqtt_client.subscribe(topic, qos)
        logger.info(f"Subscribed to topic: {topic}")
        self.stats.add_subscription(topic)

    async def start(self):
        """Start the telemetry client"""
        if self.running:
            logger.warning("Client already running")
            return

        self.running = True
        logger.info("Starting MQTT Telemetry Client")

        # Initialize storage
        await self.storage.initialize()

        # Connect to MQTT
        if not await self.connect():
            raise RuntimeError("Failed to connect to MQTT broker")

        # Subscribe to configured topics
        for topic in self.config.mqtt.get("topics", []):
            await self.subscribe(topic)

        # Start background tasks
        self.tasks = [
            asyncio.create_task(self._message_processor()),
            asyncio.create_task(self._storage_worker()),
            asyncio.create_task(self._health_monitor()),
            asyncio.create_task(self._mqtt_listener())
        ]

        logger.info("MQTT Telemetry Client started")

    async def stop(self):
        """Stop the telemetry client"""
        if not self.running:
            return

        self.running = False
        logger.info("Stopping MQTT Telemetry Client")

        # Cancel all tasks
        for task in self.tasks:
            task.cancel()

        await asyncio.gather(*self.tasks, return_exceptions=True)

        # Flush buffer
        await self.buffer.flush()

        # Close storage
        await self.storage.close()

        # Disconnect MQTT
        await self.disconnect()

        logger.info("MQTT Telemetry Client stopped")

    async def _mqtt_listener(self):
        """Listen for MQTT messages"""
        try:
            async with self.mqtt_client.messages() as messages:
                async for message in messages:
                    await self._handle_message(
                        message.topic.value,
                        message.payload.decode(),
                        message.timestamp
                    )
        except asyncio.CancelledError:
            pass
        except Exception as e:
            logger.error(f"Error in MQTT listener: {e}")

    async def _handle_message(self, topic: str, payload: str, timestamp: float):
        """Handle incoming MQTT message"""
        try:
            self.stats.increment("messages_received")

            # Call user callback
            if self.message_callback:
                await self.message_callback(topic, payload)

            # Validate schema
            if self.validator.enabled:
                validation_result = self.validator.validate(topic, payload)
                if not validation_result.valid:
                    self.stats.increment("validation_errors")
                    logger.warning(
                        f"Schema validation failed for topic {topic}: "
                        f"{validation_result.error}"
                    )
                    return

            # Add to buffer
            message = {
                "topic": topic,
                "payload": json.loads(payload),
                "timestamp": datetime.fromtimestamp(timestamp),
                "received_at": datetime.now()
            }

            await self.buffer.push(message)

        except Exception as e:
            logger.error(f"Error handling message: {e}")
            self.stats.increment("processing_errors")

    async def _message_processor(self):
        """Process messages from buffer"""
        while self.running:
            try:
                await asyncio.sleep(0.1)
                # Buffer processes itself with flush intervals
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"Error in message processor: {e}")

    async def _storage_worker(self):
        """Worker for storing messages to backend"""
        while self.running:
            try:
                # Get batch of messages from buffer
                messages = await self.buffer.get_batch()

                if messages:
                    # Store to backend
                    success = await self.storage.store_batch(messages)

                    if success:
                        self.stats.add("messages_stored", len(messages))
                    else:
                        self.stats.add("storage_errors", len(messages))
                        # Put messages back in buffer
                        for msg in messages:
                            await self.buffer.push(msg)

                await asyncio.sleep(0.1)

            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"Error in storage worker: {e}")

    async def _health_monitor(self):
        """Monitor system health"""
        interval = self.config.monitoring.get("health_check", {}).get("interval_sec", 30)

        while self.running:
            try:
                await asyncio.sleep(interval)

                # Check buffer usage
                buffer_usage = self.buffer.usage_percent()
                if buffer_usage > 90:
                    logger.warning(f"Buffer usage high: {buffer_usage:.1f}%")

                # Check storage space
                storage_info = await self.storage.get_info()
                if storage_info.get("free_space_percent", 100) < 10:
                    logger.warning("Storage space low!")

                # Update stats
                self.stats.set("buffer_usage", buffer_usage)
                self.stats.set("uptime", self.stats.uptime())

            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"Error in health monitor: {e}")

    def run(self):
        """
        Run the client (blocking)

        This method will block until the client is stopped.
        """
        try:
            asyncio.run(self._run_async())
        except KeyboardInterrupt:
            logger.info("Interrupted by user")

    async def _run_async(self):
        """Async run method"""
        await self.start()

        try:
            # Keep running until stopped
            while self.running:
                await asyncio.sleep(1)
        finally:
            await self.stop()

    def set_message_callback(self, callback: Callable):
        """Set callback for received messages"""
        self.message_callback = callback

    def set_error_callback(self, callback: Callable):
        """Set callback for errors"""
        self.error_callback = callback

    def get_stats(self) -> Dict[str, Any]:
        """Get current statistics"""
        return self.stats.get_all()
