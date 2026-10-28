import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { env } from './config/env.js';
import apiRouter from './routes/index.js';
import { apiRateLimiter } from './middlewares/rateLimit.js';
import { errorHandler } from './utils/errors.js';

export function createApp() {
  const app = express();

  // Security Headers
  app.use(
    helmet({
      contentSecurityPolicy: env.NODE_ENV === 'production' ? undefined : false,
      crossOriginEmbedderPolicy: false,
    })
  );

  // CORS Configuration
  app.use(
    cors({
      origin: env.CORS_ORIGIN,
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization'],
    })
  );

  // Body Parsing & Cookies
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));
  app.use(cookieParser());

  // Global API Rate Limiter
  app.use('/api', apiRateLimiter);

  // Mount v1 API
  app.use('/api/v1', apiRouter);

  // Root health check
  app.get('/health', (_req, res) => {
    res.redirect('/api/v1/health');
  });

  // Global Error Handler
  app.use(errorHandler);

  return app;
}
