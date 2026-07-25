import axios from 'axios';
import * as cheerio from 'cheerio';

export interface RaidPlayer {
    tag: string;
    name: string;
    attacksDone: number;
    attacksMax: number;
}

export interface RaidScrapResult {
    date: string;
    players: RaidPlayer[];
}

async function fetchWithRetry(url: string, retries = 3): Promise<string> {
    for (let attempt = 1; attempt <= retries; attempt++) {
        try {
            const { data } = await axios.get(url, {
                headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
                timeout: 15_000,
            });
            return data;
        } catch (err: any) {
            if (err?.response?.status === 403 && attempt < retries) {
                await new Promise(r => setTimeout(r, 1000 * attempt));
                continue;
            }
            throw err;
        }
    }
    throw new Error('Impossible de récupérer la page après plusieurs tentatives');
}

export async function scrapeRaidSeason(url: string): Promise<RaidScrapResult> {
    const html = await fetchWithRetry(url);

    const $ = cheerio.load(html);

    const dateRaw = $('p.date-preparation .param-value').text().trim();
    const dateMatch = dateRaw.match(/(\d{2}\/\d{2}\/\d{4})/);
    const date = dateMatch?.[1] ?? 'inconnue';

    const players: RaidPlayer[] = [];
    const rows = $('#players tbody tr');

    for (let i = 0; i < rows.length; i++) {
        const row = $(rows[i]);

        const nonParticipantHeader = row.find('strong').text().trim();
        if (nonParticipantHeader.includes('pas participé')) break;

        const link = row.find('a.player-identity');
        if (!link.length) continue;

        const href = link.attr('href') ?? '';
        const tagMatch = href.match(/\/player\/([A-Z0-9]+)\//);
        if (!tagMatch) continue;

        const tag = `#${tagMatch[1]}`;
        const name = link.find('.player-name').text().trim();

        const attacksText = row.find('td:nth-child(3) .value').first().text().trim();
        const atkMatch = attacksText.match(/(\d+)\s*\/\s*(\d+)/);
        const attacksDone = atkMatch ? parseInt(atkMatch[1], 10) : 0;
        const attacksMax = atkMatch ? parseInt(atkMatch[2], 10) : 0;

        if (attacksDone === 0 && attacksMax === 0) continue;

        players.push({ tag, name, attacksDone, attacksMax });
    }

    return { date, players };
}

export interface WarPlayer {
    tag: string;
    name: string;
    attacksDone: number;
    stars: number[];
    percents: number[];
}

export interface WarScrapResult {
    endDate: string;
    teamSize: number;
    attacksPerMember: number;
    players: WarPlayer[];
}

export async function scrapeWar(url: string): Promise<WarScrapResult> {
    const html = await fetchWithRetry(url);
    const $ = cheerio.load(html);

    const endDateRaw = $('p.date-end .param-value').text().trim();
    const endDateMatch = endDateRaw.match(/(\d{2}\/\d{2}\/\d{4})/);
    const endDate = endDateMatch?.[1] ?? 'inconnue';

    const sizeText = $('p.size .param-value').text().trim();
    const sizeMatch = sizeText.match(/(\d+)\s*vs\s*(\d+)/);
    const teamSize = sizeMatch ? parseInt(sizeMatch[1], 10) : 0;

    const atkModeText = $('p.mode .param-value').text().trim();
    const atkCountMatch = atkModeText.match(/x(\d+)/);
    const attacksPerMember = atkCountMatch ? parseInt(atkCountMatch[1], 10) : 2;

    const players: WarPlayer[] = [];
    const positions = $('.members-position');

    positions.each((_, pos) => {
        const clan1Div = $(pos).find('.clan1');
        if (!clan1Div.length) return;

        const headerLink = clan1Div.find('.members-position-name a.player-identity');
        if (!headerLink.length) return;

        const href = headerLink.attr('href') ?? '';
        const tagMatch = href.match(/\/player\/([A-Z0-9]+)\//);
        if (!tagMatch) return;

        const tag = `#${tagMatch[1]}`;
        const name = headerLink.find('.player-name').text().trim();

        const attacks = clan1Div.find('.members-position-attack');
        const attacksDone = attacks.length;

        const stars: number[] = [];
        const percents: number[] = [];

        attacks.each((_, atk) => {
            const starsEl = $(atk).find('.attack-stars');
            const starCount = starsEl.find('.fa-star.stars-win').length;
            stars.push(starCount);

            const pctText = $(atk).find('.attack-percent').text().trim();
            const pctMatch = pctText.match(/(\d+)%/);
            percents.push(pctMatch ? parseInt(pctMatch[1], 10) : 0);
        });

        players.push({ tag, name, attacksDone, stars, percents });
    });

    return { endDate, teamSize, attacksPerMember, players };
}

export interface LeaguePlayer {
    tag: string;
    name: string;
    attacks: number;
    stars: number;
    destruction: number;
}

export interface LeagueScrapResult {
    date: string;
    players: LeaguePlayer[];
}

export async function scrapeLeague(url: string): Promise<LeagueScrapResult> {
    const fullDateMatch = url.match(/clan-war-leagues\/(\d{4}-\d{2}-\d{2})/);
    const monthMatch = url.match(/clan-war-leagues\/(\d{4}-\d{2})(?:\/|$)/);
    let date: string;
    if (fullDateMatch) {
        date = fullDateMatch[1];
    } else if (monthMatch) {
        const [year, month] = monthMatch[1].split('-').map(Number);
        const first = new Date(Date.UTC(year, month - 1, 1));
        const dayOfWeek = first.getUTCDay();
        const offset = (4 - dayOfWeek + 7) % 7;
        const firstThursday = new Date(Date.UTC(year, month - 1, 1 + offset));
        date = firstThursday.toISOString().slice(0, 10);
    } else {
        date = 'inconnue';
    }

    const html = await fetchWithRetry(url);
    const $ = cheerio.load(html);

    const players: LeaguePlayer[] = [];
    const rows = $('#league-clan-members tbody tr');

    rows.each((_, row) => {
        const el = $(row);
        const tag = el.attr('data-sort-id');
        if (!tag) return;

        const nameEl = el.find('td:nth-child(2) .value').first();
        const name = nameEl.text().trim();

        const attacksText = el.find('.player-attacks-container').first().find('.value').text().trim();
        const attacks = parseInt(attacksText, 10) || 0;

        const tds = el.find('td');
        const attackTdIndex = tds.index(el.find('.player-attacks-container').first().closest('td'));

        const starsText = tds.eq(attackTdIndex + 1).find('.value').text().trim();
        const stars = parseInt(starsText, 10) || 0;

        const destructionText = tds.eq(attackTdIndex + 2).find('.value span').first().text().trim();
        const destruction = parseInt(destructionText, 10) || 0;

        players.push({ tag: `#${tag}`, name, attacks, stars, destruction });
    });

    return { date, players };
}
