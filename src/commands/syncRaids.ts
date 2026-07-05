import {
    ChatInputCommandInteraction,
    SlashCommandBuilder,
    EmbedBuilder,
    PermissionFlagsBits,
} from 'discord.js';
import { syncRaidsSince } from '../services/raidSync';
import { settingsService } from '../services/settings';
import { getClanTag } from '../utils/clanHelper';

export const data = new SlashCommandBuilder()
    .setName('sync-raids')
    .setDescription('Attribue les points de TOUS les raids terminés depuis le début d\'année pas encore comptés')
    .addIntegerOption(o =>
        o.setName('clan').setDescription('Clan à synchroniser (défaut : Clan 1)').setRequired(false)
            .addChoices({ name: 'Clan 1', value: 1 }, { name: 'Clan 2', value: 2 })
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator);

export async function execute(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply();

    const clanNum = interaction.options.getInteger('clan') ?? 1;

    const clanTag = getClanTag(clanNum);
    if (!clanTag) {
        await interaction.editReply(`❌ Tag CoC du clan ${clanNum} non configuré. Ajoute \`COC_CLAN_${clanNum}_TAG\` dans le .env.`);
        return;
    }

    const yearStart = await settingsService.getYearStart();
    if (!yearStart) {
        await interaction.editReply(
            '❌ **L\'année de l\'association n\'a pas démarré.**\n' +
            'Lance d\'abord `/start-year` : seuls les raids terminés après cette date sont comptés.'
        );
        return;
    }

    let summary;
    try {
        summary = await syncRaidsSince(clanTag, clanNum, yearStart);
    } catch (err: any) {
        console.error('[sync-raids]', err);
        await interaction.editReply(`❌ ${err?.message ?? 'Erreur pendant la synchronisation.'}`);
        return;
    }

    const saved = summary.processed.filter(r => r.status === 'saved');
    const already = summary.processed.filter(r => r.status === 'already_saved');
    const noDetails = summary.processed.filter(r => r.status === 'no_details');

    const embed = new EmbedBuilder()
        .setTitle(`🏰 Synchronisation des raids — Clan ${clanNum}`)
        .setColor(saved.length > 0 ? 0x57F287 : 0x3498DB)
        .setDescription(
            `Depuis le **${yearStart.toLocaleDateString('fr-FR')}** (début d'année) :\n` +
            `• **${saved.length}** raid(s) nouvellement comptés — **${summary.totalPoints.toFixed(2)} pts** distribués\n` +
            `• **${already.length}** raid(s) déjà comptés (ignorés)` +
            (summary.skippedOngoing > 0 ? `\n• ${summary.skippedOngoing} raid en cours (non compté, relance après sa fin)` : '')
        )
        .setTimestamp();

    if (noDetails.length > 0) {
        embed.addFields({
            name: `⚠️ ${noDetails.length} raid(s) sans détail par joueur`,
            value: noDetails.map(r => r.startTime.toLocaleDateString('fr-FR')).join(', ') +
                '\nL\'API CoC ne fournit le détail des joueurs que pour le **dernier** raid. ' +
                'Ces raids ne peuvent plus être comptés automatiquement → utilise `/set-points` si besoin. ' +
                'La synchro auto du lundi évite ce cas à l\'avenir.',
            inline: false,
        });
    }

    for (const raid of saved.slice(0, 8)) {
        const period = `${raid.startTime.toLocaleDateString('fr-FR')}${raid.endTime ? ` → ${raid.endTime.toLocaleDateString('fr-FR')}` : ''}`;
        embed.addFields({
            name: `📅 Raid du ${period} — ${raid.matched}/${raid.totalMembers} matchés — +${raid.points.toFixed(2)} pts`,
            value: raid.awarded.length > 0
                ? raid.awarded.slice(0, 15).map(a => `**${a.name}** +${a.points} pt (${a.attacks}/${a.limit} atk)`).join(' · ') +
                    (raid.awarded.length > 15 ? ` · … +${raid.awarded.length - 15}` : '')
                : 'Aucun point (personne à ≥ 5 attaques)',
            inline: false,
        });
    }
    if (saved.length > 8) {
        embed.addFields({ name: '…', value: `${saved.length - 8} autres raids comptés (voir /import-history ou /history)`, inline: false });
    }

    const allUnmatched = [...new Set(saved.flatMap(r => r.unmatched))];
    if (allUnmatched.length > 0) {
        embed.addFields({
            name: `⚠️ Non inscrits en BDD (${allUnmatched.length})`,
            value: allUnmatched.slice(0, 25).join(', ') + (allUnmatched.length > 25 ? '…' : ''),
            inline: false,
        });
    }

    if (saved.length === 0 && already.length === 0) {
        embed.setDescription(`Aucun raid terminé depuis le **${yearStart.toLocaleDateString('fr-FR')}** trouvé via l'API CoC.`);
    }

    await interaction.editReply({ embeds: [embed] });
}
