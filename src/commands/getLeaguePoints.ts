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
import { scrapeLeague } from '../services/clashspotScraper';

function leaguePoints(attacks: number): number {
    if (attacks >= 6) return 1;
    if (attacks >= 4) return 0.5;
    if (attacks >= 2) return 0.25;
    return 0;
}

export const data = new SlashCommandBuilder()
    .setName('get-league-points')
    .setDescription('Scrape ClashSpot et attribue les points de ligue (CWL) aux joueurs inscrits')
    .addStringOption(o =>
        o.setName('url')
            .setDescription('URL ClashSpot de la CWL')
            .setRequired(true)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator);

export async function execute(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply();

    const url = interaction.options.getString('url', true);

    if (!url.includes('clashspot.net') || !url.includes('clan-war-leagues')) {
        await interaction.editReply('❌ URL invalide. Format attendu : `https://clashspot.net/fr/clan/.../clan-war-leagues/...`');
        return;
    }

    const clanTagMatch = url.match(/\/clan\/([A-Z0-9]+)\//i);
    const clanTag = clanTagMatch ? `#${clanTagMatch[1].toUpperCase()}` : '';

    let scrapResult;
    try {
        scrapResult = await scrapeLeague(url);
    } catch (err) {
        console.error('Erreur scraping ClashSpot league:', err);
        await interaction.editReply('❌ Impossible de récupérer la page ClashSpot. Vérifie l\'URL.');
        return;
    }

    if (scrapResult.players.length === 0) {
        await interaction.editReply('❌ Aucun joueur trouvé sur cette page.');
        return;
    }

    const seasonDate = scrapResult.date !== 'inconnue' ? new Date(`${scrapResult.date}T00:00:00Z`) : null;
    if (!seasonDate) {
        await interaction.editReply('❌ Date de la saison introuvable dans l\'URL.');
        return;
    }

    const eventRepo = AppDataSource.getRepository(WarEvent);
    const existing = await eventRepo.findOne({
        where: { clan_id: clanTag, start_time: seasonDate, type: 'league' },
    });
    if (existing) {
        await interaction.editReply(`❌ Cette ligue (${scrapResult.date} — ${clanTag}) a déjà été sauvegardée.`);
        return;
    }

    const userRepo = AppDataSource.getRepository(User);
    const registeredUsers = await userRepo.find();
    const userByTag = new Map(registeredUsers.map(u => [u.game_id?.toUpperCase(), u]));

    const warEvent = eventRepo.create({
        type: 'league' as const,
        clan_id: clanTag,
        clan_number: 0,
        start_time: seasonDate,
        end_time: seasonDate,
        attacks_per_member: 1,
        team_size: scrapResult.players.length,
        result: 'unknown',
        points_saved: true,
    });
    await eventRepo.save(warEvent);

    const partRepo = AppDataSource.getRepository(WarParticipation);
    const results: { name: string; tag: string; attacks: number; stars: number; points: number; registered: boolean }[] = [];
    let totalPointsGiven = 0;
    let matchedCount = 0;

    for (const player of scrapResult.players) {
        const pts = leaguePoints(player.attacks);
        const user = userByTag.get(player.tag.toUpperCase());

        results.push({
            name: player.name,
            tag: player.tag,
            attacks: player.attacks,
            stars: player.stars,
            points: pts,
            registered: !!user,
        });

        if (user) {
            await partRepo.save(partRepo.create({
                user_id: user.id,
                war_event_id: warEvent.id,
                coc_tag: player.tag,
                coc_name: player.name,
                attacks_made: player.attacks,
                attacks_expected: 7,
                total_destruction: player.destruction,
                total_stars: player.stars,
                points_awarded: pts,
                attacks_detail: null,
            }));

            if (pts > 0) {
                await userRepo.increment({ id: user.id }, 'ligue', pts);
                totalPointsGiven += pts;
                matchedCount++;
            }
        }
    }

    const lines = results.map(r => {
        const status = r.registered ? '✅' : '❌';
        const ptsStr = r.points > 0 ? `+${r.points}` : '0';
        return `${status} **${r.name}** — ${r.attacks} atk, ${r.stars}⭐ → **${ptsStr} pts**`;
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
            .setColor(0x3498DB)
            .setDescription(chunk);

        if (i === 0) {
            embed.setTitle(`🏆 Ligue (CWL) — ${scrapResult.date}`);
        }
        if (i === chunks.length - 1) {
            embed.setFooter({
                text: `${scrapResult.players.length} joueurs | ${matchedCount} inscrits crédités | ${totalPointsGiven} pts distribués | 6-7atk=1pt 4-5=0.5 2-3=0.25`,
            });
        }
        return embed;
    });

    await interaction.editReply({ embeds });
}
