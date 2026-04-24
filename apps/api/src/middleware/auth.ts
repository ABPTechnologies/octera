import type { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify';
import fp from 'fastify-plugin';
import jwt from '@fastify/jwt';
import { env } from '../lib/env.js';
import type { UserRole } from '@octera/db';

/**
 * Access token payload.
 * Refresh tokens are opaque (looked up in DB); access tokens are stateless JWTs.
 */
export interface AccessTokenPayload {
  sub: string; // user id
  email: string;
  role: UserRole;
}

declare module 'fastify' {
  interface FastifyInstance {
    authenticate: (req: FastifyRequest, reply: FastifyReply) => Promise<void>;
    requireRole: (
      ...roles: UserRole[]
    ) => (req: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
  interface FastifyRequest {
    user: AccessTokenPayload;
  }
}

declare module '@fastify/jwt' {
  interface FastifyJWT {
    payload: AccessTokenPayload;
    user: AccessTokenPayload;
  }
}

const plugin: FastifyPluginAsync = async (app) => {
  await app.register(jwt, {
    secret: env.JWT_SECRET,
    sign: { expiresIn: env.ACCESS_TOKEN_TTL },
  });

  app.decorate('authenticate', async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      await req.jwtVerify();
    } catch {
      reply.code(401).send({ error: 'unauthorized', message: 'Invalid or expired token' });
    }
  });

  app.decorate(
    'requireRole',
    (...roles: UserRole[]) =>
      async (req: FastifyRequest, reply: FastifyReply) => {
        try {
          await req.jwtVerify();
        } catch {
          return reply.code(401).send({ error: 'unauthorized', message: 'Invalid or expired token' });
        }
        if (!roles.includes(req.user.role)) {
          return reply.code(403).send({ error: 'forbidden', message: 'Insufficient privileges' });
        }
      }
  );
};

export const authPlugin = fp(plugin, { name: 'auth' });
