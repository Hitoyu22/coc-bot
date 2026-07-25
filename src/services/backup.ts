import { Client, TextChannel, AttachmentBuilder } from 'discord.js';
import { AppDataSource } from '../config/dataSource';
import { config } from '../config/config';

// Ordre de restauration (FK) : parents avant enfants
const TABLES = [
    'user',
    'war_event',
    'war_participation',
    'raid_event',
    'raid_participation',
    'app_setting',
];

function sqlValue(v: unknown): string {
    if (v === null || v === undefined) return 'NULL';
    if (typeof v === 'number') return Number.isFinite(v) ? String(v) : 'NULL';
    if (typeof v === 'boolean') return v ? 'TRUE' : 'FALSE';
    if (v instanceof Date) return `'${v.toISOString()}'`;
    if (typeof v === 'object') return `'${JSON.stringify(v).replace(/'/g, "''")}'`;
    return `'${String(v).replace(/'/g, "''")}'`;
}

// Dump SQL en pur Node (pas besoin de pg_dump installé).
// Restauration : npm run migration:run (schéma) puis psql -d <db> -f backup.sql
export async function generateBackupSql(): Promise<{ fileName: string; content: string }> {
    const date = new Date();
    const dateStr = date.toISOString().slice(0, 19).replace(/[T:]/g, '-');
    const fileName = `backup-coc-${dateStr}.sql`;

    const lines: string[] = [
        `-- Backup CocBot — ${date.toLocaleString('fr-FR')}`,
        `-- Restauration : lancer les migrations (schéma) puis : psql -d <db> -f ${fileName}`,
        'BEGIN;',
        '',
        // vider dans l'ordre inverse pour respecter les FK
        ...[...TABLES].reverse().map(t => `DELETE FROM "${t}";`),
        '',
    ];

    for (const table of TABLES) {
        const rows: Record<string, unknown>[] = await AppDataSource.query(`SELECT * FROM "${table}"`);
        lines.push(`-- ${table} (${rows.length} lignes)`);
        for (const row of rows) {
            const cols = Object.keys(row);
            lines.push(
                `INSERT INTO "${table}" (${cols.map(c => `"${c}"`).join(', ')}) VALUES (${cols.map(c => sqlValue(row[c])).join(', ')});`
            );
        }
        // resynchroniser la séquence d'id (app_setting n'a pas d'id auto)
        if (table !== 'app_setting') {
            lines.push(
                `SELECT setval(pg_get_serial_sequence('"${table}"', 'id'), (SELECT COALESCE(MAX(id), 1) FROM "${table}"));`
            );
        }
        lines.push('');
    }

    lines.push('COMMIT;');
    return { fileName, content: lines.join('\n') };
}

export async function performBackup(
    client: Client,
    channelId?: string
): Promise<{ success: boolean; message: string; fileName?: string; buffer?: Buffer }> {
    try {
        const { fileName, content } = await generateBackupSql();
        const buffer = Buffer.from(content, 'utf8');

        const targetChannelId = channelId || config.BACKUP_CHANNEL_ID;
        let sentToChannel = false;
        if (targetChannelId && client) {
            const channel = client.channels.cache.get(targetChannelId) as TextChannel | undefined;
            if (channel?.isTextBased()) {
                await channel.send({
                    content: `📦 Backup BDD — ${new Date().toLocaleString('fr-FR')}`,
                    files: [new AttachmentBuilder(buffer, { name: fileName })],
                });
                sentToChannel = true;
            }
        }

        return {
            success: true,
            message: `Backup créé : ${fileName}${sentToChannel ? ' (envoyé dans le canal backup)' : ''}`,
            fileName,
            buffer,
        };
    } catch (error: any) {
        console.error('[Backup] Erreur:', error?.message ?? error);
        return { success: false, message: error?.message ?? 'Erreur inconnue' };
    }
}
