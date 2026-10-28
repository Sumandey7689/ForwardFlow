import http from 'http';
import { createApp } from './app.js';
import { env } from './config/env.js';
import { logger } from './config/logger.js';
import { initSocketIO } from './socket/socketManager.js';
import { ForwardingEngine } from './engine/ForwardingEngine.js';
import { forwardingQueue } from './engine/ForwardingQueue.js';
import { WhatsAppProviderFactory } from './whatsapp/WhatsAppProviderFactory.js';
import { prisma } from './config/prisma.js';

const app = createApp();
const server = http.createServer(app);

// Initialize Real-time Socket.IO
initSocketIO(server);

// Initialize Forwarding Engine
ForwardingEngine.initialize();

// Start Server
server.listen(env.PORT, () => {
  logger.info(`🚀 ForwardFlow WhatsApp Auto-Forwarder Server running on port ${env.PORT}`);
  logger.info(`   Environment: ${env.NODE_ENV}`);
  logger.info(`   Health check: http://localhost:${env.PORT}/api/v1/health`);
});

// Graceful Shutdown
async function handleShutdown(signal: string) {
  logger.info(`Received ${signal}. Gracefully shutting down...`);

  try {
    server.close(() => {
      logger.info('HTTP server closed');
    });

    await WhatsAppProviderFactory.destroyAll();
    await forwardingQueue.close();
    await prisma.$disconnect();

    logger.info('Graceful shutdown completed');
    process.exit(0);
  } catch (err: any) {
    logger.error({ err: err.message }, 'Error during shutdown');
    process.exit(1);
  }
}

process.on('SIGINT', () => handleShutdown('SIGINT'));
process.on('SIGTERM', () => handleShutdown('SIGTERM'));
