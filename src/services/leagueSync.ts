import { cocService } from './coc';
import { eventDb, calcLeaguePoints, WarParticipationData } from './eventDatabase';
import { AppDataSource } from '../config/dataSource';
import { User } from '../entities/User';
import { parseCocDate } from '../utils/cocDate';

export interface LeaguePlayerStats {
    tag: string;
    name: string;
    rostered: number;      // nb de guerres où le joueur était aligné
    attacksMade: number;   // 1 attaque max par guerre en CWL
    totalStars: number;
    totalDestruction: number;
    rounds: { round: number; stars: number; destruction: number; attacked: boolean }[];
}

export interface LeagueSyncResult {
    status: 'saved' | 'already_saved' | 'not_ended' | 'no_group';
    season?: string;
    warsFound?: number;
    startTime?: Date;
    endTime?: Date;
    matched?: number;
    totalPlayers?: number;
    points?: number;
    unmatched?: string[];
    awarded?: { name: string; points: number; attacks: number; rostered: number }[];
}

// Sauvegarde la dernière saison de ligue (CWL) terminée : parcourt le groupe,
// requête chaque warTag, agrège les attaques par joueur sur toute la saison,
// puis applique le barème ligue (1 pt si ≤ 1 ratée, 0.5 si a participé).
export async function syncLeague(clanTag: string, clanNum: number): Promise<LeagueSyncResult> {
    const clanTagNorm = clanTag.toUpperCase();

    const group: any = await cocService.getClanWarLeagueGroup(clanTag);
    if (!group) return { status: 'no_group' };

    const season: string = group.season ?? 'inconnue';
    if ((group.state ?? '') !== 'ended') {
        return { status: 'not_ended', season };
    }

    // Idempotence : une saison CWL = un WarEvent identifié par ce tag synthétique
    const eventTag = `cwl-${season}-clan${clanNum}`;
    const existing = await eventDb.findWarEventByTag(eventTag);
    if (existing?.points_saved) {
        return { status: 'already_saved', season };
    }

    // Parcours des rounds : chaque round contient 4 warTags, un seul concerne notre clan
    const stats = new Map<string, LeaguePlayerStats>();
    let warsFound = 0;
    let minStart: Date | null = null;
    let maxEnd: Date | null = null;

    const rounds: any[] = group.rounds ?? [];
    for (let r = 0; r < rounds.length; r++) {
        const warTags: string[] = rounds[r]?.warTags ?? rounds[r] ?? [];
        for (const warTag of warTags) {
            if (!warTag || warTag === '#0') continue;
            const war: any = await cocService.getLeagueWar(warTag);
            if (!war) continue;

            const ourSide =
                war.clan?.tag?.toUpperCase() === clanTagNorm ? war.clan
                : war.opponent?.tag?.toUpperCase() === clanTagNorm ? war.opponent
                : null;
            if (!ourSide) continue; // guerre entre deux autres clans du groupe

            warsFound++;
            const start = war.startTime ? parseCocDate(war.startTime) : null;
            const end = war.endTime ? parseCocDate(war.endTime) : null;
            if (start && (!minStart || start < minStart)) minStart = start;
            if (end && (!maxEnd || end > maxEnd)) maxEnd = end;

            for (const member of ourSide.members ?? []) {
                const tag = member.tag?.toUpperCase();
                if (!tag) continue;
                const entry: LeaguePlayerStats = stats.get(tag) ?? {
                    tag,
                    name: member.name ?? tag,
                    rostered: 0,
                    attacksMade: 0,
                    totalStars: 0,
                    totalDestruction: 0,
                    rounds: [],
                };
                entry.rostered++;
                const attacks: any[] = member.attacks ?? [];
                const attacked = attacks.length > 0;
                if (attacked) {
                    entry.attacksMade += attacks.length;
                    entry.totalStars += attacks.reduce((s, a) => s + (a.stars ?? 0), 0);
                    // la lib clashofclans.js renomme destructionPercentage → destruction
                    entry.totalDestruction += attacks.reduce((s, a) => s + (a.destruction ?? a.destructionPercentage ?? 0), 0);
                }
                entry.rounds.push({
                    round: r + 1,
                    stars: attacks[0]?.stars ?? 0,
                    destruction: attacks[0]?.destruction ?? attacks[0]?.destructionPercentage ?? 0,
                    attacked,
                });
                stats.set(tag, entry);
            }
            break; // notre guerre du round trouvée, inutile de requêter les autres tags
        }
    }

    if (warsFound === 0) {
        return { status: 'no_group', season };
    }

    const warEvent = existing ?? await eventDb.createWarEvent({
        type: 'league',
        clan_id: clanTag,
        clan_number: clanNum,
        war_tag: eventTag,
        start_time: minStart ?? new Date(),
        end_time: maxEnd,
        attacks_per_member: 1,
        team_size: group.clans?.find((c: any) => c.tag?.toUpperCase() === clanTagNorm)?.members?.length ?? 0,
        opponent_name: `CWL ${season}`,
        result: 'cwl',
        points_saved: false,
    });

    const userRepo = AppDataSource.getRepository(User);
    const users = await userRepo.find();
    const userByTag = new Map(users.map(u => [u.game_id?.toUpperCase(), u]));

    const participations: WarParticipationData[] = [];
    const unmatched: string[] = [];
    const awarded: LeagueSyncResult['awarded'] = [];
    let matched = 0;
    let totalPoints = 0;

    for (const p of stats.values()) {
        const user = userByTag.get(p.tag);
        if (!user) {
            unmatched.push(p.name);
            continue;
        }
        // rostered = nb de guerres alignées = nb d'attaques attendues (1/guerre)
        const points = calcLeaguePoints(p.attacksMade, p.rostered);
        participations.push({
            user,
            coc_tag: p.tag,
            coc_name: p.name,
            attacks_made: p.attacksMade,
            attacks_expected: p.rostered,
            total_destruction: p.totalDestruction,
            total_stars: p.totalStars,
            points_awarded: points,
            attacks_detail: p.rounds.map(r => ({
                order: r.round,
                defenderTag: '',
                stars: r.stars,
                destructionPercentage: r.destruction,
            })),
        });
        matched++;
        if (points > 0) {
            totalPoints += points;
            awarded.push({ name: p.name, points, attacks: p.attacksMade, rostered: p.rostered });
        }
    }

    await eventDb.saveWarParticipations(warEvent, participations);
    await eventDb.applyWarPoints(warEvent);

    return {
        status: 'saved',
        season,
        warsFound,
        startTime: minStart ?? undefined,
        endTime: maxEnd ?? undefined,
        matched,
        totalPlayers: stats.size,
        points: totalPoints,
        unmatched,
        awarded: awarded.sort((a, b) => b.points - a.points),
    };
}
