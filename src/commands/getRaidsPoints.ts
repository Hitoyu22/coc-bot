import {
    ChatInputCommandInteraction,
    SlashCommandBuilder,
    EmbedBuilder,
    PermissionFlagsBits,
} from 'discord.js';
import { AppDataSource } from '../config/dataSource';
import { User } from '../entities/User';
import { RaidEvent } from '../entities/RaidEvent';
import { RaidParticipation } from '../entities/RaidParticipation';
import { scrapeRaidSeason } from '../services/clashspotScraper';

const POINTS_PER_5_ATTACKS = 0.25;

function parseDateFR(dateStr: string): Date | null {
    const m = dateStr.match(/(\d{2})\/(\d{2})\/(\d{4})/);
    if (!m) return null;
    return new Date(`${m[3]}-${m[2]}-${m[1]}T00:00:00Z`);
}

export const data = new SlashCommandBuilder()
    .setName('get-raids-points')
    .setDescription('Scrape ClashSpot et attribue les points de raids aux joueurs inscrits')
    .addStringOption(o =>
        o.setName('url')
            .setDescription('URL ClashSpot de la saison de raids')
            .setRequired(true)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator);

export async function execute(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply();

    const url = interaction.options.getString('url', true);

    if (!url.includes('clashspot.net') || !url.includes('capital-raid-seasons')) {
        await interaction.editReply('❌ URL invalide. Format attendu : `https://clashspot.net/fr/clan/.../capital-raid-seasons/...`');
        return;
    }

    const clanTagMatch = url.match(/\/clan\/([A-Z0-9]+)\//i);
    const clanTag = clanTagMatch ? `#${clanTagMatch[1].toUpperCase()}` : '';

    let scrapResult;
    try {
        scrapResult = await scrapeRaidSeason(url);
    } catch (err) {
        console.error('Erreur scraping ClashSpot:', err);
        await interaction.editReply('❌ Impossible de récupérer la page ClashSpot. Vérifie l\'URL.');
        return;
    }

    if (scrapResult.players.length === 0) {
        await interaction.editReply('❌ Aucun joueur trouvé sur cette page.');
        return;
    }

    const raidDate = parseDateFR(scrapResult.date);
    if (!raidDate) {
        await interaction.editReply('❌ Date du raid introuvable sur la page.');
        return;
    }

    const eventRepo = AppDataSource.getRepository(RaidEvent);
    const existing = await eventRepo.findOne({
        where: { clan_id: clanTag, start_time: raidDate },
    });
    if (existing) {
        await interaction.editReply(`❌ Ce raid (${scrapResult.date} — ${clanTag}) a déjà été sauvegardé.`);
        return;
    }

    const userRepo = AppDataSource.getRepository(User);
    const registeredUsers = await userRepo.find();
    const userByTag = new Map(registeredUsers.map(u => [u.game_id?.toUpperCase(), u]));

    const totalAttacks = scrapResult.players.reduce((s, p) => s + p.attacksDone, 0);

    const raidEvent = eventRepo.create({
        clan_id: clanTag,
        clan_number: 0,
        start_time: raidDate,
        total_attacks: totalAttacks,
        districts_destroyed: 0,
        points_saved: true,
    });
    await eventRepo.save(raidEvent);

    const partRepo = AppDataSource.getRepository(RaidParticipation);
    const results: { name: string; tag: string; attacks: number; points: number; registered: boolean }[] = [];
    let totalPointsGiven = 0;
    let matchedCount = 0;

    for (const player of scrapResult.players) {
        const pts = Math.floor(player.attacksDone / 5) * POINTS_PER_5_ATTACKS;
        const user = userByTag.get(player.tag.toUpperCase());

        results.push({
            name: player.name,
            tag: player.tag,
            attacks: player.attacksDone,
            points: pts,
            registered: !!user,
        });

        if (user) {
            await partRepo.save(partRepo.create({
                user_id: user.id,
                raid_event_id: raidEvent.id,
                coc_tag: player.tag,
                coc_name: player.name,
                attacks_used: player.attacksDone,
                attacks_limit: player.attacksMax,
                districts_destroyed: 0,
                capital_resources_looted: 0,
                points_awarded: pts,
            }));

            if (pts > 0) {
                await userRepo.increment({ id: user.id }, 'raids', pts);
                totalPointsGiven += pts;
                matchedCount++;
            }
        }
    }

    const lines = results.map(r => {
        const status = r.registered ? '✅' : '❌';
        const ptsStr = r.points > 0 ? `+${r.points}` : '0';
        return `${status} **${r.name}** — ${r.attacks} atk → **${ptsStr} pts**`;
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
            .setColor(0x9B59B6)
            .setDescription(chunk);

        if (i === 0) {
            embed.setTitle(`🏰 Raids — ${scrapResult.date}`);
        }
        if (i === chunks.length - 1) {
            embed.setFooter({
                text: `${scrapResult.players.length} joueurs | ${matchedCount} inscrits crédités | ${totalPointsGiven} pts distribués | Barème: ${POINTS_PER_5_ATTACKS} pts / 5 atk`,
            });
        }
        return embed;
    });

    await interaction.editReply({ embeds });
}
