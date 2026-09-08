# www.octera.cloud — Go-Live Plan (grounded rewrite, 2026-07-06)

*Rewritten after actually reading the design corpus (`AI Projects/Octera/`:
rebuild-plan, Reseller-Platform-Architecture, GoDaddy-Reseller-Plan-in-Code-octera,
octera-core README, OSD-Assessment, Migration-Module) + the real code state of both
repos. The earlier version of this doc treated `Code/octera` as the whole product
and asked questions the corpus already answered — corrected here.*

## 1. The product is TWO services (+ shared estate identity)
- **`octera-core`** (`AI Projects/Octera/Octera DN/octera-core`) — **the domain & DNS
  reseller engine, and it's built**: `RegistrarProvider`/`DnsProvider` behind a **GoDaddy
  adapter (live) + shopper subaccounts** (`add_godaddy_shopper` migration) + Tucows stub;
  DNS (local records + write-through); **wallet** (Good-as-Gold mirror); **pricing/markup**;
  **SignInOnce (Keycloak `signinonce`) + CID Global** auth; **`Tenant`** multi-tenancy
  (`getTenantId(req)`); OrderSignup producer client. 2 committed migrations.
  Everything else (portal Domains page, WP plugin, panels, SDK) is a **thin client of this**.
- **`Code/octera`** — the **cloud self-care portal + marketing + operator console**
  (gig.tech hosting/SSL/email/invoices/cloudspaces), plus auth/RBAC and the (real, working)
  admin VCO console. Currently on **local JWT**, with **GoDaddy domain TODOs that duplicate
  what octera-core already owns**.
- **Identity:** the estate standard is **SignInOnce + CID** (octera-core already uses it;
  every other estate app does). `Code/octera`'s local JWT is the outlier.

## 2. The customer model (SETTLED — rebuild-plan §2.3, not an open question)
Our DB maps **`user_id → gig.tech customer_id`** (e.g. `abp_technologies_1`), **provisioned
on first purchase** via `POST /customers`; every gig.tech call is scoped by that id
server-side (partner JWT never touches the browser). octera-core layers **Tenant** on top
(resellers = tenants; per-tenant markup + API keys for satellites). Domains are
registrar-side (GoDaddy via octera-core), NOT gig.tech.

## 3. Order → provision pipeline (the real one)
`cart → Stripe checkout → OSD agreements gate → provision → OrderSignup deposit`
- **OSD** (absorb as an **`agreements` module in octera-core**): ICANN registrant agreement
  + reseller contract must be **signed** (public token link, `sha256(body)` + IP/UA audit)
  before provisioning runs. Order lifecycle `pending → awaiting_signature → paid →
  provisioning → completed`.
- **Provision:** domains → GoDaddy (octera-core, debits wallet); cloud → gig.tech (Code/octera).
- **OrderSignup producer** already wired in `Code/octera` (signup→TERMS, invoice.paid→INVOICE,
  checkout→ORDER); octera-core mirrors it.

## 4. Reconciliation — the real decision for this go-live
`octera-core` is canonical for **domains/DNS/wallet/registrar**; `Code/octera` is the
**customer front + cloud self-care**. Therefore for www.octera.cloud:
1. **Portal delegates domains to octera-core** (thin client) — do NOT finish the duplicate
   GoDaddy TODOs in `Code/octera/routes/domains.ts`; point the Domains UI at octera-core.
2. **Migrate `Code/octera` auth to SignInOnce + CID** (drop local JWT) to match octera-core
   and the estate — single sign-on across the portfolio, one tenant model.
3. Keep `Code/octera`'s gig.tech cloud self-care (hosting/SSL/email/invoices) with the
   §2 customer mapping. (My earlier `gigtechCustomerId` + `/v1/account/*` routes are the
   right *shape* for the cloud side — but on SignInOnce, and provisioned on first purchase,
   not asked-about.)

## 5. State of each service (grounded)
**octera-core — built:** GoDaddy provider + shoppers, DNS, wallet, pricing, SignInOnce+CID,
Tenant, OrderSignup, health, 2 migrations. **Stubbed (its README §"intentionally stubbed"):**
satellite API-key auth, Stripe PaymentIntent→wallet-topup + order-paid→provision, orders
flow (models exist, service TODO), BullMQ jobs (async provision/renewal/retry/webhook), TLD
wholesale price-list sync, PowerDNS (Stage B).
**Code/octera — built:** auth(local)/RBAC, marketing+legal+status, **real admin VCO console**
over gig.tech, email queue/worker, Sentry, health, OrderSignup producer, Dockerfiles + Railway
config. **Placeholder/stub:** all customer self-care pages, its own domain search(501)/register
(both octera-core's job), Stripe Checkout route, email-verify/password-reset.

## 6. Deploy (grounded)
- **`www.octera.cloud`** = the portal (`Code/octera` web). **API host** ≠ `api.octera.cloud`
  (estate gateway) — use `portal-api.octera.cloud` / `octera.net`. Railway (per CLAUDE.md
  hard-won lessons: IPv6 `::`, explicit PORT, workspace build order, Alpine `binaryTargets`,
  `NEXT_PUBLIC_*` build ARG). See `RAILWAY_DEPLOY.md`.
- **`octera-core`** needs its own deploy (Fastify+Prisma+Postgres, GoDaddy OTE→prod +
  Good-as-Gold funding). Same Railway pattern. **Deploy artifacts now built (2026-07-06):**
  `octera-core/Dockerfile` + `.dockerignore` + `railway.json` (pre-deploy
  `prisma migrate deploy`) + `OCTERA_CORE_DEPLOY.md` (env matrix, DNS host
  `reseller-api.octera.cloud`, Stripe webhook, cutover). The portal's Domains UI
  points at `https://reseller-api.octera.cloud`.
- **`migrations.octera.cloud`** (Migration Module) is a **separate internal ops tool** — NOT
  part of this go-live.

## 7. Real remaining work to go live (grounded)
**octera-core:** wire Stripe (PaymentIntent→wallet, order-paid→provision); orders service;
BullMQ jobs (domain.register/renew); TLD price sync; absorb OSD agreements module + order
gate; satellite API-keys (Phase 2, can defer). GoDaddy: OTE cert → production + Good-as-Gold.
**Code/octera:** migrate to SignInOnce+CID; delete duplicate domain TODOs, make the Domains
page a client of octera-core; wire the cloud self-care pages to gig.tech on the §2 mapping
(provisioned on first purchase); Stripe Checkout; email-verify/password-reset.
**Both:** env/secrets (GoDaddy reseller + shopper, GIGTECH IAM, Stripe, Resend, SIO client,
OrderSignup token, Sentry); DNS; deploy.

## 8. Genuinely open decisions (only these)
- GoDaddy **API Reseller plan** confirmed + OTE keys + Good-as-Gold funding (blocks real
  domain sales).
- **Markup model**: flat % vs per-TLD vs per-tenant (pricing engine exists; needs the rule).
- Timing: soft-launch on mock/OTE + operator console first, or hold for full order→provision.

*(Corrected artifacts from my earlier shallow pass: the `gigtechCustomerId` field +
`/v1/account/{invoices,ssl,hosting}` routes + the Domains page in `Code/octera` are kept as
the cloud-self-care shape, but must move onto SignInOnce and the Domains page must point at
octera-core rather than the local GoDaddy TODO.)*
