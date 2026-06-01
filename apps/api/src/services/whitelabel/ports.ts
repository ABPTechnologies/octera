/**
 * White Label provisioning — live port CLIENTS. Pure + dependency-free.
 *
 * Implements the real side-effect logic behind the Phase-3 ProvisioningPorts:
 * register a copier sentinel, wire a SignInOnce/Keycloak realm client, probe
 * health, and deploy. HTTP is injected (`FetchLike`) and there are NO imports
 * of Prisma / gig.tech / Fastify here, so this module — and the assembled ports
 * — are unit-testable offline (scripts/validate-provision-ports.ts). The real
 * `provision.ts` builds these with the global fetch + config.
 *
 * Honest boundaries (Phase 4):
 *  - The copier must expose a sentinel-registration endpoint (the registry
 *    exists as server actions in yina-copier; exposing it as the API path used
 *    here is a small addition flagged for that repo).
 *  - `deploy` is injected: the real container-image deploy into the cloudspace
 *    is the gig.tech-compute step and is supplied by provision.ts.
 */
import type { ProvisioningPorts, WlProvisionInput } from "./provision-plan";

export type FetchLike = (
  url: string,
  init?: { method?: string; headers?: Record<string, string>; body?: string }
) => Promise<{ ok: boolean; status: number; json(): Promise<unknown>; text(): Promise<string> }>;

export class PortHttpError extends Error {
  constructor(public readonly status: number, message: string) {
    super(message);
    this.name = "PortHttpError";
  }
}

