/**
 * Gate-3 smoke test for the White Label provisioning factory core.
 *
 * Pure + offline (no Prisma, no gig.tech, no network). Verifies the dry-run
 * plan and the mock execution for WL #1 (pm-se), and prints the reviewable
 * provisioning plan.
 *
 * Run (uses any local tsx):  tsx apps/api/scripts/validate-provision.ts
 */
import {
  STEP_ORDER,
  buildProvisioningPlan,
  executePlan,
  makeMockPorts,
  type WlProvisionInput,
} from "../src/services/whitelabel/provision-plan";

let failures = 0;
function check(name: string, cond: boolean, detail = "") {
  if (!cond) failures++;
  console.log(`${cond ? "PASS" : "FAIL"}  ${name}${detail ? `  — ${detail}` : ""}`);
}

// WL #1 — Perpetual Markets Sweden (SCM), from white-labels.seed.json.
const wl1: WlProvisionInput = {
  slug: "pm-se",
  seq: 1,
  displayName: "Perpetual Markets Sweden",
  jurisdiction: "SE",
  adapterFamily: "CTRADER_FIX",
  brokerName: "Scandinavian Capital Markets",
  profile: "BROKER",
  gigtechCustomerId: "abp_technologies_1",
  vcsRegion: "be-mac-dc01-002",
  vcsSize: "standard",
  subdomain: "se",
  baseDomain: "perpetualmarkets.com",
  pluginSet: ["bottrader", "copier-sentinel", "nexiswift"],
  copierSentinelSlug: "pm-se",
  copierBaseUrl: "https://copier.yina.be",
  sioRealmClientId: "pm-se",
  riskRoutingPolicy: { mode: "default" },
  originAccountExternalId: "gerry-dekens-trading",
};

async function run() {
  // 1. Plan shape
  const plan = buildProvisioningPlan(wl1, { dryRun: true });
  check("plan has 6 steps", plan.steps.length === 6, `${plan.steps.length}`);
  check("plan steps in canonical order",
    plan.steps.map((s) => s.name).join(",") === STEP_ORDER.join(","));
  check("every step has an idempotency key",
    plan.steps.every((s) => s.idempotencyKey.length > 0));
  check("cloudspace key is cs:pm-se",
    plan.steps[0]?.idempotencyKey === "cs:pm-se");

  // 2. Dry-run execution — nothing happens, all steps 'planned'
  const dry = await executePlan(wl1, makeMockPorts(), { dryRun: true });
  check("dry-run status = planned", dry.status === "planned");
  check("dry-run: all steps planned", dry.results.every((r) => r.status === "planned"));

  // 3. Mock real execution — all steps ok, completed
  const ports = makeMockPorts();
  const real = await executePlan(wl1, ports, { dryRun: false });
  check("mock-real status = completed", real.status === "completed");
  check("mock-real: all steps ok", real.results.every((r) => r.status === "ok"));
  check("cloudspace provisioned as cs_pm-se",
    real.results.find((r) => r.name === "cloudspace")?.detail.includes("cs_pm-se") ?? false);
  check("sentinel secret masked in trail",
    real.results.find((r) => r.name === "sentinel_register")?.detail.includes("abcd…wxyz") ?? false);
  check("risk layer attached (no ownership row)",
    real.results.find((r) => r.name === "risk_layer_attach")?.detail.includes("mode") ?? false);

  // 4. Idempotency — re-running with the same ports yields the same cloudspace id
  const real2 = await executePlan(wl1, ports, { dryRun: false });
  const id1 = real.results.find((r) => r.name === "cloudspace")?.detail;
  const id2 = real2.results.find((r) => r.name === "cloudspace")?.detail;
  check("cloudspace creation idempotent across reruns", id1 === id2, `${id1} == ${id2}`);

  // --- Gate-3 artifact: the reviewable dry-run plan for WL #1 ---
  console.log("\n================ WL #1 (pm-se) — DRY-RUN PROVISIONING PLAN ================");
  for (const [i, s] of plan.steps.entries()) {
    console.log(`  ${i + 1}. [${s.name}]  (key ${s.idempotencyKey})\n     ${s.description}`);
  }
  console.log("==========================================================================\n");

  if (failures === 0) console.log("ALL PROVISIONING SMOKE CHECKS PASSED");
  else {
    console.error(`${failures} CHECK(S) FAILED`);
    process.exit(1);
  }
}

run().catch((e) => {
  console.error("smoke test crashed:", e);
  process.exit(1);
});
