/**
 * MQTT Telemetry Server
 * Main entry point
 */

import { config } from 'dotenv';
import { resolve } from 'path';
import { createServer } from './server';
import { logger } from './utils/logger';
import { loadConfig } from './config';

// Load environment variables
config();

async function main() {
  try {
    logger.info('Starting MQTT Telemetry Server');
    logger.info(`Node version: ${process.version}`);
    logger.info(`Platform: ${process.platform}`);

    // Load configuration
    const cfg = await loadConfig();
    logger.info('Configuration loaded');

    // Create and start server
    const server = await createServer(cfg);

    await server.start();

    logger.info(`Server running at ${cfg.api.host}:${cfg.api.port}`);
    logger.info('MQTT Telemetry Server started successfully');

    // Handle shutdown gracefully
    const shutdown = async (signal: string) => {
      logger.info(`Received ${signal}, shutting down gracefully...`);

      try {
        await server.stop();
        logger.info('Server stopped successfully');
        process.exit(0);
      } catch (error) {
        logger.error('Error during shutdown', error);
        process.exit(1);
      }
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));

  } catch (error) {
    logger.error('Fatal error starting server', error);
    process.exit(1);
  }
}

// Start the server
main();
