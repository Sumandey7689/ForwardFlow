import { prisma } from '../config/prisma.js';
import { WhatsAppProviderFactory } from '../whatsapp/WhatsAppProviderFactory.js';
import { OutgoingMessagePayload } from '../whatsapp/IWhatsAppProvider.js';
import { emitToAdmin } from '../socket/socketManager.js';
import { logger } from '../config/logger.js';
import { FormattingConfiguration, RetryConfiguration } from '../types/index.js';
import { ForwardingJobData } from './ForwardingQueue.js';
import { ForwardingEngine } from './ForwardingEngine.js';

export async function processForwardingJob(data: ForwardingJobData): Promise<void> {
  const { forwardingJobId } = data;

  const job = await prisma.forwardingJob.findUnique({
    where: { id: forwardingJobId },
    include: {
      forwardingRule: {
        include: {
          whatsappAccount: true,
        },
      },
      incomingMessage: {
        include: {
          sourceConversation: true,
        },
      },
      destinationConversation: true,
    },
  });

  if (!job) {
    logger.error({ forwardingJobId }, 'Forwarding job record not found in database');
    return;
  }

  // Idempotency: skip if already sent
  if (job.status === 'SENT') {
    logger.info({ forwardingJobId }, 'Job already completed successfully, skipping');
    return;
  }

  const { forwardingRule, incomingMessage, destinationConversation } = job;
  const adminId = forwardingRule.adminId;
  const account = forwardingRule.whatsappAccount;

  // Mark status as PROCESSING
  await prisma.forwardingJob.update({
    where: { id: job.id },
    data: {
      status: 'PROCESSING',
      attemptCount: { increment: 1 },
    },
  });

  try {
    // 1. Destination capability check
    if (!destinationConversation.canSendMessages) {
      throw new Error(
        `Destination conversation "${destinationConversation.name}" does not permit outbound messages. ` +
        `Check group admin rights or posting permissions.`
      );
    }

    // 2. Parse configurations
    const formatting: FormattingConfiguration = JSON.parse(
      forwardingRule.formattingConfiguration || '{}'
    );
    const retryConfig: RetryConfiguration = JSON.parse(
      forwardingRule.retryConfiguration || '{"maxRetries":3,"backoffMs":5000}'
    );

    // 3. Format message text / caption
    let formattedText = incomingMessage.textBody || '';

    if (formatting.includeSourceLabel) {
      const sourceName = incomingMessage.sourceConversation.name || 'WhatsApp Community';
      const sourceLabel = `📌 *Forwarded from:* ${sourceName}`;
      formattedText = formattedText ? `${sourceLabel}\n\n${formattedText}` : sourceLabel;
    }

    if (formatting.forwardSenderName && incomingMessage.senderName) {
      formattedText = `${formattedText}\n\n👤 *Sender:* ${incomingMessage.senderName}`;
    }

    if (formatting.includePrefix && formatting.prefixText) {
      formattedText = `${formatting.prefixText}\n\n${formattedText}`;
    }

    if (formatting.includeSuffix && formatting.suffixText) {
      formattedText = `${formattedText}\n\n${formatting.suffixText}`;
    }

    // 4. Retrieve provider
    const provider = WhatsAppProviderFactory.getProvider(account);
    let destinationJid = destinationConversation.providerConversationId;

    // If destination is a Community parent, automatically route to its linked announcement feed
    if (destinationConversation.conversationType === 'COMMUNITY') {
      const announceConv = await prisma.conversation.findFirst({
        where: {
          whatsappAccountId: account.id,
          parentConversationId: destinationConversation.providerConversationId,
          conversationType: 'COMMUNITY_ANNOUNCEMENT',
        },
      });

      if (announceConv) {
        destinationJid = announceConv.providerConversationId;
        logger.info(
          { community: destinationConversation.name, announceJid: destinationJid },
          'Routed community parent destination to its official announcement feed'
        );
      }
    }

    const payload: OutgoingMessagePayload = {
      messageType: incomingMessage.messageType as any,
      text: formattedText,
      caption: formattedText,
    };

    // 5. Handle media if applicable
    if (incomingMessage.messageType !== 'text') {
      const mediaResult = await provider.downloadMedia({
        id: incomingMessage.providerMessageId,
        accountId: account.id,
        sourceJid: incomingMessage.sourceConversation.providerConversationId,
        messageType: incomingMessage.messageType as any,
        fromMe: false,
        timestamp: incomingMessage.receivedAt,
        rawPayload: incomingMessage.contentReference ? JSON.parse(incomingMessage.contentReference) : null,
      });

      if (mediaResult) {
        payload.mediaBuffer = mediaResult.buffer;
        payload.mediaMimeType = mediaResult.mimetype;
        payload.mediaFilename = mediaResult.filename;
      }
    }

    // 6. Send message
    const sendResult = await provider.sendMessage(destinationJid, payload);
    if (sendResult?.providerMessageId) {
      ForwardingEngine.registerAutomatedMessageId(sendResult.providerMessageId);
    }

    // 7. Success state
    const completedJob = await prisma.forwardingJob.update({
      where: { id: job.id },
      data: {
        status: sendResult.status === 'SENT' ? 'SENT' : 'UNCERTAIN',
        providerSentMessageId: sendResult.providerMessageId,
        completedAt: new Date(),
        errorMessage: null,
        errorCode: null,
      },
      include: {
        forwardingRule: true,
        incomingMessage: true,
        destinationConversation: true,
      },
    });

    logger.info(
      {
        jobId: job.id,
        ruleId: forwardingRule.id,
        destinationJid,
        providerMessageId: sendResult.providerMessageId,
      },
      'Forwarding job successfully completed'
    );

    // Broadcast live event to admin
    emitToAdmin(adminId, 'forwarding:job-completed', {
      job: completedJob,
    });
  } catch (err: any) {
    const errorMessage = err.message || 'Unknown forwarding delivery failure';
    const retryConfig: RetryConfiguration = JSON.parse(
      forwardingRule.retryConfiguration || '{"maxRetries":3,"backoffMs":5000}'
    );
    const maxRetries = retryConfig.maxRetries || 3;
    const currentAttempt = job.attemptCount + 1;

    logger.error(
      {
        jobId: job.id,
        attempt: currentAttempt,
        maxRetries,
        error: errorMessage,
      },
      'Forwarding job execution failed'
    );

    let nextStatus: 'RETRY_SCHEDULED' | 'FAILED' = 'FAILED';
    let nextRetryAt: Date | null = null;

    if (currentAttempt < maxRetries) {
      nextStatus = 'RETRY_SCHEDULED';
      const backoffMs = (retryConfig.backoffMs || 5000) * Math.pow(2, currentAttempt - 1);
      nextRetryAt = new Date(Date.now() + backoffMs);
    }

    const updatedJob = await prisma.forwardingJob.update({
      where: { id: job.id },
      data: {
        status: nextStatus,
        errorCode: 'SEND_FAILED',
        errorMessage,
        nextRetryAt,
      },
      include: {
        forwardingRule: true,
        incomingMessage: true,
        destinationConversation: true,
      },
    });

    emitToAdmin(adminId, 'forwarding:job-failed', {
      job: updatedJob,
      error: errorMessage,
    });

    // If retry is scheduled, re-queue after backoff delay
    if (nextStatus === 'RETRY_SCHEDULED' && nextRetryAt) {
      const delayMs = Math.max(0, nextRetryAt.getTime() - Date.now());
      setTimeout(() => {
        import('./ForwardingQueue.js').then(({ forwardingQueue }) => {
          forwardingQueue.addJob({ forwardingJobId: job.id });
        });
      }, delayMs);
    }
  }
}
