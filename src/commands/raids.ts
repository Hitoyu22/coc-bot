import {
    ChatInputCommandInteraction,
    SlashCommandBuilder,
    EmbedBuilder,
    PermissionFlagsBits,
} from 'discord.js';
import { cocService } from '../services/coc';
import { eventDb } from '../services/eventDatabase';
import { getClanTag } from '../utils/clanHelper';

export const data = new SlashCommandBuilder()
    .setName('raids')
    .setDescription('Affiche les derniers Raids du clan')
    .addIntegerOption(o =>
        o.setName('clan').setDescription('Numéro du clan (1 ou 2)').setRequired(false)
            .addChoices({ name: 'Clan 1', value: 1 }, { name: 'Clan 2', value: 2 })
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator);

export async function execute(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply({ ephemeral: true });

    const clanNum = interaction.options.getInteger('clan') ?? 1;
    const clanTag = getClanTag(clanNum);
    if (!clanTag) {
        await interaction.editReply(`❌ Tag CoC du clan ${clanNum} non configuré. Ajoute \`COC_CLAN_${clanNum}_TAG\` dans le .env.`);
        return;
    }

    const seasons = await cocService.getRaidSeasons(clanTag, 10);
    if (!seasons) {
        await interaction.editReply('Impossible de récupérer les saisons de raid (API COC).');
        return;
    }

    const savedEvents = await eventDb.getRecentRaidEvents(clanNum, 20);
    const savedByStart = new Set(savedEvents.map(e => e.start_time.toISOString().slice(0, 10)));

    const items = (seasons as any).items ?? seasons ?? [];
    if (!items || items.length === 0) {
        await interaction.editReply('Aucun raid trouvé.');
        return;
    }

    const embed = new EmbedBuilder()
        .setTitle(`🏰 Derniers Raids — Clan ${clanNum}`)
        .setColor(0xF1C40F)
        .setTimestamp();

    const lines: string[] = [];
    for (const season of items.slice(0, 8)) {
        const startDate = season.startTime ? new Date(season.startTime) : null;
        const dateStr = startDate ? startDate.toLocaleDateString('fr-FR') : '?';
        const dateKey = startDate?.toISOString().slice(0, 10) ?? '';
        const saved = savedByStart.has(dateKey);
        const totalAttacks = season.totalAttacks ?? 0;
        const districtsDestroyed = season.districtsDestroyed ?? 0;
        const savedEmoji = saved ? '💾' : '⏳';

        lines.push(
            `${savedEmoji} **${dateStr}** — ${totalAttacks} attaques — ${districtsDestroyed} districts détruits`
        );
    }

    embed.setDescription(lines.join('\n') || 'Aucune donnée.');
    embed.setFooter({ text: '💾 = points sauvegardés | ⏳ = non sauvegardé' });

    await interaction.editReply({ embeds: [embed] });
}
