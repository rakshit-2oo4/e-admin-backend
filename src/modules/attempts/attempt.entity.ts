import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

@Entity('attempts')
export class Attempt {
  @PrimaryGeneratedColumn('uuid') id!: string;
  @Index() @Column('uuid') orgId!: string;
  @Column({ type: 'uuid', nullable: true }) candidateId!: string | null;
  @Column({ type: 'varchar', default: 'IN_PROGRESS' }) status!: string;
  @Column({ type: 'bigint', default: 0 }) storageBytes!: string;
  @Index() @CreateDateColumn({ type: 'timestamptz' }) createdAt!: Date;
}
