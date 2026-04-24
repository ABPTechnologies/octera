/**
 * GIG.tech API integration client.
 *
 * Octera is a whitelabel of gig.tech's Virtual Cloud Operator (VCO). This client
 * talks to gig.tech's REST API at https://portal.octera.cloud/api/1/ on behalf of
 * the VCO operator (us) to read and manage VCO-level + customer-scoped resources.
 *
 * ⚠️ CREDENTIAL NOTE (as of 2026-04-24):
 * -------------------------------------------------------------------------------
 * This client expects env.GIGTECH_JWT to be a **VCO-level partner service
 * credential** — a long-lived JWT scoped to act across all customers under the
 * VCO. User-session JWTs issued by iam.octera.cloud's browser login flow have
 * `user:*` scopes and are REJECTED by most REST endpoints (HTTP 401) even
 * though they decode fine. Do not use a user session token here.
 *
 * Until a proper partner credential is available, the client falls back to
 * MOCK MODE (see `mockResponse` below) so the rest of the app keeps running
 * locally. Mock mode is indicated in logs and MUST NOT be used in production.
 *
 * Spec reference: apps/api/src/integrations/gigtech/swagger.json (618KB,
 * 395 paths, 515 definitions — the authoritative contract).
 *
 * Design:
 * - All calls go through a single `request()` helper that handles auth,
 *   retries with exponential backoff, idempotency keys, Zod validation, and
 *   error normalization.
 * - Every response is validated against a Zod schema at the boundary so
 *   upstream changes fail loudly rather than corrupting our DB.
 * - Endpoint paths mirror the swagger exactly. If you're tempted to invent a
 *   new path, re-check the swagger first — gig.tech's path naming is precise
 *   and resources like "domains" live under cloudspaces, not at the root.
 */

import { z } from 'zod';
import { env } from '../lib/env.js';

// ---------------------------------------------------------------------------
// Core — errors, request helper, mock mode
// ---------------------------------------------------------------------------

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
    this.name = 'GigtechError';
  }
}

/** True when we don't have a real credential; callers see canned fixture data. */
export function isMockMode(): boolean {
  return !env.GIGTECH_JWT;
}

interface RequestOptions<T> {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  path: string;
  query?: Record<string, string | number | boolean | undefined>;
  body?: unknown;
  idempotencyKey?: string;
  /** Zod schema for successful response body. Failure to parse throws GigtechError. */
  schema: z.ZodType<T>;
  /** Optional fixture returned when env.GIGTECH_JWT is unset (local dev). */
  mock?: () => T;
}

async function request<T>(opts: RequestOptions<T>): Promise<T> {
  if (isMockMode()) {
    if (opts.mock) {
      // eslint-disable-next-line no-console
      console.warn(`[gigtech:mock] ${opts.method ?? 'GET'} ${opts.path}`);
      return opts.schema.parse(opts.mock());
    }
    throw new GigtechError(
      0,
      'mock_not_available',
      `GIGTECH_JWT is not set and no mock is defined for ${opts.method ?? 'GET'} ${opts.path}`
    );
  }

  const base = env.GIGTECH_API_BASE.endsWith('/')
    ? env.GIGTECH_API_BASE
    : env.GIGTECH_API_BASE + '/';
  const url = new URL(opts.path.replace(/^\//, ''), base);
  if (opts.query) {
    for (const [k, v] of Object.entries(opts.query)) {
      if (v !== undefined) url.searchParams.set(k, String(v));
    }
  }

  const headers: Record<string, string> = {
    Authorization: `Bearer ${env.GIGTECH_JWT}`,
    Accept: 'application/json',
  };
  if (opts.body !== undefined) headers['Content-Type'] = 'application/json';
  if (opts.idempotencyKey) headers['Idempotency-Key'] = opts.idempotencyKey;

  let lastErr: unknown;
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      const res = await fetch(url, {
        method: opts.method ?? 'GET',
        headers,
        body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
      });

      // Retry 5xx and 429; anything else is terminal.
      if (res.status >= 500 || res.status === 429) {
        if (attempt < MAX_RETRIES - 1) {
          await sleep(BASE_DELAY_MS * 2 ** attempt);
          continue;
        }
      }

      const text = await res.text();
      const json = text ? safeJsonParse(text) : undefined;

      if (!res.ok) {
        throw new GigtechError(
          res.status,
          typeof json === 'object' && json !== null && 'error' in json
            ? String((json as Record<string, unknown>).error)
            : 'upstream_error',
          typeof json === 'object' && json !== null && 'message' in json
            ? String((json as Record<string, unknown>).message)
            : `GIG.tech responded ${res.status}`,
          json
        );
      }

      return opts.schema.parse(json);
    } catch (err) {
      lastErr = err;
      if (err instanceof GigtechError) throw err;
      if (err instanceof z.ZodError) {
        throw new GigtechError(
          0,
          'schema_mismatch',
          `Response from GIG.tech did not match expected schema: ${err.message}`,
          err.errors
        );
      }
      if (attempt < MAX_RETRIES - 1) {
        await sleep(BASE_DELAY_MS * 2 ** attempt);
        continue;
      }
    }
  }
  throw lastErr instanceof Error
    ? lastErr
    : new GigtechError(0, 'network_error', 'Network error calling GIG.tech');
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function safeJsonParse(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return { raw: text };
  }
}

