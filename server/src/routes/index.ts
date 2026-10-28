import { Router } from 'express';
import authRoutes from './authRoutes.js';
import whatsappRoutes from './whatsappRoutes.js';
import conversationRoutes from './conversationRoutes.js';
import ruleRoutes from './ruleRoutes.js';
import activityRoutes from './activityRoutes.js';
import { prisma } from '../config/prisma.js';
import { isRedisConnected } from '../config/redis.js';

const apiRouter = Router();

apiRouter.use('/auth', authRoutes);
apiRouter.use('/whatsapp', whatsappRoutes);
apiRouter.use('/whatsapp', conversationRoutes);
apiRouter.use('/forwarding-rules', ruleRoutes);
apiRouter.use('/activity', activityRoutes);

// Health check endpoint
apiRouter.get('/health', async (_req, res) => {
  let dbStatus = 'healthy';
  try {
    await prisma.$queryRaw`SELECT 1`;
  } catch {
    dbStatus = 'unhealthy';
  }

  const redisStatus = isRedisConnected() ? 'healthy' : 'degraded';

  const overall = dbStatus === 'healthy' ? 'ok' : 'error';
  res.status(overall === 'ok' ? 200 : 503).json({
    status: overall,
    timestamp: new Date().toISOString(),
    services: {
      database: dbStatus,
      redis: redisStatus,
      whatsappWorker: 'running',
    },
  });
});

export default apiRouter;
