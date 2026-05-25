# GameClub server — Dockerfile (Railway uchun)
FROM node:20-alpine AS base
RUN apk add --no-cache libc6-compat openssl
RUN corepack enable && corepack prepare pnpm@9.7.0 --activate
WORKDIR /app

# === Dependencies (cache layer) ===
FROM base AS deps
COPY package.json pnpm-lock.yaml* pnpm-workspace.yaml ./
COPY apps/server/package.json apps/server/package.json
COPY packages/db/package.json packages/db/package.json
COPY packages/shared/package.json packages/shared/package.json
COPY packages/i18n/package.json packages/i18n/package.json

# pnpm-lock yo'q bo'lsa ham frozen-lockfile o'rniga install
RUN pnpm install --filter @gameclub/server --filter @gameclub/db --filter @gameclub/shared --filter @gameclub/i18n

# === Builder ===
FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/server/node_modules ./apps/server/node_modules
COPY --from=deps /app/packages/db/node_modules ./packages/db/node_modules
COPY --from=deps /app/packages/shared/node_modules ./packages/shared/node_modules
COPY --from=deps /app/packages/i18n/node_modules ./packages/i18n/node_modules

COPY tsconfig.base.json package.json pnpm-workspace.yaml ./
COPY packages ./packages
COPY apps/server ./apps/server

# Prisma client yaratish
WORKDIR /app/packages/db
RUN pnpm exec prisma generate

# Shared, i18n, db build
WORKDIR /app/packages/shared
RUN pnpm run build || true

WORKDIR /app/packages/i18n
RUN pnpm run build || true

WORKDIR /app/packages/db
RUN pnpm run build || true

# Server build
WORKDIR /app/apps/server
RUN pnpm run build

# === Production runtime ===
FROM base AS runner
ENV NODE_ENV=production
ENV TZ=Asia/Tashkent

# Production dependencies
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/apps/server/node_modules ./apps/server/node_modules
COPY --from=builder /app/packages/db/node_modules ./packages/db/node_modules
COPY --from=builder /app/packages/shared/node_modules ./packages/shared/node_modules
COPY --from=builder /app/packages/i18n/node_modules ./packages/i18n/node_modules

# Build outputs
COPY --from=builder /app/apps/server/dist ./apps/server/dist
COPY --from=builder /app/packages/db/dist ./packages/db/dist
COPY --from=builder /app/packages/db/prisma ./packages/db/prisma
COPY --from=builder /app/packages/shared/dist ./packages/shared/dist
COPY --from=builder /app/packages/i18n/dist ./packages/i18n/dist

# Package json fayllari (workspace resolution uchun)
COPY apps/server/package.json ./apps/server/
COPY packages/db/package.json ./packages/db/
COPY packages/shared/package.json ./packages/shared/
COPY packages/i18n/package.json ./packages/i18n/
COPY package.json pnpm-workspace.yaml ./

EXPOSE 3001

# Entrypoint script (sed fixes Windows CRLF line endings)
COPY entrypoint.sh /app/entrypoint.sh
RUN sed -i 's/\r$//' /app/entrypoint.sh && chmod +x /app/entrypoint.sh

ENTRYPOINT ["/bin/sh", "/app/entrypoint.sh"]
