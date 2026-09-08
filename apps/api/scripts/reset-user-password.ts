/**
 * One-off admin password reset.
 *
 * Until the proper /v1/auth/forgot-password flow ships (task #7), this is
 * how to recover access to a user when nobody can log in. Connects directly
 * to whatever DATABASE_URL is set in the environment, so:
 *
 *   - Local dev: read .env and re-export DATABASE_URL inline.
 *   - Production: pull the connection URL from Railway → Postgres service →
 *     "Connect" → "Postgres Connection URL" (the public one), and pass it
 *     inline. Do NOT commit that URL anywhere; it's a credential.
 *
 * Usage (from the repo root):
 *
 *   DATABASE_URL='postgres://...' pnpm --filter @octera/api tsx \
 *     scripts/reset-user-password.ts <email> <new-password>
 *
 * Side effects:
 *   - Hashes the new password with argon2id (same params as the auth service).
 *   - Updates User.passwordHash by email.
 *   - Revokes every existing refresh token for that user, so any stale
 *     sessions on other devices stop working — safer default for the case
 *     where you suspect the old password leaked.
 *
 * If the user doesn't exist, the script aborts with a clear error.
 * If the password is weaker than 12 chars, the script aborts (matches signup
 * policy in apps/api/src/routes/auth.ts).
 */

import argon2 from 'argon2';
import { prisma } from '@octera/db';

async function main() {
  const [email, newPassword] = process.argv.slice(2);

  if (!email || !newPassword) {
    console.error('Usage: tsx scripts/reset-user-password.ts <email> <new-password>');
    process.exit(2);
  }
  if (newPassword.length < 12) {
    console.error(`✗ Password must be at least 12 characters (got ${newPassword.length}).`);
    process.exit(2);
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    console.error(`✗ "${email}" doesn't look like an email address.`);
    process.exit(2);
  }

  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, email: true, role: true, fullName: true },
  });
  if (!user) {
    console.error(`✗ No user with email ${email}.`);
    process.exit(1);
  }

  console.log(`Resetting password for: ${user.email}  (role=${user.role}, id=${user.id})`);

  const passwordHash = await argon2.hash(newPassword, { type: argon2.argon2id });

  // Run hash-update + session-revoke in one transaction so a failure mid-way
  // doesn't leave the user with a new password but stale sessions still alive.
  const result = await prisma.$transaction([
    prisma.user.update({
      where: { id: user.id },
      data: { passwordHash },
    }),
    prisma.session.updateMany({
      where: { userId: user.id, revokedAt: null },
      data: { revokedAt: new Date() },
    }),
  ]);

  const sessionsRevoked = result[1].count;
  console.log(`✓ Password updated.`);
  console.log(`✓ Revoked ${sessionsRevoked} existing session${sessionsRevoked === 1 ? '' : 's'}.`);
  console.log('You can log in now.');
}

main()
  .catch((err) => {
    console.error('✗ Unexpected error:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
