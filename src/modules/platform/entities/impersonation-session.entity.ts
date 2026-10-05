import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

@Entity('impersonation_sessions')
export class ImpersonationSession {
  @PrimaryGeneratedColumn('uuid') id!: string;
  @Index() @Column('uuid') platformUserId!: string;
  @Index() @Column('uuid') orgId!: string;
  @Column('uuid') targetUserId!: string;
  @Column('text') reason!: string;
  @CreateDateColumn({ type: 'timestamptz' }) startedAt!: Date;
  @Column({ type: 'timestamptz', nullable: true }) endedAt!: Date | null;
  @Column({ type: 'varchar', nullable: true }) ip!: string | null;
  @Column({ type: 'varchar', nullable: true }) userAgent!: string | null;
}
