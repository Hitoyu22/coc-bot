import {
    ChatInputCommandInteraction,
    SlashCommandBuilder,
    AttachmentBuilder,
    PermissionFlagsBits,
} from 'discord.js';
import { generateExportExcel } from '../services/excel';
import { existsSync, unlinkSync } from 'fs';

export const data = new SlashCommandBuilder()
    .setName('export')
    .setDescription('Exporte les participations au format Excel')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator);

export async function execute(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply({ ephemeral: true });

    try {
        const filePath = await generateExportExcel();
        const attachment = new AttachmentBuilder(filePath, {
            name: `participations-coc-${new Date().toISOString().slice(0, 10)}.xlsx`,
        });

        await interaction.editReply({
            content: '📊 Export Excel généré.',
            files: [attachment],
        });

        try { unlinkSync(filePath); } catch {}
    } catch (error: any) {
        console.error('[Export] Erreur:', error);
        await interaction.editReply('Erreur lors de la génération du fichier Excel.');
    }
}