// ---------------------------------------------------------------------------
// Zod schemas — only the shapes we actually consume for v1. Extend as we add
// more endpoints. Shapes match swagger.json definitions; names are simplified.
// ---------------------------------------------------------------------------

const UserCustomerSchema = z
  .object({
    customer_id: z.string(),
    name: z.string(),
    address: z.string().optional(),
    phone_number: z.string().optional(),
    status: z.string().optional(),
  })
  .passthrough();

const MeSchema = z
  .object({
    username: z.string(),
    email: z.string(),
    firstname: z.string().optional(),
    lastname: z.string().optional(),
    is_admin: z.boolean().optional(),
    iam_domain: z.string().optional(),
    vco_website: z.string().optional(),
    vco_name: z.string().optional(),
    vco_support_email: z.string().optional(),
    customers: z.array(UserCustomerSchema).optional(),
    admin_of_customers: z.array(UserCustomerSchema).optional(),
  })
  .passthrough();

const CustomerSummarySchema = z
  .object({
    customer_id: z.string(),
    name: z.string(),
    contact_name: z.string().optional(),
    email: z.string().optional(),
    billable: z.boolean().optional(),
    status: z.string().optional(),
    show_prices: z.boolean().optional(),
    deleted: z.boolean().optional(),
  })
  .passthrough();

const CustomerListSchema = z.object({
  pagination: z
    .object({
      limit: z.number().optional(),
      pages: z.number().optional(),
      count: z.number().optional(),
    })
    .partial()
    .optional(),
  data: z.array(CustomerSummarySchema),
});

const DatacenterSchema = z
  .object({
    name: z.string().optional(),
    code: z.string().optional(),
    city: z.string().optional(),
    country: z.string().optional(),
    country_code: z.string().optional(),
    address: z.string().optional(),
  })
  .passthrough();

const LocationSchema = z
  .object({
    name: z.string(),
    datacenter: DatacenterSchema.optional(),
    is_freemium: z.boolean().optional(),
  })
  .passthrough();

const LocationsListSchema = z.object({
  result: z.array(LocationSchema),
});

const CloudspaceSchema = z
  .object({
    cloudspace_id: z.string(),
    name: z.string(),
    status: z.string().optional(),
    location: z.string().optional(),
    private_network: z.string().optional(),
    external_network_ip: z.string().optional(),
    cloudspace_mode: z.string().optional(),
    router_type: z.string().optional(),
    creation_time: z.number().optional(),
    update_time: z.number().optional(),
    deletion_time: z.union([z.string(), z.number()]).optional(),
  })
  .passthrough();

const CloudspacesListSchema = z.object({
  result: z.array(CloudspaceSchema),
  locations: z
    .array(z.object({ location: z.string(), status: z.string() }).passthrough())
    .optional(),
});

const ReverseProxySchema = z
  .object({
    reverseproxy_id: z.string(),
    name: z.string(),
    serverpool_name: z.string().optional(),
    locked: z.boolean().optional(),
  })
  .passthrough();

const ReverseProxyListSchema = z.object({
  result: z.array(ReverseProxySchema),
});

const CertificateSummarySchema = z
  .object({
    domain: z.string(),
    customer_id: z.string().optional(),
    source: z.enum(['CERTIFICATE_STORE', 'LETS_ENCRYPT']).optional(),
    status: z.enum(['valid', 'invalid', 'expired']).optional(),
    created_at: z.number().optional(),
    expires_at: z.number().optional(),
    notified: z.boolean().optional(),
  })
  .passthrough();

const CustomerCertificatesListSchema = z.object({
  pagination: z
    .object({
      limit: z.number().optional(),
      pages: z.number().optional(),
      count: z.number().optional(),
    })
    .partial()
    .optional(),
  data: z.array(CertificateSummarySchema),
});

