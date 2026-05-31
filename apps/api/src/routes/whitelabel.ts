/**
 * White Label factory routes.
 *
 * Admin-only. Drive the Perpetual Markets white-label provisioning factory:
 * preview a dry-run plan, or run a provision (mock-first; real provisioning
 * needs gig.tech live mode + dryRun=false).
 *
 * Route prefix: /v1/whitelabels (registered in index.ts).
 */
import type { FastifyPluginAsync } from 'fastify';
import { UserRole } from '@octera/db';
import { planWhiteLabel, provisionWhiteLabel } from '../services/whitelabel/provision.js';

// The gig.tech customer tenant cloudspaces are created under. Configurable via
// env so non-prod tenants can be targeted.
const GIGTECH_CUSTOMER_ID = process.env.GIGTECH_CUSTOMER_ID ?? 'abp_technologies_1';

export const whiteLabelRoutes: FastifyPluginAsync = async (app) => {
  const adminOnly = { onRequest: [app.requireRole(UserRole.ADMIN)] };

  /**
   * GET /v1/whitelabels/:slug/plan
   * Reviewable dry-run provisioning plan (no side effects).
   */
  app.get<{ Params: { slug: string } }>(
    '/:slug/plan',
    adminOnly,
    async (req) => {
      const plan = await planWhiteLabel(req.params.slug, GIGTECH_CUSTOMER_ID);
      return { plan };
    }
  );

  /**
   * POST /v1/whitelabels/:slug/provision
   * Body: { dryRun?: boolean }  — defaults to dryRun=true (mock-first).
   * A real run (dryRun=false) additionally requires gig.tech live mode.
   */
  app.post<{ Params: { slug: string }; Body: { dryRun?: boolean } }>(
    '/:slug/provision',
    adminOnly,
    async (req) => {
      const dryRun = req.body?.dryRun ?? true;
      const result = await provisionWhiteLabel(req.params.slug, {
        dryRun,
        gigtechCustomerId: GIGTECH_CUSTOMER_ID,
      });
      return { result };
    }
  );
};
