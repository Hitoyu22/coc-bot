import {
    ChatInputCommandInteraction,
    SlashCommandBuilder,
    EmbedBuilder,
    PermissionFlagsBits,
} from 'discord.js';
import { cocService } from '../services/coc';
import { saveRaidSeason } from '../services/raidSync';
import { getClanTag } from '../utils/clanHelper';

export const data = new SlashCommandBuilder()
    .setName('save-raid')
    .setDescription('Sauvegarde UN raid précis et attribue les points (voir aussi /sync-raids)')
    .addIntegerOption(o =>
        o.setName('clan').setDescription('Numéro du clan').setRequired(false)
            .addChoices({ name: 'Clan 1', value: 1 }, { name: 'Clan 2', value: 2 })
    )
    .addIntegerOption(o =>
        o.setName('index').setDescription('Index du raid (1 = dernier, 2 = avant-dernier...)').setRequired(false)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator);

export async function execute(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply();

    const clanNum = interaction.options.getInteger('clan') ?? 1;
    const idx = Math.max(0, (interaction.options.getInteger('index') ?? 1) - 1);

    const clanTag = getClanTag(clanNum);
    if (!clanTag) {
        await interaction.editReply(`❌ Tag CoC du clan ${clanNum} non configuré. Ajoute \`COC_CLAN_${clanNum}_TAG\` dans le .env.`);
        return;
    }

    let seasons: any = null;
    try {
        seasons = await cocService.getRaidSeasons(clanTag, idx + 3);
    } catch (apiErr: any) {
        await interaction.editReply(`❌ Erreur API COC : ${apiErr?.message ?? 'Erreur inconnue'}`);
        return;
    }

    if (!seasons) {
        await interaction.editReply('❌ Impossible de récupérer les raids (API COC). Vérifie la configuration du clan.');
        return;
    }

    const items = (seasons as any).items ?? seasons ?? [];
    if (!items || items.length <= idx) {
        await interaction.editReply(`Raid index ${idx + 1} introuvable.`);
        return;
    }

    const season = items[idx];
    if ((season.state ?? '') === 'ongoing') {
        await interaction.editReply('⚠️ Ce raid est encore **en cours**. Attends sa fin (ou utilise `/sync-raids` qui l\'ignore automatiquement).');
        return;
    }

    const result = await saveRaidSeason(season, clanTag, clanNum);

    if (result.status === 'already_saved') {
        await interaction.editReply('⚠️ Ce raid a déjà été sauvegardé et les points attribués.');
        return;
    }

    if (result.status === 'no_details') {
        await interaction.editReply(
            '❌ **Détail par joueur indisponible** pour ce raid : l\'API CoC ne le fournit que pour le raid le plus récent.\n' +
            'Impossible d\'attribuer les points automatiquement → utilise `/set-points` si besoin.'
        );
        return;
    }

    const embed = new EmbedBuilder()
        .setTitle(`✅ Raid sauvegardé — Clan ${clanNum}`)
        .setColor(0xF1C40F)
        .addFields(
            { name: 'Début', value: result.startTime.toLocaleDateString('fr-FR'), inline: true },
            { name: 'Joueurs matchés', value: `${result.matched}/${result.totalMembers}`, inline: true },
            {
                name: 'Points attribués',
                value: result.awarded.length > 0
                    ? result.awarded.map(a => `${a.name}: +${a.points}pt (${a.attacks}/${a.limit} atk)`).join('\n')
                    : 'Aucun (< 5 attaques pour tous)',
                inline: false,
            },
        )
        .setTimestamp();

    if (result.unmatched.length > 0) {
        embed.addFields({ name: '⚠️ Non trouvés en BDD', value: result.unmatched.slice(0, 20).join(', '), inline: false });
    }

    await interaction.editReply({ embeds: [embed] });
}
