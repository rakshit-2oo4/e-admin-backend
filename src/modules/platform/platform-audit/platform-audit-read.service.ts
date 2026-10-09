import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, IsNull, Repository } from 'typeorm';
import { PlatformError } from '../common/platform-error';
import { PlatformAuditLog } from '../entities/platform-audit-log.entity';
import { PlatformUser } from '../entities/platform-user.entity';
import { toCsvString } from '../common/csv.util';
import { AuditQueryDto } from './dto/audit-query.dto';
import { ExportAuditQueryDto } from './dto/export-audit-query.dto';

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
    if (q.action && q.action !== 'All') qb.andWhere('a.action = :action', { action: q.action });
    if (q.entityType) qb.andWhere('a."entityType" = :et', { et: q.entityType });
    if (q.platformUserId) qb.andWhere('a."platformUserId" = :pu', { pu: q.platformUserId });
    if (q.from) qb.andWhere('a."createdAt" >= :from', { from: q.from });
    if (q.to) qb.andWhere('a."createdAt" <= :to', { to: q.to });
    if (q.date) qb.andWhere('a."createdAt"::date = :targetDate::date', { targetDate: q.date });

    if (q.outcome && q.outcome !== 'All') {
      if (q.outcome.toUpperCase() === 'FAILURE') {
        qb.andWhere('(LOWER(a.action) LIKE :f1 OR LOWER(a.action) LIKE :f2 OR LOWER(a.action) LIKE :f3)', {
          f1: '%fail%',
          f2: '%bad%',
          f3: '%denied%',
        });
      } else if (q.outcome.toUpperCase() === 'SUCCESS') {
        qb.andWhere('(LOWER(a.action) NOT LIKE :f1 AND LOWER(a.action) NOT LIKE :f2 AND LOWER(a.action) NOT LIKE :f3)', {
          f1: '%fail%',
          f2: '%bad%',
          f3: '%denied%',
        });
      }
    }

    if (q.actor && q.actor !== 'All') {
      if (q.actor.toLowerCase() === 'system') {
        qb.andWhere('a."platformUserId" IS NULL');
      } else {
        const users = await this.logs.manager.getRepository(PlatformUser).find({
          where: [{ name: q.actor }, { email: q.actor }],
          select: { id: true },
        });
        const uids = users.map((u) => u.id);
        if (uids.length > 0) {
          qb.andWhere('a."platformUserId" IN (:...uids)', { uids });
        } else {
          qb.andWhere('1 = 0');
        }
      }
    }

    if (q.search) {
      const s = `%${q.search.replace(/[%_]/g, '\\$&')}%`;
      const users = await this.logs.manager.getRepository(PlatformUser).createQueryBuilder('u')
        .where('u.name ILIKE :s OR u.email ILIKE :s', { s })
        .select('u.id', 'id')
        .getRawMany();
      const uids = users.map((u) => u.id);

      if (uids.length > 0) {
        qb.andWhere(
          '(a.action ILIKE :s OR a."entityType" ILIKE :s OR a."entityId" ILIKE :s OR a.ip ILIKE :s OR a.diff::text ILIKE :s OR a."platformUserId" IN (:...uids))',
          { s, uids },
        );
      } else {
        qb.andWhere(
          '(a.action ILIKE :s OR a."entityType" ILIKE :s OR a."entityId" ILIKE :s OR a.ip ILIKE :s OR a.diff::text ILIKE :s)',
          { s },
        );
      }
    }

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

  async getFilterOptions() {
    const rawActions = await this.logs
      .createQueryBuilder('a')
      .select('DISTINCT a.action', 'action')
      .orderBy('a.action', 'ASC')
      .getRawMany();

    const rawDates = await this.logs
      .createQueryBuilder('a')
      .select('DISTINCT a."createdAt"::date', 'date')
      .orderBy('date', 'DESC')
      .limit(30)
      .getRawMany();

    const users = await this.logs.manager.getRepository(PlatformUser).find({
      select: { id: true, name: true, email: true },
      order: { name: 'ASC' },
    });

    const hasSystemLogs = await this.logs.findOne({ where: { platformUserId: IsNull() } });

    const actors = [
      ...(hasSystemLogs ? ['System'] : []),
      ...users.map((u) => u.name || u.email).filter(Boolean),
    ];

    return {
      actions: ['All', ...rawActions.map((r) => r.action).filter(Boolean)],
      dates: ['', ...rawDates.map((r) => {
        if (!r.date) return '';
        const d = new Date(r.date);
        return !isNaN(d.getTime()) ? d.toISOString().split('T')[0] : String(r.date);
      }).filter(Boolean)],
      actors: ['All', ...actors],
    };
  }

  async exportCsv(q: ExportAuditQueryDto): Promise<{ filename: string; csv: string }> {
    const qb = this.logs.createQueryBuilder('a');

    if (q.action && q.action !== 'All') {
      qb.andWhere('a.action = :action', { action: q.action });
    }
    if (q.entityType) {
      qb.andWhere('a."entityType" = :et', { et: q.entityType });
    }
    if (q.from) {
      qb.andWhere('a."createdAt" >= :from', { from: q.from });
    }
    if (q.to) {
      qb.andWhere('a."createdAt" <= :to', { to: q.to });
    }
    if (q.date) {
      qb.andWhere('a."createdAt"::date = :targetDate::date', { targetDate: q.date });
    }

    if (q.outcome && q.outcome !== 'All') {
      if (q.outcome.toUpperCase() === 'FAILURE') {
        qb.andWhere('(LOWER(a.action) LIKE :f1 OR LOWER(a.action) LIKE :f2 OR LOWER(a.action) LIKE :f3)', {
          f1: '%fail%',
          f2: '%bad%',
          f3: '%denied%',
        });
      } else if (q.outcome.toUpperCase() === 'SUCCESS') {
        qb.andWhere('(LOWER(a.action) NOT LIKE :f1 AND LOWER(a.action) NOT LIKE :f2 AND LOWER(a.action) NOT LIKE :f3)', {
          f1: '%fail%',
          f2: '%bad%',
          f3: '%denied%',
        });
      }
    }

    if (q.actor && q.actor !== 'All') {
      if (q.actor.toLowerCase() === 'system') {
        qb.andWhere('a."platformUserId" IS NULL');
      } else {
        const users = await this.logs.manager.getRepository(PlatformUser).find({
          where: [{ name: q.actor }, { email: q.actor }],
          select: { id: true },
        });
        const uids = users.map((u) => u.id);
        if (uids.length > 0) {
          qb.andWhere('a."platformUserId" IN (:...uids)', { uids });
        } else {
          qb.andWhere('1 = 0');
        }
      }
    }

    if (q.search) {
      const s = `%${q.search.replace(/[%_]/g, '\\$&')}%`;
      const users = await this.logs.manager.getRepository(PlatformUser).createQueryBuilder('u')
        .where('u.name ILIKE :s OR u.email ILIKE :s', { s })
        .select('u.id', 'id')
        .getRawMany();
      const uids = users.map((u) => u.id);

      if (uids.length > 0) {
        qb.andWhere(
          '(a.action ILIKE :s OR a."entityType" ILIKE :s OR a."entityId" ILIKE :s OR a.ip ILIKE :s OR a.diff::text ILIKE :s OR a."platformUserId" IN (:...uids))',
          { s, uids },
        );
      } else {
        qb.andWhere(
          '(a.action ILIKE :s OR a."entityType" ILIKE :s OR a."entityId" ILIKE :s OR a.ip ILIKE :s OR a.diff::text ILIKE :s)',
          { s },
        );
      }
    }

    const maxRows = q.limit ? Math.min(q.limit, 10000) : 5000;
    const rows = await qb
      .orderBy('a."createdAt"', 'DESC')
      .addOrderBy('a.id', 'DESC')
      .limit(maxRows)
      .getMany();

    const userIds = [...new Set(rows.map((r) => r.platformUserId).filter((id): id is string => Boolean(id)))];
    let userMap = new Map<string, { id: string; name: string; email: string }>();
    if (userIds.length > 0) {
      const users = await this.logs.manager.getRepository(PlatformUser).find({
        where: { id: In(userIds) },
        select: { id: true, name: true, email: true },
      });
      userMap = new Map(users.map((u) => [u.id, { id: u.id, name: u.name, email: u.email }]));
    }

    const headers = ['ID', 'Timestamp', 'Date', 'Action', 'Target', 'Actor', 'Outcome', 'IP', 'Diff'];
    const csvRows = rows.map((r) => {
      const d = new Date(r.createdAt);
      const timeStr = !isNaN(d.getTime())
        ? d.toTimeString().split(' ')[0] + '.' + String(d.getMilliseconds()).padStart(3, '0')
        : '00:00:00.000';
      const dateKey = !isNaN(d.getTime()) ? d.toISOString().split('T')[0] : 'N/A';

      let target = `${r.entityType || 'Entity'}`;
      const diff = r.diff as any;
      if (diff?.after?.name) {
        target = `${diff.after.name}${diff.after.slug ? ` · ${diff.after.slug}` : ''}`;
      } else if (diff?.after?.email) {
        target = `${diff.after.email}`;
      } else if (diff?.name) {
        target = `${diff.name}`;
      } else if (diff?.email) {
        target = `${diff.email}`;
      } else if (r.entityId) {
        target = `${r.entityType} · ${r.entityId.slice(0, 8)}…`;
      }

      const u = r.platformUserId ? userMap.get(r.platformUserId) : null;
      const actor = u?.name || u?.email || (r.platformUserId ? 'Platform Admin' : 'System');

      const isFail =
        r.action.toLowerCase().includes('fail') ||
        r.action.toLowerCase().includes('bad') ||
        r.action.toLowerCase().includes('denied');
      const outcome = isFail ? 'FAILURE' : 'SUCCESS';

      const ip = r.ip || '';
      const diffStr = r.diff ? JSON.stringify(r.diff) : '';

      return [
        r.id,
        timeStr,
        dateKey,
        r.action,
        target,
        actor,
        outcome,
        ip,
        diffStr,
      ];
    });

    const csv = toCsvString(headers, csvRows);
    const dateStr = q.date || new Date().toISOString().slice(0, 10);
    const filename = `platform-audit-logs-${dateStr}.csv`;
    return { filename, csv };
  }
}

