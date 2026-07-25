import ExcelJS from 'exceljs';
import { join } from 'path';
import { tmpdir } from 'os';
import { User, Promotion } from '../entities/User';
import { WarEvent } from '../entities/WarEvent';
import { RaidEvent } from '../entities/RaidEvent';
import { AppDataSource } from '../config/dataSource';
import { WarParticipation } from '../entities/WarParticipation';
import { RaidParticipation } from '../entities/RaidParticipation';

const PROMOTION_LABELS: Record<string, string> = {
    [Promotion.AL]: 'Architecture des Logiciels',
    [Promotion.IW]: 'Ingénierie du Web',
    [Promotion.IABD]: 'Intelligence Artificielle et Big Data',
    [Promotion.BC]: 'Ingénierie de la Blockchain',
    [Promotion.MOC]: 'Ingénierie Mobile et Objets Connectés',
    [Promotion.SRC]: 'Systèmes, Réseaux et Cloud Computing',
    [Promotion.RVJV]: 'Ingénierie de la Réalité Virtuelle et Jeux Vidéo',
    [Promotion.SI]: 'Cybersécurité',
    [Promotion.MSCI]: 'Management et Conseil en Systèmes d\'Information',
};

function getWeekKey(date: Date): string {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const day = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - day);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    const weekNo = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
    return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`;
}

function weekThursday(weekKey: string): string {
    const [year, wStr] = weekKey.split('-W');
    const week = parseInt(wStr);
    const jan4 = new Date(Date.UTC(parseInt(year), 0, 4));
    const jan4Day = jan4.getUTCDay() || 7;
    const monday = new Date(jan4.getTime() + ((week - 1) * 7 - (jan4Day - 1)) * 86400000);
    const thursday = new Date(monday.getTime() + 3 * 86400000);
    return thursday.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: '2-digit' });
}

export async function generateExportExcel(): Promise<string> {
    const userRepo = AppDataSource.getRepository(User);
    const warPartRepo = AppDataSource.getRepository(WarParticipation);
    const raidPartRepo = AppDataSource.getRepository(RaidParticipation);

    const users = await userRepo.find({ order: { name: 'ASC', surname: 'ASC' } });
    const allWarParts = await warPartRepo.find({ relations: { war_event: true } });
    const allRaidParts = await raidPartRepo.find({ relations: { raid_event: true } });

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

    const allWeeks = new Set<string>();
    for (const weeks of participationByUser.values()) {
        for (const w of weeks) allWeeks.add(w);
    }
    const sortedWeeks = [...allWeeks].sort();

    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Participations');

    const staticHeaders = ['Nom', 'Prénom', 'Email', 'Année', 'Classe', 'Promotion', 'Rentrée', 'Membre', 'Total Points'];
    const weekHeaders = sortedWeeks.map(w => weekThursday(w));
    const headers = [...staticHeaders, ...weekHeaders];

    ws.addRow(headers);
    const headerRow = ws.getRow(1);
    headerRow.font = { bold: true };
    headerRow.alignment = { horizontal: 'center' };
    headerRow.eachCell(cell => {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2EFDA' } };
        cell.border = {
            bottom: { style: 'thin', color: { argb: 'FF999999' } },
        };
    });

    for (const user of users) {
        const totalPoints = Math.round(
            Math.min(4, (user.war || 0) + (user.ligue || 0) + (user.clangame || 0) + (user.raids || 0) + (user.donation || 0))
            * 100
        ) / 100;
        const userWeeks = participationByUser.get(user.id) ?? new Set();
        const annee = new Date().getFullYear();
        const classeLabel = `${user.classe}ème année`;
        const promoLabel = user.promotion ? (PROMOTION_LABELS[user.promotion] ?? user.promotion) : '';

        const row = ws.addRow([
            user.name,
            user.surname,
            user.mail,
            annee,
            classeLabel,
            promoLabel,
            user.rentree ?? '',
            'Oui',
            totalPoints,
        ]);

        for (let i = 0; i < sortedWeeks.length; i++) {
            const colIdx = staticHeaders.length + i + 1;
            const cell = row.getCell(colIdx);
            const participated = userWeeks.has(sortedWeeks[i]);
            cell.value = participated ? '✅' : '❌';
            cell.alignment = { horizontal: 'center' };
        }
    }

    ws.columns.forEach((col, i) => {
        const maxLen = Math.max(
            headers[i]?.length ?? 10,
            ...ws.getColumn(i + 1).values
                .filter(v => v !== undefined && v !== null)
                .map(v => String(v).length)
        );
        col.width = Math.min(maxLen + 2, 45);
    });

    const filePath = join(tmpdir(), `export-coc-${Date.now()}.xlsx`);
    await wb.xlsx.writeFile(filePath);
    return filePath;
}
