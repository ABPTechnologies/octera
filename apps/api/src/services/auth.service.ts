import argon2 from 'argon2';
import { randomBytes } from 'node:crypto';
import { prisma, UserRole } from '@octera/db';
import type { User } from '@octera/db';
import { env } from '../lib/env.js';
import type { FastifyInstance } from 'fastify';
import { mapRoleFromClaims, type KeycloakClaims } from '../lib/keycloak.js';
import { createCidClient } from '../lib/cid.js';

// ── SignInOnce + CID Global provisioning ─────────────────────────────────────
// Realm role → our UserRole, highest precedence first.
const SIO_ROLE_MAP: ReadonlyArray<readonly [string, UserRole]> = [
  [env.KEYCLOAK_ADMIN_ROLE, UserRole.ADMIN],
  ['octera-broker', UserRole.BROKER],
  ['octera-client', UserRole.CLIENT],
];

const CID_SYNC_INTERVAL_MS = 60 * 60 * 1000; // refresh the CID cache at most hourly

/**
 * Find or create the local User for a verified SIO token. Idempotent — safe on
 * every authenticated request. Transition-aware: an existing LOCAL (password)
 * user with the same email is LINKED (keycloakId set) rather than duplicated.
 */
export async function findOrProvisionUser(claims: KeycloakClaims): Promise<User> {
  const role = mapRoleFromClaims(claims, SIO_ROLE_MAP, UserRole.USER);
  const email = (claims.email ?? `${claims.sub}@no-email.local`).toLowerCase().trim();
  const fullName = claims.name ?? claims.preferred_username ?? null;

  // 1. Already linked by SIO subject → keep role/email in sync with the realm.
  const byKeycloak = await prisma.user.findUnique({ where: { keycloakId: claims.sub } });
  if (byKeycloak) {
    if (byKeycloak.role !== role || byKeycloak.email !== email) {
      return prisma.user.update({ where: { id: byKeycloak.id }, data: { role, email } });
    }
    return byKeycloak;
  }

  // 2. Transition: link an existing local user with the same email.
  const byEmail = await prisma.user.findUnique({ where: { email } });
  if (byEmail) {
    return prisma.user.update({
      where: { id: byEmail.id },
      data: { keycloakId: claims.sub, role },
    });
  }

  // 3. New SIO-native user (no local password).
  return prisma.user.create({
    data: { keycloakId: claims.sub, email, fullName, role, notificationPrefs: { create: {} } },
  });
}

/**
 * Lazily refresh the user's cached CID profile. No-op when CID is unconfigured
 * or synced within the interval. Never throws into the request path — a CID
 * outage must not 500 an otherwise-authenticated call.
 */
export async function syncCidProfile(user: User, accessToken: string): Promise<User> {
  if (!env.CID_API_URL) return user;
  const fresh =
    user.cidSyncedAt && Date.now() - user.cidSyncedAt.getTime() < CID_SYNC_INTERVAL_MS;
  if (fresh) return user;
  try {
    const cid = createCidClient({ baseUrl: env.CID_API_URL });
    const profile = await cid.fetchProfile(accessToken);
    return prisma.user.update({
      where: { id: user.id },
      data: {
        cidId: profile.cidId,
        kycLevel: profile.kycLevel,
        verified: profile.verified,
        cidSyncedAt: new Date(),
      },
    });
  } catch {
    return user;
  }
}

const REFRESH_TOKEN_BYTES = 48;

export class AuthError extends Error {
  constructor(
    public code:
      | 'invalid_credentials'
      | 'email_taken'
      | 'invalid_refresh'
      | 'wrong_current_password',
    message: string,
  ) {
    super(message);
  }
}

function makeRefreshToken() {
  return randomBytes(REFRESH_TOKEN_BYTES).toString('base64url');
}

function refreshExpiry() {
  return new Date(Date.now() + env.REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000);
}

export async function signup(params: {
  email: string;
  password: string;
  fullName?: string;
}) {
  const email = params.email.toLowerCase().trim();
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) throw new AuthError('email_taken', 'An account with that email already exists');

  const passwordHash = await argon2.hash(params.password, { type: argon2.argon2id });
  const user = await prisma.user.create({
    data: {
      email,
      passwordHash,
      fullName: params.fullName,
      role: UserRole.USER,
      notificationPrefs: { create: {} },
    },
  });

  return user;
}

