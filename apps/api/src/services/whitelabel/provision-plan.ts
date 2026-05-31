/**
 * White Label provisioning — PURE planning + execution core.
 *
 * Deliberately dependency-free (no Prisma, no Fastify, no gig.tech import, no
 * network). All side effects go through the injected `ProvisioningPorts`, so:
 *   - dry-run produces a reviewable plan without doing anything,
 *   - execution is testable offline with mock ports (see makeMockPorts),
 *   - the real wiring (provision.ts) supplies live ports.
 *
 * This is the Phase-3 factory core. The ordered steps mirror PHASE-1 §3's
 * field → action → target-system contract. Mock-first per the build plan:
 * every run defaults to dryRun=true; real provisioning is an explicit opt-in.
 */

export type ProvisioningStepName =
  | "cloudspace" // provision the VCS (gig.tech cloudspace)
  | "deploy" // deploy the BotTrader template configured for this WL
  | "sentinel_register" // register the WL as a YINA Copier sentinel
  | "risk_layer_attach" // attach to the shared risk layer (no per-WL ownership)
  | "auth_wire" // wire SignInOnce + CID Global for the WL domain
  | "healthcheck"; // verify the VCS + federation are live

export const STEP_ORDER: readonly ProvisioningStepName[] = [
  "cloudspace",
  "deploy",
  "sentinel_register",
  "risk_layer_attach",
  "auth_wire",
  "healthcheck",
] as const;

/** Minimal WL config the factory needs to provision (subset of WhiteLabel). */
export interface WlProvisionInput {
  slug: string;
  seq: number;
  displayName: string;
  jurisdiction: string;
  adapterFamily: "CTRADER_FIX" | "IBKR_WEBAPI" | "MT5_MANAGER" | "STUB";
  brokerName?: string | null;
  profile: "BROKER" | "FUNDED_PROP";
  /** gig.tech customer tenant the cloudspace is created under. */
  gigtechCustomerId: string;
  vcsRegion: string; // gig.tech location
  vcsSize?: string;
  subdomain?: string;
  baseDomain?: string; // e.g. "perpetualmarkets.com"
  pluginSet: string[];
  copierSentinelSlug?: string;
  copierBaseUrl?: string; // master copier endpoint
  sioRealmClientId?: string;
  riskRoutingPolicy: Record<string, unknown>;
  originAccountExternalId?: string;
}

export interface PlannedStep {
  name: ProvisioningStepName;
  description: string;
  /** Idempotency key so a retried step never double-provisions. */
  idempotencyKey: string;
}

export interface ProvisioningPlan {
  whiteLabelSlug: string;
  dryRun: boolean;
  steps: PlannedStep[];
}

export type StepStatus = "planned" | "ok" | "skipped" | "failed";

export interface StepResult {
  name: ProvisioningStepName;
  status: StepStatus;
  detail: string;
  at: string; // ISO timestamp
}

export interface ProvisioningResult {
  whiteLabelSlug: string;
  dryRun: boolean;
  status: "planned" | "completed" | "failed";
  results: StepResult[];
}

// --- Ports (side-effect boundaries) ----------------------------------------

export interface CloudspaceResult {
  cloudspaceId: string;
  location: string;
}
export interface DeployResult {
  url: string;
}
export interface SentinelResult {
  slug: string;
  hmacSecretMask: string;
}

export interface ProvisioningPorts {
  createCloudspace(input: WlProvisionInput, idempotencyKey: string): Promise<CloudspaceResult>;
  deployBotTrader(input: WlProvisionInput, cloudspaceId: string): Promise<DeployResult>;
  registerSentinel(input: WlProvisionInput): Promise<SentinelResult>;
  attachRiskLayer(input: WlProvisionInput): Promise<{ policy: Record<string, unknown> }>;
  wireAuth(input: WlProvisionInput): Promise<{ realmClientId: string }>;
  healthcheck(input: WlProvisionInput, ctx: { deployUrl?: string }): Promise<{ ok: boolean; detail: string }>;
}

// --- Pure helpers ----------------------------------------------------------

function fqdn(input: WlProvisionInput): string {
  const sub = input.subdomain ?? input.slug;
  const base = input.baseDomain ?? "perpetualmarkets.com";
  return `${sub}.${base}`;
}

/** Build the ordered, idempotency-keyed plan for a WL. Pure. */
export function buildProvisioningPlan(
  input: WlProvisionInput,
  opts: { dryRun?: boolean } = {}
): ProvisioningPlan {
  const k = input.slug;
  const steps: PlannedStep[] = [
    {
      name: "cloudspace",
      description: `Provision gig.tech cloudspace "${k}" in ${input.vcsRegion}${input.vcsSize ? ` (${input.vcsSize})` : ""} under customer ${input.gigtechCustomerId}`,
      idempotencyKey: `cs:${k}`,
    },
    {
      name: "deploy",
      description: `Deploy BotTrader (${input.adapterFamily}${input.brokerName ? `/${input.brokerName}` : ""}, profile=${input.profile}) at https://${fqdn(input)} with plugins [${input.pluginSet.join(", ")}]`,
      idempotencyKey: `deploy:${k}`,
    },
    {
      name: "sentinel_register",
      description: `Register copier sentinel "${input.copierSentinelSlug ?? k}" with master ${input.copierBaseUrl ?? "copier.yina.be"} (HMAC secret captured once)`,
      idempotencyKey: `sentinel:${input.copierSentinelSlug ?? k}`,
    },
    {
      name: "risk_layer_attach",
      description: `Attach to shared risk layer (232 orphans + 21 feeders) via policy ${JSON.stringify(input.riskRoutingPolicy)} — emits loss_events; no per-WL ownership row`,
      idempotencyKey: `risk:${k}`,
    },
    {
      name: "auth_wire",
      description: `Wire SignInOnce realm client "${input.sioRealmClientId ?? k}" + CID Global for ${fqdn(input)}`,
      idempotencyKey: `auth:${k}`,
    },
    {
      name: "healthcheck",
      description: `Verify VCS reachable + sentinel handshake + origin ${input.originAccountExternalId ?? "gerry-dekens-trading"} federation`,
      idempotencyKey: `health:${k}`,
    },
  ];
  return { whiteLabelSlug: k, dryRun: opts.dryRun ?? true, steps };
}

