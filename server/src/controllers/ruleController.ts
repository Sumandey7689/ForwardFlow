import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../config/prisma.js';
import { emitToAdmin } from '../socket/socketManager.js';
import { AppError } from '../utils/errors.js';

export const createRuleSchema = z.object({
  body: z.object({
    name: z.string().min(2, 'Rule name is required'),
    whatsappAccountId: z.string().uuid(),
    sourceConversationId: z.string().uuid(),
    destinationConversationIds: z.array(z.string().uuid()).min(1, 'At least one destination conversation is required'),
    messageTypes: z.object({
      text: z.boolean().default(true),
      image: z.boolean().default(true),
      video: z.boolean().default(true),
      audio: z.boolean().default(true),
      document: z.boolean().default(true),
    }).default({ text: true, image: true, video: true, audio: true, document: true }).optional(),
    formatting: z.object({
      includePrefix: z.boolean().default(false),
      prefixText: z.string().default(''),
      includeSuffix: z.boolean().default(false),
      suffixText: z.string().default(''),
      includeSourceLabel: z.boolean().default(true),
      preserveCaptions: z.boolean().default(true),
      forwardSenderName: z.boolean().default(false),
    }).default({
      includePrefix: false,
      prefixText: '',
      includeSuffix: false,
      suffixText: '',
      includeSourceLabel: true,
      preserveCaptions: true,
      forwardSenderName: false,
    }).optional(),
    schedule: z.object({
      allDay: z.boolean().default(true),
      activeDays: z.array(z.number()).default([0, 1, 2, 3, 4, 5, 6]),
      startTime: z.string().default('00:00'),
      endTime: z.string().default('23:59'),
      timezone: z.string().default('UTC'),
    }).default({
      allDay: true,
      activeDays: [0, 1, 2, 3, 4, 5, 6],
      startTime: '00:00',
      endTime: '23:59',
      timezone: 'UTC',
    }).optional(),
    retry: z.object({
      maxRetries: z.number().int().min(0).max(10).default(3),
      backoffMs: z.number().int().min(1000).max(60000).default(5000),
    }).default({ maxRetries: 3, backoffMs: 5000 }).optional(),
    enabled: z.boolean().default(true),
  }),
});

