import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

@Entity('platform_audit_logs')
export class PlatformAuditLog {
  @PrimaryGeneratedColumn('uuid') id!: string;
  @Index() @Column({ type: 'uuid', nullable: true }) platformUserId!: string | null;
  @Index() @Column() action!: string;
  @Index() @Column() entityType!: string;
  @Column({ type: 'varchar', nullable: true }) entityId!: string | null;
  @Column({ type: 'jsonb', nullable: true }) diff!: Record<string, unknown> | null;
  @Column({ type: 'varchar', nullable: true }) ip!: string | null;
  @Column({ type: 'varchar', nullable: true }) userAgent!: string | null;
  @Index() @CreateDateColumn({ type: 'timestamptz', precision: 3 }) createdAt!: Date;
}
