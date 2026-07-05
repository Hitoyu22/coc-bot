import { MigrationInterface, QueryRunner } from "typeorm";

export class PointColumnsFloat1781570000000 implements MigrationInterface {
    name = 'PointColumnsFloat1781570000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "user" ALTER COLUMN "war" TYPE float USING war::float`);
        await queryRunner.query(`ALTER TABLE "user" ALTER COLUMN "ligue" TYPE float USING ligue::float`);
        await queryRunner.query(`ALTER TABLE "user" ALTER COLUMN "clangame" TYPE float USING clangame::float`);
        await queryRunner.query(`ALTER TABLE "user" ALTER COLUMN "raids" TYPE float USING raids::float`);
        await queryRunner.query(`ALTER TABLE "user" ALTER COLUMN "donation" TYPE float USING donation::float`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "user" ALTER COLUMN "war" TYPE int USING war::int`);
        await queryRunner.query(`ALTER TABLE "user" ALTER COLUMN "ligue" TYPE int USING ligue::int`);
        await queryRunner.query(`ALTER TABLE "user" ALTER COLUMN "clangame" TYPE int USING clangame::int`);
        await queryRunner.query(`ALTER TABLE "user" ALTER COLUMN "raids" TYPE int USING raids::int`);
        await queryRunner.query(`ALTER TABLE "user" ALTER COLUMN "donation" TYPE int USING donation::int`);
    }
}