export async function getRules(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const adminId = req.admin!.id;

    const rules = await prisma.forwardingRule.findMany({
      where: { adminId },
      include: {
        whatsappAccount: {
          select: { id: true, displayName: true, connectionStatus: true, provider: true },
        },
        sourceConversation: true,
        destinations: {
          include: {
            destinationConversation: true,
          },
        },
        _count: {
          select: { forwardingJobs: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const parsedRules = rules.map((rule) => ({
      ...rule,
      messageTypeConfiguration: JSON.parse(rule.messageTypeConfiguration || '{}'),
      formattingConfiguration: JSON.parse(rule.formattingConfiguration || '{}'),
      scheduleConfiguration: JSON.parse(rule.scheduleConfiguration || '{}'),
      retryConfiguration: JSON.parse(rule.retryConfiguration || '{}'),
    }));

    res.json({
      success: true,
      data: { rules: parsedRules },
    });
  } catch (error) {
    next(error);
  }
}

export async function getRuleById(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const adminId = req.admin!.id;
    const { id } = req.params;

    const rule = await prisma.forwardingRule.findFirst({
      where: { id, adminId },
      include: {
        whatsappAccount: true,
        sourceConversation: true,
        destinations: {
          include: {
            destinationConversation: true,
          },
        },
      },
    });

    if (!rule) {
      throw new AppError('Forwarding rule not found', 404, 'NOT_FOUND');
    }

    res.json({
      success: true,
      data: {
        rule: {
          ...rule,
          messageTypeConfiguration: JSON.parse(rule.messageTypeConfiguration || '{}'),
          formattingConfiguration: JSON.parse(rule.formattingConfiguration || '{}'),
          scheduleConfiguration: JSON.parse(rule.scheduleConfiguration || '{}'),
          retryConfiguration: JSON.parse(rule.retryConfiguration || '{}'),
        },
      },
    });
  } catch (error) {
    next(error);
  }
}

export async function createRule(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const adminId = req.admin!.id;
    const {
      name,
      whatsappAccountId,
      sourceConversationId,
      destinationConversationIds,
      messageTypes,
      formatting,
      schedule,
      retry,
      enabled,
    } = req.body;

    // Verify account ownership
    const account = await prisma.whatsAppAccount.findFirst({
      where: { id: whatsappAccountId, adminId },
    });
    if (!account) {
      throw new AppError('WhatsApp account not found or access denied', 404, 'ACCOUNT_NOT_FOUND');
    }

    // Verify source conversation
    const sourceConv = await prisma.conversation.findFirst({
      where: { id: sourceConversationId, whatsappAccountId },
    });
    if (!sourceConv) {
      throw new AppError('Source conversation not found', 404, 'SOURCE_NOT_FOUND');
    }

    // Verify destinations
    const destinations = await prisma.conversation.findMany({
      where: {
        id: { in: destinationConversationIds },
        whatsappAccountId,
      },
    });

    if (destinations.length !== destinationConversationIds.length) {
      throw new AppError('One or more destination conversations were not found', 400, 'INVALID_DESTINATIONS');
    }

    // Disallow source as destination
    if (destinationConversationIds.includes(sourceConversationId)) {
      throw new AppError('Source conversation cannot also be a destination (prevents message loop)', 400, 'LOOP_PREVENTION_ERROR');
    }

    // Validate sending rights on destinations
    for (const dest of destinations) {
      if (!dest.canSendMessages) {
        throw new AppError(
          `Destination "${dest.name}" does not permit sending messages (verify admin rights or group announcement restrictions)`,
          400,
          'DESTINATION_UNSUPPORTED'
        );
      }
    }

    // Create Rule and Destinations within a transaction
    const newRule = await prisma.$transaction(async (tx) => {
      const rule = await tx.forwardingRule.create({
        data: {
          adminId,
          whatsappAccountId,
          name,
          sourceConversationId,
          enabled: enabled ?? true,
          messageTypeConfiguration: JSON.stringify(messageTypes || { text: true, image: true, video: true, audio: true, document: true }),
          formattingConfiguration: JSON.stringify(formatting || { includeSourceLabel: true, forwardSenderName: false, includePrefix: false, prefixText: '', includeSuffix: false, suffixText: '', preserveCaptions: true }),
          scheduleConfiguration: JSON.stringify(schedule || { allDay: true, activeDays: [0, 1, 2, 3, 4, 5, 6], startTime: '00:00', endTime: '23:59', timezone: 'UTC' }),
          retryConfiguration: JSON.stringify(retry || { maxRetries: 3, backoffMs: 5000 }),
        },
      });

      await tx.forwardingDestination.createMany({
        data: destinationConversationIds.map((destId: string) => ({
          forwardingRuleId: rule.id,
          destinationConversationId: destId,
          enabled: true,
        })),
      });

      return tx.forwardingRule.findUnique({
        where: { id: rule.id },
        include: {
          whatsappAccount: true,
          sourceConversation: true,
          destinations: {
            include: { destinationConversation: true },
          },
        },
      });
    });

    await prisma.auditLog.create({
      data: {
        adminId,
        action: 'RULE_CREATED',
        resourceType: 'ForwardingRule',
        resourceId: newRule!.id,
        metadata: JSON.stringify({ name, destinationsCount: destinationConversationIds.length }),
        ipAddress: req.ip || req.socket.remoteAddress || 'unknown',
      },
    });

    emitToAdmin(adminId, 'forwarding:rule-status-changed', {
      ruleId: newRule!.id,
      enabled: newRule!.enabled,
    });

    res.status(201).json({
      success: true,
      data: { rule: newRule },
    });
  } catch (error) {
    next(error);
  }
}

export async function activateRule(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const adminId = req.admin!.id;
    const { id } = req.params;

    const rule = await prisma.forwardingRule.findFirst({
      where: { id, adminId },
    });

    if (!rule) {
      throw new AppError('Forwarding rule not found', 404, 'NOT_FOUND');
    }

    const updated = await prisma.forwardingRule.update({
      where: { id },
      data: { enabled: true },
    });

    emitToAdmin(adminId, 'forwarding:rule-status-changed', {
      ruleId: id,
      enabled: true,
    });

    res.json({
      success: true,
      data: { rule: updated },
    });
  } catch (error) {
    next(error);
  }
}

export async function pauseRule(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const adminId = req.admin!.id;
    const { id } = req.params;

    const rule = await prisma.forwardingRule.findFirst({
      where: { id, adminId },
    });

    if (!rule) {
      throw new AppError('Forwarding rule not found', 404, 'NOT_FOUND');
    }

    const updated = await prisma.forwardingRule.update({
      where: { id },
      data: { enabled: false },
    });

    emitToAdmin(adminId, 'forwarding:rule-status-changed', {
      ruleId: id,
      enabled: false,
    });

    res.json({
      success: true,
      data: { rule: updated },
    });
  } catch (error) {
    next(error);
  }
}

export async function deleteRule(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const adminId = req.admin!.id;
    const { id } = req.params;

    const rule = await prisma.forwardingRule.findFirst({
      where: { id, adminId },
    });

    if (!rule) {
      throw new AppError('Forwarding rule not found', 404, 'NOT_FOUND');
    }

    await prisma.forwardingRule.delete({
      where: { id },
    });

    await prisma.auditLog.create({
      data: {
        adminId,
        action: 'RULE_DELETED',
        resourceType: 'ForwardingRule',
        resourceId: id,
        metadata: JSON.stringify({ name: rule.name }),
        ipAddress: req.ip || req.socket.remoteAddress || 'unknown',
      },
    });

    res.json({
      success: true,
      message: 'Rule deleted successfully',
    });
  } catch (error) {
    next(error);
  }
}
