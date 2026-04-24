// Sentry has to be the very first import so its instrumentation hooks wrap
// every subsequent import. No top-of-file env access above this line.
import { initSentry, captureException, flushSentry } from './lib/sentry.js';
initSentry();

import Fastify, { type FastifyError } from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import cookie from '@fastify/cookie';
import rateLimit from '@fastify/rate-limit';
import { prisma } from '@octera/db';
import { env } from './lib/env.js';
import { authPlugin } from './middleware/auth.js';
import { authRoutes } from './routes/auth.js';
import { userRoutes } from './routes/users.js';
import { domainRoutes } from './routes/domains.js';
import { healthRoutes } from './routes/health.js';
import { vcoRoutes } from './routes/vco.js';
import { stripeRoutes } from './routes/stripe.js';
import { closeQueues } from './jobs/index.js';
import { GigtechError } from './integrations/gigtech.js';

const app = Fastify({
  logger: {
    level: env.NODE_ENV === 'production' ? 'info' : 'debug',
    transport:
      env.NODE_ENV === 'development'
        ? { target: 'pino-pretty', options: { colorize: true } }
        : undefined,
  },
  trustProxy: true,
  bodyLimit: 1024 * 1024, // 1 MB; bump per-route for uploads
});

async function start() {
  // Security headers
  await app.register(helmet, {
    contentSecurityPolicy: false, // CSP is handled by the web layer; API is JSON
  });

  // CORS — only the web app can call us, with credentials for refresh cookies.
  await app.register(cors, {
    origin: env.WEB_ORIGIN,
    credentials: true,
  });

  // Cookie parsing (for refresh-token cookie)
  await app.register(cookie);

  // Rate limiting — coarse global limit; route-level limits can override.
  await app.register(rateLimit, {
    max: 300,
    timeWindow: '1 minute',
  });

  // Auth decorator (adds app.authenticate, app.requireRole, etc.)
  await app.register(authPlugin);

  // Routes
  await app.register(healthRoutes, { prefix: '/health' });
  await app.register(authRoutes, { prefix: '/v1/auth' });
  await app.register(userRoutes, { prefix: '/v1/users' });
  await app.register(domainRoutes, { prefix: '/v1/domains' });
  await app.register(vcoRoutes, { prefix: '/v1/vco' });
  await app.register(stripeRoutes, { prefix: '/v1/stripe' });

  // 404 handler
  app.setNotFoundHandler((req, reply) => {
    reply.code(404).send({ error: 'not_found', message: `${req.method} ${req.url} not found` });
  });

  // Error handler — normalize to { error, message } shape + capture to Sentry.
  app.setErrorHandler<FastifyError>((err, req, reply) => {
    req.log.error({ err }, 'request failed');
    // GIG.tech upstream errors carry their own status + code. Map 501 straight
    // through so the client sees "not implemented" rather than "500 internal
    // error" for deferred features. 401/403 from upstream surface as 502
    // because they mean OUR credential is broken, not the caller's.
    if (err instanceof GigtechError) {
      if (err.status === 501) {
        return reply.code(501).send({ error: err.code, message: err.message });
      }
      if (err.status === 401 || err.status === 403) {
        captureException(err, { endpoint: req.url, method: req.method });
        return reply.code(502).send({
          error: 'upstream_auth_failed',
          message:
            'gig.tech rejected the partner credential. Check GIGTECH_JWT in the API env.',
        });
      }
      const status = err.status >= 400 && err.status < 600 ? err.status : 502;
      // Only report 5xx-range upstream errors — 4xx are expected and noisy.
      if (status >= 500) {
        captureException(err, { endpoint: req.url, method: req.method });
      }
      return reply.code(status).send({ error: err.code, message: err.message });
    }
    if (err.validation) {
      return reply.code(400).send({
        error: 'validation_error',
        message: err.message,
        details: err.validation,
      });
    }
    const status = err.statusCode && err.statusCode >= 400 ? err.statusCode : 500;
    // Only 5xx goes to Sentry; user errors (4xx) are expected.
    if (status >= 500) {
      captureException(err, { endpoint: req.url, method: req.method });
    }
    reply.code(status).send({
      error: err.name || 'internal_error',
      message:
        status === 500 && env.NODE_ENV === 'production'
          ? 'Internal server error'
          : err.message,
    });
  });

  try {
    await app.listen({ port: env.PORT, host: env.HOST });
    app.log.info(`🪐 Octera API listening on http://${env.HOST}:${env.PORT}`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }

  // ---- Graceful shutdown -------------------------------------------------
  // Orchestrators (Railway, Kubernetes, systemd) send SIGTERM then expect
  // the process to drain in-flight work + close pooled connections within
  // a short window. We need to:
  //   1. Stop accepting new connections (app.close — Fastify drains in-flight)
  //   2. Close BullMQ queues (the Queue side; workers are a separate process)
  //   3. Disconnect Prisma (release Postgres pool slots)
  //   4. Flush Sentry so any in-flight error events ship before exit
  // Idempotent — multiple signals don't re-run the chain.
  let shuttingDown = false;
  async function shutdown(signal: string) {
    if (shuttingDown) return;
    shuttingDown = true;
    app.log.info({ signal }, 'shutting down API');
    try {
      await app.close();
      await closeQueues();
      await prisma.$disconnect();
      await flushSentry(2_000);
    } catch (err) {
      app.log.error({ err }, 'error during shutdown');
    } finally {
      process.exit(0);
    }
  }
  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
}

void start();
