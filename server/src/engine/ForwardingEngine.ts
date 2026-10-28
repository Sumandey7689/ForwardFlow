import { prisma } from '../config/prisma.js';
import { WhatsAppProviderFactory } from '../whatsapp/WhatsAppProviderFactory.js';
import { IWhatsAppProvider } from '../whatsapp/IWhatsAppProvider.js';
import {
  NormalizedMessage,
  MessageTypeConfiguration,
  ScheduleConfiguration,
} from '../types/index.js';
import { generateIdempotencyKey } from '../utils/crypto.js';
import { forwardingQueue } from './ForwardingQueue.js';
import { emitToAdmin } from '../socket/socketManager.js';
import { logger } from '../config/logger.js';

export class ForwardingEngine {
  private static isInitialized = false;

  public static initialize(): void {
    if (this.isInitialized) return;
    this.isInitialized = true;

    // Register queue processor
    import('./ForwardingWorker.js').then(({ processForwardingJob }) => {
      forwardingQueue.registerProcessor(processForwardingJob);
    });

    logger.info('Forwarding Engine initialized');
  }

  /**
   * Bind an active provider to the forwarding engine
   */
  public static bindProvider(provider: IWhatsAppProvider, adminId: string): void {
    provider.onMessage(async (message: NormalizedMessage) => {
      await this.handleIncomingMessage(message, adminId);
    });

    provider.onStatus(async (status, error) => {
      try {
        await prisma.whatsAppAccount.update({
          where: { id: provider.accountId },
          data: {
            connectionStatus: status,
            lastConnectedAt: status === 'CONNECTED' ? new Date() : undefined,
          },
        });

        emitToAdmin(adminId, 'whatsapp:connection-status', {
          accountId: provider.accountId,
          status,
          error,
        });
      } catch (err: any) {
        logger.error({ accountId: provider.accountId, err: err.message }, 'Failed to update account status in DB');
      }
    });

    provider.onQr((qrCodeDataUrl) => {
      emitToAdmin(adminId, 'whatsapp:qr-code', {
        accountId: provider.accountId,
        qrCode: qrCodeDataUrl,
      });
    });

    logger.info({ accountId: provider.accountId, adminId }, 'Provider successfully bound to Forwarding Engine');
  }

