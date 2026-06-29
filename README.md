# Authentication (Better Auth + Prisma v7 + Express)

Production-ready email/password and social (Google, GitHub) authentication using Better Auth, Prisma ORM v7, and PostgreSQL with enterprise-grade user/session fields.

## High-level architecture

- Better Auth server config: `src/lib/auth/auth.ts`
- Express routes: `src/app/http/routes/index.ts` + `src/modules/auth/auth.routes.ts`
- Controller / service / repository: `src/modules/auth/*`
- Auth guard: `src/app/http/middlewares/require-auth.middleware.ts`
- Rate limiting: `src/app/http/middlewares/rate-limit.middleware.ts`

## Prerequisites

- Node.js >= 20
- npm >= 10 (or pnpm >= 9)
- Docker + Docker Compose

## Local Host Configuration (HTTPS & Multi-tenancy)

To support multi-tenancy, subdomains (e.g., `tenant1.veylo.com`), and Google OAuth, you **must** use local HTTPS with a public TLD like `.com`.

### 1. Install mkcert

Follow instructions for your OS: [mkcert repository](https://github.com/FiloSottile/mkcert).

```bash
mkcert -install
mkdir certs
mkcert -key-file certs/key.pem -cert-file certs/cert.pem "veylo.com" "*.veylo.com" "localhost"
```

### 2. Update Hosts File

Add the following to `/etc/hosts` (Linux/macOS) or `C:\Windows\System32\drivers\etc\hosts` (Windows):

```text
127.0.0.1 veylo.com
127.0.0.1 api.veylo.com
127.0.0.1 tenant1.veylo.com
```

### 3. Environment Variables

Ensure your `.env` has:

- `PORT=443`
- `APP_URL="https://api.veylo.com"`
- `APP_DOMAIN="veylo.com"`
- `SSL_KEY_PATH="./certs/key.pem"`
- `SSL_CRT_PATH="./certs/cert.pem"`

> **Note:** On Linux/macOS, running on port 443 requires `sudo`.

## Database

- Prisma schema: `prisma/schema.prisma`
- Initial migration SQL: `prisma/migrations/20260429193000_init_auth/migration.sql`

Important note: **password hashes are stored by Better Auth in the `accounts.password` column** (`provider_id = "credential"`). The `users` table does **not** store passwords (best practice).

## Environment variables

Copy `.env.example` to `.env` and fill in the values.

### Required Core Variables

- `DATABASE_URL`: `"postgresql://user:pass@localhost:5432/veylo"`
- `BETTER_AUTH_SECRET`: Generate using `openssl rand -hex 32`
- `BETTER_AUTH_URL`: `"https://api.veylo.com"` (The base URL of your API)
- `ALLOWED_ORIGINS`: `"https://veylo.com:3000,http://localhost:3000"`

### Social Auth (OAuth)

To enable Google and GitHub login, you'll need to create applications in their respective developer consoles.

**Google:**

- `GOOGLE_CLIENT_ID`: `"your-google-client-id.apps.googleusercontent.com"`
- `GOOGLE_CLIENT_SECRET`: `"your-google-client-secret"`
- Callback URL: `https://api.veylo.com:4000/api/v1/auth/callback/google`

**GitHub:**

- `GITHUB_CLIENT_ID`: `"your-github-client-id"`
- `GITHUB_CLIENT_SECRET`: `"your-github-client-secret"`
- Callback URL: `https://api.veylo.com:4000/api/v1/auth/callback/github`

### Optional Variables

- `AUTH_SECONDARY_STORAGE_ENABLED=true` to enable Redis-backed secondary storage (caching/rate limit hooks)
- `AUTH_EMAIL_VERIFICATION_REDIRECT`: `"https://veylo.com:3000/verify-email"`
- `AUTH_RESET_PASSWORD_REDIRECT`: `"https://veylo.com:3000/reset-password"`

## Setup & run

1. **Install dependencies:**

   ```bash
   npm install
   ```

2. **Create local environment file (first time only):**

   ```bash
   cp .env.example .env
   ```

3. **Bootstrap local services + Prisma (recommended):**

   ```bash
   npm run setup:local
   ```

   This command:
   - starts `postgres` and `redis` containers (`docker compose up -d postgres redis`)
   - runs Prisma generate + migrations

4. **Start the server:**
   ```bash
   npm run dev
   ```
   The API will be available at `https://api.veylo.com:4000`.

## Monitoring & Dashboards

The project includes a full observability stack. Use the following links to access the management and visualization tools:

### Web Dashboards

| Dashboard         | URL                                                                      | Description                                                 |
| ----------------- | ------------------------------------------------------------------------ | ----------------------------------------------------------- |
| **Grafana**       | [http://localhost:3002](http://localhost:3002)                           | **Primary UI** for Logs (Loki), Traces (Tempo), and Metrics |
| **BullMQ Admin**  | [https://api.veylo.com/admin/queues](https://api.veylo.com/admin/queues) | Queue management (Jobs, Workers, Retries)                   |
| **Prometheus**    | [http://localhost:9090](http://localhost:9090)                           | Direct metrics query and alerting rules                     |
| **Redis Insight** | [http://localhost:5540](http://localhost:5540)                           | GUI for inspecting Redis data and keys                      |

### Internal Service Endpoints (No Web UI)

These services do not have a standalone dashboard and are accessed via Grafana:

- **Tempo (Tracing):** Port `3200` (Internal OTLP/HTTP)
- **Loki (Logs):** Port `3100` (Internal Log ingestion/query)
- **OTEL Collector:** Port `8888` (Internal health/metrics)

### Metrics & Tracing Endpoints

- **API Metrics:** `GET /metrics` (Prometheus format)
- **OTEL Collector (gRPC):** `localhost:4317`
- **OTEL Collector (HTTP):** `localhost:4318`

## REST API

All endpoints respond with:

```json
{ "success": true, "message": "...", "data": {} }
```

### Auth Endpoints

- `POST /api/v1/auth/signup` - `{ "first_name": "...", "last_name": "...", "email": "...", "password": "..." }`
- `POST /api/v1/auth/login` - `{ "email": "...", "password": "..." }`
- `GET /api/v1/auth/me` - (requires session)
- `POST /api/v1/auth/logout` - (requires session)
- `GET /api/v1/auth/verify-email?token=...`
- `POST /api/v1/auth/forgot-password` - `{ "email": "..." }`
- `POST /api/v1/auth/reset-password` - `{ "token": "...", "new_password": "..." }`

## Postman

Collection: `docs/postman/veylo-auth.postman_collection.json`

## Code Quality Rules

- Use strict TypeScript
- No `any` types
- Clean architecture
- Production-ready code only
- Use best practices (snake_case in DB, camelCase in App)

`GET /api/v1/auth/verify-email?token=...`

- `POST /api/v1/auth/forgot-password` - `{ "email": "..." }`
- `POST /api/v1/auth/reset-password` - `{ "token": "...", "new_password": "..." }`

## Postman

Collection: `docs/postman/veylo-auth.postman_collection.json`

## Code Quality Rules

- Use strict TypeScript
- No `any` types
- Clean architecture
- Production-ready code only
- Use best practices (snake_case in DB, camelCase in App)

Clean architecture

- Production-ready code only
- Use best practices (snake_case in DB, camelCase in App)

pp)
