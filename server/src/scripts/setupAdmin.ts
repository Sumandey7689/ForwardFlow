import { prisma } from '../config/prisma.js';
import { hashPassword } from '../utils/crypto.js';
import { logger } from '../config/logger.js';

async function setupAdmin() {
  const args = process.argv.slice(2);
  const getArg = (key: string): string | undefined => {
    const idx = args.indexOf(`--${key}`);
    return idx !== -1 && args[idx + 1] ? args[idx + 1] : undefined;
  };

  const email = (getArg('email') || process.env.INITIAL_ADMIN_EMAIL || 'admin@forwardflow.io').toLowerCase().trim();
  const password = getArg('password') || process.env.INITIAL_ADMIN_PASSWORD || 'Admin@Secure2026!';
  const name = getArg('name') || process.env.INITIAL_ADMIN_NAME || 'Platform Administrator';

  if (!email || !email.includes('@')) {
    console.error('❌ Error: A valid email address is required.');
    process.exit(1);
  }

  if (password.length < 8) {
    console.error('❌ Error: Admin password must be at least 8 characters long.');
    process.exit(1);
  }

  try {
    const existing = await prisma.admin.findUnique({
      where: { email },
    });

    const hashedPassword = await hashPassword(password);

    if (existing) {
      const updated = await prisma.admin.update({
        where: { id: existing.id },
        data: {
          passwordHash: hashedPassword,
          name,
        },
      });

      console.log('====================================================');
      console.log('✅ Administrator password successfully updated!');
      console.log(`   ID:    ${updated.id}`);
      console.log(`   Email: ${updated.email}`);
      console.log(`   Name:  ${updated.name}`);
      console.log('====================================================');
    } else {
      const created = await prisma.admin.create({
        data: {
          email,
          passwordHash: hashedPassword,
          name,
        },
      });

      console.log('====================================================');
      console.log('✅ Administrator account successfully created!');
      console.log(`   ID:       ${created.id}`);
      console.log(`   Email:    ${created.email}`);
      console.log(`   Name:     ${created.name}`);
      console.log(`   Password: ${password}`);
      console.log('====================================================');
    }

    await prisma.$disconnect();
    process.exit(0);
  } catch (error: any) {
    console.error('❌ Failed to setup administrator:', error.message);
    await prisma.$disconnect();
    process.exit(1);
  }
}

setupAdmin();
