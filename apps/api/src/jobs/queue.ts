/**
 * BullMQ queue + worker factory.
 *
 * Architecture:
 * - One shared Redis connection (ioredis) used by all queues + workers.
 *   `maxRetriesPerRequest: null` is REQUIRED by BullMQ workers (they use
 *   blocking commands that can't be auto-retried by ioredis).
 * - Each "queue" = one named topic (`email`, `domain`, `ssl`, `hosting`).
 *   Producer side: `getQueue('email').add(...)`.
 *   Consumer side: a Worker subscribes from the worker process.
 * - Connection is process-shared. Don't create a new ioredis per call.
 *
 * Worker process is separate from the API process — see apps/api/src/worker.ts.
 * That separation matters: if a job processor crashes, it shouldn't take the
 * HTTP server down with it.
 *
 * Job retries + backoff are configured per-job at enqueue time (or per-queue
 * via defaultJobOptions). Idempotency is the *job code's* responsibility —
 * BullMQ may re-execute a job that took too long even if it eventually
 * succeeded, so handlers must tolerate seeing the same payload twice.
 */

import { Queue, Worker, type Processor } from 'bullmq';
import { Redis, type RedisOptions } from 'ioredis';
import { env } from '../lib/env.js';

const REDIS_OPTS: RedisOptions = {
  // Required for BullMQ workers — they use blocking commands.
  maxRetriesPerRequest: null,
  enableReadyCheck: true,
};

let connection: Redis | null = null;

function getConnection(): Redis {
  if (!connection) {
    connection = new Redis(env.REDIS_URL, REDIS_OPTS);
    // Don't crash the whole process on Redis hiccups. BullMQ has its own
    // retry/reconnect logic; we just log here.
    connection.on('error', (err: Error) => {
      // eslint-disable-next-line no-console
      console.error('[bullmq:redis]', err.message);
    });
  }
  return connection;
}

const queueRegistry = new Map<string, Queue>();

/**
 * Get (or lazily create) a queue by name. Reuses one Queue object per name
 * to avoid leaking connections.
 */
export function getQueue<T = unknown>(name: QueueName): Queue<T> {
  const existing = queueRegistry.get(name);
  if (existing) return existing as Queue<T>;
  const q = new Queue<T>(name, {
    connection: getConnection(),
    defaultJobOptions: {
      // Retry transient failures with exponential backoff. Real upstreams
      // (gig.tech, Stripe, Resend) need this; idempotency in the handler
      // makes retries safe.
      attempts: 5,
      backoff: { type: 'exponential', delay: 2_000 },
      // Keep last 1000 completed + 5000 failed in Redis for visibility.
      removeOnComplete: { count: 1_000, age: 60 * 60 * 24 * 7 },
      removeOnFail: { count: 5_000, age: 60 * 60 * 24 * 30 },
    },
  });
  queueRegistry.set(name, q);
  return q as Queue<T>;
}

/**
 * Spin up a worker for a given queue. Workers should run in the worker
 * process (not the API process). Returns the Worker so worker.ts can wire
 * lifecycle handlers.
 */
export function startWorker<T>(name: QueueName, processor: Processor<T>): Worker<T> {
  const w = new Worker<T>(name, processor, {
    connection: getConnection(),
    // Concurrency tuning per queue can come later. Default 1 is safe.
    concurrency: 1,
  });
  return w;
}

/** Close all open queues + the shared Redis connection. Call on shutdown. */
export async function closeQueues(): Promise<void> {
  await Promise.all(Array.from(queueRegistry.values()).map((q) => q.close()));
  queueRegistry.clear();
  if (connection) {
    await connection.quit();
    connection = null;
  }
}

// ---------------------------------------------------------------------------
// Queue topic registry — keep this exhaustive so adding a new queue is a
// single place to update + the type system enforces topic names everywhere.
// ---------------------------------------------------------------------------

export const QUEUE_NAMES = ['email', 'domain', 'ssl', 'hosting'] as const;
export type QueueName = (typeof QUEUE_NAMES)[number];
