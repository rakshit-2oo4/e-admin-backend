import { Injectable } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { PlatformAuditLog } from '../entities/platform-audit-log.entity';

export interface AuditInput {
  platformUserId?: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  diff?: Record<string, unknown> | null;
  ip?: string | null;
  userAgent?: string | null;
}

@Injectable()
export class PlatformAuditService {
  /** Always pass the caller's transaction manager so the audit row commits or rolls back with the write. */
  async log(manager: EntityManager, input: AuditInput): Promise<void> {
    const row = manager.create(PlatformAuditLog, {
      platformUserId: input.platformUserId ?? null,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId ?? null,
      diff: input.diff ?? null,
      ip: input.ip ?? null,
      userAgent: input.userAgent ?? null,
    });
    await manager.save(row);
  }
}
