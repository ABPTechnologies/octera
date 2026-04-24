/**
 * Barrel for the jobs module.
 *
 * Producers (HTTP routes, services) import from here:
 *   import { enqueueEmail } from '../jobs/index.js';
 *
 * The worker entry point (apps/api/src/worker.ts) starts the consumer-side
 * workers. Don't start workers from anywhere else — they should run only in
 * the dedicated worker process.
 */

export {
  getQueue,
  startWorker,
  closeQueues,
  QUEUE_NAMES,
  type QueueName,
} from './queue.js';

export { enqueueEmail, startEmailWorker, type EmailJobData } from './email.job.js';
