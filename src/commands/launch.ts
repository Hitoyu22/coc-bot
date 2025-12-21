import {
    ChatInputCommandInteraction,
    SlashCommandBuilder,
    TextChannel,
    PermissionFlagsBits,
    EmbedBuilder,
    MessageFlags
} from "discord.js";
import { config } from "../config/config";

const clans = [
    { name: "Clan 1", value: "1" },
    { name: "Clan 2", value: "2" }
];

const events = [
    { name: "GDC", value: "gdc" },
    { name: "Ligue", value: "ligue" }
];

export const data = new SlashCommandBuilder()
    .setName("launch")
    .setDescription("Lancer une annonce d'évènement (GDC/Ligue)")
    .addStringOption(option =>
        option
            .setName("clan")
            .setDescription("Sélectionne le clan")
            .setRequired(true)
            .addChoices(...clans)
    )
    .addStringOption(option =>
        option
            .setName("event")
            .setDescription("L'évènement à lancer")
            .setRequired(true)
            .addChoices(...events)
    )
    .addIntegerOption(option =>
        option
            .setName("jour")
            .setDescription("Le jour du lancement")
            .setRequired(true)
            .setMinValue(1)
            .setMaxValue(31)
    )
    .addIntegerOption(option =>
        option
            .setName("heure")
            .setDescription("L'heure du lancement")
            .setRequired(true)
            .setMinValue(0)
            .setMaxValue(23)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator);

export async function execute(interaction: ChatInputCommandInteraction) {
    const clanId = interaction.options.getString("clan", true);
    const eventType = interaction.options.getString("event", true);
    const jour = interaction.options.getInteger("jour", true);
    const heure = interaction.options.getInteger("heure", true);

    const eventLabel =
        events.find(e => e.value === eventType)?.name ?? "Évènement";

    const configId = clanId === "1" ? config.CLAN_1_ID : config.CLAN_2_ID;
    const partialName = `annonces-clan-${clanId}`;

    let targetChannel: TextChannel | undefined;

    if (configId) {
        targetChannel = interaction.guild?.channels.cache.get(configId) as TextChannel | undefined;
    }

    if (!targetChannel) {
        targetChannel = interaction.guild?.channels.cache.find(
            c => c.name.includes(partialName) && c.isTextBased()
        ) as TextChannel | undefined;
    }

    if (!targetChannel) {
        return interaction.reply({
            content: `Erreur : le salon contenant \`${partialName}\` est introuvable.`,
            flags: MessageFlags.Ephemeral
        });
    }

    await clearReactionsInChannel(targetChannel, 20);

    const embed = new EmbedBuilder()
        .setTitle(`Lancement d'une ${eventLabel} !`)
        .setDescription(
            `@everyone\n\nUne **${eventLabel}** va être lancée **le ${jour} à ${heure}h**.\n\nRéagis avec l’emoji pour participer !`
        )
        .setColor(eventType === "gdc" ? 0xff0000 : 0x00ff00)
        .setFooter({ text: `ID Event: ${eventType}-${clanId}` });

    const message = await targetChannel.send({
        content: "@everyone",
        embeds: [embed]
    });

    const gdcEmoji = await interaction.guild!.emojis.fetch()
        .then(emojis => emojis.find(e => e.name === "gdc"));

    if (!gdcEmoji) {
        return interaction.reply({
            content: "Erreur : l’emoji `gdc` est introuvable sur ce serveur.",
            flags: MessageFlags.Ephemeral
        });
    }

    await message.react(gdcEmoji);

    await interaction.reply({
        content: `Annonce postée avec succès dans ${targetChannel}`,
        flags: MessageFlags.Ephemeral
    });
}

async function clearReactionsInChannel(channel: TextChannel, limit = 20) {
    const messages = await channel.messages.fetch({ limit });

    for (const message of messages.values()) {
        if (message.reactions.cache.size > 0) {
            try {
                await message.reactions.removeAll();
            } catch (err) {
                console.error(`Impossible de nettoyer ${message.id}`, err);
            }
        }
    }
}