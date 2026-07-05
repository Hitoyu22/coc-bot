import { AppDataSource } from '../config/dataSource';
import { WarEvent, WarEventType } from '../entities/WarEvent';
import { WarParticipation } from '../entities/WarParticipation';
import { RaidEvent } from '../entities/RaidEvent';
import { RaidParticipation } from '../entities/RaidParticipation';
import { User } from '../entities/User';

export interface AttackDetail {
    order: number;
    defenderTag: string;
    defenderName?: string;
    stars: number;
    destructionPercentage: number;
}

export interface WarParticipationData {
    user: User;
    coc_tag: string;
    coc_name: string;
    attacks_made: number;
    attacks_expected: number;
    total_destruction: number;
    total_stars: number;
    points_awarded: number;
    attacks_detail: AttackDetail[];
}

export interface RaidParticipationData {
    user: User;
    coc_tag: string;
    coc_name: string;
    attacks_used: number;
    attacks_limit: number;
    districts_destroyed: number;
    capital_resources_looted: number;
    points_awarded: number;
}

export function calcWarPoints(attacksMade: number, attacksExpected: number): number {
    if (attacksExpected === 2) {
        if (attacksMade >= 2) return 0.5;
        if (attacksMade === 1) return 0.25;
        return 0;
    }
    // League war (attacksExpected could vary)
    const ratio = attacksMade / attacksExpected;
    const missed = attacksExpected - attacksMade;
    if (missed <= 1) return 1;
    if (attacksMade >= 1) return 0.5;
    return 0;
}

export function calcLeaguePoints(attacksMade: number, attacksExpected: number): number {
    const missed = attacksExpected - attacksMade;
    if (missed <= 1) return 1;
    if (attacksMade >= 1) return 0.5;
    return 0;
}

export function calcRaidPoints(attacksUsed: number, attacksLimit: number): number {
    if (attacksUsed >= 5) return 0.25;
    return 0;
}

export class EventDatabase {
    private get warEventRepo() {
        return AppDataSource.getRepository(WarEvent);
    }
    private get warParticipationRepo() {
        return AppDataSource.getRepository(WarParticipation);
    }
    private get raidEventRepo() {
        return AppDataSource.getRepository(RaidEvent);
    }
    private get raidParticipationRepo() {
        return AppDataSource.getRepository(RaidParticipation);
    }

    async findWarEventByTag(warTag: string): Promise<WarEvent | null> {
        return this.warEventRepo.findOne({ where: { war_tag: warTag } });
    }

    async findWarEventByStartTime(clanId: string, startTime: Date): Promise<WarEvent | null> {
        return this.warEventRepo.findOne({
            where: { clan_id: clanId, start_time: startTime },
        });
    }

    async getRecentWarEvents(clanNumber: number, limit = 10): Promise<WarEvent[]> {
        return this.warEventRepo.find({
            where: { clan_number: clanNumber },
            order: { start_time: 'DESC' },
            take: limit,
        });
    }

    async createWarEvent(data: Partial<WarEvent>): Promise<WarEvent> {
        const event = this.warEventRepo.create(data);
        return this.warEventRepo.save(event);
    }

    async saveWarParticipations(warEvent: WarEvent, participations: WarParticipationData[]): Promise<void> {
        const repo = this.warParticipationRepo;
        for (const p of participations) {
            const existing = await repo.findOne({
                where: { user_id: p.user.id, war_event_id: warEvent.id },
            });
            if (existing) {
                await repo.update(existing.id, {
                    attacks_made: p.attacks_made,
                    attacks_expected: p.attacks_expected,
                    total_destruction: p.total_destruction,
                    total_stars: p.total_stars,
                    points_awarded: p.points_awarded,
                    attacks_detail: p.attacks_detail,
                });
            } else {
                const part = repo.create({
                    user: p.user,
                    user_id: p.user.id,
                    war_event_id: warEvent.id,
                    coc_tag: p.coc_tag,
                    coc_name: p.coc_name,
                    attacks_made: p.attacks_made,
                    attacks_expected: p.attacks_expected,
                    total_destruction: p.total_destruction,
                    total_stars: p.total_stars,
                    points_awarded: p.points_awarded,
                    attacks_detail: p.attacks_detail,
                });
                await repo.save(part);
            }
        }
        await this.warEventRepo.update(warEvent.id, { points_saved: true });
    }

