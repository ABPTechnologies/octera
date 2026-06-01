/**
 * Offline test for the live provisioning port clients + assembler.
 *
 * Pure: imports only ports.ts + provision-plan.ts (no Prisma/gig.tech/Fastify),
 * drives them through a mock fetch. Verifies sentinel registration (+ HMAC
 * capture), Keycloak client ensure (create + idempotent), health probe, error
 * normalisation, and a full executePlan(dryRun=false) through the assembled
 * live ports.
 *
 * Run with any tsx:  tsx apps/api/scripts/validate-provision-ports.ts
 */
import {
  CopierSentinelClient,
  KeycloakAuthClient,
  HealthProber,
  PortHttpError,
  buildLivePorts,
  type FetchLike,
} from "../src/services/whitelabel/ports";
import { executePlan, type WlProvisionInput } from "../src/services/whitelabel/provision-plan";

let failures = 0;
function check(name: string, cond: boolean, detail = "") {
  if (!cond) failures++;
  console.log(`${cond ? "PASS" : "FAIL"}  ${name}${detail ? `  — ${detail}` : ""}`);
}
function resp(status: number, body: unknown) {
  const text = body === undefined ? "" : JSON.stringify(body);
  return { ok: status >= 200 && status < 300, status, async json() { return body; }, async text() { return text; } };
}

const wl1: WlProvisionInput = {
  slug: "pm-se", seq: 1, displayName: "Perpetual Markets Sweden", jurisdiction: "SE",
  adapterFamily: "CTRADER_FIX", brokerName: "Scandinavian Capital Markets", profile: "BROKER",
  gigtechCustomerId: "abp_technologies_1", vcsRegion: "be-mac-dc01-002", vcsSize: "standard",
  subdomain: "se", baseDomain: "perpetualmarkets.com",
  pluginSet: ["bottrader", "copier-sentinel", "nexiswift"],
  copierSentinelSlug: "pm-se", copierBaseUrl: "https://copier.yina.be", sioRealmClientId: "pm-se",
  riskRoutingPolicy: { mode: "default" }, originAccountExternalId: "gerry-dekens-trading",
};

// Mock fetch: clientExists toggles Keycloak GET behaviour for the idempotency test.
function makeFetch(opts: { clientExists?: boolean; copierStatus?: number } = {}): FetchLike {
  return async (url, init) => {
    const method = init?.method ?? "GET";
    if (/\/api\/copier\/sentinels$/.test(url) && method === "POST") {
      if (opts.copierStatus && opts.copierStatus >= 400) return resp(opts.copierStatus, { error: "boom" });
      return resp(200, { slug: "pm-se", hmacSecret: "supersecretvalue1234", hmacSecretMask: "supe…1234" });
    }
    if (/\/admin\/realms\/.+\/clients\?clientId=/.test(url) && method === "GET") {
      return resp(200, opts.clientExists ? [{ clientId: "pm-se" }] : []);
    }
    if (/\/admin\/realms\/.+\/clients$/.test(url) && method === "POST") {
      return resp(201, {});
    }
    if (/\/health$/.test(url) && method === "GET") {
      return resp(200, { status: "ok" });
    }
    return resp(404, { error: "not found" });
  };
}

async function run() {
  const f = makeFetch();

  // Sentinel register
  const sentinel = new CopierSentinelClient({ baseUrl: "https://copier.yina.be", fetchImpl: f });
  const reg = await sentinel.register({ slug: "pm-se", name: "PM Sweden", baseUrl: "https://se.perpetualmarkets.com" });
  check("sentinel: returns hmacSecret + mask", reg.hmacSecret === "supersecretvalue1234" && reg.hmacSecretMask === "supe…1234");

  // Sentinel error normalisation
  let portErr: unknown = null;
  try {
    await new CopierSentinelClient({ baseUrl: "https://copier.yina.be", fetchImpl: makeFetch({ copierStatus: 500 }) })
      .register({ slug: "x", name: "x", baseUrl: "https://x" });
  } catch (e) { portErr = e; }
  check("sentinel: 500 → PortHttpError", portErr instanceof PortHttpError && (portErr as PortHttpError).status === 500);

  // Keycloak ensureClient — create path
  const authCreate = new KeycloakAuthClient({ baseUrl: "https://sio", realm: "abp", adminToken: "t", fetchImpl: makeFetch({ clientExists: false }) });
  const created = await authCreate.ensureClient("pm-se", { name: "PM Sweden", redirectUris: ["https://se.perpetualmarkets.com/*"] });
  check("auth: creates client when absent", created.created === true && created.realmClientId === "pm-se");

  // Keycloak ensureClient — idempotent path
  const authExists = new KeycloakAuthClient({ baseUrl: "https://sio", realm: "abp", adminToken: "t", fetchImpl: makeFetch({ clientExists: true }) });
  const exists = await authExists.ensureClient("pm-se", {});
  check("auth: idempotent when client exists", exists.created === false);

  // Health probe
  const health = new HealthProber({ fetchImpl: f });
  const probe = await health.probe("https://se.perpetualmarkets.com");
  check("health: 200 → ok", probe.ok === true);

  // Full executePlan through assembled live ports
  let capturedSecret: string | null = null;
  const ports = buildLivePorts({
    createCloudspace: async (input) => ({ cloudspaceId: `cs_${input.slug}`, location: input.vcsRegion }),
    deploy: async (input) => ({ url: `https://${input.subdomain}.${input.baseDomain}` }),
    sentinel,
    auth: authCreate,
    health,
    onSentinelSecret: (_slug, secret) => { capturedSecret = secret; },
  });
  const result = await executePlan(wl1, ports, { dryRun: false });
  check("executePlan: completed", result.status === "completed");
  check("executePlan: all steps ok", result.results.every((r) => r.status === "ok"));
  check("executePlan: sentinel secret captured to sealed-secret hook", capturedSecret === "supersecretvalue1234");
  check("executePlan: sentinel step shows masked secret", result.results.find((r) => r.name === "sentinel_register")?.detail.includes("supe…1234") ?? false);
  check("executePlan: auth step shows realm client", result.results.find((r) => r.name === "auth_wire")?.detail.includes("pm-se") ?? false);
  check("executePlan: healthcheck ok", result.results.find((r) => r.name === "healthcheck")?.status === "ok");

  console.log("");
  if (failures === 0) console.log("ALL PROVISIONING-PORT CHECKS PASSED");
  else { console.error(`${failures} CHECK(S) FAILED`); process.exit(1); }
}
run().catch((e) => { console.error("crashed:", e); process.exit(1); });
