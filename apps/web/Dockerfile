# =============================================================================
# Octera Web (Next.js) — multi-stage Docker build with standalone output
#
# Next.js's `output: 'standalone'` mode emits a self-contained server bundle
# at .next/standalone/ that includes only the JS files actually needed at
# runtime, plus a minimal package.json. Final image is ~120MB instead of
# ~600MB+ if we shipped node_modules.
#
# Build context expects monorepo root: `docker build -f apps/web/Dockerfile .`
# =============================================================================

ARG NODE_VERSION=22-alpine

# -----------------------------------------------------------------------------
# Stage 1 — install workspace dependencies
# -----------------------------------------------------------------------------
FROM node:${NODE_VERSION} AS deps

RUN apk add --no-cache libc6-compat
RUN corepack enable && corepack prepare pnpm@9.12.3 --activate

WORKDIR /repo

COPY pnpm-lock.yaml pnpm-workspace.yaml package.json turbo.json tsconfig.base.json ./
COPY apps/api/package.json ./apps/api/
COPY apps/web/package.json ./apps/web/
COPY packages/db/package.json ./packages/db/
COPY packages/shared/package.json ./packages/shared/

RUN pnpm install --frozen-lockfile

# -----------------------------------------------------------------------------
# Stage 2 — build the Next.js app
# -----------------------------------------------------------------------------
FROM node:${NODE_VERSION} AS builder

RUN apk add --no-cache libc6-compat
RUN corepack enable && corepack prepare pnpm@9.12.3 --activate

WORKDIR /repo

COPY --from=deps /repo/node_modules ./node_modules
COPY --from=deps /repo/apps/web/node_modules ./apps/web/node_modules
COPY --from=deps /repo/packages/shared/node_modules ./packages/shared/node_modules

COPY apps/web ./apps/web
COPY packages/shared ./packages/shared
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json turbo.json tsconfig.base.json ./

# @octera/shared's package.json `main` points at compiled dist/. Build it
# before next build resolves the import — same lesson as the API side. With
# `transpilePackages` in next.config Next can transpile *source*, but module
# resolution still walks `main`/`exports` first; without dist/ Next errors out
# at build with "Cannot find module '@octera/shared'".
RUN pnpm --filter @octera/shared build

# Build with Next.js standalone output enabled (see next.config.mjs).
# Next.js will emit:
#   apps/web/.next/standalone/    — self-contained server + minimal node_modules
#   apps/web/.next/static/        — static chunks served by the standalone server
ENV NEXT_TELEMETRY_DISABLED=1
RUN pnpm --filter @octera/web build

# -----------------------------------------------------------------------------
# Stage 3 — slim runtime
# -----------------------------------------------------------------------------
FROM node:${NODE_VERSION} AS runner

RUN apk add --no-cache tini libc6-compat

WORKDIR /app

# Standalone bundle has its own minimal node_modules + bundled server.
# Static assets must be copied alongside, plus the public/ folder.
# Note: standalone output preserves the monorepo path structure inside it,
# so the server entry is at apps/web/server.js.
COPY --from=builder /repo/apps/web/public ./apps/web/public
COPY --from=builder /repo/apps/web/.next/standalone ./
COPY --from=builder /repo/apps/web/.next/static ./apps/web/.next/static

# Drop privileges
RUN chown -R node:node /app
USER node

ENV NODE_ENV=production \
    HOSTNAME=:: \
    PORT=3000 \
    NEXT_TELEMETRY_DISABLED=1
# `::` (IPv6 dual-stack) — same reason as the API. Railway's internal mesh
# routes via IPv6; an IPv4-only listener returns 502 even though Next prints
# "Server started" cleanly. See CLAUDE.md "Hard-won deployment lessons".

EXPOSE 3000

ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "apps/web/server.js"]
