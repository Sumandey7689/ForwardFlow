export type ConnectionStatus =
  | 'DISCONNECTED'
  | 'CONNECTING'
  | 'QR_READY'
  | 'CONNECTED'
  | 'FAILED';

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

export interface Admin {
  id: string;
  email: string;
  name: string;
  lastLoginAt?: string | null;
  createdAt: string;
}

export interface WhatsAppAccount {
  id: string;
  displayName: string;
  phoneNumber?: string | null;
  provider: 'baileys' | 'mock';
  connectionStatus: ConnectionStatus;
  lastConnectedAt?: string | null;
  lastSyncAt?: string | null;
  createdAt: string;
  _count?: {
    conversations?: number;
    forwardingRules?: number;
    incomingMessages?: number;
  };
}

export interface ConversationCapabilityMetadata {
  participantCount?: number;
  isAnnounceOnly?: boolean;
  isAdmin?: boolean;
  description?: string;
  providerNote?: string;
}

export interface Conversation {
  id: string;
  whatsappAccountId: string;
  providerConversationId: string;
  name: string;
  conversationType: ConversationType;
  parentConversationId?: string | null;
  canReceiveMessages: boolean;
  canSendMessages: boolean;
  capabilityMetadata?: ConversationCapabilityMetadata | null;
  lastActivityAt?: string | null;
  createdAt: string;
}

export interface ForwardingDestination {
  id: string;
  forwardingRuleId: string;
  destinationConversationId: string;
  destinationConversation: Conversation;
  enabled: boolean;
}

export interface ForwardingRule {
  id: string;
  name: string;
  whatsappAccountId: string;
  whatsappAccount: {
    id: string;
    displayName: string;
    connectionStatus: ConnectionStatus;
    provider: string;
  };
  sourceConversationId: string;
  sourceConversation: Conversation;
  enabled: boolean;
  messageTypeConfiguration: {
    text: boolean;
    image: boolean;
    video: boolean;
    audio: boolean;
    document: boolean;
  };
  formattingConfiguration: {
    includePrefix: boolean;
    prefixText: string;
    includeSuffix: boolean;
    suffixText: string;
    includeSourceLabel: boolean;
    preserveCaptions: boolean;
    forwardSenderName: boolean;
  };
  scheduleConfiguration: {
    allDay: boolean;
    activeDays: number[];
    startTime: string;
    endTime: string;
    timezone: string;
  };
  retryConfiguration: {
    maxRetries: number;
    backoffMs: number;
  };
  destinations: ForwardingDestination[];
  _count?: {
    forwardingJobs?: number;
  };
  createdAt: string;
}

export interface ForwardingJob {
  id: string;
  forwardingRuleId: string;
  forwardingRule?: {
    name: string;
    whatsappAccount?: {
      displayName: string;
      provider: string;
    };
  };
  incomingMessageId: string;
  incomingMessage?: {
    senderName?: string;
    messageType: string;
    textBody?: string;
    receivedAt: string;
    sourceConversation?: {
      name: string;
      conversationType: ConversationType;
    };
  };
  destinationConversationId: string;
  destinationConversation?: {
    name: string;
    conversationType: ConversationType;
  };
  status: JobStatus;
  attemptCount: number;
  providerSentMessageId?: string | null;
  idempotencyKey: string;
  errorCode?: string | null;
  errorMessage?: string | null;
  nextRetryAt?: string | null;
  completedAt?: string | null;
  createdAt: string;
}

export interface DashboardStats {
  metrics: {
    totalAccounts: number;
    connectedAccounts: number;
    activeRules: number;
    messagesReceivedToday: number;
    forwardingAttemptsToday: number;
    failedAttemptsToday: number;
    successRate: number;
  };
  hourlyActivity: Array<{
    hour: string;
    received: number;
    forwarded: number;
    failed: number;
  }>;
  recentJobs: ForwardingJob[];
}
