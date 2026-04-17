import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { env } from '../lib/env.js';
import { AuthError, login, logout, rotateRefreshToken, signAccessToken, signup } from '../services/auth.service.js';
import { prisma } from '@octera/db';

const REFRESH_COOKIE = 'octera_rt';

const cookieOpts = {
  httpOnly: true,
  secure: env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  path: '/v1/auth',
  domain: env.COOKIE_DOMAIN,
  maxAge: env.REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60,
};

export const authRoutes: FastifyPluginAsync = async (app) => {
  // --- Signup ---
  app.post('/signup', async (req, reply) => {
    const body = z
      .object({
        email: z.string().email(),
        password: z.string().min(12, 'Password must be at least 12 characters'),
        fullName: z.string().min(1).optional(),
      })
      .parse(req.body);

    try {
      const user = await signup(body);
      const { refreshToken } = await login({
        email: user.email,
        password: body.password,
        userAgent: req.headers['user-agent'],
        ipAddress: req.ip,
      });
      const accessToken = signAccessToken(app, user);

      reply.setCookie(REFRESH_COOKIE, refreshToken, cookieOpts);
      return { accessToken, user: { id: user.id, email: user.email, role: user.role, fullName: user.fullName } };
    } catch (err) {
      if (err instanceof AuthError && err.code === 'email_taken') {
        return reply.code(409).send({ error: err.code, message: err.message });
      }
      throw err;
    }
  });

  // --- Login ---
  app.post('/login', async (req, reply) => {
    const body = z
      .object({ email: z.string().email(), password: z.string().min(1) })
      .parse(req.body);

    try {
      const { user, refreshToken } = await login({
        ...body,
        userAgent: req.headers['user-agent'],
        ipAddress: req.ip,
      });
      const accessToken = signAccessToken(app, user);
      reply.setCookie(REFRESH_COOKIE, refreshToken, cookieOpts);
      return { accessToken, user: { id: user.id, email: user.email, role: user.role, fullName: user.fullName } };
    } catch (err) {
      if (err instanceof AuthError && err.code === 'invalid_credentials') {
        return reply.code(401).send({ error: err.code, message: err.message });
      }
      throw err;
    }
  });

  // --- Refresh ---
  app.post('/refresh', async (req, reply) => {
    const token = req.cookies[REFRESH_COOKIE];
    if (!token) return reply.code(401).send({ error: 'no_refresh_token', message: 'No refresh token' });

    try {
      const { user, refreshToken } = await rotateRefreshToken({
        refreshToken: token,
        userAgent: req.headers['user-agent'],
        ipAddress: req.ip,
      });
      const accessToken = signAccessToken(app, user);
      reply.setCookie(REFRESH_COOKIE, refreshToken, cookieOpts);
      return { accessToken, user: { id: user.id, email: user.email, role: user.role, fullName: user.fullName } };
    } catch (err) {
      if (err instanceof AuthError) {
        reply.clearCookie(REFRESH_COOKIE, { path: '/v1/auth' });
        return reply.code(401).send({ error: err.code, message: err.message });
      }
      throw err;
    }
  });

  // --- Logout ---
  app.post('/logout', async (req, reply) => {
    const token = req.cookies[REFRESH_COOKIE];
    if (token) await logout(token);
    reply.clearCookie(REFRESH_COOKIE, { path: '/v1/auth' });
    return { ok: true };
  });

  // --- Me ---
  app.get('/me', { onRequest: [app.authenticate] }, async (req) => {
    const user = await prisma.user.findUnique({
      where: { id: req.user.sub },
      select: { id: true, email: true, fullName: true, role: true, permissions: true, createdAt: true },
    });
    return { user };
  });
};
