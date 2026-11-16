# syntax=docker/dockerfile:1
# Multi-stage: deps → builder → runner (standalone Next.js + worker).
# Non-root user nextjs (uid 1001). Не монтировать docker.sock сюда.

ARG NODE_VERSION=22-bookworm-slim

FROM node:${NODE_VERSION} AS deps
WORKDIR /app
RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates openssl \
  && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json ./
COPY prisma ./prisma
# postinstall = prisma generate — схема уже на месте
RUN npm ci

FROM node:${NODE_VERSION} AS prod-deps
WORKDIR /app
RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates openssl \
  && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json ./
COPY prisma ./prisma
RUN npm ci --omit=dev \
  && npm install tsx@4.23.15 --omit=dev

FROM deps AS builder
WORKDIR /app
COPY . .
ARG NEXT_PUBLIC_THEME_VARIANT=A
ENV NEXT_PUBLIC_THEME_VARIANT=${NEXT_PUBLIC_THEME_VARIANT}
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production
RUN npx prisma generate
RUN npm run build
# Бандл worker: наш код внутри, npm-пакеты — external (из node_modules runner)
RUN npx --yes esbuild@0.25.0 src/worker/index.ts \
  --bundle \
  --platform=node \
  --target=node22 \
  --format=cjs \
  --outfile=dist/worker.cjs \
  --packages=external \
  --alias:@=./src

FROM node:${NODE_VERSION} AS runner
WORKDIR /app
RUN apt-get update \
  && apt-get install -y --no-install-recommends \
    ca-certificates \
    curl \
    openssl \
    postgresql-client \
  && rm -rf /var/lib/apt/lists/* \
  && groupadd --system --gid 1001 nodejs \
  && useradd --system --uid 1001 --gid nodejs nextjs

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
ENV UPLOADS_DIR=/app/uploads
ENV BACKUPS_DIR=/app/backups

# Сначала standalone (server.js), затем полные prod node_modules поверх минимальных
COPY --from=builder /app/.next/standalone ./
COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=builder /app/package.json /app/package-lock.json ./
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/scripts ./scripts
COPY --from=builder /app/src ./src
COPY --from=builder /app/tsconfig.json ./tsconfig.json
COPY --from=builder /app/dist/worker.cjs ./worker.cjs
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/static ./.next/static
COPY docker/entrypoint.sh /entrypoint.sh

RUN chmod +x /entrypoint.sh \
  && mkdir -p /app/uploads /app/backups \
  && chown -R nextjs:nodejs /app

USER nextjs
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=45s --retries=3 \
  CMD curl -fsS "http://127.0.0.1:3000/admin/api/health" || exit 1

ENTRYPOINT ["/entrypoint.sh"]
CMD ["node", "server.js"]
