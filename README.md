# Octera

Domain registrar + cloud services platform + domain marketplace, built on GIG.tech and (eventually) GoDaddy.

> **This is a scaffold, not a finished product.** Before you write new code, **read `CLAUDE.md`** — it's the complete project brief, decided stack, scope ordering, and open questions.

---

## Requirements

- **Node.js** 20 or newer
- **pnpm** 9 or newer (`npm install -g pnpm`)
- **Docker** + Docker Compose (for local Postgres + Redis)

## Getting started

```bash
# 1. Install dependencies
pnpm install

# 2. Set up environment
cp .env.example .env
# Then edit .env — at minimum, generate two JWT secrets:
#   openssl rand -hex 48   # → JWT_SECRET
#   openssl rand -hex 48   # → JWT_REFRESH_SECRET

# 3. Start Postgres and Redis
pnpm infra:up

# 4. Generate the Prisma client + run migrations + seed
pnpm db:generate
pnpm db:migrate
pnpm db:seed
# Seeding creates an admin user: info@crowconsulting.be
# with the password from SEED_ADMIN_PASSWORD in .env. Change it after first login.

# 5. Start both apps
pnpm dev
```

You should now have:
- **Web** at http://localhost:3000
- **API** at http://localhost:4000
- **Health check** at http://localhost:4000/health/live

Sign up a new account via the web UI, or log in as the seeded admin.

## Project layout

```
apps/
  api/                  Fastify backend (auth, domains, integrations)
    src/
      routes/           HTTP route handlers
      services/         Business logic (no HTTP concerns)
      integrations/     External API clients (GIG.tech, GoDaddy, Stripe…)
      middleware/       Fastify plugins (auth, etc.)
      lib/              Env loader, utilities

  web/                  Next.js 15 frontend
    src/
      app/              App Router pages
      components/       Reusable UI
      lib/              API client, auth context

packages/
  db/                   Prisma schema + generated client (shared)
  shared/               Zod schemas shared between API and web

docs/                   Architecture notes, runbooks
```

## Common commands

```bash
pnpm dev                 # Run API + web in parallel, with hot reload
pnpm build               # Production build of both apps
pnpm typecheck           # TypeScript check across everything
pnpm lint                # Lint everything

pnpm db:migrate          # Create + apply a new migration (dev)
pnpm db:migrate:deploy   # Apply pending migrations (production)
pnpm db:seed             # Seed admin user
pnpm db:studio           # Open Prisma Studio (browse the DB)

pnpm infra:up            # Start Postgres + Redis
pnpm infra:down          # Stop them
pnpm infra:logs          # Tail infra logs
```

## Environment variables

Every variable is documented in [`.env.example`](./.env.example). Variables fall into
three groups:

- **Always required**: `DATABASE_URL`, `REDIS_URL`, `JWT_SECRET`, `JWT_REFRESH_SECRET`
- **Required in production**: `GIGTECH_JWT`, `STRIPE_SECRET_KEY`, `RESEND_API_KEY`, `SENTRY_DSN`
- **v2 (existing paying customers)**: `GODADDY_API_KEY`, `GODADDY_API_SECRET`

## Architecture highlights

- **Backend is the source of truth.** The frontend never calls GIG.tech or GoDaddy directly.
- **All external API calls go through typed integration clients** in `apps/api/src/integrations/`. They handle retries, rate limiting, and Zod response validation.
- **Auth**: argon2-hashed passwords, short-lived JWT access tokens, rotating refresh tokens in httpOnly cookies.
- **State-changing external calls go through a job queue** (BullMQ + Redis). Never block a request handler on a slow upstream.
- **Audit everything** that touches money, domains, or access. Append-only `AuditLog` table.
- **Idempotency keys** on every external call that creates or modifies resources.

## What's done vs. what's next

See `CLAUDE.md` for the complete picture. In short:

**Done in this scaffold:**
- Auth (signup/login/refresh/logout/me) with proper security primitives
- Prisma schema for all 19 Base44 entities
- GIG.tech integration client structure (endpoint paths are stubs)
- Next.js frontend with Octera branding, landing page, login, signup, dashboard
- Role-based access control middleware
- Docker-based local dev environment

**Not done (next up for Claude Code):**
- Fleshing out GIG.tech endpoints once the full API docs are available
- Self-care portal pages (domains, DNS, SSL, hosting, email, invoices, tickets)
- Admin panel
- Stripe integration
- Job queue workers
- Email verification flow
- GoDaddy integration (v2)
- Production deployment config

## Deploying

No deployment config is included yet — the target hasn't been chosen. Strong options:

- **Railway** — simplest, one command, bundles Postgres + Redis. Good for v1.
- **Fly.io** — more control, pay-for-what-you-use.
- **GIG.tech's own cloud** — fitting since Octera resells it. More work to set up.

Before deploying, make sure every variable marked `[prod-required]` in `.env.example` is configured in the target's secret store.

## Questions for the project owner

These are unblocked once answered — see `CLAUDE.md` for the full list:

1. The GIG.tech JWT (is it long-lived or does it need a refresh flow?)
2. Full GIG.tech API documentation (the portal docs or OpenAPI spec)
3. GoDaddy API key + secret + OTE vs. production
4. Which payment provider to use (Stripe is assumed; confirm)
5. Production domain (`octera.net`? `octera.cloud`? both?)
6. Chosen deployment target

---

© Octera
