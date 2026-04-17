import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { prisma } from '@octera/db';
import { gigtech } from '../integrations/gigtech.js';

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
  // Calls GIG.tech (stubbed until real endpoint is confirmed).
  app.get(
    '/search',
    { onRequest: [app.authenticate] },
    async (req) => {
      const { q } = z.object({ q: z.string().min(1).max(253) }).parse(req.query);
      const results = await gigtech.searchDomains(q);
      return { results };
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
