import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../config/prisma.js';
import { WhatsAppProviderFactory } from '../whatsapp/WhatsAppProviderFactory.js';
import { sessionManager } from '../whatsapp/SessionManager.js';
import { ForwardingEngine } from '../engine/ForwardingEngine.js';
import { AppError } from '../utils/errors.js';
import { logger } from '../config/logger.js';

export const createAccountSchema = z.object({
  body: z.object({
    displayName: z.string().min(2, 'Display name must be at least 2 characters'),
    provider: z.enum(['baileys', 'mock']).default('baileys'),
  }),
});

export async function getAccounts(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const adminId = req.admin!.id;

    const accounts = await prisma.whatsAppAccount.findMany({
      where: { adminId },
      include: {
        _count: {
          select: {
            conversations: true,
            forwardingRules: { where: { enabled: true } },
            incomingMessages: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json({
      success: true,
      data: { accounts },
    });
  } catch (error) {
    next(error);
  }
}

export async function getAccountById(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const adminId = req.admin!.id;
    const { id } = req.params;

    const account = await prisma.whatsAppAccount.findFirst({
      where: { id, adminId },
      include: {
        _count: {
          select: {
            conversations: true,
            forwardingRules: true,
            incomingMessages: true,
          },
        },
      },
    });

    if (!account) {
      throw new AppError('WhatsApp account not found', 404, 'NOT_FOUND');
    }

    res.json({
      success: true,
      data: { account },
    });
  } catch (error) {
    next(error);
  }
}

export async function createAccount(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const adminId = req.admin!.id;
    const { displayName, provider } = req.body;

    const encryptedSessionRef = sessionManager.createEncryptedReference('pending', {
      displayName,
      provider,
    });

    const account = await prisma.whatsAppAccount.create({
      data: {
        adminId,
        displayName,
        provider,
        connectionStatus: 'CONNECTING',
        encryptedSessionReference: encryptedSessionRef,
      },
    });

    // Create session reference with actual account ID
    const finalSessionRef = sessionManager.createEncryptedReference(account.id);
    await prisma.whatsAppAccount.update({
      where: { id: account.id },
      data: { encryptedSessionReference: finalSessionRef },
    });

    // Instantiate and bind provider
    const waProvider = WhatsAppProviderFactory.getProvider({ id: account.id, provider });
    ForwardingEngine.bindProvider(waProvider, adminId);

    // Initialize provider to kick off connection & QR generation
    waProvider.initialize().catch((err) => {
      logger.error({ accountId: account.id, err: err.message }, 'Failed during async provider initialize');
    });

    await prisma.auditLog.create({
      data: {
        adminId,
        action: 'ACCOUNT_CREATED',
        resourceType: 'WhatsAppAccount',
        resourceId: account.id,
        metadata: JSON.stringify({ displayName, provider }),
        ipAddress: req.ip || req.socket.remoteAddress || 'unknown',
      },
    });

    res.status(201).json({
      success: true,
      data: { account },
    });
  } catch (error) {
    next(error);
  }
}

export async function connectAccount(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const adminId = req.admin!.id;
    const { id } = req.params;

    const account = await prisma.whatsAppAccount.findFirst({
      where: { id, adminId },
    });

    if (!account) {
      throw new AppError('WhatsApp account not found', 404, 'NOT_FOUND');
    }

    const waProvider = WhatsAppProviderFactory.getProvider(account);
    ForwardingEngine.bindProvider(waProvider, adminId);

    await waProvider.initialize();

    res.json({
      success: true,
      message: 'Connection initialization triggered',
    });
  } catch (error) {
    next(error);
  }
}

export async function disconnectAccount(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const adminId = req.admin!.id;
    const { id } = req.params;

    const account = await prisma.whatsAppAccount.findFirst({
      where: { id, adminId },
    });

    if (!account) {
      throw new AppError('WhatsApp account not found', 404, 'NOT_FOUND');
    }

    const waProvider = WhatsAppProviderFactory.getInstance(id);
    if (waProvider) {
      await waProvider.disconnect();
    }

    const updated = await prisma.whatsAppAccount.update({
      where: { id },
      data: { connectionStatus: 'DISCONNECTED' },
    });

    await prisma.auditLog.create({
      data: {
        adminId,
        action: 'ACCOUNT_DISCONNECTED',
        resourceType: 'WhatsAppAccount',
        resourceId: id,
        ipAddress: req.ip || req.socket.remoteAddress || 'unknown',
      },
    });

    res.json({
      success: true,
      data: { account: updated },
    });
  } catch (error) {
    next(error);
  }
}

export async function deleteAccount(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const adminId = req.admin!.id;
    const { id } = req.params;

    const account = await prisma.whatsAppAccount.findFirst({
      where: { id, adminId },
    });

    if (!account) {
      throw new AppError('WhatsApp account not found', 404, 'NOT_FOUND');
    }

    await WhatsAppProviderFactory.removeProvider(id);
    sessionManager.removeSession(id);

    await prisma.whatsAppAccount.delete({
      where: { id },
    });

    await prisma.auditLog.create({
      data: {
        adminId,
        action: 'ACCOUNT_DELETED',
        resourceType: 'WhatsAppAccount',
        resourceId: id,
        metadata: JSON.stringify({ displayName: account.displayName }),
        ipAddress: req.ip || req.socket.remoteAddress || 'unknown',
      },
    });

    res.json({
      success: true,
      message: 'WhatsApp account removed successfully',
    });
  } catch (error) {
    next(error);
  }
}
