export type ConversationType =
  | 'COMMUNITY'
  | 'COMMUNITY_ANNOUNCEMENT'
  | 'COMMUNITY_GROUP'
  | 'GROUP'
  | 'INDIVIDUAL';

export type JobStatus =
  | 'RECEIVED'
  | 'QUEUED'
  | 'PROCESSING'
  | 'SENT'
  | 'FAILED'
  | 'RETRY_SCHEDULED'
  | 'UNCERTAIN';

export type AccountConnectionStatus =
  | 'DISCONNECTED'
  | 'CONNECTING'
  | 'QR_READY'
  | 'CONNECTED'
  | 'FAILED';

export interface AdminUser {
  id: string;
  email: string;
  name: string;
  createdAt: Date;
  updatedAt: Date;
  lastLoginAt: Date | null;
}

export interface AuthTokenPayload {
  adminId: string;
  email: string;
}

export interface ConversationCapabilityMetadata {
  participantCount?: number;
  isAnnounceOnly?: boolean;
  isAdmin?: boolean;
  description?: string;
  providerNote?: string;
}

export interface NormalizedConversation {
  providerConversationId: string; // WhatsApp JID
  name: string;
  conversationType: ConversationType;
  parentConversationId?: string | null;
  canReceiveMessages: boolean; // Source eligible
  canSendMessages: boolean;    // Destination eligible
  capabilityMetadata: ConversationCapabilityMetadata;
}

export interface NormalizedMessage {
  id: string;
  accountId: string;
  sourceJid: string;
  senderJid?: string;
  senderName?: string;
  messageType: 'text' | 'image' | 'video' | 'audio' | 'document' | 'other';
  textBody?: string;
  caption?: string;
  mediaBuffer?: Buffer;
  mediaMimeType?: string;
  mediaFilename?: string;
  fromMe: boolean;
  timestamp: Date;
  rawPayload?: any;
}

export type ForwardDirection = 'RECEIVED' | 'SENT' | 'BOTH';

export interface MessageTypeConfiguration {
  text: boolean;
  image: boolean;
  video: boolean;
  audio: boolean;
  document: boolean;
}

export interface FormattingConfiguration {
  includePrefix: boolean;
  prefixText: string;
  includeSuffix: boolean;
  suffixText: string;
  includeSourceLabel: boolean;
  preserveCaptions: boolean;
  forwardSenderName: boolean;
}

export interface ScheduleConfiguration {
  allDay: boolean;
  activeDays: number[]; // 0 = Sunday, 1 = Monday, etc.
  startTime: string; // "09:00"
  endTime: string;   // "18:00"
  timezone: string;  // e.g. "UTC"
}

export interface RetryConfiguration {
  maxRetries: number;
  backoffMs: number;
}

export interface ProviderCapabilities {
  supportsCommunities: boolean;
  supportsAnnouncements: boolean;
  supportsMediaDownloading: boolean;
  supportsMediaSending: boolean;
  notes: string;
}

export interface SentMessageResult {
  providerMessageId: string;
  timestamp: Date;
  status: 'SENT' | 'UNCERTAIN';
}
