/**
 * Partner handoff routes — inbound provisioning requests from sibling estate
 * apps (currently UTIT).
 *
 * Route prefix: /api/handoff (registered in index.ts). The full public path
 * `/api/handoff/utit-provision-vps` is what UTIT signs, so the HMAC check below
 * reconstructs the digest over that exact literal regardless of the Fastify
 * prefix.
 *
 * POST /api/handoff/utit-provision-vps
 *   Called by UTIT's octeraProvision() when a customer buys a Perpetual Markets
 *   VPS tier (pm-vps-3/8/15/32). We provision a gig.tech cloudspace (the same
 *   primitive the white-label factory uses) and ACK with the cloudspace id +
 *   `provisioning` status. The BotTrader container deploy onto that cloudspace
 *   is the shared Phase-4 compute step (see services/whitelabel/provision.ts
 *   `deploy` port); when that lands it calls UTIT back at
 *   /api/webhooks/octera/active with the proxyIp + wwwHost (see
 *   notifyUtitVpsActive below).
 *
 * Auth: HMAC-SHA256 over `POST\n/api/handoff/utit-provision-vps\n<ISO-ts>` in
 * header `x-utit-signature: sha256=<hex>` + `x-utit-timestamp`, ±5min skew.
 * Secret: OCTERA_HANDOFF_SECRET. Returns 503 when the secret is unset (handoff
 * disabled), 401 on bad signature, 400 on bad input, 201 on success.
 */
import type { FastifyPluginAsync } from 'fastify';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { z } from 'zod';
import { gigtech } from '../integrations/gigtech.js';

const PROVISION_PATH = '/api/handoff/utit-provision-vps';
const SKEW_MS = 5 * 60 * 1000;
const GIGTECH_CUSTOMER_ID = process.env.GIGTECH_CUSTOMER_ID ?? 'abp_technologies_1';
const DEFAULT_REGION = process.env.GIGTECH_DEFAULT_REGION ?? 'be-mac-dc01-002';

const ProvisionInput = z.object({
  subscriptionId: z.string().min(1),
  vpsServiceId: z.string().min(1),
  signinonceSub: z.string().min(1),
  productName: z.string().min(1),
  orderNumber: z.string().min(1),
  quantity: z.number().int().positive(),
  skuName: z.string().min(1),
  botSlotsLimit: z.number().int().positive(),
  region: z.string().nullable().optional(),
  exchangeJurisdiction: z.string().nullable().optional(),
  preInstall: z.string().nullable().optional(),
});

