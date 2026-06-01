/**
 * White Label provisioning — REAL wiring.
 *
 * Supplies live ProvisioningPorts (gig.tech cloudspace create, BotTrader
 * deploy, copier sentinel registration, risk-layer attach, auth wire,
 * healthcheck) and orchestrates a run against a WhiteLabel row, persisting a
 * WhiteLabelProvisioningRun.
 *
 * NOTE: this imports Prisma + the gig.tech client and is exercised on a host
 * with installed deps + a generated Prisma client + (for real runs) a gig.tech
 * JWT. The pure planning/execution logic it delegates to lives in
 * ./provision-plan.ts and is covered offline by scripts/validate-provision.ts.
 *
 * Mock-first: dryRun defaults to true. A real run additionally requires
 * gig.tech live mode (GIGTECH_JWT / client creds) — otherwise the gig.tech
 * client stays in mock mode and the cloudspace step returns a mock id.
 */
import { prisma } from "@octera/db";
import { gigtech } from "../../integrations/gigtech.js";
import {
  buildProvisioningPlan,
  executePlan,
  type ProvisioningPorts,
  type ProvisioningResult,
  type WlProvisionInput,
} from "./provision-plan.js";
import {
  buildLivePorts,
  CopierSentinelClient,
  KeycloakAuthClient,
  HealthProber,
  type FetchLike,
} from "./ports.js";

/** Map a WhiteLabel DB row → the planning input. */
function toProvisionInput(wl: {
  slug: string;
  seq: number;
  displayName: string;
  jurisdiction: string;
  adapterFamily: "CTRADER_FIX" | "IBKR_WEBAPI" | "MT5_MANAGER" | "STUB";
  brokerName: string | null;
  profile: "BROKER" | "FUNDED_PROP";
  vcsRegion: string | null;
  vcsSize: string | null;
  subdomain: string | null;
  pluginSet: string[];
  copierSentinelSlug: string | null;
  sioRealmClientId: string | null;
  riskRoutingPolicy: unknown;
  originAccountExternalId: string | null;
}, gigtechCustomerId: string): WlProvisionInput {
  return {
    slug: wl.slug,
    seq: wl.seq,
    displayName: wl.displayName,
    jurisdiction: wl.jurisdiction,
    adapterFamily: wl.adapterFamily,
    brokerName: wl.brokerName,
    profile: wl.profile,
    gigtechCustomerId,
    vcsRegion: wl.vcsRegion ?? "be-mac-dc01-002",
    vcsSize: wl.vcsSize ?? undefined,
    subdomain: wl.subdomain ?? undefined,
    pluginSet: wl.pluginSet,
    copierSentinelSlug: wl.copierSentinelSlug ?? undefined,
    sioRealmClientId: wl.sioRealmClientId ?? undefined,
    riskRoutingPolicy: (wl.riskRoutingPolicy as Record<string, unknown>) ?? {},
    originAccountExternalId: wl.originAccountExternalId ?? undefined,
  };
}

/**
 * Live ports. Each is intentionally small and isolated so the seams that
 * still need real integrations (copier register, BotTrader deploy on the VCS,
 * auth wiring) are obvious and individually testable.
 */
function livePorts(gigtechCustomerId: string): ProvisioningPorts {
  const env = process.env;
  const f: FetchLike = (globalThis as { fetch: FetchLike }).fetch;

  return buildLivePorts({
    // Real gig.tech cloudspace create (mock id when gig.tech is in mock mode).
    async createCloudspace(input, idempotencyKey) {
      const cs = await gigtech.createCloudspace(
        gigtechCustomerId,
        { name: input.slug, location: input.vcsRegion, cloudspaceMode: input.vcsSize },
        idempotencyKey
      );
      return { cloudspaceId: cs.cloudspace_id, location: cs.location ?? input.vcsRegion };
    },
    // Container-image deploy into the cloudspace is the remaining gig.tech
    // compute step (Phase 4). For now ensure the public URL; wire the compute
    // deploy here when the gig.tech container API + image are available.
    async deploy(input) {
      const sub = input.subdomain ?? input.slug;
      return { url: `https://${sub}.${input.baseDomain ?? "perpetualmarkets.com"}` };
    },
    sentinel: new CopierSentinelClient({
      baseUrl: env.COPIER_BASE_URL ?? "https://copier.yina.be",
      token: env.COPIER_API_TOKEN,
      fetchImpl: f,
    }),
    auth: new KeycloakAuthClient({
      baseUrl: env.SIO_KEYCLOAK_BASE ?? "https://signinonce.octera.cloud",
      realm: env.SIO_REALM ?? "abp",
      adminToken: env.SIO_ADMIN_TOKEN ?? "",
      fetchImpl: f,
    }),
    health: new HealthProber({ fetchImpl: f }),
    // Persist the one-time sentinel HMAC secret into the per-VCS sealed secret.
    async onSentinelSecret(slug, _secret) {
      // Phase 4: write `_secret` into the WL's sealed secret store (never DB).
      // Recorded here so the wiring point is explicit.
      void slug;
    },
  });
}

export interface ProvisionOptions {
  dryRun?: boolean;
  /** gig.tech customer tenant the cloudspace is created under. */
  gigtechCustomerId: string;
}

/**
 * Provision (or dry-run) a white label by slug. Persists a
 * WhiteLabelProvisioningRun row capturing the step trail.
 */
export async function provisionWhiteLabel(
  slug: string,
  opts: ProvisionOptions
): Promise<ProvisioningResult> {
  const dryRun = opts.dryRun ?? true;
  const wl = await prisma.whiteLabel.findUnique({ where: { slug } });
  if (!wl) throw new Error(`white label not found: ${slug}`);

  const input = toProvisionInput(wl, opts.gigtechCustomerId);

  // Persist the run up front so a crash mid-provision is still recorded.
  const run = await prisma.whiteLabelProvisioningRun.create({
    data: { whiteLabelId: wl.id, dryRun, status: "running", steps: [] },
  });

  if (!dryRun) {
    await prisma.whiteLabel.update({ where: { id: wl.id }, data: { status: "PROVISIONING" } });
  }

  const ports = livePorts(opts.gigtechCustomerId);
  const result = await executePlan(input, ports, { dryRun });

  await prisma.whiteLabelProvisioningRun.update({
    where: { id: run.id },
    data: { status: result.status, steps: result.results, finishedAt: new Date() },
  });

  if (!dryRun && result.status === "completed") {
    await prisma.whiteLabel.update({
      where: { id: wl.id },
      data: { status: "LIVE_PAPER", provisionedAt: new Date() },
    });
  }

  return result;
}

/** Dry-run plan only (no run row, no side effects) — for previews/UI. */
export async function planWhiteLabel(slug: string, gigtechCustomerId: string) {
  const wl = await prisma.whiteLabel.findUnique({ where: { slug } });
  if (!wl) throw new Error(`white label not found: ${slug}`);
  return buildProvisioningPlan(toProvisionInput(wl, gigtechCustomerId), { dryRun: true });
}
