import {
  Client,
  GatewayIntentBits,
  Events,
  Interaction,
  ChatInputCommandInteraction,
} from "discord.js";
import { config } from "./config/config";
import { commands } from "./commands";
import { deployGuildCommands } from "./config/deploy-commands";

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.DirectMessages,
  ],
});

client.once(Events.ClientReady, async () => {
  try {
    await deployGuildCommands();
    console.log("Bot Discord déployé !");
  } catch (error) {
    console.error("Erreur lors du déploiement du bot :", error);
  }
});

client.on(Events.InteractionCreate, async (interaction: Interaction) => {
  if (!interaction.isChatInputCommand()) return;

  const command = commands[interaction.commandName as keyof typeof commands];
  if (!command) {
    console.warn(`Commande non trouvée : ${interaction.commandName}`);
    return;
  }

  try {
    await (
      command as { execute: (i: ChatInputCommandInteraction) => Promise<void> }
    ).execute(interaction);
  } catch (err) {
    console.error(err);
    if (interaction.replied || interaction.deferred) {
      await interaction.followUp({
        content: "Une erreur est survenue lors de l’exécution de la commande.",
        ephemeral: true,
      });
    } else {
      await interaction.reply({
        content: "Une erreur est survenue lors de l’exécution de la commande.",
        ephemeral: true,
      });
    }
  }
});

client.login(config.DISCORD_TOKEN);
