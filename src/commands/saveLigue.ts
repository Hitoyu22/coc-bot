import {
    ChatInputCommandInteraction,
    SlashCommandBuilder,
    EmbedBuilder,
    PermissionFlagsBits,
} from 'discord.js';
import { syncLeague } from '../services/leagueSync';
import { settingsService } from '../services/settings';
import { getClanTag } from '../utils/clanHelper';

export const data = new SlashCommandBuilder()
    .setName('save-ligue')
    .setDescription('Sauvegarde la dernière ligue (CWL) terminée et attribue les points ligue')
    .addIntegerOption(o =>
        o.setName('clan').setDescription('Clan concerné (défaut : Clan 1)').setRequired(false)
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
        await interaction.editReply('❌ **L\'année de l\'association n\'a pas démarré.** Lance d\'abord `/start-year`.');
        return;
    }

    let result;
    try {
        result = await syncLeague(clanTag, clanNum);
    } catch (err: any) {
        console.error('[save-ligue]', err);
        await interaction.editReply(`❌ Erreur pendant la synchronisation : ${err?.message ?? err}`);
        return;
    }

    switch (result.status) {
        case 'no_group':
            await interaction.editReply(
                '❌ **Aucune ligue trouvée via l\'API.**\n' +
                'L\'API n\'expose le groupe CWL que pendant/juste après la saison — si la ligue date de plus d\'un mois, elle n\'est plus accessible.'
            );
            return;
        case 'not_ended':
            await interaction.editReply(
                `⏳ La ligue **${result.season}** est encore en cours. Relance la commande quand elle sera terminée ` +
                '(la synchro auto du 12 du mois la sauvegardera de toute façon).'
            );
            return;
        case 'already_saved':
            await interaction.editReply(`⚠️ La ligue **${result.season}** a déjà été sauvegardée et les points attribués.`);
            return;
    }

    if (result.endTime && result.endTime < yearStart) {
        // sécurité : points déjà appliqués seulement si saved — on prévient juste
        await interaction.editReply(
            `⚠️ La ligue **${result.season}** s'est terminée avant le début d'année (${yearStart.toLocaleDateString('fr-FR')}). Points non pris en compte ? Vérifie avec /import-history.`
        );
    }

    const embed = new EmbedBuilder()
        .setTitle(`🏆 Ligue ${result.season} sauvegardée — Clan ${clanNum}`)
        .setColor(0x9B59B6)
        .setDescription(
            `**${result.warsFound}** guerres de ligue trouvées` +
            (result.startTime && result.endTime
                ? ` (${result.startTime.toLocaleDateString('fr-FR')} → ${result.endTime.toLocaleDateString('fr-FR')})`
                : '') +
            `\n**${result.matched}**/${result.totalPlayers} joueurs trouvés en BDD — **${result.points?.toFixed(2)} pts** distribués`
        )
        .setFooter({ text: 'Barème ligue : 1 pt si ≤ 1 attaque ratée sur la saison, sinon 0.5 pt si participé' })
        .setTimestamp();

    if (result.awarded && result.awarded.length > 0) {
        embed.addFields({
            name: `🎯 Points attribués (${result.awarded.length})`,
            value: result.awarded.slice(0, 25)
                .map(a => `**${a.name}** : +${a.points} pt (${a.attacks}/${a.rostered} atk)`)
                .join('\n') + (result.awarded.length > 25 ? `\n… et ${result.awarded.length - 25} autres` : ''),
            inline: false,
        });
    } else {
        embed.addFields({ name: '🎯 Points attribués', value: 'Aucun joueur inscrit n\'a participé.', inline: false });
    }

    if (result.unmatched && result.unmatched.length > 0) {
        embed.addFields({
            name: `⚠️ Non inscrits en BDD (${result.unmatched.length})`,
            value: result.unmatched.slice(0, 25).join(', ') + (result.unmatched.length > 25 ? '…' : ''),
            inline: false,
        });
    }

    await interaction.editReply({ embeds: [embed] });
}
