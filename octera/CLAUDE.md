# Octera — Project Brief for Claude Code

> **Read this entire file before writing any code.** It's the handoff from the Claude session that scaffolded this project. It explains what Octera is, what's been decided, what's been built, and what comes next.

---

## What Octera is

Octera is a **domain registrar + cloud services platform + domain marketplace** — think GoDaddy crossed with DigitalOcean, built on top of GIG.tech's decentralized cloud infrastructure (and, secondarily, GoDaddy's registrar API).

The user originally prototyped it on Base44 (a low-code builder). That prototype has **19 entities and ~25 pages**, but almost all of it is mock data sitting on top of Base44's generic database. The only piece wired to a real backend is the "self-care" portal, which talks to GIG.tech's whitelabel partner API at `https://portal.octera.cloud/api/1/`.

The decision has been made to **abandon Base44** and rebuild Octera as a real, production platform. This repo is that rebuild.

## Who will use it

- **Internal operators** (the user's company) — they run daily operations on it. Must be stable.
- **Paying customers** — migrated from the existing GoDaddy API setup. Must be reliable.
- **Not just a demo** — this is a live business platform, not a portfolio piece.

---

## Stack (decided, don't change without asking)

**Backend:**
- Node.js 20+ / TypeScript (strict)
- Fastify (HTTP server)
- Prisma (ORM) + PostgreSQL
- BullMQ + Redis (background jobs — domain provisioning, webhook retries, etc.)
- Zod (validation, shared between API and web)
- Pino (structured logging)

**Frontend:**
- Next.js 15 (App Router) + React 19
- TailwindCSS + shadcn/ui
- TanStack Query (server state)
- Zustand (minimal client state only where needed)

**Auth:**
- Email + password, argon2 hashing
- JWT access tokens (15 min) + refresh tokens (30 days, rotated)
- Roles: `admin`, `broker`, `client`, `user` (matches the Base44 schema)
- Permission checks via middleware on the API, mirrored in the UI

**Integrations:**
- GIG.tech (primary cloud + registrar) — `portal.octera.cloud/api/1/`
- GoDaddy API (secondary registrar, existing customers) — **credentials not yet provided**
- Stripe (payments + Stripe Connect for marketplace escrow)
- Resend (transactional email)
- Sentry (error tracking)

**Repo layout (pnpm + Turborepo monorepo):**
```
apps/
  api/       # Fastify backend
  web/       # Next.js frontend
packages/
  db/        # Prisma schema + client (shared)
  shared/    # Shared Zod schemas, types, constants
docs/        # Architecture notes, runbooks
```

**Deployment target:** TBD. Reasonable defaults:
- **Fast path:** Railway or Fly.io (both apps + Postgres + Redis in one place)
- **Right path long-term:** GIG.tech's own infrastructure, since Octera resells it

---

## Scope ordering (do not skip levels)

### v1 — Ship first, to internal users + existing paying customers
The goal of v1 is **feature parity with what paying customers already use on the old GoDaddy setup**, plus internal ops tooling. Everything else waits.

- [ ] Auth (signup, login, password reset, email verification, refresh tokens)
- [ ] User management + role-based access control
- [ ] Customer self-care portal:
  - [ ] Domain list, details, DNS management, WHOIS, transfer in/out
  - [ ] Hosting plans: list, provision, suspend, resize
  - [ ] SSL: provision (free via Let's Encrypt through GIG.tech), renew
  - [ ] Email accounts (GIG.tech mail service)
  - [ ] Invoices, billing history
  - [ ] Support tickets
  - [ ] Account settings
- [ ] Domain search + registration flow via GIG.tech
- [ ] Stripe checkout for domain purchases + hosting subscriptions
- [ ] Admin panel: user lookup, domain lookup, manual overrides, audit log viewer
- [ ] Error tracking + alerting wired up
- [ ] Automated database backups

### v2 — After v1 is live and stable for a few weeks
- [ ] GoDaddy integration (second registrar, migrate existing customers)
- [ ] Marketplace: listings, fixed-price + auctions + offers
- [ ] Stripe Connect escrow for marketplace transactions
- [ ] Seller ratings
- [ ] Brokerage requests + client/broker messaging

### v3 — Real cloud orchestration
These are in the Base44 prototype but were **entirely mocked**. They require real GIG.tech provisioning API integration and real state reconciliation.
- [ ] Kubernetes clusters
- [ ] Serverless functions
- [ ] Managed databases
- [ ] Unified deployment orchestration (link domain → hosting → services)
- [ ] CI/CD pipelines with rollback
- [ ] Real-time monitoring + custom alerts

### Cut from the prototype (don't rebuild unless asked)
- "AI domain valuation" — in the prototype this was randomized. If reintroduced, use a real API (EstiBot, GoDaddy Appraisals) or an honest heuristic model.
- "AI-powered due diligence reports" — same story.
- "Predictive TLD trend analysis" — same story.

---

## Architecture principles (read before making changes)

1. **The backend is the source of truth.** The frontend never talks to GIG.tech or GoDaddy directly. All external APIs are called from the backend, which holds credentials.

2. **All external API calls go through a typed integration client** in `apps/api/src/integrations/`. These clients handle retries, rate limiting, error normalization, and logging. If you find yourself calling `fetch` directly to an external service from a route handler, stop and wrap it in an integration client first.

3. **All state changes that touch external systems go through a job queue.** A user clicks "register domain" → API creates a pending record + enqueues a job → worker calls GIG.tech → worker updates the record → user gets a webhook/notification. Never do external API calls synchronously in a request handler for state-changing operations. (Reads can be synchronous if fast and cacheable.)

4. **Idempotency everywhere.** Every external call carries an idempotency key. Every webhook handler is idempotent. Every job is safe to retry.

5. **Audit log everything that touches money, domains, or access.** Separate `AuditLog` table. Immutable, append-only.

6. **Secrets via env vars only.** Never committed. `.env.example` lists every var. Production uses the hosting provider's secret store.

7. **Every API route has a Zod schema.** Shared between API and web via `packages/shared`.

8. **No magic.** If something's weird, write a comment explaining why. The person maintaining this (possibly another Claude session) will thank you.

---

## What has been done in this scaffold (v0.0.1)

Everything below is **skeleton only** unless marked otherwise. Nothing runs against real APIs yet because credentials aren't plugged in.

- ✅ Monorepo structure with pnpm + Turborepo
- ✅ Prisma schema translated from the 19 Base44 entities (see `packages/db/prisma/schema.prisma`)
- ✅ Fastify API with auth routes (signup/login/refresh/me)
- ✅ JWT + refresh token implementation with argon2
- ✅ Role-based middleware (`requireRole`, `requirePermission`)
- ✅ GIG.tech integration client stub (`apps/api/src/integrations/gigtech.ts`) — needs real endpoint mapping once JWT is provided
- ✅ Next.js 15 frontend skeleton with Tailwind + shadcn/ui + Octera brand tokens
- ✅ Login + dashboard pages
- ✅ `.env.example` listing every credential needed
- ✅ Docker Compose for local Postgres + Redis
- ✅ Basic CI via GitHub Actions

## What the next Claude Code session should do (in order)

1. **Get the project running locally.** See `README.md`. Confirm `pnpm dev` starts API + web + DB and you can register/login a user.

2. **Ask the user for the GIG.tech JWT and full API docs.** The prototype only had partial integration. We need the complete OpenAPI spec (or the portal docs) to implement the full self-care surface. User said they have it.

3. **Ask the user for GoDaddy credentials + whether OTE or production.** Not needed for v1 but needed to validate the existing-customer migration story.

4. **Build out the GIG.tech integration client properly.** Currently a stub. Needs: domain search, domain register, domain list, DNS records CRUD, hosting provisioning, SSL, email accounts, invoices, tickets. One method per endpoint, all with Zod response validation.

5. **Build the v1 self-care pages** on top of the integration client. Reference the Base44 prototype pages (visible in the original chat transcript) for UX — but rebuild the code properly.

6. **Wire up Stripe** for domain purchase checkout.

7. **Deploy to staging.** Railway is easiest; one-command deploy of the whole monorepo. Once stable, consider migrating to GIG.tech infra.

## What needs input from the user before specific work can start

| Blocker | Unblocks |
|---|---|
| GIG.tech JWT + API docs | Full self-care portal |
| GoDaddy API key + secret + OTE/prod choice | Existing-customer migration |
| Stripe account (test mode is fine to start) | Payments |
| Resend API key | Transactional email (verification, receipts, alerts) |
| Production domain (octera.net?) | Deployment + cookie config |
| Deployment target decision (Railway vs. Fly vs. GIG) | Going live |
| Sentry DSN | Error tracking |

---

## Things to be careful about

- **The GIG.tech JWT in the prototype was stored as `OCTERA_JWT_TOKEN`.** JWTs expire. Figure out with GIG.tech whether there's a login flow (likely) or a long-lived service token. A silent token expiry on production would be very bad.

- **Base44 has a database full of schema definitions but zero real data.** The user has 1 admin account (`info@crowconsulting.be`). No migration needed from Base44. But **there are paying customers on the existing GoDaddy system** — that migration is real and needs a separate plan once GoDaddy creds are in.

- **"Real-time" monitoring in the prototype was fake.** If and when v3 is built, the metrics have to come from GIG.tech's actual monitoring API. Don't replicate the fake charts.

- **Escrow is regulated in many jurisdictions.** Before v2, check whether the user's business entity can legally run escrow in its jurisdiction. Stripe Connect handles the mechanics, but legal compliance is separate.

---

## Reference: the original Base44 prototype

The entire Base44 build history is preserved in `docs/base44-history.md`. It's useful as a **feature list and UX reference** — not as code to port. The code was generated by Base44's builder AI and isn't directly usable.

## Reference: Base44 entity schemas

Prisma schema in `packages/db/prisma/schema.prisma` is translated from these. Semantic notes where translation wasn't 1:1 are in comments inside the schema file.

---

## Contact

The user's Base44 admin email is `info@crowconsulting.be`. The platform domain is `octera.net` / `octera.cloud` (both appear in the prototype — clarify with user which is primary).

When in doubt about scope or decisions: **ask the user, don't guess**. They've been clear that stability matters more than feature count.