const SuccessSchema = z.object({ success: z.boolean() }).passthrough();

// Exported TypeScript types derived from the schemas.
export type Me = z.infer<typeof MeSchema>;
export type CustomerSummary = z.infer<typeof CustomerSummarySchema>;
export type Location = z.infer<typeof LocationSchema>;
export type Cloudspace = z.infer<typeof CloudspaceSchema>;
export type ReverseProxy = z.infer<typeof ReverseProxySchema>;
export type CertificateSummary = z.infer<typeof CertificateSummarySchema>;

// ---------------------------------------------------------------------------
// Fixtures — shape-valid canned responses for mock mode. Keep these in sync
// with what we observed in production for the ABP Technologies customer so
// local dev feels close to real data.
// ---------------------------------------------------------------------------

const MOCK_CUSTOMERS = [
  {
    customer_id: 'abp_technologies_1',
    name: 'ABP Technologies',
    contact_name: 'Gerry Dekens',
    email: 'info@crowconsulting.be',
    billable: true,
    status: 'active',
    show_prices: true,
  },
  {
    customer_id: 'iriscall_1',
    name: 'Iriscall',
    billable: true,
    status: 'active',
  },
] as const satisfies readonly z.infer<typeof CustomerSummarySchema>[];

const MOCK_LOCATIONS = [
  {
    name: 'be-mac-dc01-002',
    datacenter: {
      name: 'LCL Machelen',
      city: 'Machelen',
      country: 'Belgium',
      country_code: 'BE',
    },
    is_freemium: false,
  },
] as const satisfies readonly z.infer<typeof LocationSchema>[];

// Not annotated with z.infer<> — Zod's default() makes input/output types
// differ (input optional, output guaranteed) and the assignment breaks. Shape
// is still validated at call time via `MeSchema.parse(opts.mock())`.
const MOCK_ME = {
  username: 'gerry.dekens',
  email: 'info@crowconsulting.be',
  firstname: 'Gerry',
  lastname: 'Dekens',
  is_admin: true,
  iam_domain: 'iam.octera.cloud',
  vco_website: 'octera.cloud',
  vco_name: 'ABP Technologies BVBA',
  vco_support_email: 'support@octera.net',
  customers: MOCK_CUSTOMERS.map((c) => ({
    customer_id: c.customer_id,
    name: c.name,
    address: '',
    phone_number: '',
    status: c.status,
  })),
  admin_of_customers: MOCK_CUSTOMERS.map((c) => ({
    customer_id: c.customer_id,
    name: c.name,
    address: '',
    phone_number: '',
    status: c.status,
  })),
};

// ---------------------------------------------------------------------------
// Public client — one async function per logical operation.
//
// Naming convention: <verb><Resource> or <verb><Resource>In<Parent>, e.g.
// listCustomers, listCloudspacesFor, renewReverseProxyCert. Keep these names
// stable — route handlers consume them directly.
// ---------------------------------------------------------------------------

