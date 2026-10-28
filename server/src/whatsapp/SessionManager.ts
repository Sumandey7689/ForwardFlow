import fs from 'fs';
import path from 'path';
import { env } from '../config/env.js';
import { encryptData, decryptData } from '../utils/crypto.js';
import { logger } from '../config/logger.js';

export class SessionManager {
  private baseDir: string;

  constructor() {
    this.baseDir = path.resolve(env.WHATSAPP_SESSIONS_DIR);
    if (!fs.existsSync(this.baseDir)) {
      fs.mkdirSync(this.baseDir, { recursive: true });
    }
  }

  /**
   * Get isolated session folder path for a given account
   */
  public getSessionPath(accountId: string): string {
    const sessionPath = path.join(this.baseDir, accountId);
    if (!fs.existsSync(sessionPath)) {
      fs.mkdirSync(sessionPath, { recursive: true });
    }
    return sessionPath;
  }

  /**
   * Generate an encrypted session reference for the database
   */
  public createEncryptedReference(accountId: string, metadata: Record<string, any> = {}): string {
    const sessionPath = this.getSessionPath(accountId);
    const payload = JSON.stringify({
      accountId,
      sessionPath,
      metadata,
      timestamp: new Date().toISOString(),
    });
    return encryptData(payload);
  }

  /**
   * Decrypt and verify session reference
   */
  public readEncryptedReference(encryptedRef: string): Record<string, any> {
    try {
      const decrypted = decryptData(encryptedRef);
      return JSON.parse(decrypted);
    } catch (err: any) {
      logger.error({ err: err.message }, 'Failed to decrypt session reference');
      throw new Error('Invalid or corrupted session reference');
    }
  }

  /**
   * Check if session auth credentials exist for an account
   */
  public hasSession(accountId: string): boolean {
    const sessionPath = path.join(this.baseDir, accountId);
    const credsPath = path.join(sessionPath, 'creds.json');
    return fs.existsSync(credsPath);
  }

  /**
   * Remove session directory securely
   */
  public removeSession(accountId: string): void {
    const sessionPath = path.join(this.baseDir, accountId);
    if (fs.existsSync(sessionPath)) {
      try {
        fs.rmSync(sessionPath, { recursive: true, force: true });
        logger.info({ accountId }, 'Session directory purged');
      } catch (err: any) {
        logger.error({ accountId, err: err.message }, 'Error purging session directory');
      }
    }
  }
}

export const sessionManager = new SessionManager();
