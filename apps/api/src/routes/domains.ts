import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { prisma } from '@octera/db';

export const domainRoutes: FastifyPluginAsync = async (app) => {
  // --- List own domains ---
  app.get('/', { onRequest: [app.authenticate] }, async (req) => {
    const domains = await prisma.domain.findMany({
      where: { userId: req.user.sub },
      orderBy: { createdAt: 'desc' },
    });
    return { domains };
  });

  // --- Domain availability search ---
  //
  // Deliberately returns 501 for v1. gig.tech's VCO API is not a registrar —
  // it manages DNS + top-level domains but doesn't search or buy ICANN
  // domains. The real implementation lands with the GoDaddy integration in
  // v2 (see NEXT_STEPS.md § 3a). Keeping the route shape so the frontend
  // can wire against a real URL now.
  app.get(
    '/search',
    { onRequest: [app.authenticate] },
    async (req, reply) => {
      const _parsed = z
        .object({ q: z.string().min(1).max(253) })
        .parse(req.query); // validate input even though we're not acting on it yet
      void _parsed;
      return reply.code(501).send({
        error: 'not_implemented',
        message:
          'Domain availability search lands with the GoDaddy registrar integration in v2. gig.tech does not expose domain purchase.',
      });
    }
  );

  // --- Register domain ---
  // Enqueues a background job; returns the pending domain record immediately.
  // Worker will call GIG.tech and flip status to ACTIVE on success.
  app.post(
    '/register',
    { onRequest: [app.authenticate] },
    async (req) => {
      const body = z
        .object({
          name: z.string().min(1),
          extension: z.string().min(2),
          years: z.number().int().min(1).max(10).default(1),
        })
        .parse(req.body);

      const fullName = `${body.name}.${body.extension}`.toLowerCase();

      const domain = await prisma.domain.create({
        data: {
          userId: req.user.sub,
          name: body.name,
          extension: body.extension,
          fullName,
          status: 'PENDING',
          registrar: 'GIGTECH',
        },
      });

      // TODO: enqueue registration job
      // await queue.add('domain.register', { domainId: domain.id, years: body.years });

      return { domain };
    }
  );
};
