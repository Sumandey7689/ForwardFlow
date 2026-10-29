import makeWASocket, {
  DisconnectReason,
  useMultiFileAuthState,
  WASocket,
  downloadMediaMessage,
  proto,
  jidNormalizedUser,
} from '@whiskeysockets/baileys';
import QRCode from 'qrcode';
import { Boom } from '@hapi/boom';
import {
  AccountConnectionStatus,
  NormalizedConversation,
  NormalizedMessage,
  ProviderCapabilities,
  SentMessageResult,
} from '../types/index.js';
import {
  IWhatsAppProvider,
  OutgoingMessagePayload,
  QrCallback,
  StatusCallback,
  MessageCallback,
} from './IWhatsAppProvider.js';
import { sessionManager } from './SessionManager.js';
import { logger } from '../config/logger.js';
import pino from 'pino';

export class BaileysProvider implements IWhatsAppProvider {
  public readonly accountId: string;
  public readonly providerType = 'baileys';

  private sock: WASocket | null = null;
  private status: AccountConnectionStatus = 'DISCONNECTED';
  private qrCallbacks: QrCallback[] = [];
  private statusCallbacks: StatusCallback[] = [];
  private messageCallbacks: MessageCallback[] = [];
  private isDestroyed = false;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;

  constructor(accountId: string) {
    this.accountId = accountId;
  }

  public getStatus(): AccountConnectionStatus {
    return this.status;
  }

  public getCapabilities(): ProviderCapabilities {
    return {
      supportsCommunities: true,
      supportsAnnouncements: true,
      supportsMediaDownloading: true,
      supportsMediaSending: true,
      notes: 'Direct WebSocket connection via Baileys Multi-Device protocol. High efficiency without headless Chrome.',
    };
  }

  public onQr(callback: QrCallback): void {
    this.qrCallbacks.push(callback);
  }

  public onStatus(callback: StatusCallback): void {
    this.statusCallbacks.push(callback);
  }

  public onMessage(callback: MessageCallback): void {
    this.messageCallbacks.push(callback);
  }

  private setStatus(status: AccountConnectionStatus, error?: string): void {
    this.status = status;
    for (const cb of this.statusCallbacks) {
      try {
        cb(status, error);
      } catch (err: any) {
        logger.error({ err: err.message }, 'Error in status callback');
      }
    }
  }

