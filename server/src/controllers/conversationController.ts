import { Request, Response, NextFunction } from 'express';
import { prisma } from '../config/prisma.js';
import { WhatsAppProviderFactory } from '../whatsapp/WhatsAppProviderFactory.js';
import { emitToAdmin } from '../socket/socketManager.js';
import { AppError } from '../utils/errors.js';
import { logger } from '../config/logger.js';
import { ConversationType } from '../types/index.js';

export async function syncConversations(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const adminId = req.admin!.id;
    const { id: accountId } = req.params;

    const account = await prisma.whatsAppAccount.findFirst({
      where: { id: accountId, adminId },
    });

    if (!account) {
      throw new AppError('WhatsApp account not found', 404, 'NOT_FOUND');
    }

    const provider = WhatsAppProviderFactory.getProvider(account);
    const normalizedConvs = await provider.syncConversations();

    let createdCount = 0;
    let updatedCount = 0;

    for (const conv of normalizedConvs) {
      const existing = await prisma.conversation.findUnique({
        where: {
          whatsappAccountId_providerConversationId: {
            whatsappAccountId: account.id,
            providerConversationId: conv.providerConversationId,
          },
        },
      });

      const dataPayload = {
        name: conv.name,
        conversationType: conv.conversationType as any,
        parentConversationId: conv.parentConversationId,
        canReceiveMessages: conv.canReceiveMessages,
        canSendMessages: conv.canSendMessages,
        capabilityMetadata: JSON.stringify(conv.capabilityMetadata),
        lastActivityAt: new Date(),
      };

      if (existing) {
        await prisma.conversation.update({
          where: { id: existing.id },
          data: dataPayload,
        });
        updatedCount++;
      } else {
        await prisma.conversation.create({
          data: {
            whatsappAccountId: account.id,
            providerConversationId: conv.providerConversationId,
            ...dataPayload,
          },
        });
        createdCount++;
      }
    }

    await prisma.whatsAppAccount.update({
      where: { id: account.id },
      data: { lastSyncAt: new Date() },
    });

    emitToAdmin(adminId, 'whatsapp:conversation-sync-complete', {
      accountId: account.id,
      totalCount: normalizedConvs.length,
      createdCount,
      updatedCount,
    });

    logger.info(
      { accountId: account.id, total: normalizedConvs.length, createdCount, updatedCount },
      'Conversations synchronization complete'
    );

    res.json({
      success: true,
      data: {
        totalSynced: normalizedConvs.length,
        created: createdCount,
        updated: updatedCount,
      },
    });
  } catch (error) {
    next(error);
  }
}

export async function getConversations(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const adminId = req.admin!.id;
    const { id: accountId } = req.params;
    const { type, canSend, canReceive, search, page = '1', limit = '50' } = req.query;

    const account = await prisma.whatsAppAccount.findFirst({
      where: { id: accountId, adminId },
    });

    if (!account) {
      throw new AppError('WhatsApp account not found', 404, 'NOT_FOUND');
    }

    const where: any = {
      whatsappAccountId: accountId,
    };

    if (type && typeof type === 'string' && type !== 'ALL') {
      where.conversationType = type as ConversationType;
    }

    if (canSend === 'true') {
      where.canSendMessages = true;
    } else if (canSend === 'false') {
      where.canSendMessages = false;
    }

    if (canReceive === 'true') {
      where.canReceiveMessages = true;
    }

    if (search && typeof search === 'string') {
      where.name = {
        contains: search,
      };
    }

    const pageNum = parseInt(page as string, 10) || 1;
    const limitNum = parseInt(limit as string, 10) || 50;
    const skip = (pageNum - 1) * limitNum;

    const [conversations, totalCount] = await Promise.all([
      prisma.conversation.findMany({
        where,
        orderBy: [{ conversationType: 'asc' }, { name: 'asc' }],
        skip,
        take: limitNum,
      }),
      prisma.conversation.count({ where }),
    ]);

    // Parse metadata JSON
    const parsedConversations = conversations.map((conv) => ({
      ...conv,
      capabilityMetadata: conv.capabilityMetadata ? JSON.parse(conv.capabilityMetadata) : null,
    }));

    res.json({
      success: true,
      data: {
        conversations: parsedConversations,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total: totalCount,
          totalPages: Math.ceil(totalCount / limitNum),
        },
      },
    });
  } catch (error) {
    next(error);
  }
}

export async function getCapabilities(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const adminId = req.admin!.id;
    const { id: accountId } = req.params;

    const account = await prisma.whatsAppAccount.findFirst({
      where: { id: accountId, adminId },
    });

    if (!account) {
      throw new AppError('WhatsApp account not found', 404, 'NOT_FOUND');
    }

    const provider = WhatsAppProviderFactory.getProvider(account);
    const capabilities = provider.getCapabilities();

    res.json({
      success: true,
      data: {
        provider: account.provider,
        capabilities,
      },
    });
  } catch (error) {
    next(error);
  }
}
