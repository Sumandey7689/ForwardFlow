import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { env } from '../config/env.js';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const TAG_LENGTH = 16;

/**
 * Encrypt sensitive session data using AES-256-GCM
 */
export function encryptData(plainText: string): string {
  const key = Buffer.from(env.SESSION_ENCRYPTION_KEY, 'hex');
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  let encrypted = cipher.update(plainText, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag();

  // Format: iv:authTag:encrypted
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
}

/**
 * Decrypt sensitive session data using AES-256-GCM
 */
export function decryptData(cipherData: string): string {
  const parts = cipherData.split(':');
  if (parts.length !== 3) {
    throw new Error('Invalid cipher data format for decryption');
  }

  const [ivHex, tagHex, encryptedHex] = parts;
  const key = Buffer.from(env.SESSION_ENCRYPTION_KEY, 'hex');
  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(tagHex, 'hex');

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(encryptedHex, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

/**
 * Hash password using bcrypt
 */
export async function hashPassword(password: string): Promise<string> {
  const salt = await bcrypt.genSalt(12);
  return bcrypt.hash(password, salt);
}

/**
 * Verify password against stored bcrypt hash
 */
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

/**
 * Generate a deterministic idempotency key for forwarding attempts
 */
export function generateIdempotencyKey(
  accountId: string,
  sourceConversationId: string,
  providerMessageId: string,
  ruleId: string,
  destinationConversationId: string
): string {
  const payload = `${accountId}:${sourceConversationId}:${providerMessageId}:${ruleId}:${destinationConversationId}`;
  return crypto.createHash('sha256').update(payload).digest('hex');
}
