/**
 * Transactional email — Resend wrapper.
 *
 * Behavior by env:
 * - `RESEND_API_KEY` unset (default in dev) → emails are logged to the console
 *   with a clear `[email:dev]` prefix instead of sent. No external calls.
 *   This lets local signup / reset flows work end-to-end without provisioning
 *   Resend.
 * - `RESEND_API_KEY` set → real send via Resend. Sender is `env.EMAIL_FROM`.
 *
 * Templates live here too (small enough to inline for now). Each template
 * returns `{ subject, text, html }`. If the HTML grows past ~50 lines we'll
 * split into a templates/ folder with real React Email components.
 */

import { Resend } from 'resend';
import { env } from './env.js';

export class EmailError extends Error {
  constructor(message: string, public cause?: unknown) {
    super(message);
    this.name = 'EmailError';
  }
}

const resend = env.RESEND_API_KEY ? new Resend(env.RESEND_API_KEY) : null;

interface SendEmailInput {
  to: string | string[];
  subject: string;
  text: string;
  html?: string;
  /** Optional reply-to header override; defaults to whatever Resend domain config says. */
  replyTo?: string;
}

export interface SendEmailResult {
  id: string;
  /** True when this "send" was a dev-mode console log, not a real Resend call. */
  mocked: boolean;
}

export async function sendEmail(input: SendEmailInput): Promise<SendEmailResult> {
  if (!resend) {
    const recipients = Array.isArray(input.to) ? input.to.join(', ') : input.to;
    // eslint-disable-next-line no-console
    console.info(
      `[email:dev] would send to=${recipients} from=${env.EMAIL_FROM} subject=${JSON.stringify(
        input.subject
      )}\n--- body ---\n${input.text}\n--- end ---`
    );
    return { id: `dev-${Date.now()}`, mocked: true };
  }

  const result = await resend.emails.send({
    from: env.EMAIL_FROM,
    to: input.to,
    subject: input.subject,
    text: input.text,
    html: input.html,
    replyTo: input.replyTo,
  });

  if (result.error) {
    throw new EmailError(result.error.message, result.error);
  }
  if (!result.data?.id) {
    throw new EmailError('Resend returned no message ID');
  }
  return { id: result.data.id, mocked: false };
}

// ---------------------------------------------------------------------------
// Templates
// ---------------------------------------------------------------------------

interface TemplateOutput {
  subject: string;
  text: string;
  html: string;
}

/**
 * Email verification — sent on signup. Link carries an opaque token the API
 * generates; clicking the link POSTs back to /v1/auth/verify-email.
 */
export function verificationEmailTemplate(opts: {
  firstName?: string;
  verifyUrl: string;
}): TemplateOutput {
  const greeting = opts.firstName ? `Hi ${opts.firstName},` : 'Hi,';
  return {
    subject: 'Verify your email for Octera',
    text: `${greeting}

Welcome to Octera. Please verify your email address by opening this link:

${opts.verifyUrl}

If you didn't create an Octera account, you can ignore this email.

— The Octera team`,
    html: `<!doctype html>
<html lang="en"><body style="font-family:ui-sans-serif,system-ui,sans-serif;max-width:520px;margin:32px auto;color:#111;line-height:1.5">
  <p>${greeting}</p>
  <p>Welcome to Octera. Please verify your email address by clicking the button below:</p>
  <p style="margin:32px 0;text-align:center">
    <a href="${opts.verifyUrl}" style="background:#0891b2;color:#fff;text-decoration:none;padding:12px 24px;border-radius:6px;display:inline-block">Verify email</a>
  </p>
  <p style="font-size:12px;color:#666">Or copy and paste this URL into your browser:<br><a href="${opts.verifyUrl}" style="color:#0891b2;word-break:break-all">${opts.verifyUrl}</a></p>
  <p style="font-size:12px;color:#666;margin-top:32px">If you didn't create an Octera account, you can ignore this email.</p>
</body></html>`,
  };
}

/**
 * Password reset — sent on /v1/auth/request-reset. Link carries a short-lived
 * token the API generates; clicking POSTs to /v1/auth/reset-password.
 */
export function passwordResetEmailTemplate(opts: {
  firstName?: string;
  resetUrl: string;
  expiresInMinutes: number;
}): TemplateOutput {
  const greeting = opts.firstName ? `Hi ${opts.firstName},` : 'Hi,';
  return {
    subject: 'Reset your Octera password',
    text: `${greeting}

You (or someone claiming to be you) requested a password reset for your Octera account. Open this link to set a new password:

${opts.resetUrl}

This link expires in ${opts.expiresInMinutes} minutes.

If you didn't request a reset, you can ignore this email — your password won't change.

— The Octera team`,
    html: `<!doctype html>
<html lang="en"><body style="font-family:ui-sans-serif,system-ui,sans-serif;max-width:520px;margin:32px auto;color:#111;line-height:1.5">
  <p>${greeting}</p>
  <p>You (or someone claiming to be you) requested a password reset for your Octera account.</p>
  <p style="margin:32px 0;text-align:center">
    <a href="${opts.resetUrl}" style="background:#0891b2;color:#fff;text-decoration:none;padding:12px 24px;border-radius:6px;display:inline-block">Set a new password</a>
  </p>
  <p style="font-size:12px;color:#666">This link expires in ${opts.expiresInMinutes} minutes. Or copy and paste:<br><a href="${opts.resetUrl}" style="color:#0891b2;word-break:break-all">${opts.resetUrl}</a></p>
  <p style="font-size:12px;color:#666;margin-top:32px">If you didn't request a reset, you can ignore this email — your password won't change.</p>
</body></html>`,
  };
}
