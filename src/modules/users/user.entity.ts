import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid') id!: string;
  @Index() @Column('uuid') orgId!: string;
  @Column({ unique: true }) email!: string;
  @Column({ type: 'varchar', nullable: true }) name!: string | null;
  @Column() passwordHash!: string;
  @Column({ type: 'varchar', default: 'OWNER' }) role!: string;
  @Column({ default: true }) isActive!: boolean;
  @CreateDateColumn({ type: 'timestamptz' }) createdAt!: Date;
}
