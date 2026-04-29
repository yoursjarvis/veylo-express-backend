# Authentication (Better Auth + Prisma v7 + Express)

Production-ready email/password authentication using Better Auth, Prisma ORM v7, and PostgreSQL with enterprise-grade user/session fields (snake_case at the DB layer).

## High-level architecture

- Better Auth server config: `src/lib/auth/auth.ts`
- Express routes: `src/app/http/routes/index.ts` + `src/modules/auth/auth.routes.ts`
- Controller / service / repository: `src/modules/auth/*`
- Auth guard: `src/app/http/middlewares/require-auth.middleware.ts`
- Rate limiting: `src/app/http/middlewares/rate-limit.middleware.ts`

## Database

- Prisma schema: `prisma/schema.prisma`
- Initial migration SQL: `prisma/migrations/20260429193000_init_auth/migration.sql`

Important note: **password hashes are stored by Better Auth in the `accounts.password` column** (`provider_id = "credential"`). The `users` table does **not** store passwords (best practice).

## Environment variables

See `.env.example`.

Required:
- `DATABASE_URL`
- `BETTER_AUTH_SECRET` (>= 32 chars recommended)
- `BETTER_AUTH_URL` (explicit base URL; avoids request inference)

Optional:
- `AUTH_SECONDARY_STORAGE_ENABLED=true` to enable Redis-backed secondary storage (caching/rate limit hooks)
- `AUTH_EMAIL_VERIFICATION_REDIRECT` (Next.js URL that reads `?token=` and calls `GET /api/v1/auth/verify-email`)
- `AUTH_RESET_PASSWORD_REDIRECT` (Next.js URL that reads `?token=` and calls `POST /api/v1/auth/reset-password`)

## Setup & run

1. Install dependencies: `pnpm i`
2. Generate Prisma client: `HOME=/tmp XDG_CACHE_HOME=/tmp/cache pnpm prisma generate`
3. Apply migrations:
   - Dev: `pnpm prisma migrate dev`
   - Prod: `pnpm prisma migrate deploy`
4. Start server: `pnpm dev`

## REST API

All endpoints respond with:

```json
{ "success": true, "message": "...", "data": {} }
```

### Auth

- `POST /api/v1/auth/signup`
  - body: `{ "first_name": "...", "last_name": "...", "email": "...", "password": "..." }`
  - response is enumeration-safe: always returns a generic success message
- `GET /api/v1/auth/verify-email?token=...`
- `POST /api/v1/auth/login`
  - body: `{ "email": "...", "password": "..." }`
- `POST /api/v1/auth/logout` (requires session)
- `POST /api/v1/auth/logout-all` (requires session)
- `POST /api/v1/auth/refresh` (requires session)
- `GET /api/v1/auth/me` (requires session)
- `POST /api/v1/auth/forgot-password`
  - body: `{ "email": "...", "redirect_to": "https://your-frontend/reset-password" }` (optional)
- `POST /api/v1/auth/reset-password`
  - body: `{ "token": "...", "new_password": "..." }`
- `POST /api/v1/auth/change-password` (requires session)
  - body: `{ "current_password": "...", "new_password": "..." }`

### Sessions / Devices

- `GET /api/v1/auth/sessions` (requires session)
- `DELETE /api/v1/auth/sessions/:id` (requires session)

## Postman

Collection: `docs/postman/veylo-auth.postman_collection.json`

## Next.js integration notes

- Use `fetch(..., { credentials: "include" })` for cookie-based sessions.
- Ensure your frontend origin is in `ALLOWED_ORIGINS` and Better Auth `trustedOrigins` (derived from `ALLOWED_ORIGINS`).
- Prefer HTTPS + `AUTH_SECONDARY_STORAGE_ENABLED=true` + secure secrets in production.

1. Final Prisma schema
2. All migrations
3. Better Auth setup
4. Express middleware config
5. Route files
6. Controllers
7. Services
8. Validation schemas
9. Error handling middleware
10. Env example
11. Security best practices notes
12. Postman collection examples
13. Future Next.js integration guide

---

## Code Quality Rules

* Use strict TypeScript
* No any types
* Clean architecture
* Production-ready code only
* No toy examples
* No pseudo code
* Use best practices
* Add comments where needed
* Keep code maintainable

---

## Extra Requirement

If Better Auth can manage sessions internally, integrate that cleanly with Prisma.

If Better Auth needs custom adapters, create proper adapter layer.

---

## Final Output Format

Give step-by-step production implementation with file structure first, then code files one by one.

Do not skip anything.
Build like it will be deployed to millions of users.
