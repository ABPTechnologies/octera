/**
 * Customer self-care — the caller's OWN gig.tech data, scoped by the
 * `gigtechCustomerId` on their user (multi-tenant). Each of these proxies the
 * gig.tech client for exactly the customer the signed-in user maps to, so a
 * customer only ever sees their own invoices / SSL / hosting.
 *
 * Returns 409 `no_gigtech_customer` when the user isn't linked yet (the page
 * shows a "not linked — contact us" state).
 *
 * Route prefix: /v1/account (registered in index.ts).
 */
import type { FastifyPluginAsync, FastifyReply } from 'fastify';
import { prisma } from '@octera/db';
import { gigtech } from '../integrations/gigtech.js';

async function resolveCustomerId(userSub: string): Promise<string | null> {
  const u = await prisma.user.findUnique({
    where: { id: userSub },
    select: { gigtechCustomerId: true },
  });
  return u?.gigtechCustomerId ?? null;
}

function notLinked(reply: FastifyReply) {
  return reply.code(409).send({
    error: 'no_gigtech_customer',
    message: 'Your account isn’t linked to a hosting customer yet. Contact us to get set up.',
  });
}

export const accountRoutes: FastifyPluginAsync = async (app) => {
  app.get('/invoices', { onRequest: [app.authenticate] }, async (req, reply) => {
    const cid = await resolveCustomerId(req.user.sub);
    if (!cid) return notLinked(reply);
    const invoices = await gigtech.listCustomerInvoices(cid, { limit: 50 });
    return { invoices };
  });

  app.get('/ssl', { onRequest: [app.authenticate] }, async (req, reply) => {
    const cid = await resolveCustomerId(req.user.sub);
    if (!cid) return notLinked(reply);
    const certificates = await gigtech.listCustomerCertificates(cid);
    return { certificates };
  });

  app.get('/hosting', { onRequest: [app.authenticate] }, async (req, reply) => {
    const cid = await resolveCustomerId(req.user.sub);
    if (!cid) return notLinked(reply);
    const cloudspaces = await gigtech.listCloudspacesFor(cid);
    return { cloudspaces };
  });
};
