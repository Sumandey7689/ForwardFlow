import { Redis } from 'ioredis';
import { env } from './env.js';
import { logger } from './logger.js';

let redisClient: Redis | null = null;
let isRedisAvailable = false;

export function getRedisConnection(): Redis {
  if (!redisClient) {
    redisClient = new Redis(env.REDIS_URL, {
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
      retryStrategy(times) {
        if (times > 10) {
          logger.warn('Redis retry count exceeded, continuing with degraded functionality');
          return null; // Stop retrying
        }
        return Math.min(times * 1000, 5000);
      },
    });

    redisClient.on('connect', () => {
      isRedisAvailable = true;
      logger.info('Connected to Redis server');
    });

    redisClient.on('error', (err) => {
      isRedisAvailable = false;
      logger.warn({ err: err.message }, 'Redis connection warning (degraded queue operation active)');
    });
  }

  return redisClient;
}

export function isRedisConnected(): boolean {
  return isRedisAvailable && redisClient?.status === 'ready';
}
