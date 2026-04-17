# NEXT_STEPS

> A concrete, ordered to-do list for the next Claude Code session. Work top-to-bottom. Check items off as you finish them. When you start, read `CLAUDE.md` first.

## 0. Sanity check (do this first, ~15 min)

- [ ] Run `pnpm install` from the repo root. Expect it to install everything cleanly.
- [ ] Copy `.env.example` to `.env` and fill in the minimum secrets (both JWT secrets).
- [ ] Run `pnpm infra:up` — Postgres + Redis should start in Docker.
- [ ] Run `pnpm db:generate && pnpm db:migrate`. The migration should succeed against the empty DB.
- [ ] Run `pnpm db:seed`. You should see the admin user created.
- [ ] Run `pnpm dev`. API should come up on :4000 and web on :3000.
- [ ] Open http://localhost:3000, sign up, and reach the dashboard. If any of these steps fails, **fix before proceeding**.

## 1. Ask the user for what's needed before real work starts

- [ ] The GIG.tech JWT (goes into `.env` as `GIGTECH_JWT`).
- [ ] Full GIG.tech API documentation (OpenAPI spec or portal docs page). The integration client at `apps/api/src/integrations/gigtech.ts` has stub endpoint paths based on guesses — replace with real ones.
- [ ] Whether the JWT is long-lived (service token) or short-lived. If short-lived, add a refresh-flow service before wiring anything else.
- [ ] GoDaddy API key + secret + OTE/production choice (v2 — not blocking v1).
- [ ] Stripe account (test mode is fine to start).
- [ ] Resend API key (for email verification + transactional mail).
- [ ] Production domain for the platform (`octera.net`?) — affects cookie config.

## 2. Ship v1 — internal users + paying customers

Order matters. Don't jump ahead.

### 2a. Harden auth (half a day)
- [ ] Email verification flow (send token → verify link → set `emailVerified`).
- [ ] Password reset flow (request → email → token → reset).
- [ ] Rate-limit `/v1/auth/login` more aggressively (5/min per IP).
- [ ] Write integration tests: signup → login → refresh → logout → re-use revoked refresh fails.

### 2b. Flesh out the GIG.tech integration (1–2 days)
- [ ] Replace every stub in `apps/api/src/integrations/gigtech.ts` with real endpoints.
- [ ] Add real Zod schemas for each response shape.
- [ ] Add methods: domain search, register, renew, transfer in/out, DNS CRUD, contact management, hosting plans list/create/suspend/resize, SSL provisioning, email account CRUD, invoice list/fetch, ticket CRUD.
- [ ] Write contract tests (fixture-based) so changes to GIG.tech's API don't silently break us.

### 2c. Self-care portal UI (3–5 days)
The Base44 prototype has these as reference — see `docs/base44-history.md`. Rebuild properly.
- [ ] `/dashboard` — overview cards (domain count, hosting count, next renewal, open tickets).
- [ ] `/domains` — list, details, DNS editor, SSL panel, transfer wizard.
- [ ] `/hosting` — list, provisioning wizard, resize/suspend/cancel.
- [ ] `/email` — mailbox CRUD.
- [ ] `/invoices` — list + PDF download.
- [ ] `/tickets` — list + thread + new-ticket form.
- [ ] `/settings` — profile, password change, notification preferences.

### 2d. Admin panel (1 day)
- [ ] `/admin` — gate on `role === ADMIN`.
- [ ] User search + detail view.
- [ ] Domain lookup (any user's).
- [ ] Audit log viewer with filtering.
- [ ] Manual override actions (force sync with GIG.tech, cancel provisioning, refund).

### 2e. Payments (1–2 days)
- [ ] Stripe Checkout for domain registration (one-time).
- [ ] Stripe Subscriptions for hosting plans.
- [ ] Webhook handler (`/v1/webhooks/stripe`) with signature verification + idempotency.
- [ ] Receipt emails via Resend.

### 2f. Job queue (half a day)
- [ ] Set up BullMQ queues: `domains`, `hosting`, `ssl`, `emails`.
- [ ] Worker process (`apps/api/src/worker.ts`) — separate entry point, same DB connection.
- [ ] Job: `domain.register` (calls GIG.tech, updates DB, fires notification).
- [ ] Job: `ssl.provision` (requests cert from GIG.tech, polls until active).
- [ ] Job: `email.send` (retries on failure, dead-letter queue).

### 2g. Observability (half a day)
- [ ] Wire Sentry in both API and web.
- [ ] Structured request logging with request IDs.
- [ ] Health check at `/health/ready` should check DB + Redis + upstream GIG.tech reachability.

### 2h. Deploy (1 day)
- [ ] Pick a target (Railway strongly recommended for speed). Set up one-click deploy.
- [ ] Configure all env vars in the target's secret store.
- [ ] Set up automated daily Postgres backups.
- [ ] Set up uptime monitoring (Better Uptime, Pingdom, or similar — ping `/health/ready`).
- [ ] Do a real end-to-end test: sign up, register a cheap test domain via GIG.tech, verify it appears in the portal.

## 3. v2 — after v1 is live and stable ~2 weeks

### 3a. GoDaddy as second registrar
- [ ] Second integration client at `apps/api/src/integrations/godaddy.ts` mirroring the GIG.tech one.
- [ ] Router in the domain service that picks the right registrar per domain (or per TLD).
- [ ] Migration plan for existing paying customers (talk to user about their current setup).

### 3b. Marketplace
- [ ] Listings CRUD (fixed-price, auction, make-offer).
- [ ] Offer flow with accept/reject/counter.
- [ ] Auction engine — scheduled job that closes auctions, sends notifications, charges the winner.
- [ ] Stripe Connect for marketplace escrow. **Check legal requirements before launching.**
- [ ] Seller ratings.

### 3c. Brokerage
- [ ] Broker dashboard (existing role).
- [ ] Request lifecycle state machine.
- [ ] Messaging thread per request.
- [ ] Due-diligence report template (manual fields; drop the "AI-generated" framing from the prototype).

## 4. v3 — real cloud orchestration (only once v1+v2 are stable)

Everything in this bucket was mocked in the prototype. Don't rebuild the mocks.

- [ ] Kubernetes clusters (real GIG.tech provisioning).
- [ ] Serverless functions.
- [ ] Managed databases.
- [ ] Unified deployment orchestration.
- [ ] CI/CD pipelines with real build/test/deploy + rollback.
- [ ] Monitoring with real metrics from GIG.tech.
- [ ] Alert rules backed by real threshold evaluation.

## 5. Things explicitly cut from the prototype

Don't reintroduce these without a real backing service:
- "AI domain valuation" (was `Math.random()` underneath).
- "AI due-diligence reports" (same).
- "Predictive TLD trend analysis" (same).

If the user wants these, integrate a real provider (EstiBot, GoDaddy Appraisals) or be honest in the UI that it's heuristic-based.

---

## Operating rules while you build

1. **Read `CLAUDE.md` before every session.** It's the source of truth for architectural decisions.
2. **Ask the user** when something is ambiguous. Don't guess and ship.
3. **Never skip tests** on money, auth, or external-integration code.
4. **Every PR to `main`** should pass `pnpm typecheck && pnpm lint && pnpm test`.
5. **Don't add features outside the current phase.** v1 before v2, v2 before v3.
6. **Commit often, commit small.** Future-you (possibly another Claude) has to read the history.
