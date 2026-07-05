import { MigrationInterface, QueryRunner } from "typeorm";

export class AddEventTables1781560000000 implements MigrationInterface {
    name = 'AddEventTables1781560000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            CREATE TABLE "war_event" (
                "id" SERIAL NOT NULL,
                "type" character varying NOT NULL,
                "clan_id" character varying NOT NULL,
                "clan_number" integer NOT NULL,
                "war_tag" character varying,
                "start_time" TIMESTAMP NOT NULL,
                "end_time" TIMESTAMP,
                "attacks_per_member" integer NOT NULL DEFAULT 2,
                "team_size" integer NOT NULL DEFAULT 0,
                "opponent_name" character varying,
                "result" character varying NOT NULL DEFAULT 'unknown',
                "points_saved" boolean NOT NULL DEFAULT false,
                "created_at" TIMESTAMP NOT NULL DEFAULT now(),
                CONSTRAINT "PK_war_event" PRIMARY KEY ("id")
            )
        `);

        await queryRunner.query(`
            CREATE TABLE "war_participation" (
                "id" SERIAL NOT NULL,
                "user_id" integer NOT NULL,
                "war_event_id" integer NOT NULL,
                "coc_tag" character varying NOT NULL,
                "coc_name" character varying NOT NULL,
                "attacks_made" integer NOT NULL DEFAULT 0,
                "attacks_expected" integer NOT NULL DEFAULT 2,
                "total_destruction" float NOT NULL DEFAULT 0,
                "total_stars" integer NOT NULL DEFAULT 0,
                "points_awarded" float NOT NULL DEFAULT 0,
                "attacks_detail" jsonb,
                CONSTRAINT "PK_war_participation" PRIMARY KEY ("id"),
                CONSTRAINT "FK_war_participation_user" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE,
                CONSTRAINT "FK_war_participation_event" FOREIGN KEY ("war_event_id") REFERENCES "war_event"("id") ON DELETE CASCADE,
                CONSTRAINT "UQ_war_participation" UNIQUE ("user_id", "war_event_id")
            )
        `);

        await queryRunner.query(`
            CREATE TABLE "raid_event" (
                "id" SERIAL NOT NULL,
                "clan_id" character varying NOT NULL,
                "clan_number" integer NOT NULL,
                "start_time" TIMESTAMP NOT NULL,
                "end_time" TIMESTAMP,
                "total_attacks" integer NOT NULL DEFAULT 0,
                "districts_destroyed" integer NOT NULL DEFAULT 0,
                "points_saved" boolean NOT NULL DEFAULT false,
                "created_at" TIMESTAMP NOT NULL DEFAULT now(),
                CONSTRAINT "PK_raid_event" PRIMARY KEY ("id")
            )
        `);

        await queryRunner.query(`
            CREATE TABLE "raid_participation" (
                "id" SERIAL NOT NULL,
                "user_id" integer NOT NULL,
                "raid_event_id" integer NOT NULL,
                "coc_tag" character varying NOT NULL,
                "coc_name" character varying NOT NULL,
                "attacks_used" integer NOT NULL DEFAULT 0,
                "attacks_limit" integer NOT NULL DEFAULT 6,
                "districts_destroyed" integer NOT NULL DEFAULT 0,
                "capital_resources_looted" integer NOT NULL DEFAULT 0,
                "points_awarded" float NOT NULL DEFAULT 0,
                CONSTRAINT "PK_raid_participation" PRIMARY KEY ("id"),
                CONSTRAINT "FK_raid_participation_user" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE,
                CONSTRAINT "FK_raid_participation_event" FOREIGN KEY ("raid_event_id") REFERENCES "raid_event"("id") ON DELETE CASCADE,
                CONSTRAINT "UQ_raid_participation" UNIQUE ("user_id", "raid_event_id")
            )
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE "raid_participation"`);
        await queryRunner.query(`DROP TABLE "raid_event"`);
        await queryRunner.query(`DROP TABLE "war_participation"`);
        await queryRunner.query(`DROP TABLE "war_event"`);
    }
}
