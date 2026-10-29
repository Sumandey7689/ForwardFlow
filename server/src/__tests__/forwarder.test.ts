import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../app.js';
import { prisma } from '../config/prisma.js';
import { hashPassword, generateIdempotencyKey } from '../utils/crypto.js';
import { WhatsAppProviderFactory } from '../whatsapp/WhatsAppProviderFactory.js';
import { MockWhatsAppProvider } from '../whatsapp/MockWhatsAppProvider.js';
import { ForwardingEngine } from '../engine/ForwardingEngine.js';

const app = createApp();

describe('WhatsApp Community Auto Forwarder SaaS - Comprehensive Test Suite', () => {
  let adminToken: string;
  let adminId: string;
  let secondAdminToken: string;
  let secondAdminId: string;
  let accountId: string;
  let announcementsConvId: string;
  let generalGroupConvId: string;
  let clientAlertsConvId: string; // Announce only, canSendMessages: false
  let parentCommunityConvId: string; // Parent container, canSendMessages: false
  let createdRuleId: string;

  beforeAll(async () => {
    ForwardingEngine.initialize();

    // Clean up test data
    await prisma.forwardingJob.deleteMany();
    await prisma.forwardingDestination.deleteMany();
    await prisma.forwardingRule.deleteMany();
    await prisma.incomingMessage.deleteMany();
    await prisma.conversation.deleteMany();
    await prisma.whatsAppAccount.deleteMany();
    await prisma.auditLog.deleteMany();
    await prisma.admin.deleteMany({
      where: { email: { in: ['test-admin@forwardflow.io', 'secondary-admin@forwardflow.io'] } },
    });

    // Create test admin 1
    const passwordHash = await hashPassword('AdminPass123!');
    const admin = await prisma.admin.create({
      data: {
        email: 'test-admin@forwardflow.io',
        passwordHash,
        name: 'Primary Test Admin',
      },
    });
    adminId = admin.id;

    // Create test admin 2 (for multi-tenant isolation tests)
    const admin2 = await prisma.admin.create({
      data: {
        email: 'secondary-admin@forwardflow.io',
        passwordHash,
        name: 'Secondary Admin',
      },
    });
    secondAdminId = admin2.id;
  });

  afterAll(async () => {
    await WhatsAppProviderFactory.destroyAll();
    await prisma.$disconnect();
  });

  describe('1. Admin Authentication & Security', () => {
    it('should reject login with invalid password', async () => {
      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: 'test-admin@forwardflow.io', password: 'WrongPassword' });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('INVALID_CREDENTIALS');
    });

    it('should successfully authenticate and return token and cookie', async () => {
      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: 'test-admin@forwardflow.io', password: 'AdminPass123!' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.token).toBeDefined();
      expect(res.body.data.admin.email).toBe('test-admin@forwardflow.io');
      adminToken = res.body.data.token;

      // Also login second admin
      const res2 = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: 'secondary-admin@forwardflow.io', password: 'AdminPass123!' });
      secondAdminToken = res2.body.data.token;
    });

    it('should block unauthorized requests without token', async () => {
      const res = await request(app).get('/api/v1/whatsapp/accounts');
      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('UNAUTHORIZED');
    });

    it('should retrieve current authenticated profile with valid token', async () => {
      const res = await request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.admin.id).toBe(adminId);
    });
  });

  describe('2. WhatsApp Account Management & Multi-Account Isolation', () => {
    it('should create a WhatsApp account using mock provider', async () => {
      const res = await request(app)
        .post('/api/v1/whatsapp/accounts')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          displayName: 'Marketing Community Account',
          provider: 'mock',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.account.displayName).toBe('Marketing Community Account');
      expect(res.body.data.account.provider).toBe('mock');
      accountId = res.body.data.account.id;
    });

    it('should enforce account ownership (admin 2 cannot view or control admin 1 account)', async () => {
      const res = await request(app)
        .get(`/api/v1/whatsapp/accounts/${accountId}`)
        .set('Authorization', `Bearer ${secondAdminToken}`);

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
    });

    it('should wait for connection status to become CONNECTED', async () => {
      // Allow mock provider connection lifecycle (500ms QR -> 1500ms Connected)
      await new Promise((r) => setTimeout(r, 2200));

      const res = await request(app)
        .get(`/api/v1/whatsapp/accounts/${accountId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.account.connectionStatus).toBe('CONNECTED');
    });
  });

  describe('3. Communities, Announcements & Group Synchronization', () => {
    it('should synchronize WhatsApp conversations and detect capabilities', async () => {
      const res = await request(app)
        .post(`/api/v1/whatsapp/accounts/${accountId}/sync`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.totalSynced).toBeGreaterThan(0);
    });

    it('should correctly categorize Communities, announcements, and normal groups', async () => {
      const res = await request(app)
        .get(`/api/v1/whatsapp/accounts/${accountId}/conversations`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      const convs = res.body.data.conversations;

      const community = convs.find((c: any) => c.conversationType === 'COMMUNITY');
      const announcement = convs.find((c: any) => c.conversationType === 'COMMUNITY_ANNOUNCEMENT');
      const normalGroup = convs.find((c: any) => c.conversationType === 'GROUP' && c.canSendMessages);
      const restrictedGroup = convs.find((c: any) => c.conversationType === 'GROUP' && !c.canSendMessages);

      expect(community).toBeDefined();
      expect(announcement).toBeDefined();
      expect(normalGroup).toBeDefined();
      expect(restrictedGroup).toBeDefined();

      // Parent community container routes to announcement feed
      expect(community.canSendMessages).toBe(true);
      // Announcements where user is admin can receive sends
      expect(announcement.canSendMessages).toBe(true);
      // Restricted group where user is not admin cannot receive sends
      expect(restrictedGroup.canSendMessages).toBe(false);

      parentCommunityConvId = community.id;
      announcementsConvId = announcement.id;
      generalGroupConvId = normalGroup.id;
      clientAlertsConvId = restrictedGroup.id;
    });

    it('should filter conversations by type', async () => {
      const res = await request(app)
        .get(`/api/v1/whatsapp/accounts/${accountId}/conversations?type=COMMUNITY_ANNOUNCEMENT`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      for (const conv of res.body.data.conversations) {
        expect(conv.conversationType).toBe('COMMUNITY_ANNOUNCEMENT');
      }
    });

    it('should add multiple personal numbers with automatic +91 country code', async () => {
      const res = await request(app)
        .post(`/api/v1/whatsapp/accounts/${accountId}/custom-numbers`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          phoneNumbers: ['9810088950', '9820011223', '+91 98300 44556'],
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.conversations).toHaveLength(3);

      const [c1, c2, c3] = res.body.data.conversations;
      expect(c1.providerConversationId).toBe('919810088950@s.whatsapp.net');
      expect(c1.conversationType).toBe('INDIVIDUAL');
      expect(c1.name).toBe('+91 98100 88950');

      expect(c2.providerConversationId).toBe('919820011223@s.whatsapp.net');
      expect(c2.name).toBe('+91 98200 11223');

      expect(c3.providerConversationId).toBe('919830044556@s.whatsapp.net');
      expect(c3.name).toBe('+91 98300 44556');
    });
  });

  describe('4. Forwarding Rule Builder & Validation Safeguards', () => {
    it('should reject rule creation if destination is an unsupported group (cannot send messages)', async () => {
      const res = await request(app)
        .post('/api/v1/forwarding-rules')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Invalid Restricted Forwarding Rule',
          whatsappAccountId: accountId,
          sourceConversationId: announcementsConvId,
          destinationConversationIds: [clientAlertsConvId], // Restricted!
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('DESTINATION_UNSUPPORTED');
    });

    it('should reject rule creation if source and destination are the same (loop prevention)', async () => {
      const res = await request(app)
        .post('/api/v1/forwarding-rules')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Self Loop Rule',
          whatsappAccountId: accountId,
          sourceConversationId: generalGroupConvId,
          destinationConversationIds: [generalGroupConvId],
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('LOOP_PREVENTION_ERROR');
    });

    it('should successfully create a valid forwarding rule with formatted labels', async () => {
      const res = await request(app)
        .post('/api/v1/forwarding-rules')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Community Announcements -> General Group',
          whatsappAccountId: accountId,
          sourceConversationId: announcementsConvId,
          destinationConversationIds: [generalGroupConvId],
          formatting: {
            includeSourceLabel: true,
            forwardSenderName: true,
            includePrefix: true,
            prefixText: '⚡ [BROADCAST]',
            includeSuffix: false,
            suffixText: '',
            preserveCaptions: true,
          },
          messageTypes: {
            text: true,
            image: true,
            video: true,
            audio: true,
            document: true,
          },
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.rule.name).toBe('Community Announcements -> General Group');
      expect(res.body.data.rule.enabled).toBe(true);
      createdRuleId = res.body.data.rule.id;
    });

    it('should update/edit an existing forwarding rule (name, direction, bidirectional)', async () => {
      const editRes = await request(app)
        .patch(`/api/v1/forwarding-rules/${createdRuleId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Updated: Community Announcements -> General Group',
          direction: 'BOTH',
          bidirectional: false,
        });

      expect(editRes.status).toBe(200);
      expect(editRes.body.success).toBe(true);
      expect(editRes.body.data.rule.name).toBe('Updated: Community Announcements -> General Group');
      expect(editRes.body.data.rule.direction).toBe('BOTH');
    });

    it('should allow pausing and activating a forwarding rule', async () => {
      const pauseRes = await request(app)
        .post(`/api/v1/forwarding-rules/${createdRuleId}/pause`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(pauseRes.status).toBe(200);
      expect(pauseRes.body.data.rule.enabled).toBe(false);

      const activateRes = await request(app)
        .post(`/api/v1/forwarding-rules/${createdRuleId}/activate`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(activateRes.status).toBe(200);
      expect(activateRes.body.data.rule.enabled).toBe(true);
    });

    it('should create a forwarding rule with direct personal phone numbers', async () => {
      const res = await request(app)
        .post('/api/v1/forwarding-rules')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Announcements -> Personal Number Broadcast',
          whatsappAccountId: accountId,
          sourceConversationId: announcementsConvId,
          customPhoneNumbers: ['9999988888'],
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      const destinations = res.body.data.rule.destinations;
      expect(destinations.length).toBeGreaterThanOrEqual(1);
      const personalDest = destinations.find(
        (d: any) => d.destinationConversation.providerConversationId === '919999988888@s.whatsapp.net'
      );
      expect(personalDest).toBeDefined();
      expect(personalDest.destinationConversation.conversationType).toBe('INDIVIDUAL');
    });
  });

  describe('5. Real-Time Forwarding Engine, Idempotency & Loop Prevention', () => {
    it('should automatically forward incoming announcements to destination group', async () => {
      const provider = WhatsAppProviderFactory.getInstance(accountId) as MockWhatsAppProvider;
      expect(provider).toBeDefined();

      provider.clearSentMessages();

      // Simulate incoming message event in announcements conversation
      provider.simulateIncomingMessage({
        id: 'msg_test_announcement_001',
        sourceJid: '120363044112233446@g.us', // Announcements JID
        senderName: 'CEO Alex',
        textBody: 'Quarterly Town Hall is starting in 15 minutes!',
        messageType: 'text',
        fromMe: false,
      });

      // Allow background worker execution
      for (let i = 0; i < 30; i++) {
        if (provider.getSentMessages().length >= 2) break;
        await new Promise((r) => setTimeout(r, 100));
      }

      const sentMessages = provider.getSentMessages();
      expect(sentMessages.length).toBe(2);

      const groupMsg = sentMessages.find((m) => m.destinationJid === '120363044112233448@g.us');
      const personalMsg = sentMessages.find((m) => m.destinationJid === '919999988888@s.whatsapp.net');

      expect(groupMsg).toBeDefined();
      expect(personalMsg).toBeDefined();

      expect(groupMsg!.payload.text).toContain('⚡ [BROADCAST]');
      expect(groupMsg!.payload.text).toContain('Forwarded from:');
      expect(groupMsg!.payload.text).toContain('Quarterly Town Hall is starting in 15 minutes!');
      expect(personalMsg!.payload.text).toContain('Quarterly Town Hall is starting in 15 minutes!');
    });

    it('should prevent loop: drop messages with fromMe = true when message is automated', async () => {
      const provider = WhatsAppProviderFactory.getInstance(accountId) as MockWhatsAppProvider;
      // Wait for any previous pending jobs to settle before clearing
      await new Promise((r) => setTimeout(r, 200));
      provider.clearSentMessages();

      // Register automated message ID (echo prevention)
      ForwardingEngine.registerAutomatedMessageId('msg_test_loop_002');

      provider.simulateIncomingMessage({
        id: 'msg_test_loop_002',
        sourceJid: '120363044112233446@g.us',
        textBody: 'Message sent by ourselves that should never be re-forwarded',
        fromMe: true, // Automated echo
      });

      await new Promise((r) => setTimeout(r, 400));
      expect(provider.getSentMessages().length).toBe(0);
    });

    it('should automatically forward messages from a personal contact source to personal destination (P2P)', async () => {
      const provider = WhatsAppProviderFactory.getInstance(accountId) as MockWhatsAppProvider;
      provider.clearSentMessages();

      // 1. Add source personal number
      const addRes = await request(app)
        .post(`/api/v1/whatsapp/accounts/${accountId}/custom-numbers`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ phoneNumbers: ['9876543210'] });

      expect(addRes.status).toBe(200);
      expect(addRes.body.data.conversations.length).toBeGreaterThan(0);
      const sourceContactConvId = addRes.body.data.conversations[0].id;

      // 2. Create forwarding rule from this contact to another personal number
      const ruleRes = await request(app)
        .post('/api/v1/forwarding-rules')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'P2P Contact -> Direct Client Personal',
          whatsappAccountId: accountId,
          sourceConversationId: sourceContactConvId,
          customPhoneNumbers: ['9123456789'],
        });

      expect(ruleRes.status).toBe(201);

      // 3. Simulate incoming message from this contact (with WhatsApp Multi-Device JID format)
      provider.simulateIncomingMessage({
        id: 'msg_p2p_incoming_001',
        sourceJid: '919876543210@s.whatsapp.net',
        senderJid: '919876543210:0@s.whatsapp.net',
        senderName: 'VIP Client',
        textBody: 'Hello, need urgent assistance on invoice #1042',
        messageType: 'text',
        fromMe: false,
      });

      // 4. Wait for processing
      for (let i = 0; i < 30; i++) {
        if (provider.getSentMessages().length >= 1) break;
        await new Promise((r) => setTimeout(r, 100));
      }

      const p2pSent = provider.getSentMessages();
      expect(p2pSent.length).toBe(1);
      expect(p2pSent[0].destinationJid).toBe('919123456789@s.whatsapp.net');
      expect(p2pSent[0].payload.text).toContain('Hello, need urgent assistance on invoice #1042');
    });

    it('should forward messages sent by me (fromMe: true) when rule direction permits SENT or BOTH', async () => {
      const provider = WhatsAppProviderFactory.getInstance(accountId) as MockWhatsAppProvider;
      provider.clearSentMessages();

      // Simulate message typed by human user in source conversation (not an automated message)
      provider.simulateIncomingMessage({
        id: 'msg_human_sent_001',
        sourceJid: '919876543210@s.whatsapp.net',
        senderJid: '919876543210@s.whatsapp.net',
        senderName: 'Me',
        textBody: 'Outgoing message sent by me from WhatsApp phone',
        messageType: 'text',
        fromMe: true, // Sent by me!
      });

      for (let i = 0; i < 30; i++) {
        if (provider.getSentMessages().length >= 1) break;
        await new Promise((r) => setTimeout(r, 100));
      }

      const sent = provider.getSentMessages();
      expect(sent.length).toBeGreaterThanOrEqual(1);
      expect(sent[0].payload.text).toContain('Outgoing message sent by me from WhatsApp phone');
    });

    it('should support two-way / bidirectional forwarding from destination back to source', async () => {
      const provider = WhatsAppProviderFactory.getInstance(accountId) as MockWhatsAppProvider;
      provider.clearSentMessages();

      // Enable bidirectional on the P2P rule
      const rulesRes = await request(app)
        .get('/api/v1/forwarding-rules')
        .set('Authorization', `Bearer ${adminToken}`);

      const p2pRule = rulesRes.body.data.rules.find((r: any) => r.name.includes('P2P Contact'));
      expect(p2pRule).toBeDefined();

      await request(app)
        .patch(`/api/v1/forwarding-rules/${p2pRule.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ bidirectional: true, direction: 'BOTH' });

      // Now simulate a reply arriving in the DESTINATION (919123456789@s.whatsapp.net)
      provider.simulateIncomingMessage({
        id: 'msg_reply_from_dest_001',
        sourceJid: '919123456789@s.whatsapp.net',
        senderJid: '919123456789@s.whatsapp.net',
        senderName: 'Client Support Agent',
        textBody: 'Thank you for reaching out, invoice #1042 has been verified.',
        messageType: 'text',
        fromMe: false,
      });

      for (let i = 0; i < 30; i++) {
        if (provider.getSentMessages().length >= 1) break;
        await new Promise((r) => setTimeout(r, 100));
      }

      const replySent = provider.getSentMessages();
      expect(replySent.length).toBe(1);
      // Destination of reverse forward should be source contact (919876543210@s.whatsapp.net)
      expect(replySent[0].destinationJid).toBe('919876543210@s.whatsapp.net');
      expect(replySent[0].payload.text).toContain('Thank you for reaching out, invoice #1042 has been verified.');
    });

    it('should enforce idempotency and never process duplicate message twice for the same rule', async () => {
      const provider = WhatsAppProviderFactory.getInstance(accountId) as MockWhatsAppProvider;
      provider.clearSentMessages();

      // Send the same message ID again
      provider.simulateIncomingMessage({
        id: 'msg_test_announcement_001', // Already processed!
        sourceJid: '120363044112233446@g.us',
        textBody: 'Quarterly Town Hall is starting in 15 minutes!',
        fromMe: false,
      });

      await new Promise((r) => setTimeout(r, 400));
      // Should NOT send a duplicate message
      expect(provider.getSentMessages().length).toBe(0);
    });

    it('should generate deterministic idempotency keys', () => {
      const key1 = generateIdempotencyKey('acc1', 'src1', 'msg123', 'rule1', 'dest1');
      const key2 = generateIdempotencyKey('acc1', 'src1', 'msg123', 'rule1', 'dest1');
      const key3 = generateIdempotencyKey('acc1', 'src1', 'msg123', 'rule1', 'dest2');

      expect(key1).toBe(key2);
      expect(key1).not.toBe(key3);
    });
  });

  describe('6. Activity Logs, Retries & Dashboard Metrics', () => {
    it('should list message activity logs with job statuses', async () => {
      const res = await request(app)
        .get('/api/v1/activity')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.jobs.length).toBeGreaterThan(0);

      const completedJob = res.body.data.jobs.find((j: any) => j.status === 'SENT');
      expect(completedJob).toBeDefined();
      expect(completedJob.providerSentMessageId).toBeDefined();
    });

    it('should retrieve aggregated dashboard metrics calculated from database', async () => {
      const res = await request(app)
        .get('/api/v1/activity/stats')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.metrics.totalAccounts).toBe(1);
      expect(res.body.data.metrics.connectedAccounts).toBe(1);
      expect(res.body.data.metrics.activeRules).toBe(3);
      expect(res.body.data.metrics.messagesReceivedToday).toBeGreaterThan(0);
      expect(res.body.data.metrics.forwardingAttemptsToday).toBeGreaterThan(0);
      expect(res.body.data.hourlyActivity.length).toBe(24);
    });

    it('should support health check endpoint', async () => {
      const res = await request(app).get('/api/v1/health');
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('ok');
      expect(res.body.services.database).toBe('healthy');
    });
  });
});
