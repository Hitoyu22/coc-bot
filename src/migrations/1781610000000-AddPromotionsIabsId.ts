import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddPromotionsIabsId1781610000000 implements MigrationInterface {
    name = 'AddPromotionsIabsId1781610000000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TYPE "public"."user_promotion_enum" ADD VALUE IF NOT EXISTS 'IABS'`);
        await queryRunner.query(`ALTER TYPE "public"."user_promotion_enum" ADD VALUE IF NOT EXISTS 'ID'`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // PostgreSQL ne permet pas de retirer une valeur d'un enum : on recrée le type sans IABS/ID.
        await queryRunner.query(`UPDATE "user" SET "promotion" = NULL WHERE "promotion" IN ('IABS', 'ID')`);
        await queryRunner.query(`ALTER TYPE "public"."user_promotion_enum" RENAME TO "user_promotion_enum_old"`);
        await queryRunner.query(`CREATE TYPE "public"."user_promotion_enum" AS ENUM('AL', 'IW', 'IABD', 'BC', 'MOC', 'SRC', 'RVJV', 'SI', 'MSCI')`);
        await queryRunner.query(`ALTER TABLE "user" ALTER COLUMN "promotion" TYPE "public"."user_promotion_enum" USING "promotion"::text::"public"."user_promotion_enum"`);
        await queryRunner.query(`DROP TYPE "public"."user_promotion_enum_old"`);
    }
}
