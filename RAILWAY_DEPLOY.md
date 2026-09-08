# www.octera.cloud — Railway deploy config

*Deploy target for the Octera portal (per go-live decision). Monorepo → **3
Railway services** off the two Dockerfiles, + Postgres + Redis plugins. Web at
`www.octera.cloud`; API at an **alt host** (`api.octera.cloud` is the estate
gateway — use `portal-api.octera.cloud`).*

## Services
| Service | Build | Start | Notes |
|---|---|---|---|
| **octera-web** | `apps/web/Dockerfile` | (Dockerfile CMD) | Next standalone; needs `NEXT_PUBLIC_API_URL` as a **build ARG** (inlined at build). |
| **octera-api** | `apps/api/Dockerfile` | (Dockerfile CMD) | Fastify; IPv6 `HOST=::`. |
| **octera-worker** | `apps/api/Dockerfile` | override start → `node apps/api/dist/worker.js` | BullMQ worker (email queue live; domain/ssl/hosting processors are follow-ups). |
| **Postgres** | Railway plugin | — | provides `DATABASE_URL`. |
| **Redis** | Railway plugin | — | provides `REDIS_URL`. |

One-off after first deploy: run `pnpm --filter @octera/db prisma migrate deploy`
(or a release command on octera-api) + the seed once.

## DNS (registrar for octera.cloud)
| Host | → |
|---|---|
| `www.octera.cloud` | Railway `octera-web` (CNAME to the Railway domain) |
| `octera.cloud` apex | redirect/ALIAS → `www` |
| `portal-api.octera.cloud` | Railway `octera-api` |

*(Keep clear of the estate's `api.`/`app.`/`sso.`/`vaiox.octera.cloud`.)*

## Env matrix (from Zod `apps/api/src/lib/env.ts`)
**octera-api / octera-worker:**
```
DATABASE_URL=<Railway Postgres>
REDIS_URL=<Railway Redis>
JWT_SECRET=<openssl rand -hex 32>
JWT_REFRESH_SECRET=<openssl rand -hex 32>          # ≥32 chars, DIFFERENT from JWT_SECRET
NODE_ENV=production
WEB_ORIGIN=https://www.octera.cloud
COOKIE_DOMAIN=.octera.cloud                        # so refresh cookie spans www + portal-api
# GIG.tech — flips OFF mock mode (from iam.octera.cloud → Access Tokens):
GIGTECH_CLIENT_ID=...
GIGTECH_CLIENT_SECRET=...
# GIGTECH_CUSTOMER_ID=...                           # optional single-customer scope
# Stripe (billing):
STRIPE_SECRET_KEY=<live sk_live_...>
STRIPE_WEBHOOK_SECRET=<from Stripe webhook to portal-api.octera.cloud/v1/stripe/webhook>
# Email:
RESEND_API_KEY=...                                 # verified octera.cloud sending domain
# Observability:
SENTRY_DSN=...
# optional: GODADDY_* (registrar v2), ORDERSIGNUP_INGEST_URL/TOKEN
```
**octera-web (build ARG + runtime):**
```
NEXT_PUBLIC_API_URL=https://portal-api.octera.cloud
```

## Cutover checklist
- [ ] Create the 3 services + Postgres + Redis; set env above.
- [ ] `octera-web` build ARG `NEXT_PUBLIC_API_URL=https://portal-api.octera.cloud`.
- [ ] Deploy api → run `prisma migrate deploy` + seed once (admin `info@crowconsulting.be`).
- [ ] Deploy web + worker.
- [ ] DNS: `www.octera.cloud` → web, `portal-api.octera.cloud` → api; wait for Railway TLS.
- [ ] Stripe webhook → `https://portal-api.octera.cloud/v1/stripe/webhook`.
- [ ] Verify `https://www.octera.cloud/` + `https://portal-api.octera.cloud/health/ready`
      (DB+Redis+gig.tech probes green); sign up + log in; admin VCO console loads.

## Notes / blockers
- Without `GIGTECH_CLIENT_ID/SECRET` the app runs on **mock fixtures** — fine for a
  soft launch; set them for real customer/invoice/SSL data.
- **gig.tech-backed customer pages** (invoices, SSL, hosting, DNS, email) need a
  **user → gig.tech customer linkage** design (a `gigtechCustomerId` on the user, or
  a single `GIGTECH_CUSTOMER_ID` scope) before they can show per-customer data —
  that's the key backend decision gating those pages. Domains (local model) + auth +
  marketing + operator console are ready now.
- Split the white-label/BotTrader factory out of this repo before launch (estate code).
