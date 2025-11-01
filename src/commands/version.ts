import { ChatInputCommandInteraction, SlashCommandBuilder } from "discord.js";
import { version } from "../../package.json";

export const data = new SlashCommandBuilder()
  .setName("version")
  .setDescription("Affiche la version du bot");

export async function execute(interaction: ChatInputCommandInteraction) {
  await interaction.reply(`Version actuelle du bot : **${version}**`);
}