/**
 * Execute (or, in dry-run, simulate) the plan in order, stopping on first
 * failure. Returns a per-step result trail suitable for persisting into
 * WhiteLabelProvisioningRun.steps.
 */
export async function executePlan(
  input: WlProvisionInput,
  ports: ProvisioningPorts,
  opts: { dryRun?: boolean } = {}
): Promise<ProvisioningResult> {
  const dryRun = opts.dryRun ?? true;
  const plan = buildProvisioningPlan(input, { dryRun });
  const results: StepResult[] = [];
  const now = () => new Date().toISOString();
  const ctx: { deployUrl?: string } = {};

  for (const step of plan.steps) {
    if (dryRun) {
      results.push({ name: step.name, status: "planned", detail: step.description, at: now() });
      continue;
    }
    try {
      switch (step.name) {
        case "cloudspace": {
          const r = await ports.createCloudspace(input, step.idempotencyKey);
          results.push({ name: step.name, status: "ok", detail: `cloudspace ${r.cloudspaceId} @ ${r.location}`, at: now() });
          ctx.deployUrl = undefined;
          (ctx as { cloudspaceId?: string }).cloudspaceId = r.cloudspaceId;
          break;
        }
        case "deploy": {
          const csid = (ctx as { cloudspaceId?: string }).cloudspaceId ?? "unknown";
          const r = await ports.deployBotTrader(input, csid);
          ctx.deployUrl = r.url;
          results.push({ name: step.name, status: "ok", detail: `deployed ${r.url}`, at: now() });
          break;
        }
        case "sentinel_register": {
          const r = await ports.registerSentinel(input);
          results.push({ name: step.name, status: "ok", detail: `sentinel ${r.slug} (secret ${r.hmacSecretMask})`, at: now() });
          break;
        }
        case "risk_layer_attach": {
          const r = await ports.attachRiskLayer(input);
          results.push({ name: step.name, status: "ok", detail: `attached: ${JSON.stringify(r.policy)}`, at: now() });
          break;
        }
        case "auth_wire": {
          const r = await ports.wireAuth(input);
          results.push({ name: step.name, status: "ok", detail: `auth client ${r.realmClientId}`, at: now() });
          break;
        }
        case "healthcheck": {
          const r = await ports.healthcheck(input, ctx);
          results.push({ name: step.name, status: r.ok ? "ok" : "failed", detail: r.detail, at: now() });
          if (!r.ok) return { whiteLabelSlug: plan.whiteLabelSlug, dryRun, status: "failed", results };
          break;
        }
      }
    } catch (err) {
      results.push({
        name: step.name,
        status: "failed",
        detail: err instanceof Error ? err.message : String(err),
        at: now(),
      });
      return { whiteLabelSlug: plan.whiteLabelSlug, dryRun, status: "failed", results };
    }
  }

  return {
    whiteLabelSlug: plan.whiteLabelSlug,
    dryRun,
    status: dryRun ? "planned" : "completed",
    results,
  };
}

/**
 * Deterministic, offline mock ports. Idempotent: keyed by the step
 * idempotency key / slug, so re-running yields identical ids. Used by the
 * Gate-3 smoke test and any mock-mode dry/real run before live creds land.
 */
export function makeMockPorts(): ProvisioningPorts & { calls: string[] } {
  const calls: string[] = [];
  const cloudspaces = new Map<string, CloudspaceResult>();
  return {
    calls,
    async createCloudspace(input, idempotencyKey) {
      calls.push(`createCloudspace:${idempotencyKey}`);
      const existing = cloudspaces.get(idempotencyKey);
      if (existing) return existing;
      const r: CloudspaceResult = { cloudspaceId: `cs_${input.slug}`, location: input.vcsRegion };
      cloudspaces.set(idempotencyKey, r);
      return r;
    },
    async deployBotTrader(input) {
      calls.push(`deploy:${input.slug}`);
      const sub = input.subdomain ?? input.slug;
      const base = input.baseDomain ?? "perpetualmarkets.com";
      return { url: `https://${sub}.${base}` };
    },
    async registerSentinel(input) {
      calls.push(`sentinel:${input.copierSentinelSlug ?? input.slug}`);
      return { slug: input.copierSentinelSlug ?? input.slug, hmacSecretMask: "abcd…wxyz" };
    },
    async attachRiskLayer(input) {
      calls.push(`risk:${input.slug}`);
      return { policy: input.riskRoutingPolicy };
    },
    async wireAuth(input) {
      calls.push(`auth:${input.slug}`);
      return { realmClientId: input.sioRealmClientId ?? input.slug };
    },
    async healthcheck(input) {
      calls.push(`health:${input.slug}`);
      return { ok: true, detail: "mock: vcs reachable, sentinel handshake ok" };
    },
  };
}
