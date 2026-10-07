import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { PlatformError } from '../common/platform-error';
import { PlatformAuditLog } from '../entities/platform-audit-log.entity';
import { PlatformUser } from '../entities/platform-user.entity';
import { AuditQueryDto } from './dto/audit-query.dto';

@Injectable()
export class PlatformAuditReadService {
  constructor(@InjectRepository(PlatformAuditLog) private readonly logs: Repository<PlatformAuditLog>) { }

  private decode(cursor: string): { c: string; i: string } {
    try {
      const v = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8'));
      if (typeof v.c !== 'string' || typeof v.i !== 'string' || Number.isNaN(Date.parse(v.c))) throw new Error();
      return v;
    } catch {
      throw new PlatformError(400, 'VALIDATION_ERROR', 'Invalid cursor');
    }
  }

  async list(q: AuditQueryDto) {
    const qb = this.logs.createQueryBuilder('a');
    if (q.action) qb.andWhere('a.action = :action', { action: q.action });
    if (q.entityType) qb.andWhere('a."entityType" = :et', { et: q.entityType });
    if (q.platformUserId) qb.andWhere('a."platformUserId" = :pu', { pu: q.platformUserId });
    if (q.from) qb.andWhere('a."createdAt" >= :from', { from: q.from });
    if (q.to) qb.andWhere('a."createdAt" <= :to', { to: q.to });
    if (q.cursor) {
      const { c, i } = this.decode(q.cursor);
      qb.andWhere('(a."createdAt", a.id) < (:c::timestamptz, :i::uuid)', { c, i });
    }

    const rows = await qb.orderBy('a."createdAt"', 'DESC').addOrderBy('a.id', 'DESC').limit(q.limit + 1).getMany();
    const hasMore = rows.length > q.limit;
    const items = hasMore ? rows.slice(0, q.limit) : rows;
    const last = items[items.length - 1];
    const nextCursor =
      hasMore && last
        ? Buffer.from(JSON.stringify({ c: last.createdAt.toISOString(), i: last.id })).toString('base64url')
        : null;

    const userIds = [...new Set(items.map((r) => r.platformUserId).filter((id): id is string => Boolean(id)))];
    let userMap = new Map<string, { id: string; name: string; email: string }>();
    if (userIds.length > 0) {
      const users = await this.logs.manager.getRepository(PlatformUser).find({
        where: { id: In(userIds) },
        select: { id: true, name: true, email: true },
      });
      userMap = new Map(users.map((u) => [u.id, { id: u.id, name: u.name, email: u.email }]));
    }

    const enriched = items.map((r) => ({
      ...r,
      actor: r.platformUserId ? userMap.get(r.platformUserId) ?? null : null,
    }));

    return { items: enriched, nextCursor, limit: q.limit };
  }
}
