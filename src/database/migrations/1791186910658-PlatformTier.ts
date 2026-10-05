import { MigrationInterface, QueryRunner } from "typeorm";

export class PlatformTier1791186910658 implements MigrationInterface {
    name = 'PlatformTier1791186910658'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "attempts" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "orgId" uuid NOT NULL, "candidateId" uuid, "status" character varying NOT NULL DEFAULT 'IN_PROGRESS', "storageBytes" bigint NOT NULL DEFAULT '0', "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_295ca261e361fd2fd217754dcac" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_ae3062764117f93aa372f7bc13" ON "attempts"  ("orgId") `);
        await queryRunner.query(`CREATE INDEX "IDX_63c49edb1fde02b54671b19d04" ON "attempts"  ("createdAt") `);
        await queryRunner.query(`CREATE TABLE "organizations" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "name" character varying NOT NULL, "slug" character varying NOT NULL, "retentionDays" integer NOT NULL DEFAULT '90', "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "suspendedAt" TIMESTAMP WITH TIME ZONE, "suspendedReason" text, "plan" character varying NOT NULL DEFAULT 'trial', "trialEndsAt" TIMESTAMP WITH TIME ZONE, "deletedAt" TIMESTAMP WITH TIME ZONE, "createdByPlatformUserId" uuid, CONSTRAINT "UQ_963693341bd612aa01ddf3a4b68" UNIQUE ("slug"), CONSTRAINT "PK_6b031fcd0863e3f6b44230163f9" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "impersonation_sessions" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "platformUserId" uuid NOT NULL, "orgId" uuid NOT NULL, "targetUserId" uuid NOT NULL, "reason" text NOT NULL, "startedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "endedAt" TIMESTAMP WITH TIME ZONE, "ip" character varying, "userAgent" character varying, CONSTRAINT "PK_b735433f13b4dd6f03bd6bf2879" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_5ef768fc16b7dec73f34a9767f" ON "impersonation_sessions"  ("platformUserId") `);
        await queryRunner.query(`CREATE INDEX "IDX_43972af08403f40ee0877ed214" ON "impersonation_sessions"  ("orgId") `);
        await queryRunner.query(`CREATE TABLE "platform_audit_logs" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "platformUserId" uuid, "action" character varying NOT NULL, "entityType" character varying NOT NULL, "entityId" character varying, "diff" jsonb, "ip" character varying, "userAgent" character varying, "createdAt" TIMESTAMP(3) WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_df9143ce2f97b20833a989e1e8c" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_2dd7d3065a315d8dfda50ed35e" ON "platform_audit_logs"  ("platformUserId") `);
        await queryRunner.query(`CREATE INDEX "IDX_dd132616563392a82c920fa468" ON "platform_audit_logs"  ("action") `);
        await queryRunner.query(`CREATE INDEX "IDX_a51c4932a56fcee87feed8acfc" ON "platform_audit_logs"  ("entityType") `);
        await queryRunner.query(`CREATE INDEX "IDX_4846dee6eac63eb768f704aa6d" ON "platform_audit_logs"  ("createdAt") `);
        await queryRunner.query(`CREATE TYPE "public"."platform_users_role_enum" AS ENUM('SUPER_ADMIN', 'SUPPORT')`);
        await queryRunner.query(`CREATE TABLE "platform_users" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "email" character varying NOT NULL, "passwordHash" character varying NOT NULL, "name" character varying NOT NULL, "role" "public"."platform_users_role_enum" NOT NULL, "isActive" boolean NOT NULL DEFAULT true, "lastLoginAt" TIMESTAMP WITH TIME ZONE, "failedLoginCount" integer NOT NULL DEFAULT '0', "lockedUntil" TIMESTAMP WITH TIME ZONE, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "UQ_b616fa69a7b331fc2a7906a83d2" UNIQUE ("email"), CONSTRAINT "PK_69bfedb2b67d1014d7b7741f5b4" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "platform_refresh_tokens" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "platformUserId" uuid NOT NULL, "tokenHash" character varying NOT NULL, "familyId" uuid NOT NULL, "expiresAt" TIMESTAMP WITH TIME ZONE NOT NULL, "revokedAt" TIMESTAMP WITH TIME ZONE, "ip" character varying, "userAgent" character varying, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_5c2e776a445e812f49b71d1bcfd" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_af9e27bf48b1be6af2f55af5b8" ON "platform_refresh_tokens"  ("platformUserId") `);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_8ad80403a77510d891bf623df6" ON "platform_refresh_tokens"  ("tokenHash") `);
        await queryRunner.query(`CREATE INDEX "IDX_3441c23206a02cc618ce793b91" ON "platform_refresh_tokens"  ("familyId") `);
        await queryRunner.query(`CREATE TABLE "users" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "orgId" uuid NOT NULL, "email" character varying NOT NULL, "name" character varying, "passwordHash" character varying NOT NULL, "role" character varying NOT NULL DEFAULT 'OWNER', "isActive" boolean NOT NULL DEFAULT true, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "UQ_97672ac88f789774dd47f7c8be3" UNIQUE ("email"), CONSTRAINT "PK_a3ffb1c0c8416b9fc6f907b7433" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_1890588e47e133fd85670f187d" ON "users"  ("orgId") `);
        await queryRunner.query(`ALTER TABLE "platform_refresh_tokens" ADD CONSTRAINT "FK_af9e27bf48b1be6af2f55af5b8b" FOREIGN KEY ("platformUserId") REFERENCES "platform_users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "platform_refresh_tokens" DROP CONSTRAINT "FK_af9e27bf48b1be6af2f55af5b8b"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_1890588e47e133fd85670f187d"`);
        await queryRunner.query(`DROP TABLE "users"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_3441c23206a02cc618ce793b91"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_8ad80403a77510d891bf623df6"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_af9e27bf48b1be6af2f55af5b8"`);
        await queryRunner.query(`DROP TABLE "platform_refresh_tokens"`);
        await queryRunner.query(`DROP TABLE "platform_users"`);
        await queryRunner.query(`DROP TYPE "public"."platform_users_role_enum"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_4846dee6eac63eb768f704aa6d"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_a51c4932a56fcee87feed8acfc"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_dd132616563392a82c920fa468"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_2dd7d3065a315d8dfda50ed35e"`);
        await queryRunner.query(`DROP TABLE "platform_audit_logs"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_43972af08403f40ee0877ed214"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_5ef768fc16b7dec73f34a9767f"`);
        await queryRunner.query(`DROP TABLE "impersonation_sessions"`);
        await queryRunner.query(`DROP TABLE "organizations"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_63c49edb1fde02b54671b19d04"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_ae3062764117f93aa372f7bc13"`);
        await queryRunner.query(`DROP TABLE "attempts"`);
    }

}
