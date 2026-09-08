import type { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify';
import fp from 'fastify-plugin';
import jwt from '@fastify/jwt';
import { prisma } from '@octera/db';
import type { User, UserRole } from '@octera/db';
import { env } from '../lib/env.js';
import { verifyKeycloakToken, type KeycloakClaims } from '../lib/keycloak.js';
import { findOrProvisionUser, syncCidProfile } from '../services/auth.service.js';

/**
 * Access token payload. Two token kinds resolve to the SAME `req.user` shape:
 *  - SignInOnce (Keycloak) Bearer — verified against the realm JWKS (preferred
 *    when KEYCLOAK_ISSUER is set); provisions/links the local User + CID cache.
 *  - Legacy local JWT — the transition fallback (opaque DB refresh + HS256 access).
 */
export interface AccessTokenPayload {
  sub: string; // local user id
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
    /** Full local User row when resolved (both paths populate it). */
    authUser?: User;
    /** SIO claims when the caller authenticated via SignInOnce. */
    claims?: KeycloakClaims;
    accessToken?: string;
  }
}

declare module '@fastify/jwt' {
  interface FastifyJWT {
    payload: AccessTokenPayload;
    user: AccessTokenPayload;
  }
}

function bearer(req: FastifyRequest): string | null {
  const h = req.headers.authorization;
  if (!h || !h.startsWith('Bearer ')) return null;
  return h.slice('Bearer '.length).trim();
}

const plugin: FastifyPluginAsync = async (app) => {
  // Keep @fastify/jwt for the legacy local path (signing on /login + the fallback verify).
  await app.register(jwt, {
    secret: env.JWT_SECRET,
    sign: { expiresIn: env.ACCESS_TOKEN_TTL },
  });

  const sioEnabled = env.KEYCLOAK_ISSUER.trim().length > 0;

  /**
   * Resolve the caller. When SIO is enabled, verify a Bearer token against the
   * realm JWKS first (provision/link the local User + CID); on any SIO failure,
   * fall back to the legacy local JWT during the transition. Throws → 401.
   */
  async function resolve(req: FastifyRequest): Promise<void> {
    // Local-only dev bypass (never in production).
    if (env.AUTH_DEV_BYPASS && env.NODE_ENV !== 'production') {
      const devId = req.headers['x-dev-user'];
      const keycloakId = Array.isArray(devId) ? devId[0] : devId;
      if (keycloakId) {
        const user = await findOrProvisionUser({ sub: keycloakId, email: `${keycloakId}@dev.local` });
        req.authUser = user;
        req.user = { sub: user.id, email: user.email, role: user.role };
        return;
      }
    }

    if (sioEnabled) {
      const token = bearer(req);
      if (token) {
        try {
          const claims = await verifyKeycloakToken(token, {
            issuer: env.KEYCLOAK_ISSUER,
            audience: env.KEYCLOAK_AUDIENCE ?? env.KEYCLOAK_CLIENT_ID,
          });
          const user = await syncCidProfile(await findOrProvisionUser(claims), token);
          req.claims = claims;
          req.accessToken = token;
          req.authUser = user;
          req.user = { sub: user.id, email: user.email, role: user.role };
          return;
        } catch {
          // Not a valid SIO token → try the legacy local path below.
        }
      }
    }

    // Legacy local JWT (HS256 against JWT_SECRET). Populates req.user; throws → 401.
    await req.jwtVerify();
    const local = await prisma.user.findUnique({ where: { id: req.user.sub } });
    if (local) req.authUser = local;
  }

  app.decorate('authenticate', async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      await resolve(req);
    } catch {
      reply.code(401).send({ error: 'unauthorized', message: 'Invalid or expired token' });
    }
  });

  app.decorate(
    'requireRole',
    (...roles: UserRole[]) =>
      async (req: FastifyRequest, reply: FastifyReply) => {
        try {
          await resolve(req);
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
