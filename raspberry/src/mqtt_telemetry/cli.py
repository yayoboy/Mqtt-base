"""
Command-line interface
"""

import click
import logging
import sys
from pathlib import Path

from .client import MqttTelemetryClient
from .config import Config


def setup_logging(level: str, log_file: str = None):
    """Setup logging configuration"""
    log_level = getattr(logging, level.upper(), logging.INFO)

    handlers = [logging.StreamHandler(sys.stdout)]

    if log_file:
        handlers.append(logging.FileHandler(log_file))

    logging.basicConfig(
        level=log_level,
        format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
        handlers=handlers
    )


@click.command()
@click.option(
    '--config', '-c',
    type=click.Path(exists=True),
    help='Path to configuration file'
)
@click.option(
    '--schema', '-s',
    type=click.Path(exists=True),
    help='Path to schema file or directory'
)
@click.option(
    '--broker', '-b',
    help='MQTT broker address'
)
@click.option(
    '--port', '-p',
    type=int,
    default=1883,
    help='MQTT broker port'
)
@click.option(
    '--storage',
    type=click.Choice(['sqlite', 'postgresql', 'filesystem']),
    default='sqlite',
    help='Storage backend'
)
@click.option(
    '--debug',
    is_flag=True,
    help='Enable debug logging'
)
def main(config, schema, broker, port, storage, debug):
    """
    MQTT Telemetry Storage System

    Start the MQTT telemetry client with the specified configuration.
    """
    # Load configuration
    if config:
        cfg = Config.from_file(config)
    else:
        cfg = Config.default()

    # Override with CLI options
    if broker:
        cfg.set("mqtt.broker", broker)
        cfg.set("mqtt.port", port)

    if schema:
        cfg.set("schema.path", schema)

    if storage:
        cfg.set("storage.backend", storage)

    # Setup logging
    log_level = "DEBUG" if debug else cfg.get("logging.level", "INFO")
    log_file = cfg.get("logging.file")
    setup_logging(log_level, log_file)

    logger = logging.getLogger(__name__)
    logger.info("Starting MQTT Telemetry System")
    logger.info(f"Configuration: broker={cfg.mqtt['broker']}, storage={cfg.storage['backend']}")

    # Create and run client
    try:
        client = MqttTelemetryClient(config=cfg)
        client.run()
    except KeyboardInterrupt:
        logger.info("Shutting down...")
    except Exception as e:
        logger.error(f"Fatal error: {e}", exc_info=True)
        sys.exit(1)


if __name__ == '__main__':
    main()
