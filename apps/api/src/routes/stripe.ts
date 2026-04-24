/**
 * Stripe webhook + checkout routes.
 *
 * Mounted under /v1/stripe.
 *
 * The webhook handler needs the RAW request body (bytes, not parsed JSON) to
 * verify Stripe's signature. Fastify's default JSON parser would strip that.
 * We get around it by isolating these routes inside their own encapsulated
 * context where the JSON parser is overridden to keep the buffer.
 *
 * Event handling for v1 is intentionally minimal — the events we care about
 * (checkout.session.completed, invoice.paid, etc.) get logged + acknowledged.
 * Real business logic (provisioning a domain on payment, marking an invoice
 * paid in our DB) lands once we have the corresponding features.
 */

import type { FastifyPluginAsync } from 'fastify';
import { captureException } from '../lib/sentry.js';
import { getStripe, isStripeMockMode } from '../lib/stripe.js';
import { env } from '../lib/env.js';

export const stripeRoutes: FastifyPluginAsync = async (app) => {
  // Override JSON parsing within this encapsulated subtree to keep the raw
  // bytes — required for Stripe's signature verification. Outside this
  // subtree, the global JSON parser still applies.
  app.addContentTypeParser(
    'application/json',
    { parseAs: 'buffer' },
    (_req, body, done) => {
      done(null, body);
    }
  );

  /**
   * POST /v1/stripe/webhook
   *
   * Verifies signature, dispatches by event type, ACKs with 200. Stripe
   * retries on non-200 responses, so the handler should always be idempotent
   * and should never throw past this boundary unless we genuinely want a retry.
   */
  app.post('/webhook', async (req, reply) => {
    if (isStripeMockMode() || !env.STRIPE_WEBHOOK_SECRET) {
      return reply.code(501).send({
        error: 'stripe_not_configured',
        message:
          'STRIPE_SECRET_KEY and/or STRIPE_WEBHOOK_SECRET not set. Set both before enabling webhooks.',
      });
    }

    const sig = req.headers['stripe-signature'];
    if (typeof sig !== 'string') {
      return reply
        .code(400)
        .send({ error: 'missing_signature', message: 'No stripe-signature header' });
    }

    const stripe = getStripe();
    let event: import('stripe').Stripe.Event;
    try {
      event = stripe.webhooks.constructEvent(
        req.body as Buffer,
        sig,
        env.STRIPE_WEBHOOK_SECRET
      );
    } catch (err) {
      // Bad signature is suspicious — surface it cleanly but don't 500.
      const message = err instanceof Error ? err.message : 'invalid signature';
      req.log.warn({ err }, 'stripe webhook signature verification failed');
      return reply.code(400).send({ error: 'invalid_signature', message });
    }

    try {
      await handleStripeEvent(event, req.log);
      return reply.code(200).send({ received: true });
    } catch (err) {
      // Don't let a handler error become a 500 — log + Sentry + 200 to ACK.
      // We'd rather miss-process one event we can replay later than have
      // Stripe retry-storm us with the same event.
      req.log.error({ err, event_type: event.type }, 'stripe handler threw');
      captureException(err, { stripe_event_type: event.type, stripe_event_id: event.id });
      return reply.code(200).send({ received: true, processing_failed: true });
    }
  });

  /**
   * GET /v1/stripe/status
   *
   * Plain JSON readout of how Stripe is wired in this environment. Useful
   * for the operator console + smoke tests. Doesn't require auth — no
   * sensitive data leaves.
   */
  app.get('/status', async () => {
    return {
      mode: isStripeMockMode() ? 'mock' : 'live',
      api_key_set: Boolean(env.STRIPE_SECRET_KEY),
      webhook_secret_set: Boolean(env.STRIPE_WEBHOOK_SECRET),
    };
  });
};

/**
 * Top-level event dispatcher. Add new event types here as the corresponding
 * features land. For now, every event type is logged; only a few are handled.
 */
async function handleStripeEvent(
  event: import('stripe').Stripe.Event,
  log: { info: (obj: object, msg: string) => void }
): Promise<void> {
  log.info(
    { event_id: event.id, event_type: event.type, livemode: event.livemode },
    'stripe webhook received'
  );

  switch (event.type) {
    case 'checkout.session.completed':
      // TODO: provision the purchased resource (domain registration, hosting plan, etc).
      // Object: event.data.object as Stripe.Checkout.Session
      break;
    case 'invoice.paid':
      // TODO: mark the corresponding Octera invoice as paid in our DB + audit.
      break;
    case 'invoice.payment_failed':
      // TODO: surface failed-payment state on the customer's account, send email.
      break;
    case 'customer.subscription.deleted':
      // TODO: deprovision / mark subscription cancelled.
      break;
    default:
      // Unhandled event types are logged + acknowledged. Stripe sends many
      // event types per object lifecycle; we only act on the ones we care
      // about. Acknowledging the rest stops Stripe from retrying.
      break;
  }
}
