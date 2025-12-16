import { ChatInputCommandInteraction, SlashCommandBuilder, PermissionFlagsBits } from "discord.js";
import {UserDatabase} from "../services/userDatabase";

export const data = new SlashCommandBuilder()
    .setName("reset-all")
    .setDescription("Supprime TOUS les utilisateurs de la base de données")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator);

export async function execute(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply();

    try {
        let userDatabase;
        userDatabase = new UserDatabase();
        const count = await userDatabase.resetUsers();
        await interaction.editReply(`Base de données réinitialisée. **${count}** utilisateurs supprimés.`);
    } catch (error) {
        console.error(error);
        await interaction.editReply("Erreur lors de la suppression des utilisateurs.");
    }
}