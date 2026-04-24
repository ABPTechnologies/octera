import { prisma, UserRole } from '../src/index.js';
import argon2 from 'argon2';

async function main() {
  const adminEmail = 'info@crowconsulting.be';
  const tempPassword = process.env.SEED_ADMIN_PASSWORD ?? 'ChangeMe-Immediately-123!';

  const passwordHash = await argon2.hash(tempPassword, { type: argon2.argon2id });

  await prisma.user.upsert({
    where: { email: adminEmail },
    update: {},
    create: {
      email: adminEmail,
      passwordHash,
      fullName: 'Octera Admin',
      role: UserRole.ADMIN,
      notificationPrefs: { create: {} },
    },
  });

  // eslint-disable-next-line no-console
  console.log(`✅ Seeded admin user: ${adminEmail}`);
  // eslint-disable-next-line no-console
  console.log(`   Temporary password: ${tempPassword}`);
  // eslint-disable-next-line no-console
  console.log(`   ⚠️  CHANGE THIS IMMEDIATELY after first login.`);
}

main()
  .catch((e) => {
    // eslint-disable-next-line no-console
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
