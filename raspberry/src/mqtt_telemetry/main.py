"""
Main entry point for server mode
"""

import asyncio
from .server import TelemetryServer
from .config import Config
import logging
import sys

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)

logger = logging.getLogger(__name__)


def main_server():
    """Main function for server mode with web interface"""
    import argparse

    parser = argparse.ArgumentParser(description='MQTT Telemetry Server')
    parser.add_argument('--config', '-c', help='Path to configuration file')
    parser.add_argument('--host', help='Server host (default: 0.0.0.0)')
    parser.add_argument('--port', type=int, help='Server port (default: 8080)')
    parser.add_argument('--debug', action='store_true', help='Enable debug logging')

    args = parser.parse_args()

    if args.debug:
        logging.getLogger().setLevel(logging.DEBUG)

    try:
        # Load configuration
        if args.config:
            config = Config.from_file(args.config)
        else:
            config = Config.default()
            logger.warning("No config file specified, using defaults")

        # Create and run server
        server = TelemetryServer(config)
        server.run(host=args.host, port=args.port)

    except KeyboardInterrupt:
        logger.info("Shutting down...")
    except Exception as e:
        logger.error(f"Fatal error: {e}", exc_info=True)
        sys.exit(1)


if __name__ == '__main__':
    main_server()
