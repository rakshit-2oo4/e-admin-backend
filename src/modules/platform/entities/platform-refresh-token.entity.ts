import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { PlatformUser } from './platform-user.entity';

@Entity('platform_refresh_tokens')
export class PlatformRefreshToken {
  @PrimaryGeneratedColumn('uuid') id!: string;

  @Index() @Column('uuid') platformUserId!: string;
  @ManyToOne(() => PlatformUser, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'platformUserId' })
  user!: PlatformUser;

  @Index({ unique: true }) @Column() tokenHash!: string;
  @Index() @Column('uuid') familyId!: string;
  @Column({ type: 'timestamptz' }) expiresAt!: Date;
  @Column({ type: 'timestamptz', nullable: true }) revokedAt!: Date | null;
  @Column({ type: 'varchar', nullable: true }) ip!: string | null;
  @Column({ type: 'varchar', nullable: true }) userAgent!: string | null;
  @CreateDateColumn({ type: 'timestamptz' }) createdAt!: Date;
}
