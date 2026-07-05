import ExcelJS from 'exceljs';
import { join } from 'path';
import { tmpdir } from 'os';
import { User } from '../entities/User';
import { WarEvent } from '../entities/WarEvent';
import { RaidEvent } from '../entities/RaidEvent';
import { AppDataSource } from '../config/dataSource';
import { WarParticipation } from '../entities/WarParticipation';
import { RaidParticipation } from '../entities/RaidParticipation';

function getWeekKey(date: Date): string {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const day = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - day);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    const weekNo = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
    return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`;
}

function weekLabel(weekKey: string): string {
    const [year, wStr] = weekKey.split('-W');
    const week = parseInt(wStr);
    const jan1 = new Date(parseInt(year), 0, 1);
    const dayOffset = (week - 1) * 7;
    const monday = new Date(jan1.getTime() + dayOffset * 86400000);
    const sunday = new Date(monday.getTime() + 6 * 86400000);
    return `S${wStr}/${year.slice(2)} (${monday.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })}-${sunday.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })})`;
}

export async function generateExportExcel(): Promise<string> {
    const userRepo = AppDataSource.getRepository(User);
    const warPartRepo = AppDataSource.getRepository(WarParticipation);
    const raidPartRepo = AppDataSource.getRepository(RaidParticipation);

    const users = await userRepo.find({ order: { name: 'ASC', surname: 'ASC' } });
    const allWarParts = await warPartRepo.find({ relations: { war_event: true } });
    const allRaidParts = await raidPartRepo.find({ relations: { raid_event: true } });

    // Collect all participation weeks per user
    type UserParticipation = Map<string, Set<string>>; // userId -> Set<weekKey>
    const participationByUser = new Map<number, Set<string>>();

    for (const p of allWarParts) {
        const we = (p as any).war_event as WarEvent;
        if (!we) continue;
        const week = getWeekKey(new Date(we.start_time));
        if (!participationByUser.has(p.user_id)) participationByUser.set(p.user_id, new Set());
        participationByUser.get(p.user_id)!.add(week);
    }

    for (const p of allRaidParts) {
        const re = (p as any).raid_event as RaidEvent;
        if (!re) continue;
        const week = getWeekKey(new Date(re.start_time));
        if (!participationByUser.has(p.user_id)) participationByUser.set(p.user_id, new Set());
        participationByUser.get(p.user_id)!.add(week);
    }

    // Collect all unique weeks sorted
    const allWeeks = new Set<string>();
    for (const weeks of participationByUser.values()) {
        for (const w of weeks) allWeeks.add(w);
    }
    const sortedWeeks = [...allWeeks].sort();

    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Participations');

    const staticHeaders = ['Nom', 'Prénom', 'Email', 'Année', 'Classe', 'Promotion', 'Rentrée', 'Total Points'];
    const weekHeaders = sortedWeeks.map(w => weekLabel(w));
    const headers = [...staticHeaders, ...weekHeaders];

    ws.addRow(headers);
    const headerRow = ws.getRow(1);
    headerRow.font = { bold: true };
    headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4472C4' } };
    headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };

    for (const user of users) {
        const totalPoints = Math.min(4, (user.war || 0) + (user.ligue || 0) + (user.clangame || 0) + (user.raids || 0) + (user.donation || 0));
        const userWeeks = participationByUser.get(user.id) ?? new Set();
        const weekCols = sortedWeeks.map(w => userWeeks.has(w));
        const annee = new Date().getFullYear();

        const row = [
            user.name,
            user.surname,
            user.mail,
            annee,
            user.classe,
            user.promotion ?? '',
            user.rentree ?? '',
            totalPoints,
            ...weekCols,
        ];
        ws.addRow(row);
    }

    // Auto width
    ws.columns.forEach((col, i) => {
        const maxLen = Math.max(
            headers[i]?.length ?? 10,
            ...ws.getColumn(i + 1).values
                .filter(v => v !== undefined && v !== null)
                .map(v => String(v).length)
        );
        col.width = Math.min(maxLen + 2, 40);
    });

    const filePath = join(tmpdir(), `export-coc-${Date.now()}.xlsx`);
    await wb.xlsx.writeFile(filePath);
    return filePath;
}