/** Verify UTIT's HMAC over METHOD\nPATH\nTIMESTAMP (body not covered). */
function verifyUtit(sig: string | undefined, ts: string | undefined, secret: string): boolean {
  if (!sig || !ts) return false;
  const tsMs = Date.parse(ts);
  if (!Number.isFinite(tsMs) || Math.abs(Date.now() - tsMs) > SKEW_MS) return false;
  const expected =
    'sha256=' + createHmac('sha256', secret).update(`POST\n${PROVISION_PATH}\n${ts}`).digest('hex');
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

const PUXEO_PROVISION_PATH = '/api/handoff/puxeo-provision-vm';

const PuxeoProvisionInput = z.object({
  organizationEmail: z.string().min(3),
  spec: z.object({
    slug: z.string().min(1),
    domain: z.string().min(3),
    backofficeHost: z.string().min(3),
    brand: z.object({
      name: z.string().min(1),
      primary: z.string().optional(),
      logoUrl: z.string().optional(),
      faviconUrl: z.string().optional(),
    }),
    adminEmail: z.string().min(3),
    oidc: z.object({
      issuer: z.string(),
      clientId: z.string(),
      clientSecret: z.string().optional(),
    }),
    addDns: z.boolean().optional(),
  }),
  callbackUrl: z.string().optional(),
  seedExportUrl: z.string().optional(),
  size: z
    .object({
      vcpus: z.number().int().positive().optional(),
      memory: z.number().int().positive().optional(),
      disk: z.number().int().positive().optional(),
    })
    .optional(),
});

/** Verify Puxeo's HMAC over METHOD\nPATH\nTIMESTAMP (body not covered). */
function verifyPuxeo(sig: string | undefined, ts: string | undefined, secret: string): boolean {
  if (!sig || !ts) return false;
  const tsMs = Date.parse(ts);
  if (!Number.isFinite(tsMs) || Math.abs(Date.now() - tsMs) > SKEW_MS) return false;
  const expected =
    'sha256=' + createHmac('sha256', secret).update(`POST\n${PUXEO_PROVISION_PATH}\n${ts}`).digest('hex');
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export const handoffRoutes: FastifyPluginAsync = async (app) => {
  app.post('/utit-provision-vps', async (req, reply) => {
    const secret = process.env.OCTERA_HANDOFF_SECRET;
    if (!secret) {
      return reply.code(503).send({
        ok: false,
        error: 'octera handoff disabled (OCTERA_HANDOFF_SECRET unset)',
      });
    }

    const sig = req.headers['x-utit-signature'] as string | undefined;
    const ts = req.headers['x-utit-timestamp'] as string | undefined;
    if (!verifyUtit(sig, ts, secret)) {
      return reply.code(401).send({ ok: false, error: 'bad signature' });
    }

    const parsed = ProvisionInput.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({ ok: false, error: parsed.error.message });
    }
    const input = parsed.data;

    // Provision the cloudspace. Idempotency key ties retries to the same VPS.
    // botSlotsLimit maps onto the cloudspace sizing hint (Octera resolves the
    // concrete flavour); region falls back to the operator default.
    const cs = await gigtech.createCloudspace(
      GIGTECH_CUSTOMER_ID,
      {
        name: `pmvps-${input.vpsServiceId}`,
        location: input.region ?? DEFAULT_REGION,
        cloudspaceMode: `bots-${input.botSlotsLimit}`,
      },
      `utit-vps:${input.vpsServiceId}`,
    );

    req.log.info(
      { vpsServiceId: input.vpsServiceId, cloudspaceId: cs.cloudspace_id, status: cs.status },
      'handoff.utit-provision-vps.cloudspace_created',
    );

    // Auto-deploy the branded BotTrader stack onto the cloudspace via the
    // Octera Cloud Launch API (createVm + Docker + compose + Caddy). The Launch
    // route returns 202 immediately and provisions in the background; on
    // success it calls UTIT's /api/webhooks/octera/active (via activeCallback)
    // to flip the VpsService to `active` with the proxyIp + wwwHost. We
    // fire-and-forget so the checkout webhook ACKs fast.
    const launchUrl = process.env.WHITELABEL_LAUNCH_URL;
    const launchToken = process.env.WHITELABEL_LAUNCH_SERVICE_TOKEN;
    const utitWebhook = process.env.UTIT_WEBHOOK_URL;
    const webhookSecret = process.env.OCTERA_WEBHOOK_SECRET;
    const baseDomain = process.env.PERPETUAL_MARKETS_BASE_DOMAIN ?? 'perpetualmarkets.com';
    const vpsDomain = `pm-${input.vpsServiceId.replace(/[^a-zA-Z0-9]/g, '').slice(0, 16).toLowerCase()}.${baseDomain}`;

    if (launchUrl && launchToken) {
      void (async () => {
        try {
          const res = await fetch(new URL('/api/provision/bottrader-clone', launchUrl), {
            method: 'POST',
            headers: { 'content-type': 'application/json', authorization: `Bearer ${launchToken}` },
            body: JSON.stringify({
              cloudspaceId: cs.cloudspace_id,
              domain: vpsDomain,
              vmName: `pmvps-${input.vpsServiceId.slice(0, 16)}`,
              customerId: GIGTECH_CUSTOMER_ID,
              brand: { slug: 'perpetual_markets', name: 'Perpetual Markets' },
              sultHandoffSecret: process.env.SULT_HANDOFF_SECRET,
              cycloneBaseUrl: process.env.CYCLONE_BASE_URL,
              addDns: true,
              activeCallback:
                utitWebhook && webhookSecret
                  ? { url: utitWebhook, secret: webhookSecret, vpsServiceId: input.vpsServiceId }
                  : undefined,
            }),
          });
          req.log.info(
            { vpsServiceId: input.vpsServiceId, launch: res.status },
            'handoff.utit-provision-vps.launch_kicked',
          );
        } catch (err) {
          req.log.error({ err, vpsServiceId: input.vpsServiceId }, 'handoff.utit-provision-vps.launch_failed');
        }
      })();
    }

    // proxyIp may already be assigned; wwwHost + the flip to `active` arrive on
    // the Launch action's active-callback once the box is live.
    return reply.code(201).send({
      externalId: cs.cloudspace_id,
      externalStatus: 'provisioning',
      proxyIp: cs.external_network_ip ?? null,
      wwwHost: vpsDomain,
    });
  });

  // ── Puxeo: upgrade a shared SaaS tenant to a dedicated VM ──────────────────
  app.post('/puxeo-provision-vm', async (req, reply) => {
    const secret = process.env.OCTERA_HANDOFF_SECRET;
    if (!secret) {
      return reply.code(503).send({ ok: false, error: 'octera handoff disabled (OCTERA_HANDOFF_SECRET unset)' });
    }
    const sig = req.headers['x-puxeo-signature'] as string | undefined;
    const ts = req.headers['x-puxeo-timestamp'] as string | undefined;
    if (!verifyPuxeo(sig, ts, secret)) {
      return reply.code(401).send({ ok: false, error: 'bad signature' });
    }
    const parsed = PuxeoProvisionInput.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({ ok: false, error: parsed.error.message });
    }
    const input = parsed.data;
    const spec = input.spec;

    // Provision the cloudspace (same primitive as the white-label factory).
    // Idempotency ties retries to the tenant.
    const cs = await gigtech.createCloudspace(
      GIGTECH_CUSTOMER_ID,
      { name: `puxeo-${spec.slug}`.slice(0, 24), location: DEFAULT_REGION },
      `puxeo-vm:${input.organizationEmail}`,
    );
    req.log.info(
      { org: input.organizationEmail, cloudspaceId: cs.cloudspace_id, status: cs.status },
      'handoff.puxeo-provision-vm.cloudspace_created',
    );

    // Fire the Launch puxeo-clone (createVm + puxeo+postgres+caddy). seedExportUrl
    // + activeCallback are forwarded for the data migration + status callback
    // (consumed once the Launch route wires them — G4). Fire-and-forget.
    const launchUrl = process.env.WHITELABEL_LAUNCH_URL;
    const launchToken = process.env.WHITELABEL_LAUNCH_SERVICE_TOKEN;
    const webhookSecret = process.env.OCTERA_WEBHOOK_SECRET;
    if (launchUrl && launchToken) {
      void (async () => {
        try {
          const res = await fetch(new URL('/api/provision/puxeo-clone', launchUrl), {
            method: 'POST',
            headers: { 'content-type': 'application/json', authorization: `Bearer ${launchToken}` },
            body: JSON.stringify({
              cloudspaceId: cs.cloudspace_id,
              customerId: GIGTECH_CUSTOMER_ID,
              domain: spec.backofficeHost,
              vmName: `${spec.slug}-puxeo`,
              brand: spec.brand,
              oidc: spec.oidc,
              adminEmail: spec.adminEmail,
              vcpus: input.size?.vcpus,
              memory: input.size?.memory,
              disk: input.size?.disk,
              addDns: spec.addDns ?? true,
              seedExportUrl: input.seedExportUrl,
              activeCallback:
                input.callbackUrl && webhookSecret
                  ? { url: input.callbackUrl, secret: webhookSecret, organizationEmail: input.organizationEmail }
                  : undefined,
            }),
          });
          req.log.info({ org: input.organizationEmail, launch: res.status }, 'handoff.puxeo-provision-vm.launch_kicked');
        } catch (err) {
          req.log.error({ err, org: input.organizationEmail }, 'handoff.puxeo-provision-vm.launch_failed');
        }
      })();
    }

    return reply.code(201).send({
      ok: true,
      cloudspaceId: cs.cloudspace_id,
      status: 'provisioning',
      proxyIp: cs.external_network_ip ?? null,
      host: spec.backofficeHost,
    });
  });
};

