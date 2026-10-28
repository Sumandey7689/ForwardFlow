import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const envSchema = z.object({
  PORT: z.string().default('5000').transform(val => parseInt(val, 10)),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  REDIS_URL: z.string().default('redis://localhost:6379'),
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters long'),
  SESSION_ENCRYPTION_KEY: z.string().length(64, 'SESSION_ENCRYPTION_KEY must be a 64-character hex string (32 bytes)'),
  CORS_ORIGIN: z.string().default('http://localhost:5173'),
  MEDIA_TEMP_DIR: z.string().default('./temp_media'),
  WHATSAPP_SESSIONS_DIR: z.string().default('./sessions'),
  LOG_LEVEL: z.string().default('info'),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('❌ Invalid environment variables:', parsed.error.format());
  throw new Error('Invalid environment configuration');
}

export const env = parsed.data;
