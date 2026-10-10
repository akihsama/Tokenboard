# ── Stage 1: dependencies ───────────────────────────────────
FROM node:22-alpine AS deps
RUN apk add --no-cache python3 make g++ libc6-compat
WORKDIR /app
RUN corepack enable
COPY package.json pnpm-lock.yaml* ./
RUN pnpm install --frozen-lockfile || pnpm install

# ── Stage 2: build ──────────────────────────────────────────
FROM node:22-alpine AS builder
RUN apk add --no-cache python3 make g++ libc6-compat
WORKDIR /app
RUN corepack enable
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN pnpm build

# ── Stage 3: runtime ────────────────────────────────────────
FROM node:22-alpine AS runner
WORKDIR /app
RUN apk add --no-cache libc6-compat
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV DATA_DIR=/app/data

RUN addgroup --system --gid 1001 nodejs \
 && adduser --system --uid 1001 nextjs \
 && mkdir -p /app/data && chown -R nextjs:nodejs /app/data

# Standalone server output (see next.config.ts output: 'standalone' is not set,
# so we copy the standard production build + node_modules).
COPY --from=builder --chown=nextjs:nodejs /app/.next ./.next
COPY --from=builder --chown=nextjs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nextjs:nodejs /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/package.json ./package.json
COPY --from=builder --chown=nextjs:nodejs /app/next.config.ts ./next.config.ts
COPY --from=builder --chown=nextjs:nodejs /app/lib ./lib

USER nextjs
EXPOSE 3000

VOLUME ["/app/data"]

CMD ["node_modules/.bin/next", "start", "-p", "3000"]