  /**
   * Process incoming message event through rule evaluation and queue creation
   */
  public static async handleIncomingMessage(
    message: NormalizedMessage,
    adminId: string
  ): Promise<void> {
    try {
      // 1. Loop Prevention: Drop messages originated by ourselves
      if (message.fromMe) {
        return;
      }

      // 2. Locate source conversation in database
      const sourceConversation = await prisma.conversation.findUnique({
        where: {
          whatsappAccountId_providerConversationId: {
            whatsappAccountId: message.accountId,
            providerConversationId: message.sourceJid,
          },
        },
      });

      if (!sourceConversation) {
        // Message from untracked conversation
        return;
      }

      // 3. Persist incoming message (safely handle duplicates)
      let incomingMessageRecord = await prisma.incomingMessage.findUnique({
        where: {
          whatsappAccountId_sourceConversationId_providerMessageId: {
            whatsappAccountId: message.accountId,
            sourceConversationId: sourceConversation.id,
            providerMessageId: message.id,
          },
        },
      });

      if (!incomingMessageRecord) {
        incomingMessageRecord = await prisma.incomingMessage.create({
          data: {
            whatsappAccountId: message.accountId,
            sourceConversationId: sourceConversation.id,
            providerMessageId: message.id,
            senderId: message.senderJid,
            senderName: message.senderName,
            messageType: message.messageType,
            textBody: message.textBody,
            contentReference: message.rawPayload ? JSON.stringify(message.rawPayload) : null,
            receivedAt: message.timestamp,
          },
        });

        emitToAdmin(adminId, 'forwarding:message-received', {
          message: incomingMessageRecord,
        });
      }

      // 4. Find all active forwarding rules for this source conversation
      const activeRules = await prisma.forwardingRule.findMany({
        where: {
          whatsappAccountId: message.accountId,
          sourceConversationId: sourceConversation.id,
          enabled: true,
        },
        include: {
          destinations: {
            where: { enabled: true },
            include: { destinationConversation: true },
          },
        },
      });

      if (activeRules.length === 0) {
        return;
      }

      for (const rule of activeRules) {
        // 5. Evaluate Schedule Filter
        if (!this.isWithinSchedule(rule.scheduleConfiguration)) {
          logger.info({ ruleId: rule.id }, 'Message ignored: current time outside permitted forwarding schedule');
          continue;
        }

        // 6. Evaluate Message Type Filter
        if (!this.isPermittedMessageType(message.messageType, rule.messageTypeConfiguration)) {
          logger.info(
            { ruleId: rule.id, messageType: message.messageType },
            'Message ignored: message type not permitted by rule'
          );
          continue;
        }

        // 7. Process Destinations
        for (const dest of rule.destinations) {
          const destConv = dest.destinationConversation;

          // Loop Prevention: Do not forward to same conversation
          if (destConv.id === sourceConversation.id || destConv.providerConversationId === message.sourceJid) {
            continue;
          }

          // Idempotency check
          const idempotencyKey = generateIdempotencyKey(
            message.accountId,
            sourceConversation.id,
            message.id,
            rule.id,
            destConv.id
          );

          // Check if job already exists
          const existingJob = await prisma.forwardingJob.findUnique({
            where: { idempotencyKey },
          });

          if (existingJob) {
            logger.info({ idempotencyKey }, 'Forwarding job already created, skipping duplicate');
            continue;
          }

          // Create durable job record
          const forwardingJob = await prisma.forwardingJob.create({
            data: {
              forwardingRuleId: rule.id,
              incomingMessageId: incomingMessageRecord.id,
              destinationConversationId: destConv.id,
              status: 'QUEUED',
              idempotencyKey,
            },
            include: {
              forwardingRule: true,
              incomingMessage: true,
              destinationConversation: true,
            },
          });

          emitToAdmin(adminId, 'forwarding:job-queued', {
            job: forwardingJob,
          });

          // Enqueue for processing
          await forwardingQueue.addJob({ forwardingJobId: forwardingJob.id });
        }
      }
    } catch (err: any) {
      logger.error({ err: err.message, messageId: message.id }, 'Error in ForwardingEngine message handling');
    }
  }

  private static isPermittedMessageType(type: string, configJson: string): boolean {
    try {
      const config: MessageTypeConfiguration = JSON.parse(configJson || '{}');
      switch (type) {
        case 'text':
          return config.text !== false;
        case 'image':
          return config.image !== false;
        case 'video':
          return config.video !== false;
        case 'audio':
          return config.audio !== false;
        case 'document':
          return config.document !== false;
        default:
          return false;
      }
    } catch {
      return true;
    }
  }

  private static isWithinSchedule(scheduleJson: string): boolean {
    try {
      const schedule: ScheduleConfiguration = JSON.parse(scheduleJson || '{}');
      if (schedule.allDay) return true;

      const now = new Date();
      const currentDay = now.getDay(); // 0 = Sunday

      if (Array.isArray(schedule.activeDays) && !schedule.activeDays.includes(currentDay)) {
        return false;
      }

      if (schedule.startTime && schedule.endTime) {
        const [startHour, startMin] = schedule.startTime.split(':').map(Number);
        const [endHour, endMin] = schedule.endTime.split(':').map(Number);

        const currentMinutes = now.getHours() * 60 + now.getMinutes();
        const startMinutes = startHour * 60 + startMin;
        const endMinutes = endHour * 60 + endMin;

        if (currentMinutes < startMinutes || currentMinutes > endMinutes) {
          return false;
        }
      }

      return true;
    } catch {
      return true;
    }
  }
}
