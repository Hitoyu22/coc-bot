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
import { User, Rentree } from '../entities/User';
import { In } from 'typeorm';

export const data = new SlashCommandBuilder()
    .setName('reset-history')
    .setDescription('Efface l\'historique des guerres et raids pour une année/rentrée')
    .addIntegerOption(o =>
        o.setName('annee')
            .setDescription('Année d\'étude (1 à 5)')
            .setRequired(true)
            .addChoices(
                { name: '1ère année', value: 1 },
                { name: '2ème année', value: 2 },
                { name: '3ème année', value: 3 },
                { name: '4ème année', value: 4 },
                { name: '5ème année', value: 5 },
            )
    )
    .addStringOption(o =>
        o.setName('rentree')
            .setDescription('Rentrée concernée')
            .setRequired(true)
            .addChoices(
                { name: 'Octobre', value: Rentree.OCTOBRE },
                { name: 'Janvier', value: Rentree.JANVIER },
            )
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator);

export async function execute(interaction: ChatInputCommandInteraction) {
    const response = await interaction.deferReply({ fetchReply: true });

    const annee = interaction.options.getInteger('annee', true);
    const rentree = interaction.options.getString('rentree', true) as Rentree;

    const userRepo = AppDataSource.getRepository(User);
    const matchingUsers = await userRepo.find({ where: { classe: annee, rentree } });

    if (matchingUsers.length === 0) {
        await interaction.editReply(`Aucun utilisateur trouvé en ${annee}ème année — Rentrée ${rentree}.`);
        return;
    }

    const userIds = matchingUsers.map(u => u.id);
    const label = `${annee}ème année — Rentrée ${rentree}`;

    const btn = new ButtonBuilder()
        .setCustomId('confirm_reset_history')
        .setLabel('Confirmer la suppression')
        .setStyle(ButtonStyle.Danger);

    await interaction.editReply({
        content: `⚠️ Vous allez effacer l'historique des participations **et remettre les points à zéro** pour **${label}** (${matchingUsers.length} utilisateurs).\nCette action est irréversible.`,
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

        const wpDel = await AppDataSource.query(
            'DELETE FROM "war_participation" WHERE "user_id" = ANY($1) RETURNING id',
            [userIds]
        );
        const rpDel = await AppDataSource.query(
            'DELETE FROM "raid_participation" WHERE "user_id" = ANY($1) RETURNING id',
            [userIds]
        );

        await userRepo.update(userIds.map(id => id), {
            war: 0, ligue: 0, clangame: 0, raids: 0, donation: 0,
        });

        await interaction.editReply({
            content: [
                `✅ **Historique effacé pour ${label}** (${matchingUsers.length} utilisateurs)`,
                `- Participations guerre supprimées : ${wpDel.length}`,
                `- Participations raid supprimées : ${rpDel.length}`,
                `- Points remis à zéro pour ${matchingUsers.length} utilisateurs`,
            ].join('\n'),
            components: [],
        });

    } catch {
        await interaction.editReply({ content: 'Temps écoulé ou opération annulée.', components: [] });
    }
}
