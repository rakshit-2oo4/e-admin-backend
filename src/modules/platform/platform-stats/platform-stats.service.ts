import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Attempt } from '../../attempts/attempt.entity';
import { Organization } from '../../organizations/organization.entity';
import { User } from '../../users/user.entity';
import { PlatformUsageService } from '../common/platform-usage.service';

@Injectable()
export class PlatformStatsService {
  constructor(
    private readonly usage: PlatformUsageService,
    @InjectRepository(Organization) private readonly orgs: Repository<Organization>,
    @InjectRepository(User) private readonly users: Repository<User>,
    @InjectRepository(Attempt) private readonly attempts: Repository<Attempt>,
  ) {}

  async overview() {
    const [totalOrgs, suspendedOrgs, totalUsers, last30, storage, top] = await Promise.all([
      this.orgs.count(),
      this.orgs
        .createQueryBuilder('o')
        .where('o."suspendedAt" IS NOT NULL')
        .getCount(),
      this.users.count(),
      this.attempts
        .createQueryBuilder('a')
        .where(`a."createdAt" >= now() - interval '30 days'`)
        .getCount(),
      this.attempts
        .createQueryBuilder('a')
        .select('COALESCE(SUM(a."storageBytes"), 0)', 'bytes')
        .getRawOne<{ bytes: string }>(),
      this.attempts
        .createQueryBuilder('a')
        .innerJoin(Organization, 'o', 'o.id = a."orgId"')
        .select('o.id', 'orgId')
        .addSelect('o.name', 'name')
        .addSelect('COUNT(*)', 'attemptsLast30Days')
        .where(`a."createdAt" >= now() - interval '30 days'`)
        .groupBy('o.id')
        .addGroupBy('o.name')
        .orderBy('"attemptsLast30Days"', 'DESC')
        .limit(5)
        .getRawMany<{ orgId: string; name: string; attemptsLast30Days: string }>(),
    ]);

    return {
      totalOrgs,
      activeOrgs: totalOrgs - suspendedOrgs,
      suspendedOrgs,
      totalUsers,
      attemptsLast30Days: last30,
      totalStorageBytes: Number(storage?.bytes ?? 0),
      mostActiveOrgs: top.map((t) => ({ orgId: t.orgId, name: t.name, attemptsLast30Days: Number(t.attemptsLast30Days) })),
    };
  }

  orgUsage(id: string) {
    return this.usage.getOrgUsage(id);
  }
}
