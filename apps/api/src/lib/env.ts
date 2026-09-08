import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().default(4000),
  // `::` (IPv6 unspecified, dual-stack) — NOT `0.0.0.0`. Railway routes
  // service-to-service traffic over an IPv6 mesh; an IPv4-only listener
  // returns 502 at the edge even though the process is up. Dual-stack on
  // every modern Linux accepts IPv4 connections too.
  HOST: z.string().default('::'),

  DATABASE_URL: z.string().url(),
  REDIS_URL: z.string().url().default('redis://localhost:6379'),

  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 chars'),
  JWT_REFRESH_SECRET: z.string().min(32, 'JWT_REFRESH_SECRET must be at least 32 chars'),
  ACCESS_TOKEN_TTL: z.string().default('15m'),
  REFRESH_TOKEN_TTL_DAYS: z.coerce.number().default(30),

  // ── SignInOnce (Keycloak realm `signinonce`) + CID Global ──────────────────
  // Estate-standard identity. When KEYCLOAK_ISSUER is set, the API verifies SIO
  // Bearer tokens against the realm JWKS (and provisions/links the local User);
  // the legacy local-JWT path stays as a fallback during the transition. Leave
  // KEYCLOAK_ISSUER blank to keep local-JWT-only (no behaviour change).
  KEYCLOAK_ISSUER: z.string().default(''),
  KEYCLOAK_AUDIENCE: z.string().optional(),
  KEYCLOAK_CLIENT_ID: z.string().default('octera-portal'),
  KEYCLOAK_ADMIN_ROLE: z.string().default('octera-admin'),
  // Local-only dev bypass: accept X-Dev-User (a keycloakId) without a real token.
  AUTH_DEV_BYPASS: z.string().default('false').transform((v) => v === 'true'),
  // CID Global base URL. Blank → CID profile sync is skipped (auth still works).
  CID_API_URL: z.string().default(''),

  WEB_ORIGIN: z.string().url().default('http://localhost:3000'),
  COOKIE_DOMAIN: z.string().optional(),

  // Integrations — all optional for local dev; required in prod.
  GIGTECH_API_BASE: z.string().url().default('https://portal.octera.cloud/api/1'),
  // Two credential shapes are supported:
  //   1) GIGTECH_JWT — a static bearer token (legacy, fine for local dev).
  //   2) GIGTECH_CLIENT_ID + GIGTECH_CLIENT_SECRET — an IAM-issued access-token
  //      pair (Settings → Access Tokens in iam.octera.cloud). The integration
  //      exchanges them for a short-lived user-session JWT at runtime and
  //      auto-refreshes before expiry. This is the production path because
  //      the resulting JWT carries the `username` claim that gig.tech's
  //      per-customer resolvers require.
  // When both shapes are set, client_credentials wins.
  GIGTECH_JWT: z.string().optional(),
  GIGTECH_CLIENT_ID: z.string().optional(),
  GIGTECH_CLIENT_SECRET: z.string().optional(),
  GIGTECH_IAM_BASE: z.string().url().default('https://iam.octera.cloud'),
  // Optional OAuth scope to send during the client_credentials exchange.
  // ItsYou.Online-style: e.g. `user:memberof:abp_technologies_1.admin` to
  // assume an org-scoped role. Empty default means "use the PAT's full
  // user-level access" — which is what we want for the operator console.
  GIGTECH_OAUTH_SCOPE: z.string().default(''),

  GODADDY_API_BASE: z.string().url().optional(),
  GODADDY_API_KEY: z.string().optional(),
  GODADDY_API_SECRET: z.string().optional(),
  GODADDY_ENV: z.enum(['ote', 'production']).default('ote'),

  STRIPE_SECRET_KEY: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),

  // Inbound UTIT VPS provisioning handoff (routes/handoff.ts). Shared HMAC
  // secret with UTIT's OCTERA_HANDOFF_SECRET. The active-callback back to UTIT
  // uses OCTERA_WEBHOOK_SECRET (UTIT's inbound secret) + UTIT_WEBHOOK_URL.
  // All optional → handoff 503s (disabled) until set.
  OCTERA_HANDOFF_SECRET: z.string().optional(),
  OCTERA_WEBHOOK_SECRET: z.string().optional(),
  UTIT_WEBHOOK_URL: z.string().url().optional(),
  GIGTECH_CUSTOMER_ID: z.string().optional(),
  GIGTECH_DEFAULT_REGION: z.string().optional(),

  RESEND_API_KEY: z.string().optional(),
  // EMAIL_FROM supports the "Name <addr>" header format, not strict email only
  EMAIL_FROM: z.string().min(3).default('Octera <noreply@octera.net>'),

  SENTRY_DSN: z.string().optional(),

  // OrderSignup — Octera deposits account/order/invoice documents into the
  // customer's central vault. Both required to enable; absent = feature off.
  ORDERSIGNUP_INGEST_URL: z.string().url().optional(),
  ORDERSIGNUP_INGEST_TOKEN: z.string().optional(),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  // eslint-disable-next-line no-console
  console.error('❌ Invalid environment variables:', parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;
export type Env = typeof env;
