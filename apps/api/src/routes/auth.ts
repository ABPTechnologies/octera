import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { env } from '../lib/env.js';
import { AuthError, changePassword, login, logout, rotateRefreshToken, signAccessToken, signup } from '../services/auth.service.js';
import { prisma } from '@octera/db';

const REFRESH_COOKIE = 'octera_rt';

// In production the web app and API live on different origins (api.octera.net
// vs octera.net, or different *.up.railway.app subdomains), so the refresh
// cookie has to be SameSite=None to be set on cross-site POST responses —
// which in turn requires Secure. In dev everything is on localhost and Lax
// is fine (and Secure=true would block the cookie over plain http).
const cookieOpts = {
  httpOnly: true,
  secure: env.NODE_ENV === 'production',
  sameSite: env.NODE_ENV === 'production' ? ('none' as const) : ('lax' as const),
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

  // --- Change password ---
  // Authenticated user changes their own password. Verifies current password
  // to defend against access-token theft (a stolen access token alone can't
  // pivot to a permanent password change). Revokes every OTHER session
  // belonging to the user; this browser's session stays alive so the user
  // doesn't get bounced out mid-flow.
  app.post('/change-password', { onRequest: [app.authenticate] }, async (req, reply) => {
    const body = z
      .object({
        currentPassword: z.string().min(1),
        // 12 chars to match signup's policy. Tightening these later is
        // additive — `min(12)` here means existing users with weaker (legacy
        // import) passwords can still log in, but can't keep them.
        newPassword: z.string().min(12, 'New password must be at least 12 characters'),
      })
      .parse(req.body);
    if (body.currentPassword === body.newPassword) {
      return reply
        .code(400)
        .send({ error: 'same_password', message: 'New password must differ from current password' });
    }
    try {
      await changePassword({
        userId: req.user.sub,
        currentPassword: body.currentPassword,
        newPassword: body.newPassword,
        keepSessionToken: req.cookies[REFRESH_COOKIE],
      });
      return { ok: true };
    } catch (err) {
      if (err instanceof AuthError && err.code === 'wrong_current_password') {
        return reply.code(403).send({ error: err.code, message: err.message });
      }
      throw err;
    }
  });
};