async function http(
  f: FetchLike,
  method: string,
  url: string,
  headers: Record<string, string>,
  body?: unknown
): Promise<{ status: number; json: unknown; locationHeader?: string }> {
  const res = await f(url, {
    method,
    headers: { Accept: "application/json", ...headers, ...(body !== undefined ? { "Content-Type": "application/json" } : {}) },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  const text = await res.text();
  const json = text ? JSON.parse(text) : null;
  if (!res.ok) {
    const msg = typeof json === "object" && json && "error" in json ? String((json as { error: unknown }).error) : text;
    throw new PortHttpError(res.status, msg || `HTTP ${res.status}`);
  }
  return { status: res.status, json };
}

function fqdn(input: WlProvisionInput): string {
  const sub = input.subdomain ?? input.slug;
  const base = input.baseDomain ?? "perpetualmarkets.com";
  return `${sub}.${base}`;
}

// --- Copier sentinel registration ------------------------------------------
export interface SentinelRegisterResult {
  slug: string;
  /** Plaintext secret — present only on create/rotate, null on idempotent
   *  re-register of an existing slug (the copier never reveals it twice). */
  hmacSecret: string | null;
  hmacSecretMask: string;
  created: boolean;
}

export class CopierSentinelClient {
  constructor(
    private readonly cfg: { baseUrl: string; token?: string; fetchImpl: FetchLike; path?: string }
  ) {}

  async register(reg: {
    slug: string;
    name: string;
    baseUrl: string;
    supportedFeatures?: string[];
    authorizedAccountExternalIds?: string[];
    rotate?: boolean;
  }): Promise<SentinelRegisterResult> {
    const path = this.cfg.path ?? "/api/copier/sentinels";
    const base = this.cfg.baseUrl.endsWith("/") ? this.cfg.baseUrl.slice(0, -1) : this.cfg.baseUrl;
    const headers: Record<string, string> = this.cfg.token ? { Authorization: `Bearer ${this.cfg.token}` } : {};
    const { json } = await http(this.cfg.fetchImpl, "POST", `${base}${path}`, headers, reg);
    const r = (json ?? {}) as Partial<SentinelRegisterResult>;
    if (!r.slug || !r.hmacSecretMask) {
      throw new PortHttpError(0, `copier register: missing slug/hmacSecretMask in response`);
    }
    // hmacSecret is absent on an idempotent re-register — that's expected.
    return {
      slug: r.slug,
      hmacSecret: r.hmacSecret ?? null,
      hmacSecretMask: r.hmacSecretMask,
      created: r.created ?? false,
    };
  }
}

// --- SignInOnce / Keycloak realm client ------------------------------------
export class KeycloakAuthClient {
  constructor(
    private readonly cfg: { baseUrl: string; realm: string; adminToken: string; fetchImpl: FetchLike }
  ) {}

  /** Idempotent: returns the existing client if clientId already exists. */
  async ensureClient(
    clientId: string,
    opts: { name?: string; redirectUris?: string[] } = {}
  ): Promise<{ realmClientId: string; created: boolean }> {
    const base = this.cfg.baseUrl.endsWith("/") ? this.cfg.baseUrl.slice(0, -1) : this.cfg.baseUrl;
    const adminBase = `${base}/admin/realms/${encodeURIComponent(this.cfg.realm)}/clients`;
    const headers = { Authorization: `Bearer ${this.cfg.adminToken}` };

    const found = await http(this.cfg.fetchImpl, "GET", `${adminBase}?clientId=${encodeURIComponent(clientId)}`, headers);
    const existing = Array.isArray(found.json) ? (found.json as Array<{ clientId?: string }>) : [];
    if (existing.length > 0 && existing[0]?.clientId === clientId) {
      return { realmClientId: clientId, created: false };
    }
    await http(this.cfg.fetchImpl, "POST", adminBase, headers, {
      clientId,
      name: opts.name ?? clientId,
      enabled: true,
      protocol: "openid-connect",
      publicClient: false,
      standardFlowEnabled: true,
      redirectUris: opts.redirectUris ?? [],
    });
    return { realmClientId: clientId, created: true };
  }
}

// --- Health prober ----------------------------------------------------------
export class HealthProber {
  constructor(private readonly cfg: { fetchImpl: FetchLike; path?: string }) {}

  async probe(baseUrl: string): Promise<{ ok: boolean; detail: string }> {
    const path = this.cfg.path ?? "/health";
    const url = `${baseUrl.replace(/\/$/, "")}${path}`;
    try {
      const res = await this.cfg.fetchImpl(url, { method: "GET" });
      return { ok: res.ok, detail: `GET ${url} → ${res.status}` };
    } catch (err) {
      return { ok: false, detail: `GET ${url} failed: ${err instanceof Error ? err.message : String(err)}` };
    }
  }
}

// --- Injected seams --------------------------------------------------------
export type CreateCloudspaceFn = (
  input: WlProvisionInput,
  idempotencyKey: string
) => Promise<{ cloudspaceId: string; location: string }>;

export type DeployFn = (
  input: WlProvisionInput,
  cloudspaceId: string
) => Promise<{ url: string }>;

export type RiskAttachFn = (input: WlProvisionInput) => Promise<{ policy: Record<string, unknown> }>;

/**
 * Assemble the ProvisioningPorts from the live clients + injected seams. Pure:
 * given mock clients/fetch it runs entirely offline; given real ones it runs
 * for real. `onSentinelSecret` lets the caller persist the one-time HMAC secret
 * into the per-VCS sealed secret.
 */
export function buildLivePorts(deps: {
  createCloudspace: CreateCloudspaceFn;
  deploy: DeployFn;
  sentinel: CopierSentinelClient;
  auth: KeycloakAuthClient;
  health: HealthProber;
  riskAttach?: RiskAttachFn;
  onSentinelSecret?: (slug: string, secret: string) => void | Promise<void>;
}): ProvisioningPorts {
  return {
    createCloudspace: (input, key) => deps.createCloudspace(input, key),
    deployBotTrader: (input, cloudspaceId) => deps.deploy(input, cloudspaceId),
    async registerSentinel(input) {
      const r = await deps.sentinel.register({
        slug: input.copierSentinelSlug ?? input.slug,
        name: input.displayName,
        baseUrl: `https://${fqdn(input)}`,
        supportedFeatures: input.pluginSet,
        authorizedAccountExternalIds: input.originAccountExternalId ? [input.originAccountExternalId] : [],
      });
      // Secret is only present on create/rotate; on idempotent re-register it's
      // null and already stored from the first run — skip the hook.
      if (r.hmacSecret && deps.onSentinelSecret) await deps.onSentinelSecret(r.slug, r.hmacSecret);
      return { slug: r.slug, hmacSecretMask: r.hmacSecretMask };
    },
    attachRiskLayer: (input) =>
      deps.riskAttach ? deps.riskAttach(input) : Promise.resolve({ policy: input.riskRoutingPolicy }),
    async wireAuth(input) {
      const r = await deps.auth.ensureClient(input.sioRealmClientId ?? input.slug, {
        name: input.displayName,
        redirectUris: [`https://${fqdn(input)}/*`],
      });
      return { realmClientId: r.realmClientId };
    },
    healthcheck: (input, ctx) => deps.health.probe(ctx.deployUrl ?? `https://${fqdn(input)}`),
  };
}
