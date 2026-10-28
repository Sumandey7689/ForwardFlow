# ForwardFlow — WhatsApp Community Auto Forwarder SaaS

[![TypeScript](https://img.shields.io/badge/TypeScript-5.6-blue.svg)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-20.x-green.svg)](https://nodejs.org/)
[![React](https://img.shields.io/badge/React-18.x-cyan.svg)](https://react.dev/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-3.4-38bdf8.svg)](https://tailwindcss.com/)
[![MySQL](https://img.shields.io/badge/MySQL-8.0-orange.svg)](https://www.mysql.com/)
[![Redis](https://img.shields.io/badge/Redis-7.x-red.svg)](https://redis.io/)
[![BullMQ](https://img.shields.io/badge/BullMQ-5.x-yellow.svg)](https://docs.bullmq.io/)
[![License](https://img.shields.io/badge/License-MIT-purple.svg)](LICENSE)

A production-grade, multi-tenant WhatsApp Community message-forwarding SaaS platform with a premium dashboard interface. The system empowers administrators to authenticate, link multiple isolated WhatsApp accounts via Multi-Device QR codes, inspect organic WhatsApp Communities, announcement feeds, and member groups, and configure real-time automated forwarding pipelines with robust deduplication, scheduling, and loop prevention safeguards.

---

## Architecture Overview

```
                      ┌────────────────────────────────────────┐
                      │    ForwardFlow Premium SaaS UI         │
                      │  (React 18 + Vite + Tailwind + WSS)   │
                      └───────────────────▲────────────────────┘
                                          │ REST API / Socket.IO
                      ┌───────────────────▼────────────────────┐
                      │    Express.js SaaS API Gateway         │
                      │ (Rate Limiting, Auth, Tenant Security) │
                      └───────┬────────────────────────┬───────┘
                              │                        │
             ┌────────────────┴──────┐   ┌─────────────┴──────────┐
             │ WhatsApp Provider     │   │ BullMQ Job Queue       │
             │ Abstraction Layer     │   │ (Redis Coordination)   │
             │  - Baileys Multi-Dev  │   │  - Idempotency Hash    │
             │  - Mock Sandbox QA    │   │  - Exponential Backoff │
             └───────────────┬───────┘   └─────────────┬──────────┘
                             │                         │
     ┌───────────────────────▼─────────────────────────▼──────────────┐
     │                      Prisma ORM (MySQL 8)                      │
     │ Admins │ WhatsAppAccounts │ Conversations │ Rules │ Jobs │ Logs │
     └────────────────────────────────────────────────────────────────┘
```

---

## 1. Verified Technology Stack & WhatsApp Library Evaluation

### Evaluated WhatsApp Providers

| Provider | Architecture | Memory Footprint | Community & Announcement Support | Production Assessment |
| :--- | :--- | :--- | :--- | :--- |
| **Baileys (Active)** | Pure WebSocket protocol (`wss://web.whatsapp.com/ws/chat`) | **~35–50 MB** per account | **Supported**: Exposes `isCommunity`, `isCommunityAnnounce`, `linkedParent`, and participant rights | **Selected Default**: Fast, stable in Docker containers without headless Chrome crashes |
| **whatsapp-web.js** | Puppeteer / Chromium browser automation | **~450–800 MB** per account | Partial / brittle selectors; fails frequently under memory constraints | **Not recommended** for multi-account server workloads |
| **WPPConnect** | Headless Chrome engine | **~500–900 MB** per account | Chromium crash risks on VPS | **Not recommended** for low-latency SaaS engines |
| **Official WhatsApp Business Platform** | Meta Graph API Webhooks | Stateless REST | **Unsupported**: The official Cloud API strictly forbids joining consumer WhatsApp Communities or listening to organic group conversations | Documented limitation; strictly template/customer-service focused |

### Abstraction Architecture
The platform implements an `IWhatsAppProvider` interface (`server/src/whatsapp/IWhatsAppProvider.ts`) managed by `WhatsAppProviderFactory`:
- **`BaileysProvider`**: Uses `@whiskeysockets/baileys` with isolated multi-file auth credentials.
- **`MockWhatsAppProvider`**: High-fidelity sandbox provider for deterministic end-to-end integration testing and offline development.

---

## 2. Community & Group Capabilities Matrix

WhatsApp Communities have a distinct hierarchical architecture. The platform enforces verified capability rules:

1. **Parent Community Container (`COMMUNITY`)**:
   - Acts as the organizational root for chapters and groups.
   - **Source capability:** ✅ Can receive/monitor messages if account is member.
   - **Destination capability:** ❌ Disabled with explanation. Direct messages cannot be posted to parent containers; only linked groups or announcement feeds accept posts.
2. **Community Announcement Conversations (`COMMUNITY_ANNOUNCEMENT`)**:
   - Official one-way broadcast feed for the entire community.
   - **Source capability:** ✅ Can monitor announcement alerts.
   - **Destination capability:** ✅ Permitted **only** if the linked WhatsApp account is an administrator. Non-admin accounts have posting disabled with an explicit tooltip.
3. **Linked Community Groups (`COMMUNITY_GROUP`)**:
   - Thematic discussion groups connected to a parent community.
   - **Source & Destination:** ✅ Full read and write capabilities (unless group has admin-only posting enabled).
4. **Regular WhatsApp Groups (`GROUP`)**:
   - Standard peer-to-peer WhatsApp groups.
   - **Source & Destination:** ✅ Full read and write capabilities.

---

## 3. Core Capabilities & SaaS Features

- **Multi-Account Isolation:** Every WhatsApp account operates with isolated session credentials, separate storage paths, and encrypted session references using **AES-256-GCM**.
- **Visual Rule Builder Wizard:** 5-step intuitive flow (Account → Source Feed → Destinations → Media & Formatting Filters → Review & Instant Activation).
- **Infinite Loop Prevention:**
  - Messages with `fromMe: true` are discarded immediately.
  - The Rule Builder forbids configuring the same conversation as both source and destination.
  - Reverse echo suppression via message tracking.
- **Idempotency Safeguard:** Unique processing key `sha256(accountId + ":" + sourceId + ":" + messageId + ":" + ruleId + ":" + destId)` stored with a database unique index prevents duplicate forwarding.
- **Media Forwarding Engine:** Automatically downloads images, videos, audio, documents, applies formatted attribution headers to captions, and cleans temporary files.
- **Real-Time Live Updates:** Socket.IO WebSocket broadcasts connection states, QR codes, delivery logs, and 24-hour analytics.
- **Robust Retries:** BullMQ queue with Redis coordination and bounded exponential backoff (`status: RETRY_SCHEDULED` -> `nextRetryAt` -> `SENT` or `FAILED`).

---

## 4. Quick Start (Local Development)

### Prerequisites
- Node.js `20.x` or higher
- MySQL `8.0` (or running local instance)
- Redis `7.x` (or running Docker container)

### Step 1: Clone and Install Dependencies
```bash
# Install backend dependencies
cd server
npm install

# Install frontend dependencies
cd ../client
npm install
```

### Step 2: Configure Environment Variables
Copy and adjust the environment configuration:
```bash
# In server/
cp .env.example .env
```
Ensure `DATABASE_URL`, `REDIS_URL`, `JWT_SECRET`, and `SESSION_ENCRYPTION_KEY` are configured.

### Step 3: Run Database Migrations
```bash
cd server
npx prisma db push
```

### Step 4: Create Initial Administrator Account
Use the secure setup command:
```bash
cd server
npm run setup:admin -- --email admin@forwardflow.io --password Admin@Secure2026! --name "Platform Administrator"
```

### Step 5: Start Development Servers
In terminal 1 (Backend):
```bash
cd server
npm run dev
```

In terminal 2 (Frontend):
```bash
cd client
npm run dev
```
Open **`http://localhost:5173`** in your browser.

---

## 5. Automated Test Suite Execution

The repository includes a comprehensive 21-test automated suite testing authentication, authorization, session isolation, conversation sync, rule creation, loop prevention, idempotency, and the forwarding engine using mocked provider events.

To run the automated tests:
```bash
cd server
npm test
```

Expected output:
```
 ✓ src/__tests__/forwarder.test.ts (21 tests)
   ✓ 1. Admin Authentication & Security > should reject login with invalid password
   ✓ 1. Admin Authentication & Security > should successfully authenticate and return token and cookie
   ✓ 1. Admin Authentication & Security > should block unauthorized requests without token
   ✓ 2. WhatsApp Account Management > should create a WhatsApp account using mock provider
   ✓ 2. WhatsApp Account Management > should enforce account ownership (multi-tenant isolation)
   ✓ 3. Communities Synchronization > should categorize Communities, announcements, and normal groups
   ✓ 4. Forwarding Rule Builder > should reject rule creation if destination is unsupported
   ✓ 4. Forwarding Rule Builder > should reject rule creation if source and destination are the same (loop prevention)
   ✓ 5. Real-Time Forwarding Engine > should automatically forward incoming announcements
   ✓ 5. Real-Time Forwarding Engine > should prevent loop: drop messages with fromMe = true
   ✓ 5. Real-Time Forwarding Engine > should enforce idempotency and never process duplicate message twice
   ...
 Test Files  1 passed (1)
      Tests  21 passed (21)
```

---

## 6. Production Deployment (Docker Compose)

The application includes containerization for the entire stack:
- **`forwardflow-frontend`**: Nginx Alpine serving the optimized React SPA with WebSocket proxying and gzip compression.
- **`forwardflow-backend`**: Node.js 20 Alpine running as a secure non-root `node` user with healthcheck monitoring.
- **`forwardflow-mysql`**: MySQL 8.0 with persistent storage volume.
- **`forwardflow-redis`**: Redis 7.2 with AOF persistence.

### Launch with Docker Compose
```bash
docker compose up -d --build
```

### Verify Container Health
```bash
docker compose ps
```

The frontend will be available at **`http://localhost:8088`** (or configured port) and backend API health at **`http://localhost:8088/health`**.

---

## 7. Production Deployment on Ubuntu VPS / AWS EC2

### System Requirements
- **OS:** Ubuntu 22.04 LTS / Debian 12 / Amazon Linux 2023
- **CPU:** 2 vCPU minimum
- **RAM:** 2 GB minimum (4 GB recommended for 5+ concurrent WhatsApp accounts)
- **Disk:** 20 GB SSD

### Step-by-Step Ubuntu Deployment

1. **Install Docker & Docker Compose:**
   ```bash
   sudo apt update && sudo apt upgrade -y
   sudo apt install -y curl git ufw
   curl -fsSL https://get.docker.com | sh
   sudo usermod -aG docker $USER
   ```

2. **Clone Repository:**
   ```bash
   git clone https://github.com/your-org/whatsapp-forwardflow-saas.git /opt/forwardflow
   cd /opt/forwardflow
   ```

3. **Configure Environment:**
   ```bash
   cp .env.example .env
   # Edit secrets:
   nano .env
   ```
   *Tip: Generate 32-byte hex keys for `SESSION_ENCRYPTION_KEY`:*
   ```bash
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   ```

4. **Launch Docker Services:**
   ```bash
   docker compose up -d --build
   ```

5. **Initialize Administrator:**
   ```bash
   docker compose exec backend npm run setup:admin -- --email admin@yourdomain.com --password YourSuperSecretPassword! --name "Super Admin"
   ```

6. **Configure SSL / HTTPS (Let's Encrypt / Certbot):**
   Install Certbot on host Nginx to proxy port 80/443 to `forwardflow-frontend` container:
   ```bash
   sudo apt install -y certbot python3-certbot-nginx
   sudo certbot --nginx -d app.yourdomain.com
   ```

---

## 8. Database Backups & Maintenance

### Automated Daily MySQL Backup Script
Create `/opt/forwardflow/scripts/backup-db.sh`:
```bash
#!/bin/bash
BACKUP_DIR="/opt/forwardflow/backups"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
mkdir -p "$BACKUP_DIR"

docker compose -f /opt/forwardflow/docker-compose.yml exec -T mysql \
  mysqldump -u root -p"$MYSQL_ROOT_PASSWORD" whatsapp_forwarder_saas | gzip > "$BACKUP_DIR/db_backup_$TIMESTAMP.sql.gz"

# Retain 14 days of backups
find "$BACKUP_DIR" -type f -name "*.sql.gz" -mtime +14 -delete
```
Make executable and add to crontab:
```bash
chmod +x /opt/forwardflow/scripts/backup-db.sh
(crontab -l 2>/dev/null; echo "0 3 * * * /opt/forwardflow/scripts/backup-db.sh") | crontab -
```

---

## 9. Troubleshooting & Operational FAQ

### Q: Why is my destination group marked as "Restricted"?
**A:** In WhatsApp, Community announcement channels and groups with "Only Admins Can Send" permission (`announce: true`) require the connected phone number to hold administrator rights. If your account is an ordinary participant, you can use that group as a **source** (to read incoming messages), but not as a **destination**.

### Q: How many concurrent accounts can one server handle?
**A:** Because Baileys uses direct WebSockets instead of headless Chrome, each account consumes only **~35–50 MB RAM**. A standard 2 vCPU / 4 GB RAM server comfortably manages **25–40 active WhatsApp accounts** simultaneously.

### Q: What prevents message loops if Group A forwards to Group B and Group B forwards to Group A?
**A:** The engine applies three-layer protection:
1. `fromMe: true` drops all messages sent by our own connected account.
2. The Rule Builder explicitly blocks setting the source group as its own destination.
3. Cryptographic idempotency keys prevent processing duplicate transmission IDs within the configured deduplication window.

---

## License & Compliance Notice

This project is licensed under the MIT License.

*Disclaimer: This software utilizes unofficial WhatsApp protocols for message forwarding. WhatsApp and Meta are registered trademarks. The developers are not affiliated with Meta. Use responsibly in compliance with WhatsApp Terms of Service and local data regulations.*
