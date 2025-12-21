import dotenv from "dotenv";

dotenv.config();

const {
    DISCORD_TOKEN,
    DISCORD_CLIENT_ID,
    DISCORD_GUILD_ID,
    COC_KEY,
    POSTGRES_URL,
    CLAN_1_ID,
    CLAN_2_ID,
    PARTICIPANT_CLAN_1_ID,
    PARTICIPANT_CLAN_2_ID
} = process.env;

if (!DISCORD_TOKEN || !DISCORD_CLIENT_ID || !DISCORD_GUILD_ID || !COC_KEY || !POSTGRES_URL) {
    throw new Error("Variables d'environnement manquantes");
}

export const config = {
    DISCORD_TOKEN,
    DISCORD_CLIENT_ID,
    DISCORD_GUILD_ID,
    COC_KEY,
    POSTGRES_URL,
    CLAN_1_ID,
    CLAN_2_ID,
    PARTICIPANT_CLAN_1_ID,
    PARTICIPANT_CLAN_2_ID
};