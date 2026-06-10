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
- pnpm >= 9
- PostgreSQL
- Redis (Optional, for secondary storage/rate limiting)

## Local Host Configuration

To support multi-tenancy and subdomains (e.g., `org1.veylo.local`), you need to update your hosts file.

### Linux / macOS
Add the following to `/etc/hosts`:
```bash
127.0.0.1 veylo.local
127.0.0.1 api.veylo.local
```

### Windows
Add the following to `C:\Windows\System32\drivers\etc\hosts` (Run Notepad as Administrator):
```text
127.0.0.1 veylo.local
127.0.0.1 api.veylo.local
```

## Database

- Prisma schema: `prisma/schema.prisma`
- Initial migration SQL: `prisma/migrations/20260429193000_init_auth/migration.sql`

Important note: **password hashes are stored by Better Auth in the `accounts.password` column** (`provider_id = "credential"`). The `users` table does **not** store passwords (best practice).

## Environment variables

Copy `.env.example` to `.env` and fill in the values.

### Required Core Variables
- `DATABASE_URL`: `"postgresql://user:pass@localhost:5432/veylo"`
- `BETTER_AUTH_SECRET`: Generate using `openssl rand -hex 32`
- `BETTER_AUTH_URL`: `"http://veylo.local:4000"` (The base URL of your API)
- `ALLOWED_ORIGINS`: `"http://veylo.local:3000,http://localhost:3000"`

### Social Auth (OAuth)
To enable Google and GitHub login, you'll need to create applications in their respective developer consoles.

**Google:**
- `GOOGLE_CLIENT_ID`: `"your-google-client-id.apps.googleusercontent.com"`
- `GOOGLE_CLIENT_SECRET`: `"your-google-client-secret"`
- Callback URL: `http://veylo.local:4000/api/v1/auth/callback/google`

**GitHub:**
- `GITHUB_CLIENT_ID`: `"your-github-client-id"`
- `GITHUB_CLIENT_SECRET`: `"your-github-client-secret"`
- Callback URL: `http://veylo.local:4000/api/v1/auth/callback/github`

### Optional Variables
- `AUTH_SECONDARY_STORAGE_ENABLED=true` to enable Redis-backed secondary storage (caching/rate limit hooks)
- `AUTH_EMAIL_VERIFICATION_REDIRECT`: `"http://veylo.local:3000/verify-email"`
- `AUTH_RESET_PASSWORD_REDIRECT`: `"http://veylo.local:3000/reset-password"`

## Setup & run

1. **Install dependencies:**
   ```bash
   pnpm i
   ```

2. **Database Setup:**
   Ensure PostgreSQL is running, then:
   ```bash
   pnpm prisma generate
   pnpm prisma migrate dev
   ```

3. **Start the server:**
   ```bash
   pnpm dev
   ```
   The API will be available at `http://veylo.local:4000`.

## Monitoring & Dashboards

The project includes a full observability stack. Use the following links to access the management and visualization tools:

### Web Dashboards
| Dashboard | URL | Description |
|-----------|-----|-------------|
| **Grafana** | [http://localhost:3002](http://localhost:3002) | **Primary UI** for Logs (Loki), Traces (Tempo), and Metrics |
| **BullMQ Admin** | [http://api.veylo.local:4000/admin/queues](http://api.veylo.local:4000/admin/queues) | Queue management (Jobs, Workers, Retries) |
| **Prometheus** | [http://localhost:9090](http://localhost:9090) | Direct metrics query and alerting rules |
| **Redis Insight** | [http://localhost:5540](http://localhost:5540) | GUI for inspecting Redis data and keys |

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

* Use strict TypeScript
* No `any` types
* Clean architecture
* Production-ready code only
* Use best practices (snake_case in DB, camelCase in App)

