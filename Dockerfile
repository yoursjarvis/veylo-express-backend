FROM node:22-alpine AS base
WORKDIR /app

# -------------------------
# Install dependencies
# -------------------------
FROM base AS deps
COPY package.json package-lock.json ./
RUN npm ci

# -------------------------
# Build stage
# -------------------------
FROM deps AS build
COPY . .
RUN DATABASE_URL=postgresql://postgres:postgres@localhost:5432/postgres?schema=public \
    npx prisma generate && npm run build

# -------------------------
# Production runtime
# -------------------------
FROM base AS runtime
ENV NODE_ENV=production

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY --from=build /app/dist ./dist
COPY --from=build /app/generated ./generated
COPY --from=build /app/generated ./dist/generated

EXPOSE 3000
CMD ["node", "dist/src/index.js"]