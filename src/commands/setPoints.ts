import {
    SlashCommandBuilder,
    ChatInputCommandInteraction,
    ActionRowBuilder,
    UserSelectMenuBuilder,
    ComponentType,
    PermissionFlagsBits,
    UserSelectMenuInteraction,
    MessageFlags
} from "discord.js";
import { pool } from "../config/pg";

const ACTIVITIES = [
    { name: "GDC", value: "war" },
    { name: "Ligue", value: "ligue" },
    { name: "Dons", value: "dons" },
    { name: "Jeux de clans", value: "clangame" },
    { name: "Raids", value: "raid" }
];

export const data = new SlashCommandBuilder()
    .setName("set-points")
    .setDescription("Ajoute ou retire des points à une liste d'utilisateurs")
    .addNumberOption(option =>
        option.setName("points")
            .setDescription("Nombre de points (ex: 10.5 ou -5)")
            .setRequired(true)
    )
    .addStringOption(option =>
        option.setName("activite")
            .setDescription("Type d'activité")
            .setRequired(true)
            .addChoices(...ACTIVITIES)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator);

export async function execute(interaction: ChatInputCommandInteraction) {
    const points = interaction.options.getNumber("points", true);
    const activityColumn = interaction.options.getString("activite", true);
    const activityName = ACTIVITIES.find(a => a.value === activityColumn)?.name;

    const selectMenu = new UserSelectMenuBuilder()
        .setCustomId("select_users_points")
        .setPlaceholder("Sélectionne les membres (max 25)")
        .setMinValues(1)
        .setMaxValues(25);

    const row = new ActionRowBuilder<UserSelectMenuBuilder>()
        .addComponents(selectMenu);

    const response = await interaction.reply({
        content: `Combien de points : **${points}**\nActivité : **${activityName}**\n\nSélectionne les utilisateurs ci-dessous pour appliquer les points :`,
        components: [row],
        flags: MessageFlags.Ephemeral
    });

    try {
        const confirmation = await response.awaitMessageComponent({
            filter: (i) => i.user.id === interaction.user.id,
            time: 60000,
            componentType: ComponentType.UserSelect,
        }) as UserSelectMenuInteraction;

        const selectedUserIds = confirmation.values;

        const query = `
            UPDATE "user"
            SET ${activityColumn} = ${activityColumn} + $1
            WHERE discord_id = ANY($2)
            RETURNING discord_id
        `;

        const result = await pool.query(query, [points, selectedUserIds]);
        const updatedCount = result.rowCount;

        await confirmation.update({
            content: `Points mis à jour !\n\n**${points}** points ajoutés en **${activityName}** pour **${updatedCount}** utilisateurs enregistrés.`,
            components: []
        });

    } catch (error) {
        if (error instanceof Error && error.message.includes("time")) {
            await interaction.editReply({
                content: "Temps écoulé. Commande annulée.",
                components: []
            });
        } else {
            console.error(error);
            await interaction.editReply({
                content: "Une erreur est survenue lors de la mise à jour des points.",
                components: []
            });
        }
    }
}