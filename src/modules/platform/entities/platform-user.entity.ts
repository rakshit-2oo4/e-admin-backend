import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

export enum PlatformRole {
  SUPER_ADMIN = 'SUPER_ADMIN',
  SUPPORT = 'SUPPORT',
}

@Entity('platform_users')
export class PlatformUser {
  @PrimaryGeneratedColumn('uuid') id!: string;
  @Column({ unique: true }) email!: string;
  @Column() passwordHash!: string;
  @Column() name!: string;
  @Column({ type: 'enum', enum: PlatformRole }) role!: PlatformRole;
  @Column({ default: true }) isActive!: boolean;
  @Column({ type: 'timestamptz', nullable: true }) lastLoginAt!: Date | null;
  @Column({ type: 'int', default: 0 }) failedLoginCount!: number;
  @Column({ type: 'timestamptz', nullable: true }) lockedUntil!: Date | null;
  @CreateDateColumn({ type: 'timestamptz' }) createdAt!: Date;
  @UpdateDateColumn({ type: 'timestamptz' }) updatedAt!: Date;
}