export async function login(params: {
  email: string;
  password: string;
  userAgent?: string;
  ipAddress?: string;
}) {
  const email = params.email.toLowerCase().trim();
  const user = await prisma.user.findUnique({ where: { email } });
  // Always hash-compare even if user is missing, to prevent user enumeration via timing.
  const hashToVerify = user?.passwordHash ?? '$argon2id$v=19$m=65536,t=3,p=4$' + 'a'.repeat(22) + '$' + 'b'.repeat(43);
  const ok = await argon2.verify(hashToVerify, params.password).catch(() => false);
  if (!user || !ok) throw new AuthError('invalid_credentials', 'Invalid email or password');

  const refreshToken = makeRefreshToken();
  await prisma.session.create({
    data: {
      userId: user.id,
      refreshToken,
      userAgent: params.userAgent,
      ipAddress: params.ipAddress,
      expiresAt: refreshExpiry(),
    },
  });

  return { user, refreshToken };
}

export async function rotateRefreshToken(params: {
  refreshToken: string;
  userAgent?: string;
  ipAddress?: string;
}) {
  const session = await prisma.session.findUnique({
    where: { refreshToken: params.refreshToken },
    include: { user: true },
  });

  if (!session || session.revokedAt || session.expiresAt < new Date()) {
    throw new AuthError('invalid_refresh', 'Invalid or expired refresh token');
  }

  // Rotate: revoke old, issue new.
  const newRefresh = makeRefreshToken();
  await prisma.$transaction([
    prisma.session.update({
      where: { id: session.id },
      data: { revokedAt: new Date() },
    }),
    prisma.session.create({
      data: {
        userId: session.userId,
        refreshToken: newRefresh,
        userAgent: params.userAgent,
        ipAddress: params.ipAddress,
        expiresAt: refreshExpiry(),
      },
    }),
  ]);

  return { user: session.user, refreshToken: newRefresh };
}

export async function logout(refreshToken: string) {
  await prisma.session.updateMany({
    where: { refreshToken },
    data: { revokedAt: new Date() },
  });
}

export function signAccessToken(app: FastifyInstance, user: { id: string; email: string; role: UserRole }) {
  return app.jwt.sign({ sub: user.id, email: user.email, role: user.role });
}

/**
 * Change password for the currently authenticated user. Verifies the current
 * password to prevent token-theft → password-reset attacks. On success,
 * revokes all OTHER sessions tied to this user (keeping `keepSessionToken`
 * alive) so a stolen refresh token elsewhere stops working — except the
 * caller's own browser, which keeps its session.
 *
 * Returns void; the caller's existing access token + refresh cookie remain
 * valid since we don't touch the session matching `keepSessionToken`.
 */
export async function changePassword(params: {
  userId: string;
  currentPassword: string;
  newPassword: string;
  /** Refresh token of the session that initiated the change — keep it alive. */
  keepSessionToken?: string;
}): Promise<void> {
  const user = await prisma.user.findUnique({ where: { id: params.userId } });
  if (!user) {
    // Genuinely shouldn't happen — the access token verified before we got
    // here. If it does, treat as auth failure.
    throw new AuthError('invalid_credentials', 'Account not found');
  }
  const ok = await argon2.verify(user.passwordHash, params.currentPassword).catch(() => false);
  if (!ok) {
    throw new AuthError('wrong_current_password', 'Current password is incorrect');
  }
  const passwordHash = await argon2.hash(params.newPassword, { type: argon2.argon2id });
  const now = new Date();
  await prisma.$transaction([
    prisma.user.update({
      where: { id: params.userId },
      data: { passwordHash },
    }),
    // Revoke every other session. The caller's session — identified by its
    // refresh token — is excluded so the user doesn't get bounced out of
    // the page they just submitted the form from.
    prisma.session.updateMany({
      where: {
        userId: params.userId,
        revokedAt: null,
        ...(params.keepSessionToken
          ? { refreshToken: { not: params.keepSessionToken } }
          : {}),
      },
      data: { revokedAt: now },
    }),
  ]);
}
