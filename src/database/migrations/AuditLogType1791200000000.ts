import { MigrationInterface, QueryRunner } from "typeorm";

export class AuditLogType1791200000000 implements MigrationInterface {
    name = 'AuditLogType1791200000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "platform_audit_logs" ADD "type" character varying NOT NULL DEFAULT 'USER'`);
        await queryRunner.query(`UPDATE "platform_audit_logs" SET "type" = 'SYSTEM' WHERE "platformUserId" IS NULL`);
        await queryRunner.query(`CREATE INDEX "IDX_platform_audit_logs_type" ON "platform_audit_logs" ("type")`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "public"."IDX_platform_audit_logs_type"`);
        await queryRunner.query(`ALTER TABLE "platform_audit_logs" DROP COLUMN "type"`);
    }
}