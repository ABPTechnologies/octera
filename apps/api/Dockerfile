# =============================================================================
# Octera API — multi-stage Docker build
#
# Stage 1 (deps):     Install ALL workspace deps once. Cached aggressively.
# Stage 2 (builder):  Generate Prisma client, compile TypeScript to dist/.
# Stage 3 (runner):   Slim runtime with prod deps + dist/ + Prisma client.
#
# Build context expects monorepo root: `docker build -f apps/api/Dockerfile .`
# Final image runs the API on $PORT (default 4000) plus a `worker` mode if
# invoked with `node dist/worker.js`.
#
# Architecture choice: we ship the whole monorepo into the deps stage rather
# than using `turbo prune` to slice it. Simpler, larger build context (still
# ~50MB after .dockerignore), and Turbo's prune output sometimes lags pnpm.
# Easy to switch later if image size becomes a real cost.
# =============================================================================

ARG NODE_VERSION=22-alpine

# -----------------------------------------------------------------------------
# Stage 1 — install workspace dependencies
# -----------------------------------------------------------------------------
FROM node:${NODE_VERSION} AS deps

# argon2 + native modules need build toolchain. Alpine ships `apk` so we add
# them temporarily; they're not in the final runtime image.
RUN apk add --no-cache python3 make g++ libc6-compat

# pnpm via corepack (matches the version pinned in root package.json)
RUN corepack enable && corepack prepare pnpm@9.12.3 --activate

WORKDIR /repo

# Copy lockfile + workspace manifests first so install layer caches as long
# as deps don't change. Then copy source.
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json turbo.json tsconfig.base.json ./
COPY apps/api/package.json ./apps/api/
COPY apps/web/package.json ./apps/web/
COPY packages/db/package.json ./packages/db/
COPY packages/shared/package.json ./packages/shared/

RUN pnpm install --frozen-lockfile

# -----------------------------------------------------------------------------
# Stage 2 — build the API
# -----------------------------------------------------------------------------
FROM node:${NODE_VERSION} AS builder

RUN apk add --no-cache libc6-compat
RUN corepack enable && corepack prepare pnpm@9.12.3 --activate

WORKDIR /repo

# Pull installed node_modules from deps stage
COPY --from=deps /repo/node_modules ./node_modules
COPY --from=deps /repo/apps/api/node_modules ./apps/api/node_modules
COPY --from=deps /repo/apps/web/node_modules ./apps/web/node_modules
COPY --from=deps /repo/packages/db/node_modules ./packages/db/node_modules
COPY --from=deps /repo/packages/shared/node_modules ./packages/shared/node_modules

# Now copy the source for everything the API depends on
COPY apps/api ./apps/api
COPY packages/db ./packages/db
COPY packages/shared ./packages/shared
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json turbo.json tsconfig.base.json ./

# Generate the Prisma client (writes into packages/db/node_modules/.prisma)
RUN pnpm --filter @octera/db generate

# Compile workspace packages FIRST, then the API. apps/api imports from
# @octera/shared and @octera/db; both ship as TS source in dev (resolved by
# tsx). In production we need real .js so plain `node` can resolve them via
# package.json `main` → `./dist/index.js`. Without this, the API exits at
# import time with "Unknown file extension '.ts'" and produces no logs (which
# is exactly what bit us on the first prod boot).
RUN pnpm --filter @octera/shared build
RUN pnpm --filter @octera/db build
RUN pnpm --filter @octera/api build

# -----------------------------------------------------------------------------
# Stage 3 — slim runtime
# -----------------------------------------------------------------------------
FROM node:${NODE_VERSION} AS runner

# tini: PID 1 / signal forwarding; libc6-compat: glibc shims; openssl: required
# by Prisma's query engine binary for the linux-musl-openssl-3.0.x target.
# Without `openssl` here, `prisma migrate deploy` warns "Prisma failed to detect
# the libssl/openssl version" and exits 1 at container start.
RUN apk add --no-cache tini libc6-compat openssl
RUN corepack enable && corepack prepare pnpm@9.12.3 --activate

WORKDIR /app

# Copy ONLY what the runtime needs:
# - compiled JS
# - production dependency tree
# - Prisma generated client + schema (for runtime migrations if needed)
# - workspace package metadata so node can resolve @octera/db, @octera/shared
COPY --from=builder /repo/apps/api/dist ./apps/api/dist
COPY --from=builder /repo/apps/api/package.json ./apps/api/package.json
COPY --from=builder /repo/packages/db/package.json ./packages/db/package.json
COPY --from=builder /repo/packages/db/prisma ./packages/db/prisma
COPY --from=builder /repo/packages/db/dist ./packages/db/dist
COPY --from=builder /repo/packages/shared/package.json ./packages/shared/package.json
COPY --from=builder /repo/packages/shared/dist ./packages/shared/dist
COPY --from=builder /repo/pnpm-lock.yaml ./
COPY --from=builder /repo/pnpm-workspace.yaml ./
COPY --from=builder /repo/package.json ./

# Install ONLY production deps (skips devDependencies). Re-uses the lockfile
# for reproducibility.
RUN pnpm install --frozen-lockfile --prod
RUN pnpm --filter @octera/db generate

# Run as non-root user. Node.js images ship a `node` user (uid 1000).
RUN chown -R node:node /app
USER node

ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=4000

EXPOSE 4000

# tini reaps zombies and forwards signals (SIGTERM) properly to Node — without
# it, our graceful-shutdown handler may not fire on container stop.
ENTRYPOINT ["/sbin/tini", "--"]

# Default: HTTP API. Override to `node apps/api/dist/worker.js` for a worker
# container.
CMD ["node", "apps/api/dist/index.js"]
