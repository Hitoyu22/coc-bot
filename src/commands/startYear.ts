import {
    ChatInputCommandInteraction,
    SlashCommandBuilder,
    EmbedBuilder,
    PermissionFlagsBits,
} from 'discord.js';
import { settingsService } from '../services/settings';

export const data = new SlashCommandBuilder()
    .setName('start-year')
    .setDescription('Démarre l\'année de l\'association : ouvre les inscriptions et les imports de points')
    .addStringOption(o =>
        o.setName('date').setDescription('Date de début JJ/MM/AAAA (défaut : aujourd\'hui)').setRequired(false)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator);

export async function execute(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply();

    const dateStr = interaction.options.getString('date');
    let startDate = new Date();

    if (dateStr) {
        const m = dateStr.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
        if (!m) {
            await interaction.editReply('❌ Format de date invalide. Utilise `JJ/MM/AAAA` (ex : `01/10/2026`).');
            return;
        }
        startDate = new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]));
        if (Number.isNaN(startDate.getTime())) {
            await interaction.editReply('❌ Date invalide.');
            return;
        }
    }

    const existing = await settingsService.getYearStart();
    await settingsService.startYear(startDate);

    const embed = new EmbedBuilder()
        .setTitle('🎉 Année de l\'association démarrée !')
        .setColor(0x57F287)
        .setDescription(
            `**Début de l'année :** ${startDate.toLocaleDateString('fr-FR')}\n` +
            (existing ? `⚠️ Remplace l'ancienne date (${existing.toLocaleDateString('fr-FR')})\n` : '') +
            '\n**Ce que ça change :**\n' +
            '• Les inscriptions via `/register` sont ouvertes\n' +
            '• Les imports `/import-csv` sont autorisés\n' +
            '• Les events d\'avant cette date ne compteront pas\n\n' +
            '**📌 Prochaine étape importante :**\n' +
            'Fais dès maintenant un **premier import** de chaque CSV ClashSpot ' +
            '(`dons`, `war`, `ligue`, `raids`). Il servira de **référence** : ' +
            'seuls les points gagnés *après* seront comptés lors des imports suivants.'
        )
        .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
}
