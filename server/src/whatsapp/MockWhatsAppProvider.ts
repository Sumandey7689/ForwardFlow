import QRCode from 'qrcode';
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

export class MockWhatsAppProvider implements IWhatsAppProvider {
  public readonly accountId: string;
  public readonly providerType = 'mock';

  private status: AccountConnectionStatus = 'DISCONNECTED';
  private qrCallbacks: QrCallback[] = [];
  private statusCallbacks: StatusCallback[] = [];
  private messageCallbacks: MessageCallback[] = [];
  private isDestroyed = false;
  private sentMessages: Array<{ destinationJid: string; payload: OutgoingMessagePayload }> = [];

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
      notes: 'Mock Provider for automated test suites, QA evaluation, and high-fidelity local simulation.',
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
      cb(status, error);
    }
  }

  public async initialize(): Promise<void> {
    if (this.isDestroyed) return;
    this.setStatus('CONNECTING');

    // Simulate QR generation
    const mockQrString = `MOCK_AUTH_TOKEN_KEY_${this.accountId}_${Date.now()}`;
    const qrDataUrl = await QRCode.toDataURL(mockQrString);

    setTimeout(() => {
      if (this.isDestroyed) return;
      this.setStatus('QR_READY');
      for (const cb of this.qrCallbacks) {
        cb(qrDataUrl);
      }

      // Simulate device scan after 1.5 seconds if in mock mode
      setTimeout(() => {
        if (this.isDestroyed) return;
        this.setStatus('CONNECTED');
      }, 1500);
    }, 500);
  }

  public async syncConversations(): Promise<NormalizedConversation[]> {
    if (this.status !== 'CONNECTED') {
      throw new Error('Cannot sync conversations: Mock provider is not connected');
    }

    const parentCommunityJid = '120363044112233445@g.us';
    const announcementsJid = '120363044112233446@g.us';
    const techTalksGroupJid = '120363044112233447@g.us';
    const generalGroupJid = '120363044112233448@g.us';
    const clientAlertsGroupJid = '120363044112233449@g.us';

    return [
      {
        providerConversationId: parentCommunityJid,
        name: 'Tech Innovators Community (Parent)',
        conversationType: 'COMMUNITY',
        parentConversationId: null,
        canReceiveMessages: true,
        canSendMessages: true,
        capabilityMetadata: {
          participantCount: 1420,
          isAnnounceOnly: false,
          isAdmin: true,
          description: 'Official parent community containing all regional developer chapters.',
          providerNote: 'Parent Community root container. Forwarding destination routes to announcement feed.',
        },
      },
      {
        providerConversationId: announcementsJid,
        name: '📢 Tech Innovators Official Announcements',
        conversationType: 'COMMUNITY_ANNOUNCEMENT',
        parentConversationId: parentCommunityJid,
        canReceiveMessages: true,
        canSendMessages: true, // User is admin in mock, so can send
        capabilityMetadata: {
          participantCount: 1420,
          isAnnounceOnly: true,
          isAdmin: true,
          description: 'Verified announcement channel for broadcast notifications.',
        },
      },
      {
        providerConversationId: techTalksGroupJid,
        name: 'Tech Talks & Discussions',
        conversationType: 'COMMUNITY_GROUP',
        parentConversationId: parentCommunityJid,
        canReceiveMessages: true,
        canSendMessages: true,
        capabilityMetadata: {
          participantCount: 254,
          isAnnounceOnly: false,
          isAdmin: false,
          description: 'Community-linked active developer discussion group.',
        },
      },
      {
        providerConversationId: generalGroupJid,
        name: 'Global Tech News & Updates',
        conversationType: 'GROUP',
        parentConversationId: null,
        canReceiveMessages: true,
        canSendMessages: true,
        capabilityMetadata: {
          participantCount: 480,
          isAnnounceOnly: false,
          isAdmin: false,
          description: 'Standard public group for global tech trends.',
        },
      },
      {
        providerConversationId: clientAlertsGroupJid,
        name: 'Operations VIP Client Broadcasts',
        conversationType: 'GROUP',
        parentConversationId: null,
        canReceiveMessages: true,
        canSendMessages: false, // User is NOT admin and group is announce only
        capabilityMetadata: {
          participantCount: 88,
          isAnnounceOnly: true,
          isAdmin: false,
          description: 'VIP alerts group with admin-only posting rights.',
          providerNote: 'Only group admins can post. This connected account is a member only.',
        },
      },
    ];
  }

  public async sendMessage(
    destinationJid: string,
    payload: OutgoingMessagePayload
  ): Promise<SentMessageResult> {
    if (this.status !== 'CONNECTED') {
      throw new Error('WhatsApp client is not connected');
    }

    if (destinationJid.includes('fail_trigger')) {
      throw new Error('Simulated network delivery timeout');
    }

    this.sentMessages.push({ destinationJid, payload });

    return {
      providerMessageId: `mock_sent_${Date.now()}_${Math.random().toString(36).substring(7)}`,
      timestamp: new Date(),
      status: 'SENT',
    };
  }

  public async downloadMedia(
    message: NormalizedMessage
  ): Promise<{ buffer: Buffer; mimetype: string; filename?: string } | null> {
    if (message.messageType === 'image') {
      return {
        buffer: Buffer.from('mock_image_binary_data'),
        mimetype: 'image/jpeg',
        filename: 'mock_forward_image.jpg',
      };
    }
    return null;
  }

  /**
   * Helper for tests & simulations: trigger an incoming message event
   */
  public simulateIncomingMessage(message: Partial<NormalizedMessage>): void {
    const defaultMsg: NormalizedMessage = {
      id: `sim_msg_${Date.now()}_${Math.random().toString(36).substring(7)}`,
      accountId: this.accountId,
      sourceJid: '120363044112233446@g.us', // Default to announcements
      senderJid: '19999999999@s.whatsapp.net',
      senderName: 'Community Lead',
      messageType: 'text',
      textBody: '🚀 Simulated release update: ForwardFlow v1.0 is live!',
      fromMe: false,
      timestamp: new Date(),
    };

    const merged = { ...defaultMsg, ...message };
    for (const cb of this.messageCallbacks) {
      cb(merged);
    }
  }

  public getSentMessages(): Array<{ destinationJid: string; payload: OutgoingMessagePayload }> {
    return [...this.sentMessages];
  }

  public clearSentMessages(): void {
    this.sentMessages = [];
  }

  public async disconnect(): Promise<void> {
    this.isDestroyed = true;
    this.setStatus('DISCONNECTED');
  }

  public async destroy(): Promise<void> {
    await this.disconnect();
    this.qrCallbacks = [];
    this.statusCallbacks = [];
    this.messageCallbacks = [];
    this.sentMessages = [];
  }
}