/**
 * Call UTIT back when a VPS finishes bootstrapping. Invoke this from the
 * BotTrader compute-deploy completion (Phase 4) once the container is live,
 * the static proxy IP is assigned, and the Gatsby viewer host is reachable.
 * Mirrors UTIT's inbound webhook contract (src/app/api/webhooks/octera/active).
 * Fail-soft: returns false rather than throwing.
 */
export async function notifyUtitVpsActive(payload: {
  vpsServiceId: string;
  externalProviderRef: string;
  proxyIp?: string;
  wwwHost?: string;
  containerNumber?: number;
}): Promise<boolean> {
  const base = process.env.UTIT_WEBHOOK_URL;
  const secret = process.env.OCTERA_WEBHOOK_SECRET;
  if (!base || !secret) return false;
  const path = '/api/webhooks/octera/active';
  const ts = new Date().toISOString();
  const sig = 'sha256=' + createHmac('sha256', secret).update(`POST\n${path}\n${ts}`).digest('hex');
  try {
    const res = await fetch(new URL(path, base), {
      method: 'POST',
      headers: {
        'x-octera-signature': sig,
        'x-octera-timestamp': ts,
        'content-type': 'application/json',
      },
      body: JSON.stringify(payload),
    });
    return res.ok;
  } catch {
    return false;
  }
}
