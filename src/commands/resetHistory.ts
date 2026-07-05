import {
    ChatInputCommandInteraction,
    SlashCommandBuilder,
    PermissionFlagsBits,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    ComponentType,
} from 'discord.js';
import { AppDataSource } from '../config/dataSource';

export const data = new SlashCommandBuilder()
    .setName('reset-history')
    .setDescription('Efface tout l\'historique des guerres et raids (sans supprimer les utilisateurs)')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator);

export async function execute(interaction: ChatInputCommandInteraction) {
    const response = await interaction.deferReply({ fetchReply: true });

    const btn = new ButtonBuilder()
        .setCustomId('confirm_reset_history')
        .setLabel('Confirmer la suppression de l\'historique')
        .setStyle(ButtonStyle.Danger);

    await interaction.editReply({
        content: '⚠️ Vous allez effacer **tout l\'historique** des GDC, Ligues et Raids.\nLes points actuels des utilisateurs ne seront **pas** remis à zéro.\nCette action est irréversible.',
        components: [new ActionRowBuilder<ButtonBuilder>().addComponents(btn)],
    });

    try {
        const confirmation = await response.awaitMessageComponent({
            filter: i => i.user.id === interaction.user.id,
            time: 30000,
            componentType: ComponentType.Button,
        });

        if (confirmation.customId !== 'confirm_reset_history') return;

        await confirmation.update({ content: 'Nettoyage en cours...', components: [] });

        const [wpDel, rpDel, weDel, reDel] = await Promise.all([
            AppDataSource.query('DELETE FROM "war_participation" RETURNING id'),
            AppDataSource.query('DELETE FROM "raid_participation" RETURNING id'),
            AppDataSource.query('DELETE FROM "war_event" RETURNING id'),
            AppDataSource.query('DELETE FROM "raid_event" RETURNING id'),
        ]);

        await interaction.editReply({
            content: [
                '✅ **Historique effacé.**',
                `- Guerres supprimées : ${weDel.length}`,
                `- Participations guerre : ${wpDel.length}`,
                `- Raids supprimés : ${reDel.length}`,
                `- Participations raid : ${rpDel.length}`,
            ].join('\n'),
            components: [],
        });

    } catch {
        await interaction.editReply({ content: 'Temps écoulé ou opération annulée.', components: [] });
    }
}
