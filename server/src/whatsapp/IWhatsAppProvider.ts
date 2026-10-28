import {
  AccountConnectionStatus,
  NormalizedConversation,
  NormalizedMessage,
  ProviderCapabilities,
  SentMessageResult,
} from '../types/index.js';

export interface OutgoingMessagePayload {
  text?: string;
  caption?: string;
  mediaBuffer?: Buffer;
  mediaMimeType?: string;
  mediaFilename?: string;
  messageType: 'text' | 'image' | 'video' | 'audio' | 'document';
}

export type QrCallback = (qrCodeDataUrl: string) => void;
export type StatusCallback = (status: AccountConnectionStatus, error?: string) => void;
export type MessageCallback = (message: NormalizedMessage) => void;

export interface IWhatsAppProvider {
  readonly accountId: string;
  readonly providerType: string;

  initialize(): Promise<void>;
  disconnect(): Promise<void>;
  getStatus(): AccountConnectionStatus;
  getCapabilities(): ProviderCapabilities;

  syncConversations(): Promise<NormalizedConversation[]>;
  sendMessage(destinationJid: string, payload: OutgoingMessagePayload): Promise<SentMessageResult>;
  downloadMedia(message: NormalizedMessage): Promise<{ buffer: Buffer; mimetype: string; filename?: string } | null>;

  onQr(callback: QrCallback): void;
  onStatus(callback: StatusCallback): void;
  onMessage(callback: MessageCallback): void;

  destroy(): Promise<void>;
}
