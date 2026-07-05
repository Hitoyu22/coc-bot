import { config } from '../config/config';

export function getClanTag(clanNumber: number): string | null {
    const raw = clanNumber === 1 ? config.COC_CLAN_1_TAG : config.COC_CLAN_2_TAG;
    if (!raw) return null;
    return raw.startsWith('#') ? raw : `#${raw}`;
}

export function getClanChannelId(clanNumber: number): string | null {
    return clanNumber === 1 ? (config.CLAN_1_ID ?? null) : (config.CLAN_2_ID ?? null);
}
