import { WhatsAppAccount } from '@prisma/client';
import { IWhatsAppProvider } from './IWhatsAppProvider.js';
import { BaileysProvider } from './BaileysProvider.js';
import { MockWhatsAppProvider } from './MockWhatsAppProvider.js';
import { logger } from '../config/logger.js';

export class WhatsAppProviderFactory {
  private static instances = new Map<string, IWhatsAppProvider>();

  public static getProvider(account: { id: string; provider?: string }): IWhatsAppProvider {
    if (this.instances.has(account.id)) {
      return this.instances.get(account.id)!;
    }

    const providerType = account.provider || 'baileys';
    let provider: IWhatsAppProvider;

    if (providerType === 'mock') {
      provider = new MockWhatsAppProvider(account.id);
    } else {
      provider = new BaileysProvider(account.id);
    }

    this.instances.set(account.id, provider);
    logger.info({ accountId: account.id, providerType }, 'Instantiated WhatsApp provider');
    return provider;
  }

  public static hasInstance(accountId: string): boolean {
    return this.instances.has(accountId);
  }

  public static getInstance(accountId: string): IWhatsAppProvider | undefined {
    return this.instances.get(accountId);
  }

  public static async removeProvider(accountId: string): Promise<void> {
    const provider = this.instances.get(accountId);
    if (provider) {
      await provider.destroy();
      this.instances.delete(accountId);
      logger.info({ accountId }, 'Removed WhatsApp provider instance');
    }
  }

  public static async destroyAll(): Promise<void> {
    for (const [accountId, provider] of this.instances.entries()) {
      await provider.destroy();
      logger.info({ accountId }, 'Destroyed provider during cleanup');
    }
    this.instances.clear();
  }
}
