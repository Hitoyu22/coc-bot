import { REST, Routes } from "discord.js";
import { config } from "./config";
import { commands } from "../commands";

const rest = new REST({ version: "10" }).setToken(config.DISCORD_TOKEN);

export async function deployGuildCommands() {
    try {
        console.log("Début du rafraîchissement des commandes (/)");

        const commandsData = Object.values(commands).map((command) => command.data.toJSON());

        const commandNames = commandsData.map(c => c.name);
        console.log(`Commandes identifiées à déployer : [${commandNames.join(", ")}]`);

        await rest.put(
            Routes.applicationGuildCommands(
                config.DISCORD_CLIENT_ID,
                config.DISCORD_GUILD_ID
            ),
            { body: commandsData }
        );

        console.log(`${commandsData.length} commandes (/) rechargées avec succès !`);
    } catch (error) {
        console.error("Erreur critique lors du déploiement des commandes :", error);
    }
}