export const gigtech = {
  // --- Session / identity ---------------------------------------------------

  /** GET /me — returns the VCO operator profile + customer memberships. */
  async getMe(): Promise<Me> {
    return request({
      path: '/me',
      schema: MeSchema,
      mock: () => MOCK_ME,
    });
  },

  // --- Customers ------------------------------------------------------------

  /** GET /customers — list customers visible to the authenticated principal. */
  async listCustomers(opts: { limit?: number; search?: string } = {}): Promise<CustomerSummary[]> {
    const res = await request({
      path: '/customers',
      query: { limit: opts.limit, search: opts.search },
      schema: CustomerListSchema,
      mock: () => ({ pagination: { count: MOCK_CUSTOMERS.length }, data: [...MOCK_CUSTOMERS] }),
    });
    return res.data;
  },

  /** GET /customers/{cid} — full customer info. */
  async getCustomer(customerId: string) {
    return request({
      path: `/customers/${encodeURIComponent(customerId)}`,
      schema: CustomerSummarySchema.passthrough(),
      mock: () => {
        const c = MOCK_CUSTOMERS.find((x) => x.customer_id === customerId);
        if (!c) throw new GigtechError(404, 'not_found', `Customer ${customerId} not found`);
        return c;
      },
    });
  },

  // --- Locations ------------------------------------------------------------

  /** GET /locations — VCO datacenters available for deployment. */
  async listLocations(): Promise<Location[]> {
    const res = await request({
      path: '/locations',
      schema: LocationsListSchema,
      mock: () => ({ result: [...MOCK_LOCATIONS] }),
    });
    return res.result;
  },

  // --- Cloudspaces ----------------------------------------------------------

  /** GET /customers/{cid}/cloudspaces — list VDCs for a customer. */
  async listCloudspacesFor(customerId: string): Promise<Cloudspace[]> {
    const res = await request({
      path: `/customers/${encodeURIComponent(customerId)}/cloudspaces`,
      schema: CloudspacesListSchema,
      mock: () => ({ result: [], locations: [{ location: 'be-mac-dc01-002', status: 'OK' }] }),
    });
    return res.result;
  },

  /** GET /customers/{cid}/cloudspaces/{csid} — single cloudspace detail. */
  async getCloudspace(customerId: string, cloudspaceId: string) {
    return request({
      path: `/customers/${encodeURIComponent(customerId)}/cloudspaces/${encodeURIComponent(cloudspaceId)}`,
      schema: CloudspaceSchema,
      mock: () => ({
        cloudspace_id: cloudspaceId,
        name: 'mock-cloudspace',
        status: 'DEPLOYED',
        location: 'be-mac-dc01-002',
      }),
    });
  },

  // --- Ingress / reverse proxies / SSL --------------------------------------
  // Needed for the ABP cert renewal path and for future self-care SSL panel.

  /** GET /customers/{cid}/cloudspaces/{csid}/ingress/reverse-proxies */
  async listReverseProxies(customerId: string, cloudspaceId: string): Promise<ReverseProxy[]> {
    const res = await request({
      path: `/customers/${encodeURIComponent(customerId)}/cloudspaces/${encodeURIComponent(cloudspaceId)}/ingress/reverse-proxies`,
      schema: ReverseProxyListSchema,
      mock: () => ({ result: [] }),
    });
    return res.result;
  },

  /**
   * POST /customers/{cid}/cloudspaces/{csid}/ingress/reverse-proxies/{rpid}/renew-certificate
   *
   * Triggers a Let's Encrypt / ACME renewal via gig.tech's managed ingress.
   * This is the cleaner alternative to SSH-ing into VMs to run certbot.
   */
  async renewReverseProxyCert(customerId: string, cloudspaceId: string, reverseProxyId: string) {
    return request({
      method: 'POST',
      path: `/customers/${encodeURIComponent(customerId)}/cloudspaces/${encodeURIComponent(cloudspaceId)}/ingress/reverse-proxies/${encodeURIComponent(reverseProxyId)}/renew-certificate`,
      schema: SuccessSchema,
      idempotencyKey: `renew-cert-${customerId}-${cloudspaceId}-${reverseProxyId}-${Date.now()}`,
      mock: () => ({ success: true }),
    });
  },

  /** GET /customers/{cid}/certificates/ssl — customer-level cert store. */
  async listCustomerCertificates(customerId: string): Promise<CertificateSummary[]> {
    const res = await request({
      path: `/customers/${encodeURIComponent(customerId)}/certificates/ssl`,
      schema: CustomerCertificatesListSchema,
      mock: () => ({ data: [] }),
    });
    return res.data;
  },

  /** POST /customers/{cid}/certificates/ssl/{domain} — request new LE cert. */
  async createCustomerCertificate(
    customerId: string,
    domain: string,
    idempotencyKey: string
  ) {
    return request({
      method: 'POST',
      path: `/customers/${encodeURIComponent(customerId)}/certificates/ssl/${encodeURIComponent(domain)}`,
      schema: SuccessSchema,
      idempotencyKey,
      mock: () => ({ success: true }),
    });
  },

  // --- Domain search / registration (DEFERRED) ------------------------------

  /**
   * @deprecated gig.tech's VCO API is NOT a domain registrar surface. Top-level
   * domains live under `/alpha/admin/dns/top-level-domain` (VCO) and
   * `/alpha/customers/{cid}/dns/top-level-domains` (per customer) but those
   * register domains you already own with the VCO — they don't search or
   * purchase new domains against an ICANN registrar.
   *
   * For ".com availability search + buy a new domain" we need a separate
   * registrar integration (GoDaddy for v2, per NEXT_STEPS.md). This method
   * exists only to keep the /v1/domains/search route from crashing until the
   * GoDaddy client is built.
   */
  async searchDomains(_query: string): Promise<never> {
    throw new GigtechError(
      501,
      'not_implemented',
      'Domain availability search is not part of the gig.tech API. GoDaddy integration (v2) will handle this; see NEXT_STEPS.md § 3a.'
    );
  },
};
