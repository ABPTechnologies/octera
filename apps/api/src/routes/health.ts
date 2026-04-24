/**
 * Health check routes.
 *
 * - GET /health/live    — process is responsive. Used by orchestrator
 *                         liveness probes (Railway, Kubernetes). Cheap; no
 *                         downstream calls. Failing here means restart me.
 *
 * - GET /health/ready   — process is ready to serve real traffic. Probes
 *                         critical dependencies in parallel (DB, Redis) plus
 *                         optionally gig.tech if a credential is wired.
 *                         Returns 200 if all critical deps are healthy, 503
 *                         otherwise. Failing here means stop routing traffic
 *                         to me until I recover.
 *
 * Each downstream probe has a strict timeout so a slow / hung upstream can't
 * hang the readiness response — important because orchestrators interpret
 * "no response within N seconds" as "down" and start cycling instances.
 */

import type { FastifyPluginAsync } from 'fastify';
import { prisma } from '@octera/db';
import { Redis } from 'ioredis';
import { env } from '../lib/env.js';
import { isMockMode as isGigtechMock } from '../integrations/gigtech.js';

const PROBE_TIMEOUT_MS = 1500;

interface ProbeResult {
  status: 'ok' | 'degraded' | 'skipped';
  latency_ms?: number;
  error?: string;
  note?: string;
}

export const healthRoutes: FastifyPluginAsync = async (app) => {
  // Reuse a single ioredis instance for all probes; opening a fresh
  // connection per request would itself become an availability risk.
  // Connect eagerly — `lazyConnect: true` + `enableOfflineQueue: false`
  // would race the first PING against connection establishment and falsely
  // fail every cold-start readiness probe.
  const redis = new Redis(env.REDIS_URL, {
    maxRetriesPerRequest: 1,
    // Allow brief queuing while reconnect is in progress; the per-probe
    // timeout still bounds how long we wait.
    enableOfflineQueue: true,
  });

  // Drain the Redis connection when Fastify shuts down. Without this hook,
  // graceful shutdown would leave the socket dangling for a few seconds
  // until ioredis times out — annoying in tests and noisy in logs.
  app.addHook('onClose', async () => {
    redis.disconnect();
  });

  // -------------------------------------------------------------------------
  // GET /health/live — process responsiveness only.
  // -------------------------------------------------------------------------
  app.get('/live', async () => ({ status: 'ok' }));

  // -------------------------------------------------------------------------
  // GET /health/ready — full dependency probe.
  // -------------------------------------------------------------------------
  app.get('/ready', async (_req, reply) => {
    const [database, cache, gigtech] = await Promise.all([
      probeDatabase(),
      probeRedis(redis),
      probeGigtech(),
    ]);

    const probes = { database, cache, gigtech };

    // Critical = DB and Redis. Gig.tech being down is degraded but not 503,
    // because the rest of the app (auth, internal routes) keeps working
    // without it. We surface it as a warning instead.
    const critical = [database, cache];
    const allCriticalHealthy = critical.every((p) => p.status === 'ok');

    if (allCriticalHealthy) {
      return { status: 'ok', probes };
    }

    return reply.code(503).send({ status: 'degraded', probes });
  });
};

// ---------------------------------------------------------------------------
// Probes — each returns within PROBE_TIMEOUT_MS or marks itself degraded.
// ---------------------------------------------------------------------------

async function probeDatabase(): Promise<ProbeResult> {
  const start = Date.now();
  try {
    await withTimeout(prisma.$queryRaw`SELECT 1`, PROBE_TIMEOUT_MS, 'database');
    return { status: 'ok', latency_ms: Date.now() - start };
  } catch (err) {
    return { status: 'degraded', error: errorMessage(err), latency_ms: Date.now() - start };
  }
}

async function probeRedis(redis: Redis): Promise<ProbeResult> {
  const start = Date.now();
  try {
    const reply = await withTimeout(redis.ping(), PROBE_TIMEOUT_MS, 'redis');
    if (reply !== 'PONG') {
      return { status: 'degraded', error: `unexpected ping reply: ${reply}` };
    }
    return { status: 'ok', latency_ms: Date.now() - start };
  } catch (err) {
    return { status: 'degraded', error: errorMessage(err), latency_ms: Date.now() - start };
  }
}

async function probeGigtech(): Promise<ProbeResult> {
  // In mock mode there's nothing to probe. Surface that so the operator
  // sees "you're running on fixtures" without us flapping a 503.
  if (isGigtechMock()) {
    return { status: 'skipped', note: 'mock mode (GIGTECH_JWT not set)' };
  }
  const start = Date.now();
  try {
    // swagger.json is the cheapest unauth-friendly probe. It returns the
    // spec regardless of whether our token is valid, so it tests "is the
    // gig.tech edge reachable" not "is our token valid."
    const url = new URL(
      'swagger.json',
      env.GIGTECH_API_BASE.endsWith('/') ? env.GIGTECH_API_BASE : env.GIGTECH_API_BASE + '/'
    );
    const res = await withTimeout(
      fetch(url, { method: 'HEAD' }),
      PROBE_TIMEOUT_MS,
      'gigtech'
    );
    if (!res.ok) {
      return { status: 'degraded', error: `HTTP ${res.status}`, latency_ms: Date.now() - start };
    }
    return { status: 'ok', latency_ms: Date.now() - start };
  } catch (err) {
    return { status: 'degraded', error: errorMessage(err), latency_ms: Date.now() - start };
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    p,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`${label} probe timed out after ${ms}ms`)), ms)
    ),
  ]);
}

function errorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  return String(err);
}
