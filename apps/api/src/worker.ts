/**
 * Worker process entry point.
 *
 * Spins up BullMQ workers for each queue topic, plus signal handlers for
 * graceful shutdown (drain in-flight jobs, then exit).
 *
 * Run with:
 *   pnpm --filter @octera/api worker:dev   (dev, with file watcher)
 *   node dist/worker.js                     (prod)
 *
 * Sentry inits first so any error in worker startup is captured. Same
 * convention as src/index.ts.
 */

import { initSentry, captureException, flushSentry } from './lib/sentry.js';
initSentry();

import pino from 'pino';
import { closeQueues, startEmailWorker } from './jobs/index.js';
import { env } from './lib/env.js';

const log = pino({
  level: env.NODE_ENV === 'production' ? 'info' : 'debug',
  transport:
    env.NODE_ENV === 'development'
      ? { target: 'pino-pretty', options: { colorize: true } }
      : undefined,
});

async function main() {
  log.info('🛠  Octera worker starting');

  const workers = [startEmailWorker()];

  // Wire each worker's lifecycle events to our logger + Sentry. Failures
  // inside processors will be caught and reported.
  for (const w of workers) {
    w.on('completed', (job) => {
      log.debug({ jobId: job.id, queue: w.name }, 'job completed');
    });
    w.on('failed', (job, err) => {
      log.error(
        { jobId: job?.id, queue: w.name, attempts: job?.attemptsMade, err },
        'job failed'
      );
      captureException(err, {
        queue: w.name,
        jobId: job?.id,
        attemptsMade: job?.attemptsMade,
      });
    });
    w.on('error', (err) => {
      log.error({ queue: w.name, err }, 'worker error');
      captureException(err, { queue: w.name, scope: 'worker_error' });
    });
  }

  log.info(
    { queues: workers.map((w) => w.name) },
    `🛠  worker ready; processing ${workers.length} queue(s)`
  );

  // ---- Graceful shutdown ----
  let shuttingDown = false;
  async function shutdown(signal: string) {
    if (shuttingDown) return;
    shuttingDown = true;
    log.info({ signal }, 'shutting down worker');
    try {
      await Promise.all(workers.map((w) => w.close()));
      await closeQueues();
      await flushSentry(2_000);
    } catch (err) {
      log.error({ err }, 'error during shutdown');
    } finally {
      process.exit(0);
    }
  }
  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
}

main().catch((err) => {
  log.error({ err }, 'worker failed to start');
  captureException(err, { scope: 'worker_startup' });
  flushSentry(2_000).finally(() => process.exit(1));
});
