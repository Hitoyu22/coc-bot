import {ChatInputCommandInteraction, SlashCommandBuilder, PermissionFlagsBits, User} from "discord.js";
import {UserDatabase} from "../services/userDatabase";

export const data = new SlashCommandBuilder()
    .setName("reset-points")
    .setDescription("Remet à zéro les points (JDC, Ligue, GDC, Raid, Dons)")
    .addUserOption(option =>
        option.setName('user')
            .setDescription("L'utilisateur cible (laisser vide pour tout le monde)")
            .setRequired(false)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator);

export async function execute(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply();

    const targetUser = interaction.options.getUser('user');

    try {
        const userDatabase = new UserDatabase();

        const targetId = targetUser ? targetUser.id : undefined;

        const count = await userDatabase.resetPoints(targetId);

        if (targetUser) {
            await interaction.editReply(`Points réinitialisés pour l'utilisateur **${targetUser.username}**.`);
        } else {
            await interaction.editReply(`Points réinitialisés pour **${count}** utilisateurs (tout le monde).`);
        }

    } catch (error) {
        console.error(error);
        await interaction.editReply("Erreur lors de la réinitialisation des points.");
    }
}