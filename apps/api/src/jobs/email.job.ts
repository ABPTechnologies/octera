/**
 * Email-sending job.
 *
 * Why a job and not just an inline call to sendEmail?
 * - Resend (or any SMTP provider) can be slow / temporarily unreachable;
 *   we don't want a slow upstream blocking a request handler.
 * - BullMQ retries + exponential backoff give us free recovery from
 *   transient failures.
 * - Sending email is exactly the kind of "external state change" the
 *   architecture principle in CLAUDE.md says should go through a queue.
 *
 * Idempotency note: Resend sends are NOT naturally idempotent — if BullMQ
 * retries a successful job we'd send the same email twice. The recipient
 * will not appreciate that. Provide a stable `idempotencyKey` in the job
 * data when possible; we can later enhance the worker to dedupe by key
 * via a Redis SET with TTL.
 */

import type { Processor } from 'bullmq';
import { getQueue, startWorker } from './queue.js';
import { sendEmail, type SendEmailResult } from '../lib/email.js';

export interface EmailJobData {
  to: string | string[];
  subject: string;
  text: string;
  html?: string;
  /** Optional dedupe key to prevent double-sends across retries. */
  idempotencyKey?: string;
}

/** Producer-side: enqueue an email send. */
export async function enqueueEmail(data: EmailJobData) {
  return getQueue<EmailJobData>('email').add('send', data, {
    // Use the idempotencyKey as the job ID when provided so BullMQ refuses
    // to enqueue a duplicate within the keep-alive window.
    jobId: data.idempotencyKey,
  });
}

const emailProcessor: Processor<EmailJobData, SendEmailResult> = async (job) => {
  const { to, subject, text, html } = job.data;
  return sendEmail({ to, subject, text, html });
};

/** Consumer-side: started by the worker process at boot. */
export function startEmailWorker() {
  return startWorker<EmailJobData>('email', emailProcessor);
}
