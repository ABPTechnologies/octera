import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().default(4000),
  HOST: z.string().default('0.0.0.0'),

  DATABASE_URL: z.string().url(),
  REDIS_URL: z.string().url().default('redis://localhost:6379'),

  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 chars'),
  JWT_REFRESH_SECRET: z.string().min(32, 'JWT_REFRESH_SECRET must be at least 32 chars'),
  ACCESS_TOKEN_TTL: z.string().default('15m'),
  REFRESH_TOKEN_TTL_DAYS: z.coerce.number().default(30),

  WEB_ORIGIN: z.string().url().default('http://localhost:3000'),
  COOKIE_DOMAIN: z.string().optional(),

  // Integrations — all optional for local dev; required in prod.
  GIGTECH_API_BASE: z.string().url().default('https://portal.octera.cloud/api/1'),
  GIGTECH_JWT: z.string().optional(),

  GODADDY_API_BASE: z.string().url().optional(),
  GODADDY_API_KEY: z.string().optional(),
  GODADDY_API_SECRET: z.string().optional(),
  GODADDY_ENV: z.enum(['ote', 'production']).default('ote'),

  STRIPE_SECRET_KEY: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),

  RESEND_API_KEY: z.string().optional(),
  // EMAIL_FROM supports the "Name <addr>" header format, not strict email only
  EMAIL_FROM: z.string().min(3).default('Octera <noreply@octera.net>'),

  SENTRY_DSN: z.string().optional(),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  // eslint-disable-next-line no-console
  console.error('❌ Invalid environment variables:', parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;
export type Env = typeof env;
