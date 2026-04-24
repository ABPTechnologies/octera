/**
 * Stripe SDK wrapper.
 *
 * Behavior by env:
 * - `STRIPE_SECRET_KEY` unset (default in dev) → calling getStripe() throws
 *   StripeNotConfigured. The webhook route checks isStripeMockMode() up front
 *   and returns 501 with a clear message instead of crashing on requests.
 * - `STRIPE_SECRET_KEY` set → real Stripe SDK client. Use `sk_test_…` keys
 *   while developing; only swap to `sk_live_…` for production.
 *
 * The webhook secret (`STRIPE_WEBHOOK_SECRET`) is separate and required
 * separately. It's the `whsec_…` value Stripe shows when you add a webhook
 * endpoint in their dashboard or via `stripe listen` for local testing.
 *
 * Architecture note: this module exposes a *lazy* getter rather than a
 * top-level singleton. That way unit tests can stub `env.STRIPE_SECRET_KEY`
 * before any Stripe code is executed without resorting to module mocks.
 */

import Stripe from 'stripe';
import { env } from './env.js';

export class StripeNotConfigured extends Error {
  constructor() {
    super('STRIPE_SECRET_KEY is not set');
    this.name = 'StripeNotConfigured';
  }
}

/** True when we don't have a Stripe key wired — webhook + checkout 501 in this state. */
export function isStripeMockMode(): boolean {
  return !env.STRIPE_SECRET_KEY;
}

let cachedClient: Stripe | null = null;

/** Lazy singleton. Throws if `STRIPE_SECRET_KEY` isn't set. */
export function getStripe(): Stripe {
  if (cachedClient) return cachedClient;
  if (!env.STRIPE_SECRET_KEY) throw new StripeNotConfigured();
  cachedClient = new Stripe(env.STRIPE_SECRET_KEY, {
    // Pin a recent API version so behavior is stable. Bump intentionally
    // when we adopt new features; never let the SDK auto-upgrade silently.
    apiVersion: '2024-11-20.acacia',
    // Tag requests so they're searchable in Stripe's logs.
    appInfo: {
      name: 'Octera',
      url: 'https://octera.net',
    },
    typescript: true,
  });
  return cachedClient;
}
