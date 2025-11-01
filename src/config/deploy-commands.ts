import { REST, Routes } from "discord.js";
import { config } from "./config";
import { commands } from "../commands";

const commandsData = Object.values(commands).map((command) => command.data);

const rest = new REST({ version: "10" }).setToken(config.DISCORD_TOKEN);

export async function deployGuildCommands() {
  await rest.put(
    Routes.applicationGuildCommands(
      config.DISCORD_CLIENT_ID,
      config.DISCORD_GUILD_ID
    ),
    {
      body: commandsData,
    }
  );
}
