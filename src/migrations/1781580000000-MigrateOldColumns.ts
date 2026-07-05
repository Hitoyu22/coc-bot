import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Migration défensive : migre les données de l'ancienne structure v1 vers v2.
 *
 * Anciens noms (v1) → Nouveaux noms (v2) :
 *   dons  (int)     → donation (float)
 *   raid  (int)     → raids    (float)
 *   classe (varchar)→ classe   (int) + promotion (enum)
 *
 * Cette migration ne fait rien si les anciennes colonnes n'existent pas
 * (cas d'une installation fraîche qui a déjà la bonne structure).
 */
export class MigrateOldColumns1781580000000 implements MigrationInterface {
    name = 'MigrateOldColumns1781580000000'

    private async columnExists(queryRunner: QueryRunner, table: string, column: string): Promise<boolean> {
        const result = await queryRunner.query(`
            SELECT COUNT(*) as count
            FROM information_schema.columns
            WHERE table_schema = 'public'
              AND table_name   = $1
              AND column_name  = $2
        `, [table, column]);
        return parseInt(result[0]?.count ?? '0') > 0;
    }

    public async up(queryRunner: QueryRunner): Promise<void> {
        const hasDons = await this.columnExists(queryRunner, 'user', 'dons');
        const hasRaid = await this.columnExists(queryRunner, 'user', 'raid');
        const hasDonation = await this.columnExists(queryRunner, 'user', 'donation');
        const hasRaids = await this.columnExists(queryRunner, 'user', 'raids');
        const classeIsVarchar = await queryRunner.query(`
            SELECT data_type FROM information_schema.columns
            WHERE table_name='user' AND column_name='classe'
        `).then((r: any[]) => r[0]?.data_type === 'character varying');

        // Migration dons → donation
        if (hasDons && hasDonation) {
            console.log('[Migration] Copie dons → donation');
            await queryRunner.query(`UPDATE "user" SET donation = donation + dons WHERE dons > 0`);
            await queryRunner.query(`ALTER TABLE "user" DROP COLUMN dons`);
        } else if (hasDons && !hasDonation) {
            console.log('[Migration] Renommage dons → donation');
            await queryRunner.query(`ALTER TABLE "user" RENAME COLUMN dons TO donation`);
            await queryRunner.query(`ALTER TABLE "user" ALTER COLUMN donation TYPE float USING donation::float`);
        }

        // Migration raid → raids
        if (hasRaid && hasRaids) {
            console.log('[Migration] Copie raid → raids');
            await queryRunner.query(`UPDATE "user" SET raids = raids + raid WHERE raid > 0`);
            await queryRunner.query(`ALTER TABLE "user" DROP COLUMN raid`);
        } else if (hasRaid && !hasRaids) {
            console.log('[Migration] Renommage raid → raids');
            await queryRunner.query(`ALTER TABLE "user" RENAME COLUMN raid TO raids`);
            await queryRunner.query(`ALTER TABLE "user" ALTER COLUMN raids TYPE float USING raids::float`);
        }

        // Migration classe varchar → int
        if (classeIsVarchar) {
            console.log('[Migration] Conversion classe varchar → int');
            await queryRunner.query(`
                ALTER TABLE "user"
                ALTER COLUMN classe TYPE integer
                USING CASE
                    WHEN classe ~ '^[0-9]+$' THEN classe::integer
                    ELSE 1
                END
            `);
        }

        if (!hasDons && !hasRaid && !classeIsVarchar) {
            console.log('[Migration] Structure déjà à jour — aucune migration de données nécessaire.');
        }
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Pas de rollback possible pour une migration de données
        console.log('[Migration down] MigrateOldColumns: rollback non supporté.');
    }
}