  public async initialize(): Promise<void> {
    if (this.isDestroyed) return;
    this.setStatus('CONNECTING');

    try {
      const sessionPath = sessionManager.getSessionPath(this.accountId);
      const { state, saveCreds } = await useMultiFileAuthState(sessionPath);

      // Baileys socket creation
      this.sock = makeWASocket({
        auth: state,
        printQRInTerminal: false,
        logger: pino({ level: 'silent' }), // Suppress internal Baileys noise
        browser: ['ForwardFlow SaaS', 'Chrome', '124.0.0'],
        syncFullHistory: false,
        markOnlineOnConnect: true,
      });

      this.sock.ev.on('creds.update', saveCreds);

      this.sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect, qr } = update;

        if (qr) {
          try {
            const qrDataUrl = await QRCode.toDataURL(qr);
            this.setStatus('QR_READY');
            for (const cb of this.qrCallbacks) {
              cb(qrDataUrl);
            }
          } catch (err: any) {
            logger.error({ err: err.message }, 'Failed to generate QR data URL');
          }
        }

        if (connection === 'open') {
          this.reconnectAttempts = 0;
          this.setStatus('CONNECTED');
          logger.info({ accountId: this.accountId, user: this.sock?.user }, 'WhatsApp connection established');
        }

        if (connection === 'close') {
          const statusCode = (lastDisconnect?.error as Boom)?.output?.statusCode;
          const shouldReconnect = statusCode !== DisconnectReason.loggedOut && !this.isDestroyed;

          logger.warn(
            { accountId: this.accountId, statusCode, shouldReconnect },
            'WhatsApp connection closed'
          );

          if (statusCode === DisconnectReason.loggedOut) {
            this.setStatus('DISCONNECTED', 'Session logged out from device');
            sessionManager.removeSession(this.accountId);
          } else if (shouldReconnect && this.reconnectAttempts < this.maxReconnectAttempts) {
            this.reconnectAttempts++;
            this.setStatus('CONNECTING', `Reconnecting attempt ${this.reconnectAttempts}...`);
            setTimeout(() => {
              if (!this.isDestroyed) {
                this.initialize().catch((err) => logger.error({ err }, 'Reconnect failed'));
              }
            }, 3000 * this.reconnectAttempts);
          } else {
            this.setStatus('FAILED', 'Connection interrupted or maximum reconnects reached');
          }
        }
      });

      // Handle incoming messages
      this.sock.ev.on('messages.upsert', async ({ messages, type }) => {
        if (type !== 'notify') return;

        for (const msg of messages) {
          // Ignore status broadcasts or messages without key
          if (!msg.key || msg.key.remoteJid === 'status@broadcast') continue;

          // Prevent loop: do not process messages sent by ourselves
          if (msg.key.fromMe) continue;

          const normalized = this.normalizeIncomingMessage(msg);
          if (normalized) {
            for (const cb of this.messageCallbacks) {
              try {
                cb(normalized);
              } catch (err: any) {
                logger.error({ err: err.message }, 'Error in message callback');
              }
            }
          }
        }
      });
    } catch (err: any) {
      logger.error({ accountId: this.accountId, err: err.message }, 'Failed to initialize Baileys');
      this.setStatus('FAILED', err.message);
      throw err;
    }
  }

  private normalizeIncomingMessage(msg: proto.IWebMessageInfo): NormalizedMessage | null {
    const key = msg.key;
    const rawSource = key.remoteJid;
    if (!rawSource || !key.id) return null;
    const sourceJid = jidNormalizedUser(rawSource);
    const rawSender = key.participant || rawSource;
    const senderJid = rawSender ? jidNormalizedUser(rawSender) : sourceJid;

    const message = msg.message;
    if (!message) return null;

    let messageType: NormalizedMessage['messageType'] = 'other';
    let textBody: string | undefined;
    let caption: string | undefined;

    if (message.conversation) {
      messageType = 'text';
      textBody = message.conversation;
    } else if (message.extendedTextMessage?.text) {
      messageType = 'text';
      textBody = message.extendedTextMessage.text;
    } else if (message.imageMessage) {
      messageType = 'image';
      caption = message.imageMessage.caption || undefined;
      textBody = caption;
    } else if (message.videoMessage) {
      messageType = 'video';
      caption = message.videoMessage.caption || undefined;
      textBody = caption;
    } else if (message.audioMessage) {
      messageType = 'audio';
    } else if (message.documentMessage) {
      messageType = 'document';
      caption = message.documentMessage.caption || undefined;
      textBody = caption || message.documentMessage.fileName || undefined;
    }

    const timestamp = msg.messageTimestamp
      ? new Date(Number(msg.messageTimestamp) * 1000)
      : new Date();

    return {
      id: key.id,
      accountId: this.accountId,
      sourceJid,
      senderJid,
      senderName: msg.pushName || undefined,
      messageType,
      textBody,
      caption,
      fromMe: Boolean(key.fromMe),
      timestamp,
      rawPayload: msg,
    };
  }

  public async syncConversations(): Promise<NormalizedConversation[]> {
    if (!this.sock || this.status !== 'CONNECTED') {
      throw new Error('Cannot sync conversations while WhatsApp is disconnected');
    }

    const conversations: NormalizedConversation[] = [];

    const myPhoneJid = this.sock.user?.id ? jidNormalizedUser(this.sock.user.id) : '';
    const myPhoneNumber = myPhoneJid ? myPhoneJid.split('@')[0] : '';
    const myLidJid = (this.sock.user as any)?.lid ? jidNormalizedUser((this.sock.user as any).lid) : '';
    const myLidNumber = myLidJid ? myLidJid.split('@')[0] : '';

    try {
      const groups = await this.sock.groupFetchAllParticipating();

      // First pass: Calculate initial isAdmin for each group/community
      const groupAdminMap = new Map<string, boolean>();

      for (const [jid, group] of Object.entries(groups)) {
        const isOwner =
          group.owner === myPhoneJid ||
          group.owner === myLidJid ||
          (group.owner && group.owner.split('@')[0] === myPhoneNumber) ||
          (group.owner && group.owner.split('@')[0] === myLidNumber) ||
          group.ownerJid === myPhoneJid ||
          (group.ownerJid && group.ownerJid.split('@')[0] === myPhoneNumber) ||
          group.subjectOwner === myPhoneJid ||
          group.subjectOwner === myLidJid ||
          (group.subjectOwner && group.subjectOwner.split('@')[0] === myPhoneNumber) ||
          (group.subjectOwner && group.subjectOwner.split('@')[0] === myLidNumber) ||
          group.subjectOwnerJid === myPhoneJid ||
          (group.subjectOwnerJid && group.subjectOwnerJid.split('@')[0] === myPhoneNumber);

        const myParticipant = group.participants?.find((p: any) => {
          const pId = p.id ? p.id.split(':')[0] : '';
          const pJid = p.jid ? p.jid.split(':')[0] : '';
          const pLid = p.lid ? p.lid.split(':')[0] : '';

          return (
            (pId && (pId === myPhoneJid || pId === myLidJid || pId.split('@')[0] === myPhoneNumber || pId.split('@')[0] === myLidNumber)) ||
            (pJid && (pJid === myPhoneJid || pJid.split('@')[0] === myPhoneNumber)) ||
            (pLid && (pLid === myLidJid || pLid.split('@')[0] === myLidNumber))
          );
        });

        const isAdmin = isOwner || myParticipant?.admin === 'admin' || myParticipant?.admin === 'superadmin';
        groupAdminMap.set(jid, Boolean(isAdmin));
      }

      // Second pass: Propagate admin rights between Parent Community and its Announcement feed
      for (const [jid, group] of Object.entries(groups)) {
        const linkedParent = (group as any).linkedParent;
        const isAnnounce = Boolean((group as any).isCommunityAnnounce);

        if (isAnnounce && linkedParent && groupAdminMap.get(linkedParent)) {
          groupAdminMap.set(jid, true);
        }
        if (linkedParent && groupAdminMap.get(jid)) {
          groupAdminMap.set(linkedParent, true);
        }
      }

      for (const [jid, group] of Object.entries(groups)) {
        const isCommunity = Boolean((group as any).isCommunity || (group as any).isParentGroup);
        const isAnnounce = Boolean((group as any).isCommunityAnnounce);
        const linkedParent = (group as any).linkedParent || null;

        const isAdmin = groupAdminMap.get(jid) || false;

        let conversationType: NormalizedConversation['conversationType'] = 'GROUP';
        if (isCommunity) {
          conversationType = 'COMMUNITY';
        } else if (isAnnounce) {
          conversationType = 'COMMUNITY_ANNOUNCEMENT';
        } else if (linkedParent) {
          conversationType = 'COMMUNITY_GROUP';
        }

        const announceOnly = Boolean(group.announce || isAnnounce);
        let providerNote: string | undefined;

        if (isCommunity) {
          providerNote = 'Parent Community container. Forwarded messages will automatically be routed to its linked announcement feed.';
        } else if (announceOnly && !isAdmin) {
          providerNote = 'Announcement-only group. Admin rights may be required to post.';
        } else if (isAdmin) {
          providerNote = 'Admin verified channel.';
        }

        conversations.push({
          providerConversationId: jid,
          name: group.subject || 'Unnamed Group',
          conversationType,
          parentConversationId: linkedParent,
          canReceiveMessages: true,
          // Allow sending to communities, announcements, and groups
          canSendMessages: true,
          capabilityMetadata: {
            participantCount: group.participants?.length || (group as any).size || 0,
            isAnnounceOnly: announceOnly,
            isAdmin,
            description: group.desc || undefined,
            providerNote,
          },
        });
      }

      return conversations;
    } catch (err: any) {
      logger.error({ accountId: this.accountId, err: err.message }, 'Error syncing WhatsApp conversations');
      throw err;
    }
  }

  public async sendMessage(
    destinationJid: string,
    payload: OutgoingMessagePayload
  ): Promise<SentMessageResult> {
    if (!this.sock || this.status !== 'CONNECTED') {
      throw new Error('WhatsApp client is not connected');
    }

    try {
      let targetJid = destinationJid.trim();
      if (targetJid.endsWith('@s.whatsapp.net') || !targetJid.includes('@')) {
        const parts = targetJid.split('@');
        let digits = parts[0].replace(/\D/g, '');
        if (digits.length === 10) {
          digits = '91' + digits;
        }
        targetJid = `${digits}@s.whatsapp.net`;
      } else {
        targetJid = jidNormalizedUser(targetJid);
      }

      // If destination is an individual personal number, verify & pre-warm encryption keys via onWhatsApp
      if (targetJid.endsWith('@s.whatsapp.net')) {
        try {
          const onWaResults = await this.sock.onWhatsApp(targetJid);
          if (onWaResults && onWaResults.length > 0) {
            if (onWaResults[0].exists && onWaResults[0].jid) {
              targetJid = onWaResults[0].jid;
            } else if (onWaResults[0].exists === false) {
              logger.warn({ targetJid }, 'Target WhatsApp number reported as not registered on WhatsApp');
            }
          }
        } catch (onWaErr: any) {
          logger.warn({ targetJid, err: onWaErr.message }, 'onWhatsApp pre-verification failed, sending directly');
        }
      }

      let result: proto.WebMessageInfo | undefined;
      const textContent = (payload.text || '').trim();

      switch (payload.messageType) {
        case 'text':
          result = await this.sock.sendMessage(targetJid, {
            text: textContent || ' ',
          });
          break;

        case 'image':
          if (!payload.mediaBuffer) throw new Error('Missing image buffer');
          result = await this.sock.sendMessage(targetJid, {
            image: payload.mediaBuffer,
            caption: payload.caption,
          });
          break;

        case 'video':
          if (!payload.mediaBuffer) throw new Error('Missing video buffer');
          result = await this.sock.sendMessage(targetJid, {
            video: payload.mediaBuffer,
            caption: payload.caption,
          });
          break;

        case 'audio':
          if (!payload.mediaBuffer) throw new Error('Missing audio buffer');
          result = await this.sock.sendMessage(targetJid, {
            audio: payload.mediaBuffer,
            mimetype: payload.mediaMimeType || 'audio/mp4',
          });
          break;

        case 'document':
          if (!payload.mediaBuffer) throw new Error('Missing document buffer');
          result = await this.sock.sendMessage(targetJid, {
            document: payload.mediaBuffer,
            mimetype: payload.mediaMimeType || 'application/octet-stream',
            fileName: payload.mediaFilename || 'file',
            caption: payload.caption,
          });
          break;

        default:
          result = await this.sock.sendMessage(targetJid, {
            text: textContent || ' ',
          });
      }

      const providerMessageId = result?.key?.id || `msg_${Date.now()}`;
      return {
        providerMessageId,
        timestamp: new Date(),
        status: 'SENT',
      };
    } catch (err: any) {
      logger.error({ destinationJid, err: err.message }, 'Error sending WhatsApp message');
      throw err;
    }
  }

  public async downloadMedia(
    message: NormalizedMessage
  ): Promise<{ buffer: Buffer; mimetype: string; filename?: string } | null> {
    if (!this.sock || !message.rawPayload) return null;

    try {
      const buffer = await downloadMediaMessage(
        message.rawPayload,
        'buffer',
        {},
        {
          logger: pino({ level: 'silent' }),
          reuploadRequest: this.sock.updateMediaMessage,
        }
      );

      let mimetype = 'application/octet-stream';
      let filename: string | undefined;

      const rawMsg = message.rawPayload.message;
      if (rawMsg?.imageMessage) {
        mimetype = rawMsg.imageMessage.mimetype || 'image/jpeg';
        filename = `image_${Date.now()}.jpg`;
      } else if (rawMsg?.videoMessage) {
        mimetype = rawMsg.videoMessage.mimetype || 'video/mp4';
        filename = `video_${Date.now()}.mp4`;
      } else if (rawMsg?.audioMessage) {
        mimetype = rawMsg.audioMessage.mimetype || 'audio/ogg';
        filename = `audio_${Date.now()}.ogg`;
      } else if (rawMsg?.documentMessage) {
        mimetype = rawMsg.documentMessage.mimetype || 'application/pdf';
        filename = rawMsg.documentMessage.fileName || `doc_${Date.now()}.pdf`;
      }

      return {
        buffer: buffer as Buffer,
        mimetype,
        filename,
      };
    } catch (err: any) {
      logger.error({ messageId: message.id, err: err.message }, 'Failed to download WhatsApp media');
      return null;
    }
  }

  public async disconnect(): Promise<void> {
    this.isDestroyed = true;
    if (this.sock) {
      try {
        this.sock.end(undefined);
      } catch (e) {
        // Ignore closing errors
      }
      this.sock = null;
    }
    this.setStatus('DISCONNECTED');
  }

  public async destroy(): Promise<void> {
    await this.disconnect();
    this.qrCallbacks = [];
    this.statusCallbacks = [];
    this.messageCallbacks = [];
  }
}
