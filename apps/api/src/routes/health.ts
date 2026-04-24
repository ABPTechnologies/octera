import type { FastifyPluginAsync } from 'fastify';
import { prisma } from '@octera/db';

export const healthRoutes: FastifyPluginAsync = async (app) => {
  // Liveness — is the process up?
  app.get('/live', async () => ({ status: 'ok' }));

  // Readiness — can we serve real traffic? (DB connectivity check)
  app.get('/ready', async (_req, reply) => {
    try {
      await prisma.$queryRaw`SELECT 1`;
      return { status: 'ok' };
    } catch (err) {
      app.log.error({ err }, 'readiness check failed');
      reply.code(503).send({ status: 'degraded', error: 'database_unavailable' });
    }
  });
};
