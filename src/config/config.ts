import dotenv from "dotenv";

dotenv.config();

const { DISCORD_TOKEN, DISCORD_CLIENT_ID, DISCORD_GUILD_ID, COC_KEY, POSTGRES_URL } = process.env;

if (!DISCORD_TOKEN || !DISCORD_CLIENT_ID || !DISCORD_GUILD_ID || !COC_KEY || !POSTGRES_URL) {
  throw new Error("Variables d'environnement manquantes");
}

export const config = {
  DISCORD_TOKEN,
  DISCORD_CLIENT_ID,
  DISCORD_GUILD_ID,
  COC_KEY,
  POSTGRES_URL,
};
