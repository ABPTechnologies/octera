import type { FastifyPluginAsync } from 'fastify';
import { UserRole, prisma } from '@octera/db';

export const userRoutes: FastifyPluginAsync = async (app) => {
  // Admin-only: list all users.
  app.get(
    '/',
    { onRequest: [app.requireRole(UserRole.ADMIN)] },
    async () => {
      const users = await prisma.user.findMany({
        select: { id: true, email: true, fullName: true, role: true, createdAt: true },
        orderBy: { createdAt: 'desc' },
        take: 100,
      });
      return { users };
    }
  );
};
