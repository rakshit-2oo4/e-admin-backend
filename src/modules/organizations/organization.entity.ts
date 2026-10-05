import { Column, CreateDateColumn, DeleteDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('organizations')
export class Organization {
  @PrimaryGeneratedColumn('uuid') id!: string;
  @Column() name!: string;
  @Column({ unique: true }) slug!: string;
  @Column({ type: 'int', default: 90 }) retentionDays!: number;
  @CreateDateColumn({ type: 'timestamptz' }) createdAt!: Date;

  // ---- platform-tier columns ----
  @Column({ type: 'timestamptz', nullable: true }) suspendedAt!: Date | null;
  @Column({ type: 'text', nullable: true }) suspendedReason!: string | null;
  @Column({ type: 'varchar', default: 'trial' }) plan!: string;
  @Column({ type: 'timestamptz', nullable: true }) trialEndsAt!: Date | null;
  @DeleteDateColumn({ type: 'timestamptz', nullable: true }) deletedAt!: Date | null;
  @Column({ type: 'uuid', nullable: true }) createdByPlatformUserId!: string | null;
}
