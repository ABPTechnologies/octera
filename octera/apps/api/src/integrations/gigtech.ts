/**
 * GIG.tech API integration client.
 *
 * This is the PRIMARY upstream for Octera — it's GIG.tech's whitelabel partner API
 * for domains, hosting, SSL, email, invoicing, and tickets.
 *
 * Base URL: https://portal.octera.cloud/api/1/
 *
 * ⚠️ STATUS: STUB. The structure is here but individual endpoint paths need to be
 * filled in from the official GIG.tech API docs, which the user has.
 *
 * Ask the user for:
 *   1. The current JWT (stored as env.GIGTECH_JWT)
 *   2. Whether the JWT is long-lived (service token) or short-lived (requires re-auth)
 *   3. The full API docs / OpenAPI spec
 *
 * Design principles in use:
 * - All calls go through a single `request()` method that handles auth, retries,
 *   logging, and error normalization.
 * - All responses are validated with Zod. If the upstream returns an unexpected
 *   shape, we fail loudly at the boundary rather than letting junk leak into our DB.
 * - Rate limits / 5xx errors retry with exponential backoff, up to 3 times.
 * - Every call is tagged with an idempotency key where the upstream supports it.
 */

import { z } from 'zod';
import { env } from '../lib/env.js';

const MAX_RETRIES = 3;
const BASE_DELAY_MS = 500;

export class GigtechError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public upstreamBody?: unknown
  ) {
    super(message);
  }
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  path: string;
  query?: Record<string, string | number | boolean | undefined>;
  body?: unknown;
  idempotencyKey?: string;
  /** Zod schema to validate successful response body against. */
  schema?: z.ZodTypeAny;
}

async function request<T>({ method = 'GET', path, query, body, idempotencyKey, schema }: RequestOptions): Promise<T> {
  if (!env.GIGTECH_JWT) {
    throw new GigtechError(0, 'not_configured', 'GIGTECH_JWT is not set');
  }

  const url = new URL(path.replace(/^\//, ''), env.GIGTECH_API_BASE.endsWith('/') ? env.GIGTECH_API_BASE : env.GIGTECH_API_BASE + '/');
  if (query) {
    for (const [k, v] of Object.entries(query)) {
      if (v !== undefined) url.searchParams.set(k, String(v));
    }
  }

  const headers: Record<string, string> = {
    Authorization: `Bearer ${env.GIGTECH_JWT}`,
    Accept: 'application/json',
  };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (idempotencyKey) headers['Idempotency-Key'] = idempotencyKey;

  let lastErr: unknown;
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      const res = await fetch(url, {
        method,
        headers,
        body: body !== undefined ? JSON.stringify(body) : undefined,
      });

      // Retry on 5xx and 429; everything else is terminal.
      if (res.status >= 500 || res.status === 429) {
        if (attempt < MAX_RETRIES - 1) {
          await new Promise((r) => setTimeout(r, BASE_DELAY_MS * 2 ** attempt));
          continue;
        }
      }

      const text = await res.text();
      const json = text ? JSON.parse(text) : undefined;

      if (!res.ok) {
        throw new GigtechError(
          res.status,
          (json?.error as string) ?? 'upstream_error',
          (json?.message as string) ?? `GIG.tech responded ${res.status}`,
          json
        );
      }

      return schema ? (schema.parse(json) as T) : (json as T);
    } catch (err) {
      lastErr = err;
      if (err instanceof GigtechError) throw err;
      if (attempt < MAX_RETRIES - 1) {
        await new Promise((r) => setTimeout(r, BASE_DELAY_MS * 2 ** attempt));
        continue;
      }
    }
  }
  throw lastErr instanceof Error ? lastErr : new GigtechError(0, 'network_error', 'Network error calling GIG.tech');
}

// ---------------------------------------------------------------------------
// Response schemas — these are placeholders. Replace with real shapes once the
// GIG.tech API docs are available. Keep them strict; use `.passthrough()` only
// if you really need to tolerate unknown fields.
// ---------------------------------------------------------------------------

const DomainSearchResultSchema = z.object({
  domain: z.string(),
  available: z.boolean(),
  price: z.number().optional(),
  currency: z.string().optional(),
});

const DomainSearchResponseSchema = z.object({
  results: z.array(DomainSearchResultSchema),
});

// ---------------------------------------------------------------------------
// Public API surface — one method per logical operation. When filling these in,
// keep names and signatures consistent with how routes consume them; don't leak
// upstream response shapes into route handlers.
// ---------------------------------------------------------------------------

export const gigtech = {
  /** Search for domain availability across supported TLDs. */
  async searchDomains(query: string) {
    // TODO: confirm real endpoint path with GIG.tech docs.
    // This is a reasonable guess based on common registrar APIs.
    const data = await request<z.infer<typeof DomainSearchResponseSchema>>({
      path: '/domains/search',
      query: { q: query },
      schema: DomainSearchResponseSchema,
    });
    return data.results;
  },

  /** Register a domain for a given number of years. */
  async registerDomain(params: { domain: string; years: number; contactId?: string; idempotencyKey: string }) {
    // TODO: real endpoint + request shape from GIG.tech docs.
    return request({
      method: 'POST',
      path: '/domains',
      body: params,
      idempotencyKey: params.idempotencyKey,
    });
  },

  /** List domains owned by the authenticated partner account. */
  async listDomains() {
    return request({ path: '/domains' });
  },

  /** Fetch a single domain's full record. */
  async getDomain(domain: string) {
    return request({ path: `/domains/${encodeURIComponent(domain)}` });
  },

  /** CRUD DNS records. */
  async listDnsRecords(domain: string) {
    return request({ path: `/domains/${encodeURIComponent(domain)}/dns` });
  },
  async createDnsRecord(domain: string, record: unknown, idempotencyKey: string) {
    return request({
      method: 'POST',
      path: `/domains/${encodeURIComponent(domain)}/dns`,
      body: record,
      idempotencyKey,
    });
  },
  async deleteDnsRecord(domain: string, recordId: string) {
    return request({
      method: 'DELETE',
      path: `/domains/${encodeURIComponent(domain)}/dns/${recordId}`,
    });
  },

  // TODO: hosting, SSL, email, invoices, tickets endpoints.
  // Add methods here following the same pattern as above.
};
