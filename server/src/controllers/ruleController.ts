import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../config/prisma.js';
import { emitToAdmin } from '../socket/socketManager.js';
import { AppError } from '../utils/errors.js';
import { parseMultiplePhoneNumbers } from '../utils/phone.js';

export const createRuleSchema = z.object({
  body: z.object({
    name: z.string().min(2, 'Rule name is required'),
    whatsappAccountId: z.string().uuid(),
    sourceConversationId: z.string().uuid(),
    destinationConversationIds: z.array(z.string().uuid()).default([]),
    customPhoneNumbers: z.array(z.string()).default([]).optional(),
    direction: z.enum(['RECEIVED', 'SENT', 'BOTH']).default('BOTH').optional(),
    bidirectional: z.boolean().default(false).optional(),
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
  }).refine(
    (data) => (data.destinationConversationIds && data.destinationConversationIds.length > 0) || (data.customPhoneNumbers && data.customPhoneNumbers.length > 0),
    { message: 'At least one destination conversation or personal phone number is required' }
  ),
});

export const updateRuleSchema = z.object({
  body: z.object({
    name: z.string().min(2).optional(),
    direction: z.enum(['RECEIVED', 'SENT', 'BOTH']).optional(),
    bidirectional: z.boolean().optional(),
    destinationConversationIds: z.array(z.string().uuid()).optional(),
    customPhoneNumbers: z.array(z.string()).optional(),
    messageTypes: z.object({
      text: z.boolean().optional(),
      image: z.boolean().optional(),
      video: z.boolean().optional(),
      audio: z.boolean().optional(),
      document: z.boolean().optional(),
    }).optional(),
    formatting: z.object({
      includePrefix: z.boolean().optional(),
      prefixText: z.string().optional(),
      includeSuffix: z.boolean().optional(),
      suffixText: z.string().optional(),
      includeSourceLabel: z.boolean().optional(),
      preserveCaptions: z.boolean().optional(),
      forwardSenderName: z.boolean().optional(),
    }).optional(),
    schedule: z.object({
      allDay: z.boolean().optional(),
      activeDays: z.array(z.number()).optional(),
      startTime: z.string().optional(),
      endTime: z.string().optional(),
      timezone: z.string().optional(),
    }).optional(),
    retry: z.object({
      maxRetries: z.number().int().min(0).max(10).optional(),
      backoffMs: z.number().int().min(1000).max(60000).optional(),
    }).optional(),
    enabled: z.boolean().optional(),
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
      destinationConversationIds = [],
      customPhoneNumbers = [],
      direction = 'BOTH',
      bidirectional = false,
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

    // Process custom personal phone numbers (auto-adds +91 if 10-digit number)
    const allDestinationIds: string[] = [...(destinationConversationIds || [])];

    if (Array.isArray(customPhoneNumbers) && customPhoneNumbers.length > 0) {
      const parsedNumbers = parseMultiplePhoneNumbers(customPhoneNumbers);
      for (const item of parsedNumbers) {
        const conv = await prisma.conversation.upsert({
          where: {
            whatsappAccountId_providerConversationId: {
              whatsappAccountId: account.id,
              providerConversationId: item.jid,
            },
          },
          update: {
            name: item.formatted,
            canSendMessages: true,
            canReceiveMessages: true,
          },
          create: {
            whatsappAccountId: account.id,
            providerConversationId: item.jid,
            name: item.formatted,
            conversationType: 'INDIVIDUAL',
            canSendMessages: true,
            canReceiveMessages: true,
            capabilityMetadata: JSON.stringify({
              phoneNumber: item.digits,
              formattedPhone: item.formatted,
              isPersonalNumber: true,
            }),
          },
        });

        if (!allDestinationIds.includes(conv.id)) {
          allDestinationIds.push(conv.id);
        }
      }
    }

    if (allDestinationIds.length === 0) {
      throw new AppError('At least one destination conversation or personal phone number is required', 400, 'NO_DESTINATIONS');
    }

    // Verify destinations
    const destinations = await prisma.conversation.findMany({
      where: {
        id: { in: allDestinationIds },
        whatsappAccountId,
      },
    });

    if (destinations.length !== allDestinationIds.length) {
      throw new AppError('One or more destination conversations were not found', 400, 'INVALID_DESTINATIONS');
    }

    // Disallow source as destination
    if (allDestinationIds.includes(sourceConversationId)) {
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
          direction: direction || 'BOTH',
          bidirectional: Boolean(bidirectional),
          messageTypeConfiguration: JSON.stringify(messageTypes || { text: true, image: true, video: true, audio: true, document: true }),
          formattingConfiguration: JSON.stringify(formatting || { includeSourceLabel: true, forwardSenderName: false, includePrefix: false, prefixText: '', includeSuffix: false, suffixText: '', preserveCaptions: true }),
          scheduleConfiguration: JSON.stringify(schedule || { allDay: true, activeDays: [0, 1, 2, 3, 4, 5, 6], startTime: '00:00', endTime: '23:59', timezone: 'UTC' }),
          retryConfiguration: JSON.stringify(retry || { maxRetries: 3, backoffMs: 5000 }),
        },
      });

      await tx.forwardingDestination.createMany({
        data: allDestinationIds.map((destId: string) => ({
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

export async function updateRule(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const adminId = req.admin!.id;
    const { id } = req.params;
    const {
      name,
      direction,
      bidirectional,
      destinationConversationIds,
      customPhoneNumbers,
      messageTypes,
      formatting,
      schedule,
      retry,
      enabled,
    } = req.body;

    const existingRule = await prisma.forwardingRule.findFirst({
      where: { id, adminId },
      include: {
        whatsappAccount: true,
        destinations: true,
      },
    });

    if (!existingRule) {
      throw new AppError('Forwarding rule not found', 404, 'NOT_FOUND');
    }

    let allDestinationIds: string[] | undefined = undefined;

    if (destinationConversationIds !== undefined || customPhoneNumbers !== undefined) {
      allDestinationIds = [...(destinationConversationIds || [])];

      if (Array.isArray(customPhoneNumbers) && customPhoneNumbers.length > 0) {
        const parsedNumbers = parseMultiplePhoneNumbers(customPhoneNumbers);
        for (const item of parsedNumbers) {
          const conv = await prisma.conversation.upsert({
            where: {
              whatsappAccountId_providerConversationId: {
                whatsappAccountId: existingRule.whatsappAccountId,
                providerConversationId: item.jid,
              },
            },
            update: {
              name: item.formatted,
              canSendMessages: true,
              canReceiveMessages: true,
            },
            create: {
              whatsappAccountId: existingRule.whatsappAccountId,
              providerConversationId: item.jid,
              name: item.formatted,
              conversationType: 'INDIVIDUAL',
              canSendMessages: true,
              canReceiveMessages: true,
              capabilityMetadata: JSON.stringify({
                phoneNumber: item.digits,
                formattedPhone: item.formatted,
                isPersonalNumber: true,
              }),
            },
          });

          if (!allDestinationIds.includes(conv.id)) {
            allDestinationIds.push(conv.id);
          }
        }
      }

      if (allDestinationIds.length === 0) {
        throw new AppError('At least one destination conversation or personal phone number is required', 400, 'NO_DESTINATIONS');
      }

      // Disallow source conversation as destination
      if (allDestinationIds.includes(existingRule.sourceConversationId)) {
        throw new AppError('Source conversation cannot also be a destination (prevents message loop)', 400, 'LOOP_PREVENTION_ERROR');
      }
    }

    const updatedRule = await prisma.$transaction(async (tx) => {
      const dataToUpdate: any = {};
      if (name !== undefined) dataToUpdate.name = name;
      if (direction !== undefined) dataToUpdate.direction = direction;
      if (bidirectional !== undefined) dataToUpdate.bidirectional = Boolean(bidirectional);
      if (enabled !== undefined) dataToUpdate.enabled = Boolean(enabled);
      if (messageTypes !== undefined) dataToUpdate.messageTypeConfiguration = JSON.stringify(messageTypes);
      if (formatting !== undefined) dataToUpdate.formattingConfiguration = JSON.stringify(formatting);
      if (schedule !== undefined) dataToUpdate.scheduleConfiguration = JSON.stringify(schedule);
      if (retry !== undefined) dataToUpdate.retryConfiguration = JSON.stringify(retry);

      await tx.forwardingRule.update({
        where: { id },
        data: dataToUpdate,
      });

      if (allDestinationIds !== undefined) {
        await tx.forwardingDestination.deleteMany({
          where: { forwardingRuleId: id },
        });

        await tx.forwardingDestination.createMany({
          data: allDestinationIds.map((destId: string) => ({
            forwardingRuleId: id,
            destinationConversationId: destId,
            enabled: true,
          })),
        });
      }

      return tx.forwardingRule.findUnique({
        where: { id },
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
        action: 'RULE_UPDATED',
        resourceType: 'ForwardingRule',
        resourceId: id,
        metadata: JSON.stringify({ name: updatedRule!.name, direction: updatedRule!.direction, bidirectional: updatedRule!.bidirectional }),
        ipAddress: req.ip || req.socket.remoteAddress || 'unknown',
      },
    });

    emitToAdmin(adminId, 'forwarding:rule-status-changed', {
      ruleId: id,
      enabled: updatedRule!.enabled,
    });

    res.json({
      success: true,
      data: {
        rule: {
          ...updatedRule,
          messageTypeConfiguration: JSON.parse(updatedRule!.messageTypeConfiguration || '{}'),
          formattingConfiguration: JSON.parse(updatedRule!.formattingConfiguration || '{}'),
          scheduleConfiguration: JSON.parse(updatedRule!.scheduleConfiguration || '{}'),
          retryConfiguration: JSON.parse(updatedRule!.retryConfiguration || '{}'),
        },
      },
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
