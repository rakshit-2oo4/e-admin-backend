import 'dotenv/config';
import dataSource from '../../../database/data-source';
import { PlatformAuditService } from '../common/platform-audit.service';
import { PlatformPasswordService } from '../common/platform-password.service';
import { PlatformRole, PlatformUser } from '../entities/platform-user.entity';

async function main() {
  const email = process.env.PLATFORM_ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.PLATFORM_ADMIN_PASSWORD;
  const name = process.env.PLATFORM_ADMIN_NAME?.trim() || 'Platform Owner';
  if (!email || !password || password.length < 12) {
    throw new Error('Set PLATFORM_ADMIN_EMAIL and PLATFORM_ADMIN_PASSWORD (min 12 chars)');
  }

  await dataSource.initialize();
  try {
    const existing = await dataSource.getRepository(PlatformUser).count({ where: { role: PlatformRole.SUPER_ADMIN } });
    if (existing > 0) {
      console.log('A SUPER_ADMIN already exists. Nothing to do.');
      return;
    }

    const passwordHash = await new PlatformPasswordService().hash(password);
    const audit = new PlatformAuditService();
    await dataSource.transaction(async (m) => {
      const user = await m.save(
        m.create(PlatformUser, { email, name, passwordHash, role: PlatformRole.SUPER_ADMIN, isActive: true }),
      );
      await audit.log(m, {
        platformUserId: null,
        action: 'PLATFORM_USER_CREATED',
        entityType: 'PlatformUser',
        entityId: user.id,
        diff: { after: { email, role: PlatformRole.SUPER_ADMIN }, source: 'seed' },
      });
    });
    console.log(`SUPER_ADMIN created: ${email}`);
  } finally {
    await dataSource.destroy();
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
