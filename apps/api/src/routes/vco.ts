/**
 * VCO operator routes.
 *
 * These are admin-only endpoints that expose a cleaned, authenticated view
 * of the underlying gig.tech Virtual Cloud Operator surface for the Octera
 * web app's operator console.
 *
 * Every endpoint here is a proxy over the gig.tech client — the gig.tech
 * JWT stays server-side, and end users talk only to our API with their own
 * Octera auth.
 *
 * Route prefix: /v1/vco (registered in index.ts).
 *
 * Routes require ADMIN role. When we add broker / staff-support tiers
 * later we'll split scope-by-role, but for v1 this is an all-or-nothing
 * operator surface.
 */

import type { FastifyPluginAsync } from 'fastify';
import { UserRole } from '@octera/db';
import { gigtech, isMockMode } from '../integrations/gigtech.js';

export const vcoRoutes: FastifyPluginAsync = async (app) => {
  // Every route here is admin-gated.
  const adminOnly = { onRequest: [app.requireRole(UserRole.ADMIN)] };

  // --- Diagnostic / status -------------------------------------------------

  /**
   * GET /v1/vco/status
   * Reports whether the gig.tech integration is using a real credential or
   * running in mock mode. Useful for the web UI to badge "[MOCK]" on pages.
   */
  app.get('/status', adminOnly, async () => {
    return {
      mode: isMockMode() ? 'mock' : 'live',
      api_base: process.env.GIGTECH_API_BASE ?? 'https://portal.octera.cloud/api/1',
    };
  });

  // --- VCO identity --------------------------------------------------------

  /**
   * GET /v1/vco/me
   * Returns the gig.tech-side identity (VCO operator profile + customer
   * memberships). Distinct from /v1/auth/me which returns the Octera user.
   */
  app.get('/me', adminOnly, async () => {
    return gigtech.getMe();
  });

  // --- Customers (VCO-level) -----------------------------------------------

  /**
   * GET /v1/vco/customers
   * Lists every customer tenant under the VCO.
   */
  app.get('/customers', adminOnly, async (req) => {
    const { limit, search } = req.query as { limit?: string; search?: string };
    const customers = await gigtech.listCustomers({
      limit: limit ? Number.parseInt(limit, 10) : undefined,
      search,
    });
    return { customers };
  });

  /**
   * GET /v1/vco/customers/:customerId
   * Detail view of a single customer tenant.
   */
  app.get<{ Params: { customerId: string } }>(
    '/customers/:customerId',
    adminOnly,
    async (req) => {
      const customer = await gigtech.getCustomer(req.params.customerId);
      return { customer };
    }
  );

  // --- Locations -----------------------------------------------------------

  /**
   * GET /v1/vco/locations
   * Datacenters available for deployment.
   */
  app.get('/locations', adminOnly, async () => {
    const locations = await gigtech.listLocations();
    return { locations };
  });

  // --- Cloudspaces (per customer) ------------------------------------------

  /**
   * GET /v1/vco/customers/:customerId/cloudspaces
   * All VDCs for a customer.
   */
  app.get<{ Params: { customerId: string } }>(
    '/customers/:customerId/cloudspaces',
    adminOnly,
    async (req) => {
      const cloudspaces = await gigtech.listCloudspacesFor(req.params.customerId);
      return { cloudspaces };
    }
  );

  /**
   * GET /v1/vco/customers/:customerId/cloudspaces/:cloudspaceId
   * Single cloudspace detail.
   */
  app.get<{ Params: { customerId: string; cloudspaceId: string } }>(
    '/customers/:customerId/cloudspaces/:cloudspaceId',
    adminOnly,
    async (req) => {
      const cloudspace = await gigtech.getCloudspace(
        req.params.customerId,
        req.params.cloudspaceId
      );
      return { cloudspace };
    }
  );

  // --- SSL / ingress (per customer) ----------------------------------------
  // These unblock the ABP cert renewal use case without SSH access.

  /**
   * GET /v1/vco/customers/:customerId/certificates
   * Customer-level SSL certificate store.
   */
  app.get<{ Params: { customerId: string } }>(
    '/customers/:customerId/certificates',
    adminOnly,
    async (req) => {
      const certificates = await gigtech.listCustomerCertificates(req.params.customerId);
      return { certificates };
    }
  );

  /**
   * GET /v1/vco/customers/:customerId/invoices
   * Invoices for a customer, newest first. Optional ?limit, ?month, ?year,
   * ?search query params passed through to gig.tech.
   */
  app.get<{
    Params: { customerId: string };
    Querystring: { limit?: string; month?: string; year?: string; search?: string };
  }>(
    '/customers/:customerId/invoices',
    adminOnly,
    async (req) => {
      const { limit, month, year, search } = req.query;
      const invoices = await gigtech.listCustomerInvoices(req.params.customerId, {
        limit: limit ? Number.parseInt(limit, 10) : undefined,
        month: month ? Number.parseInt(month, 10) : undefined,
        year: year ? Number.parseInt(year, 10) : undefined,
        search,
      });
      return { invoices };
    }
  );

  /**
   * GET /v1/vco/customers/:customerId/audits
   * Audit log of every API call against this customer's resources.
   * Optional ?limit, ?username, ?status_code filters.
   */
  app.get<{
    Params: { customerId: string };
    Querystring: { limit?: string; username?: string; status_code?: string };
  }>(
    '/customers/:customerId/audits',
    adminOnly,
    async (req) => {
      const { limit, username, status_code } = req.query;
      const audits = await gigtech.listCustomerAudits(req.params.customerId, {
        limit: limit ? Number.parseInt(limit, 10) : undefined,
        username,
        status_code: status_code ? Number.parseInt(status_code, 10) : undefined,
      });
      return { audits };
    }
  );

  /**
   * GET /v1/vco/customers/:customerId/cloudspaces/:cloudspaceId/reverse-proxies
   * Ingress reverse-proxies live per-cloudspace in gig.tech. Each one can
   * have a Let's Encrypt cert that we can renew via the API.
   */
  app.get<{ Params: { customerId: string; cloudspaceId: string } }>(
    '/customers/:customerId/cloudspaces/:cloudspaceId/reverse-proxies',
    adminOnly,
    async (req) => {
      const reverseProxies = await gigtech.listReverseProxies(
        req.params.customerId,
        req.params.cloudspaceId
      );
      return { reverse_proxies: reverseProxies };
    }
  );

  /**
   * POST /v1/vco/customers/:customerId/cloudspaces/:cloudspaceId/reverse-proxies/:reverseProxyId/renew-cert
   * Trigger ACME / Let's Encrypt renewal on a gig.tech-managed reverse proxy.
   * This replaces manual certbot runs on individual VMs.
   */
  app.post<{
    Params: { customerId: string; cloudspaceId: string; reverseProxyId: string };
  }>(
    '/customers/:customerId/cloudspaces/:cloudspaceId/reverse-proxies/:reverseProxyId/renew-cert',
    adminOnly,
    async (req) => {
      const result = await gigtech.renewReverseProxyCert(
        req.params.customerId,
        req.params.cloudspaceId,
        req.params.reverseProxyId
      );
      return { result };
    }
  );
};
