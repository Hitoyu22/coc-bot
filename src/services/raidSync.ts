import { cocService } from './coc';
import { eventDb, calcRaidPoints, RaidParticipationData } from './eventDatabase';
import { AppDataSource } from '../config/dataSource';
import { User } from '../entities/User';
import { parseCocDate } from '../utils/cocDate';

export interface RaidSaveResult {
    status: 'saved' | 'already_saved' | 'no_details';
    startTime: Date;
    endTime: Date | null;
    matched: number;
    totalMembers: number;
    points: number;
    unmatched: string[];
    awarded: { name: string; points: number; attacks: number; limit: number }[];
}

// Reconstruit la liste des membres (tag, name, attacks) à partir des listes
// d'attaques détaillées de l'attackLog, quand l'API ne renvoie plus `members`.
function buildMembersFromAttackLog(season: any): any[] {
    const byTag = new Map<string, { tag: string; name: string; attacks: number }>();
    for (const log of season.attackLog ?? []) {
        for (const district of log.districts ?? []) {
            for (const attack of district.attacks ?? []) {
                const tag = attack.attacker?.tag;
                if (!tag) continue;
                const entry = byTag.get(tag) ?? { tag, name: attack.attacker?.name ?? tag, attacks: 0 };
                entry.attacks++;
                byTag.set(tag, entry);
            }
        }
    }
    return [...byTag.values()];
}

// Sauvegarde une saison de raid (API CoC) + attribue les points. Idempotent :
// si le raid est déjà sauvegardé (points_saved), ne fait rien.
export async function saveRaidSeason(season: any, clanTag: string, clanNum: number): Promise<RaidSaveResult> {
    const startTime = season.startTime ? parseCocDate(season.startTime) : new Date();
    const endTime = season.endTime ? parseCocDate(season.endTime) : null;

    const existing = await eventDb.findRaidEventByStartTime(clanTag, startTime);
    if (existing?.points_saved) {
        return { status: 'already_saved', startTime, endTime, matched: 0, totalMembers: 0, points: 0, unmatched: [], awarded: [] };
    }

    // L'API CoC ne fournit le détail par joueur (members) que pour la saison la
    // plus récente. Fallback : reconstruire le nombre d'attaques par joueur
    // depuis attackLog[].districts[].attacks[] si présent. Sans aucun détail,
    // impossible d'attribuer des points → on ne crée rien pour réessayer plus tard.
    let memberList: any[] = season.members?.items ?? season.members ?? [];
    if (memberList.length === 0) {
        memberList = buildMembersFromAttackLog(season);
    }
    if (memberList.length === 0 && (season.totalAttacks ?? 0) > 0) {
        return { status: 'no_details', startTime, endTime, matched: 0, totalMembers: 0, points: 0, unmatched: [], awarded: [] };
    }

    const raidEvent = existing ?? await eventDb.createRaidEvent({
        clan_id: clanTag,
        clan_number: clanNum,
        start_time: startTime,
        end_time: endTime,
        total_attacks: season.totalAttacks ?? 0,
        districts_destroyed: season.enemyDistrictsDestroyed ?? season.districtsDestroyed ?? 0,
        points_saved: false,
    });

    const userRepo = AppDataSource.getRepository(User);
    const registeredUsers = await userRepo.find();
    const userByTag = new Map(registeredUsers.map(u => [u.game_id?.toUpperCase(), u]));

    const members = memberList;
    const participations: RaidParticipationData[] = [];
    const unmatched: string[] = [];
    const awarded: RaidSaveResult['awarded'] = [];
    let matched = 0;
    let totalPoints = 0;

    for (const member of members) {
        if (!member?.tag) continue;
        const tag = member.tag.toUpperCase();
        const user = userByTag.get(tag);
        if (!user) {
            unmatched.push(member.name ?? tag);
            continue;
        }

        const attacksUsed = member.attacks ?? member.attackCount ?? 0;
        const attacksLimit = (member.attackLimit ?? 5) + (member.bonusAttackLimit ?? 1);
        const points = calcRaidPoints(attacksUsed, attacksLimit);

        participations.push({
            user,
            coc_tag: tag,
            coc_name: member.name ?? tag,
            attacks_used: attacksUsed,
            attacks_limit: attacksLimit,
            districts_destroyed: member.districtsDestroyed ?? 0,
            capital_resources_looted: member.capitalResourcesLooted ?? 0,
            points_awarded: points,
        });
        matched++;
        if (points > 0) {
            totalPoints += points;
            awarded.push({ name: member.name ?? tag, points, attacks: attacksUsed, limit: attacksLimit });
        }
    }

    await eventDb.saveRaidParticipations(raidEvent, participations);
    await eventDb.applyRaidPoints(raidEvent);

    return { status: 'saved', startTime, endTime, matched, totalMembers: members.length, points: totalPoints, unmatched, awarded };
}

export interface RaidSyncSummary {
    processed: RaidSaveResult[];
    skippedOngoing: number;
    totalPoints: number;
}

// Récupère les saisons de raid terminées depuis `since` et sauvegarde celles
// qui n'ont pas encore leurs points attribués.
export async function syncRaidsSince(clanTag: string, clanNum: number, since: Date): Promise<RaidSyncSummary> {
    // 60 saisons ≈ 14 mois de raids hebdo : couvre toute l'année asso sans pagination
    const seasons = await cocService.getRaidSeasons(clanTag, 60);
    if (!seasons) throw new Error('Impossible de récupérer les raids (API CoC).');

    const items: any[] = (seasons as any).items ?? seasons ?? [];
    const ended = items.filter(s => {
        const state = s.state ?? 'ended';
        const end = s.endTime ? parseCocDate(s.endTime) : null;
        return state === 'ended' && end && end >= since;
    });
    const skippedOngoing = items.filter(s => (s.state ?? '') === 'ongoing').length;

    // Du plus ancien au plus récent
    ended.sort((a, b) => parseCocDate(a.startTime).getTime() - parseCocDate(b.startTime).getTime());

    const processed: RaidSaveResult[] = [];
    let totalPoints = 0;
    for (const season of ended) {
        const result = await saveRaidSeason(season, clanTag, clanNum);
        processed.push(result);
        totalPoints += result.points;
    }

    return { processed, skippedOngoing, totalPoints };
}
