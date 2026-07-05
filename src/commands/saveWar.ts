import {
    ChatInputCommandInteraction,
    SlashCommandBuilder,
    EmbedBuilder,
    PermissionFlagsBits,
} from 'discord.js';
import { cocService } from '../services/coc';
import { eventDb, calcWarPoints, calcLeaguePoints, WarParticipationData } from '../services/eventDatabase';
import { AppDataSource } from '../config/dataSource';
import { User } from '../entities/User';
import { getClanTag } from '../utils/clanHelper';
import { parseCocDate } from '../utils/cocDate';

export const data = new SlashCommandBuilder()
    .setName('save-war')
    .setDescription('Sauvegarde une GDC terminée et attribue les points')
    .addIntegerOption(o =>
        o.setName('clan').setDescription('Numéro du clan').setRequired(false)
            .addChoices({ name: 'Clan 1', value: 1 }, { name: 'Clan 2', value: 2 })
    )
    .addStringOption(o =>
        o.setName('type').setDescription('Type de guerre').setRequired(false)
            .addChoices({ name: 'GDC (Guerre de Clan)', value: 'gdc' }, { name: 'Ligue (CWL)', value: 'league' })
    )
    .addStringOption(o =>
        o.setName('war_tag').setDescription('Tag de guerre CWL (optionnel, si ligue)').setRequired(false)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator);

export async function execute(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply({ ephemeral: false });

    const clanNum = interaction.options.getInteger('clan') ?? 1;
    const warType = (interaction.options.getString('type') ?? 'gdc') as 'gdc' | 'league';
    const warTagOpt = interaction.options.getString('war_tag');

    const clanTag = getClanTag(clanNum);
    if (!clanTag) {
        await interaction.editReply(`❌ Tag CoC du clan ${clanNum} non configuré. Ajoute \`COC_CLAN_${clanNum}_TAG\` dans le .env.`);
        return;
    }

    let war: any = null;
    let actualWarTag: string | null = warTagOpt;

    try {
        if (warType === 'league' && warTagOpt) {
            war = await cocService.getLeagueWar(warTagOpt);
        } else {
            war = await cocService.getCurrentWar(clanTag);
        }
    } catch (apiErr: any) {
        console.error('[save-war] API error:', apiErr);
        await interaction.editReply(`❌ Erreur API COC : ${apiErr?.message ?? 'Erreur inconnue'}`);
        return;
    }

    if (!war) {
        await interaction.editReply(
            warType === 'league' && warTagOpt
                ? `❌ Guerre de ligue introuvable pour le tag \`${warTagOpt}\`. Vérifie le tag.`
                : `❌ Impossible de récupérer la guerre actuelle. Le clan n'est peut-être pas en guerre, ou le journal est privé.`
        );
        return;
    }

    const state: string = war.state ?? (war as any).status ?? '';
    if (state === 'notInWar') {
        await interaction.editReply('Le clan n\'est pas en guerre actuellement.');
        return;
    }

    if (state === 'preparation') {
        await interaction.editReply('⚠️ La guerre est encore en phase de préparation. Attends le début des combats.');
        return;
    }

    const startTime = war.startTime ? parseCocDate(war.startTime) : new Date();
    const endTime = war.endTime ? parseCocDate(war.endTime) : null;
    const clanTagNorm = clanTag.toUpperCase();
    const clan = (war.clan?.tag?.toUpperCase() === clanTagNorm)
        ? war.clan
        : war.opponent;

    const existing = await eventDb.findWarEventByStartTime(clanTag, startTime);
    if (existing?.points_saved) {
        await interaction.editReply('⚠️ Cette guerre a déjà été sauvegardée et les points attribués.');
        return;
    }

    const warEvent = existing ?? await eventDb.createWarEvent({
        type: warType,
        clan_id: clanTag,
        clan_number: clanNum,
        war_tag: actualWarTag,
        start_time: startTime,
        end_time: endTime,
        attacks_per_member: war.attacksPerMember ?? 2,
        team_size: war.teamSize ?? 0,
        opponent_name: war.opponent?.name ?? null,
        result: war.result ?? war.status ?? 'unknown',
        points_saved: false,
    });

    // Match members with registered users
    const userRepo = AppDataSource.getRepository(User);
    const registeredUsers = await userRepo.find();
    const userByTag = new Map(registeredUsers.map(u => [u.game_id?.toUpperCase(), u]));

    const members: any[] = clan?.members ?? [];
    const participations: WarParticipationData[] = [];
    let matched = 0;
    let unmatched: string[] = [];

    for (const member of members) {
        const tag = member.tag?.toUpperCase?.() ?? member.tag;
        const user = userByTag.get(tag);
        if (!user) {
            unmatched.push(member.name ?? tag);
            continue;
        }

        const attacks: any[] = member.attacks ?? [];
        const attacksMade = attacks.length;
        const attacksExpected = war.attacksPerMember ?? 2;
        const totalStars = attacks.reduce((s: number, a: any) => s + (a.stars ?? 0), 0);
        // la lib clashofclans.js renomme destructionPercentage → destruction
        const totalDestruction = attacks.reduce((s: number, a: any) => s + (a.destruction ?? a.destructionPercentage ?? 0), 0);

        const points = warType === 'gdc'
            ? calcWarPoints(attacksMade, attacksExpected)
            : calcLeaguePoints(attacksMade, attacksExpected);

        participations.push({
            user,
            coc_tag: tag,
            coc_name: member.name ?? tag,
            attacks_made: attacksMade,
            attacks_expected: attacksExpected,
            total_destruction: totalDestruction,
            total_stars: totalStars,
            points_awarded: points,
            attacks_detail: attacks.map((a: any, i: number) => ({
                order: i + 1,
                defenderTag: a.defenderTag ?? '',
                stars: a.stars ?? 0,
                destructionPercentage: a.destruction ?? a.destructionPercentage ?? 0,
            })),
        });
        matched++;
    }

    await eventDb.saveWarParticipations(warEvent, participations);
    await eventDb.applyWarPoints(warEvent);

    const typeLabel = warType === 'gdc' ? 'GDC' : 'Ligue';
    const embed = new EmbedBuilder()
        .setTitle(`✅ ${typeLabel} sauvegardée — Clan ${clanNum}`)
        .setColor(0x57F287)
        .addFields(
            { name: 'Adversaire', value: war.opponent?.name ?? '?', inline: true },
            { name: 'Résultat', value: war.result ?? '?', inline: true },
            { name: 'Joueurs matchés', value: `${matched}/${members.length}`, inline: true },
            { name: 'Points attribués', value: participations.map(p => `${p.coc_name}: +${p.points_awarded}pt`).join('\n') || 'Aucun', inline: false },
        )
        .setTimestamp();

    if (unmatched.length > 0) {
        embed.addFields({ name: '⚠️ Non trouvés en BDD', value: unmatched.slice(0, 20).join(', '), inline: false });
    }

    await interaction.editReply({ embeds: [embed] });
}
