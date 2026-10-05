import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Attempt } from '../../attempts/attempt.entity';
import { Organization } from '../../organizations/organization.entity';
import { User } from '../../users/user.entity';
import { PlatformError } from './platform-error';

@Injectable()
export class PlatformUsageService {
  constructor(
    @InjectRepository(Organization) private readonly orgs: Repository<Organization>,
    @InjectRepository(Attempt) private readonly attempts: Repository<Attempt>,
    @InjectRepository(User) private readonly users: Repository<User>,
  ) {}

  async getOrgUsage(orgId: string) {
    const org = await this.orgs.findOne({ where: { id: orgId }, withDeleted: true });
    if (!org) throw new PlatformError(404, 'ORG_NOT_FOUND');

    const raw = await this.attempts
      .createQueryBuilder('a')
      .select('COUNT(*)', 'attemptsTotal')
      .addSelect(`COUNT(*) FILTER (WHERE a."createdAt" >= now() - interval '30 days')`, 'attemptsLast30Days')
      .addSelect('COALESCE(SUM(a."storageBytes"), 0)', 'storageBytes')
      .addSelect(
        `COUNT(DISTINCT a."candidateId") FILTER (WHERE a."createdAt" >= now() - interval '30 days')`,
        'mau',
      )
      .where('a."orgId" = :orgId', { orgId })
      .getRawOne<Record<string, string>>();

    const userCount = await this.users.count({ where: { orgId } });

    return {
      orgId,
      attemptsTotal: Number(raw?.attemptsTotal ?? 0),
      attemptsLast30Days: Number(raw?.attemptsLast30Days ?? 0),
      storageBytes: Number(raw?.storageBytes ?? 0),
      monthlyActiveUsers: Number(raw?.mau ?? 0),
      userCount,
    };
  }
}