    async applyWarPoints(warEvent: WarEvent): Promise<void> {
        const participations = await this.warParticipationRepo.find({
            where: { war_event_id: warEvent.id },
            relations: { user: true },
        });
        const userRepo = AppDataSource.getRepository(User);
        const column = warEvent.type === 'gdc' ? 'war' : 'ligue';
        for (const p of participations) {
            if (p.points_awarded > 0) {
                await userRepo.increment({ id: p.user_id }, column, p.points_awarded);
            }
        }
    }

    async getWarParticipationsForUser(userId: number): Promise<(WarParticipation & { war_event: WarEvent })[]> {
        return this.warParticipationRepo.find({
            where: { user_id: userId },
            relations: { war_event: true },
            order: { id: 'DESC' },
        }) as any;
    }

    async getWarParticipationsForEvent(warEventId: number): Promise<WarParticipation[]> {
        return this.warParticipationRepo.find({
            where: { war_event_id: warEventId },
        });
    }

    // Raid
    async findRaidEventByStartTime(clanId: string, startTime: Date): Promise<RaidEvent | null> {
        return this.raidEventRepo.findOne({
            where: { clan_id: clanId, start_time: startTime },
        });
    }

    async getRecentRaidEvents(clanNumber: number, limit = 10): Promise<RaidEvent[]> {
        return this.raidEventRepo.find({
            where: { clan_number: clanNumber },
            order: { start_time: 'DESC' },
            take: limit,
        });
    }

    async createRaidEvent(data: Partial<RaidEvent>): Promise<RaidEvent> {
        const event = this.raidEventRepo.create(data);
        return this.raidEventRepo.save(event);
    }

    async saveRaidParticipations(raidEvent: RaidEvent, participations: RaidParticipationData[]): Promise<void> {
        const repo = this.raidParticipationRepo;
        for (const p of participations) {
            const existing = await repo.findOne({
                where: { user_id: p.user.id, raid_event_id: raidEvent.id },
            });
            if (existing) {
                await repo.update(existing.id, {
                    attacks_used: p.attacks_used,
                    attacks_limit: p.attacks_limit,
                    districts_destroyed: p.districts_destroyed,
                    capital_resources_looted: p.capital_resources_looted,
                    points_awarded: p.points_awarded,
                });
            } else {
                const part = repo.create({
                    user: p.user,
                    user_id: p.user.id,
                    raid_event_id: raidEvent.id,
                    coc_tag: p.coc_tag,
                    coc_name: p.coc_name,
                    attacks_used: p.attacks_used,
                    attacks_limit: p.attacks_limit,
                    districts_destroyed: p.districts_destroyed,
                    capital_resources_looted: p.capital_resources_looted,
                    points_awarded: p.points_awarded,
                });
                await repo.save(part);
            }
        }
        await this.raidEventRepo.update(raidEvent.id, { points_saved: true });
    }

    async applyRaidPoints(raidEvent: RaidEvent): Promise<void> {
        const participations = await this.raidParticipationRepo.find({
            where: { raid_event_id: raidEvent.id },
            relations: { user: true },
        });
        const userRepo = AppDataSource.getRepository(User);
        for (const p of participations) {
            if (p.points_awarded > 0) {
                await userRepo.increment({ id: p.user_id }, 'raids', p.points_awarded);
            }
        }
    }

    async getRaidParticipationsForUser(userId: number): Promise<(RaidParticipation & { raid_event: RaidEvent })[]> {
        return this.raidParticipationRepo.find({
            where: { user_id: userId },
            relations: { raid_event: true },
            order: { id: 'DESC' },
        }) as any;
    }

    async getAllWarEvents(): Promise<WarEvent[]> {
        return this.warEventRepo.find({ order: { start_time: 'DESC' } });
    }

    async getAllRaidEvents(): Promise<RaidEvent[]> {
        return this.raidEventRepo.find({ order: { start_time: 'DESC' } });
    }
}

export const eventDb = new EventDatabase();
