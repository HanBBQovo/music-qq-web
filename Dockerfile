ARG NODE_IMAGE=node:20-alpine

FROM ${NODE_IMAGE} AS base
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
RUN apk add --no-cache libc6-compat

FROM base AS deps
COPY package.json package-lock.json ./
RUN --mount=type=cache,target=/root/.npm npm ci

FROM base AS builder
ARG NEXT_PUBLIC_API_URL=/music-api
ARG BACKEND_API_URL=http://music-api:18880
ARG VCS_REF=development
ARG VCS_MESSAGE=Built_from_Docker

COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN --mount=type=cache,target=/app/.next/cache \
    NEXT_OUTPUT_STANDALONE=true \
    NEXT_PUBLIC_API_URL="${NEXT_PUBLIC_API_URL}" \
    BACKEND_API_URL="${BACKEND_API_URL}" \
    VERCEL_GIT_COMMIT_SHA="${VCS_REF}" \
    VERCEL_GIT_COMMIT_MESSAGE="${VCS_MESSAGE}" \
    npm run build

FROM ${NODE_IMAGE} AS runner
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0

RUN apk add --no-cache wget \
    && addgroup -S nodejs \
    && adduser -S nextjs -G nodejs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD wget -qO- "http://127.0.0.1:${PORT}/api/health" >/dev/null || exit 1

CMD ["node", "server.js"]
