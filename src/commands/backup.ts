import {
    ChatInputCommandInteraction,
    SlashCommandBuilder,
    AttachmentBuilder,
    PermissionFlagsBits,
} from 'discord.js';
import { performBackup } from '../services/backup';

export const data = new SlashCommandBuilder()
    .setName('backup')
    .setDescription('Déclenche une sauvegarde manuelle de la base de données')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator);

export async function execute(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply({ ephemeral: true });

    const result = await performBackup(interaction.client);

    if (!result.success || !result.buffer || !result.fileName) {
        await interaction.editReply(`❌ Backup échoué : ${result.message}`);
        return;
    }

    await interaction.editReply({
        content: `✅ ${result.message}\n> Restauration : \`npm run migration:run\` puis \`psql -d <db> -f ${result.fileName}\``,
        files: [new AttachmentBuilder(result.buffer, { name: result.fileName })],
    });
}
