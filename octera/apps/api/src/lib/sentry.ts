/**
 * Sentry initialization + helpers.
 *
 * Behavior by env:
 * - `SENTRY_DSN` unset (default in dev) → Sentry is a no-op. No network
 *   calls, no overhead, no extra log noise. This keeps local dev clean and
 *   means missing a Sentry DSN never breaks the app.
 * - `SENTRY_DSN` set → errors captured via `captureException`, plus any
 *   unhandled exceptions / rejections the SDK catches automatically.
 *
 * We deliberately do NOT turn on performance tracing or profiling in v1.
 * Those are large additional dependencies and only worth enabling once we
 * have a real traffic baseline to look at.
 */

import * as Sentry from '@sentry/node';
import { env } from './env.js';

let initialized = false;

/**
 * Initialize Sentry. Call this as early as possible from index.ts, BEFORE any
 * Fastify plugin registration, so instrumentation hooks apply to everything.
 */
export function initSentry(): void {
  if (initialized) return;
  if (!env.SENTRY_DSN) {
    // eslint-disable-next-line no-console
    console.info('[sentry] SENTRY_DSN not set — error reporting disabled');
    initialized = true;
    return;
  }

  Sentry.init({
    dsn: env.SENTRY_DSN,
    environment: env.NODE_ENV,
    // Low sample rate because we have no traffic baseline yet; raise later.
    tracesSampleRate: 0.0,
    // Disable performance monitoring entirely for v1 — keeps the SDK lean
    // and means we don't ship transaction data we wouldn't look at.
    profilesSampleRate: 0.0,
    // Filter out noisy client-aborted requests (common Fastify case).
    beforeSend(event, hint) {
      const err = hint?.originalException;
      if (err && typeof err === 'object' && 'code' in err && err.code === 'FST_ERR_REQ_ABORTED') {
        return null;
      }
      return event;
    },
  });

  initialized = true;
  // eslint-disable-next-line no-console
  console.info(`[sentry] initialized (env=${env.NODE_ENV})`);
}

/**
 * Report an error to Sentry if initialized; otherwise a no-op. Safe to call
 * unconditionally from error handlers and background workers.
 *
 * Returns the Sentry event ID (useful for logging alongside the error so a
 * sysadmin can correlate log lines to Sentry events).
 */
export function captureException(err: unknown, context?: Record<string, unknown>): string | undefined {
  if (!env.SENTRY_DSN) return undefined;
  return Sentry.captureException(err, context ? { extra: context } : undefined);
}

/** Flush pending Sentry events. Call before process exit in workers / CLI. */
export async function flushSentry(timeoutMs = 2000): Promise<boolean> {
  if (!env.SENTRY_DSN) return true;
  return Sentry.flush(timeoutMs);
}
