import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddCsvImportTables1781590000000 implements MigrationInterface {
    name = 'AddCsvImportTables1781590000000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            CREATE TABLE "app_setting" (
                "key" character varying NOT NULL,
                "value" character varying,
                "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
                CONSTRAINT "PK_app_setting" PRIMARY KEY ("key")
            )
        `);
        await queryRunner.query(`
            CREATE TABLE "csv_import" (
                "id" SERIAL NOT NULL,
                "type" character varying NOT NULL,
                "clan_number" integer NOT NULL,
                "file_name" character varying NOT NULL,
                "file_hash" character varying NOT NULL,
                "rows_total" integer NOT NULL DEFAULT '0',
                "rows_matched" integer NOT NULL DEFAULT '0',
                "rows_baseline" integer NOT NULL DEFAULT '0',
                "points_distributed" double precision NOT NULL DEFAULT '0',
                "imported_by" character varying NOT NULL,
                "imported_at" TIMESTAMP NOT NULL DEFAULT now(),
                CONSTRAINT "UQ_csv_import_file_hash" UNIQUE ("file_hash"),
                CONSTRAINT "PK_csv_import" PRIMARY KEY ("id")
            )
        `);
        await queryRunner.query(`
            CREATE TABLE "csv_snapshot" (
                "id" SERIAL NOT NULL,
                "import_id" integer NOT NULL,
                "type" character varying NOT NULL,
                "clan_number" integer NOT NULL,
                "coc_tag" character varying NOT NULL,
                "coc_name" character varying NOT NULL,
                "user_id" integer,
                "metrics" jsonb NOT NULL,
                "points_awarded" double precision NOT NULL DEFAULT '0',
                "created_at" TIMESTAMP NOT NULL DEFAULT now(),
                CONSTRAINT "PK_csv_snapshot" PRIMARY KEY ("id"),
                CONSTRAINT "FK_csv_snapshot_import" FOREIGN KEY ("import_id")
                    REFERENCES "csv_import"("id") ON DELETE CASCADE
            )
        `);
        await queryRunner.query(`
            CREATE INDEX "IDX_csv_snapshot_lookup" ON "csv_snapshot" ("type", "clan_number", "coc_tag")
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "IDX_csv_snapshot_lookup"`);
        await queryRunner.query(`DROP TABLE "csv_snapshot"`);
        await queryRunner.query(`DROP TABLE "csv_import"`);
        await queryRunner.query(`DROP TABLE "app_setting"`);
    }
}
