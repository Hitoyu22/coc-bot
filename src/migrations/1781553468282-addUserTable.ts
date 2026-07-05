import { MigrationInterface, QueryRunner } from "typeorm";

export class AddUserTable1781553468282 implements MigrationInterface {
    name = 'AddUserTable1781553468282'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "user" ("id" SERIAL NOT NULL, "name" character varying NOT NULL, "surname" character varying NOT NULL, "mail" character varying NOT NULL, "classe" integer NOT NULL, "promotion" "public"."user_promotion_enum", "contract_type" "public"."user_contract_type_enum", "rentree" "public"."user_rentree_enum", "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), "game_id" character varying, "game_name" character varying, "hdv" integer, "discord_id" character varying NOT NULL, "discord_tag" character varying NOT NULL, "war" integer NOT NULL DEFAULT '0', "ligue" integer NOT NULL DEFAULT '0', "clangame" integer NOT NULL DEFAULT '0', "raids" integer NOT NULL DEFAULT '0', "donation" integer NOT NULL DEFAULT '0', CONSTRAINT "UQ_7395ecde6cda2e7fe90253ec59f" UNIQUE ("mail"), CONSTRAINT "UQ_a695038a038c00cf65735299628" UNIQUE ("discord_id"), CONSTRAINT "PK_cace4a159ff9f2512dd42373760" PRIMARY KEY ("id"))`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE "user"`);
    }

}
