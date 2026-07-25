import {
    ChatInputCommandInteraction,
    SlashCommandBuilder,
    EmbedBuilder,
    PermissionFlagsBits,
} from 'discord.js';
import { AppDataSource } from '../config/dataSource';
import { User } from '../entities/User';
import { WarEvent } from '../entities/WarEvent';
import { WarParticipation } from '../entities/WarParticipation';
import { scrapeWar } from '../services/clashspotScraper';

const POINTS_PER_ATTACK = 0.25;

function parseDateFR(dateStr: string): Date | null {
    const m = dateStr.match(/(\d{2})\/(\d{2})\/(\d{4})/);
    if (!m) return null;
    return new Date(`${m[3]}-${m[2]}-${m[1]}T00:00:00Z`);
}

export const data = new SlashCommandBuilder()
    .setName('get-war-points')
    .setDescription('Scrape ClashSpot et attribue les points de GDC aux joueurs inscrits')
    .addStringOption(o =>
        o.setName('url')
            .setDescription('URL ClashSpot de la guerre')
            .setRequired(true)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator);

export async function execute(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply();

    const url = interaction.options.getString('url', true);

    if (!url.includes('clashspot.net') || !url.includes('/war/')) {
        await interaction.editReply('❌ URL invalide. Format attendu : `https://clashspot.net/fr/clan/.../war/...`');
        return;
    }

    const clanTagMatch = url.match(/\/clan\/([A-Z0-9]+)\//i);
    const clanTag = clanTagMatch ? `#${clanTagMatch[1].toUpperCase()}` : '';

    let scrapResult;
    try {
        scrapResult = await scrapeWar(url);
    } catch (err) {
        console.error('Erreur scraping ClashSpot war:', err);
        await interaction.editReply('❌ Impossible de récupérer la page ClashSpot. Vérifie l\'URL.');
        return;
    }

    if (scrapResult.players.length === 0) {
        await interaction.editReply('❌ Aucun joueur trouvé sur cette page.');
        return;
    }

    const endDate = parseDateFR(scrapResult.endDate);
    if (!endDate) {
        await interaction.editReply('❌ Date de fin introuvable sur la page.');
        return;
    }

    const eventRepo = AppDataSource.getRepository(WarEvent);
    const existing = await eventRepo.findOne({
        where: { clan_id: clanTag, end_time: endDate, type: 'gdc' },
    });
    if (existing) {
        await interaction.editReply(`❌ Cette GDC (${scrapResult.endDate} — ${clanTag}) a déjà été sauvegardée.`);
        return;
    }

    const userRepo = AppDataSource.getRepository(User);
    const registeredUsers = await userRepo.find();
    const userByTag = new Map(registeredUsers.map(u => [u.game_id?.toUpperCase(), u]));

    const warEvent = eventRepo.create({
        type: 'gdc' as const,
        clan_id: clanTag,
        clan_number: 0,
        start_time: endDate,
        end_time: endDate,
        attacks_per_member: scrapResult.attacksPerMember,
        team_size: scrapResult.teamSize,
        result: 'unknown',
        points_saved: true,
    });
    await eventRepo.save(warEvent);

    const partRepo = AppDataSource.getRepository(WarParticipation);
    const results: { name: string; tag: string; attacks: number; maxAtk: number; points: number; registered: boolean }[] = [];
    let totalPointsGiven = 0;
    let matchedCount = 0;

    for (const player of scrapResult.players) {
        const pts = player.attacksDone * POINTS_PER_ATTACK;
        const user = userByTag.get(player.tag.toUpperCase());

        results.push({
            name: player.name,
            tag: player.tag,
            attacks: player.attacksDone,
            maxAtk: scrapResult.attacksPerMember,
            points: pts,
            registered: !!user,
        });

        if (user) {
            const detail = player.stars.map((s, i) => ({
                stars: s,
                destructionPercentage: player.percents[i] ?? 0,
            }));

            await partRepo.save(partRepo.create({
                user_id: user.id,
                war_event_id: warEvent.id,
                coc_tag: player.tag,
                coc_name: player.name,
                attacks_made: player.attacksDone,
                attacks_expected: scrapResult.attacksPerMember,
                total_destruction: player.percents.reduce((a, b) => a + b, 0),
                total_stars: player.stars.reduce((a, b) => a + b, 0),
                points_awarded: pts,
                attacks_detail: detail,
            }));

            if (pts > 0) {
                await userRepo.increment({ id: user.id }, 'war', pts);
                totalPointsGiven += pts;
                matchedCount++;
            }
        }
    }

    const lines = results.map(r => {
        const status = r.registered ? '✅' : '❌';
        const ptsStr = r.points > 0 ? `+${r.points}` : '0';
        return `${status} **${r.name}** — ${r.attacks}/${r.maxAtk} atk → **${ptsStr} pts**`;
    });

    const chunks: string[] = [];
    let current = '';
    for (const line of lines) {
        if ((current + '\n' + line).length > 4000) {
            chunks.push(current);
            current = line;
        } else {
            current = current ? current + '\n' + line : line;
        }
    }
    if (current) chunks.push(current);

    const embeds = chunks.map((chunk, i) => {
        const embed = new EmbedBuilder()
            .setColor(0xE74C3C)
            .setDescription(chunk);

        if (i === 0) {
            embed.setTitle(`⚔️ GDC — ${scrapResult.endDate} (${scrapResult.teamSize}v${scrapResult.teamSize})`);
        }
        if (i === chunks.length - 1) {
            embed.setFooter({
                text: `${scrapResult.players.length} joueurs | ${matchedCount} inscrits crédités | ${totalPointsGiven} pts distribués | Barème: ${POINTS_PER_ATTACK} pts/atk`,
            });
        }
        return embed;
    });

    await interaction.editReply({ embeds });
}
