import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
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
    },
  );

  // Self-update: any authenticated user can edit their own profile.
  // For v1 only fullName is mutable here. Email changes require verification
  // (auth-hardening task #7), password changes go through /v1/auth/change-pw,
  // and role is intentionally not mutable from a user-facing endpoint.
  // Returns the same UserPublic shape the auth endpoints emit so the web
  // can splice the response straight into auth-context's user state.
  app.patch(
    '/me',
    { onRequest: [app.authenticate] },
    async (req, reply) => {
      const body = z
        .object({
          fullName: z.string().trim().min(1).max(100).nullable().optional(),
        })
        .parse(req.body);
      const userId = req.user.sub;
      const updated = await prisma.user.update({
        where: { id: userId },
        data: { fullName: body.fullName ?? null },
        select: { id: true, email: true, fullName: true, role: true },
      });
      return reply.send(updated);
    },
  );
};
