/**
 * OrderSignup deposit client.
 *
 * OrderSignup (app.ordersignup.com) is the user's central vault for every
 * contract / order / invoice generated across the ABP estate. Octera is a
 * *producer*: when a customer opens an account or pays, we deposit a document
 * into their vault so it shows up alongside everything else they've signed up
 * for online.
 *
 * Two identities are in play (mirrors OrderSignup's ingest contract):
 *   • the SOURCE  — Octera, authenticated by a shared ingest token.
 *   • the OWNER   — the customer, asserted here by email. OrderSignup resolves
 *                   the email to a SignInOnce `sub` if it knows one.
 *
 * This is strictly best-effort: a depositing failure must NEVER break signup or
 * payment handling. Every call is fire-and-forget and swallows its own errors.
 */
import { env } from '../lib/env.js';

export type DepositKind = 'CONTRACT' | 'ORDER' | 'INVOICE' | 'RECEIPT' | 'TERMS' | 'SUBSCRIPTION' | 'OTHER';

export interface DepositInput {
  ownerEmail: string;
  kind: DepositKind;
  title: string;
  counterparty?: string;
  externalRef?: string; // Octera's own id — idempotency key on OrderSignup's side
  sourceUrl?: string; // link OrderSignup fetches + stores a governed copy of
  effectiveDate?: string; // ISO date
  expiresAt?: string; // ISO date
  metadata?: Record<string, unknown>;
}

type Logger = { info: (o: object, m: string) => void; warn: (o: object, m: string) => void };

const DEPOSIT_TIMEOUT_MS = 5_000;

function isConfigured(): boolean {
  return Boolean(env.ORDERSIGNUP_INGEST_URL && env.ORDERSIGNUP_INGEST_TOKEN);
}

/**
 * Deposit a document into the customer's OrderSignup vault. Returns true on a
 * 2xx, false otherwise (including when OrderSignup isn't configured). Never
 * throws — safe to `void` from a request handler.
 */
export async function depositDocument(input: DepositInput, log?: Logger): Promise<boolean> {
  if (!isConfigured()) {
    log?.info({ kind: input.kind }, 'ordersignup not configured — skipping deposit');
    return false;
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), DEPOSIT_TIMEOUT_MS);
  try {
    const res = await fetch(`${env.ORDERSIGNUP_INGEST_URL}/api/ingest`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-ingest-token': env.ORDERSIGNUP_INGEST_TOKEN as string,
      },
      body: JSON.stringify(input),
      signal: controller.signal,
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      log?.warn({ status: res.status, body: body.slice(0, 200), kind: input.kind }, 'ordersignup deposit failed');
      return false;
    }
    log?.info({ kind: input.kind, externalRef: input.externalRef }, 'ordersignup deposit ok');
    return true;
  } catch (err) {
    log?.warn({ err: String(err), kind: input.kind }, 'ordersignup deposit threw');
    return false;
  } finally {
    clearTimeout(timer);
  }
}
