import {
    SlashCommandBuilder,
    ChatInputCommandInteraction,
    TextChannel,
    PermissionFlagsBits
} from "discord.js";

export const data = new SlashCommandBuilder()
    .setName("assign-role")
    .setDescription("Force la synchronisation des rôles et de la liste via les réactions d'un message")
    .addStringOption(option =>
        option
            .setName("message_id")
            .setDescription("L'ID du message contenant les réactions gdc")
            .setRequired(true)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator);

export const execute = async (interaction: ChatInputCommandInteraction) => {
    const messageId = interaction.options.getString("message_id", true);
    await interaction.deferReply({ ephemeral: true });

    try {
        const message = await interaction.channel?.messages.fetch(messageId);
        if (!message) {
            return interaction.editReply("Message introuvable dans ce salon.");
        }

        const embed = message.embeds[0];
        const footerText = embed?.footer?.text;
        if (!footerText || !footerText.toLowerCase().includes("id event")) {
            return interaction.editReply("Ce message ne contient pas de footer valide (ID Event manquant).");
        }

        const rawData = footerText.split(":").pop()?.trim();
        if (!rawData) return interaction.editReply("Format de footer invalide.");

        const [eventType, clanId] = rawData.split("-");
        const rolePrefix = eventType.toLowerCase() === "gdc" ? "GDC" : "LGC";
        const roleName = `${rolePrefix}${clanId}`;

        const role = interaction.guild?.roles.cache.find(r => r.name === roleName);
        if (!role) {
            return interaction.editReply(`Rôle "${roleName}" introuvable sur le serveur.`);
        }

        const reaction = message.reactions.cache.find(r => r.emoji.name === "gdc");
        if (!reaction) {
            return interaction.editReply("Aucune réaction 'gdc' trouvée sur ce message.");
        }

        const reactedUsers = await reaction.users.fetch();
        const humanUsers = reactedUsers.filter(u => !u.bot);

        let addedCount = 0;
        for (const [userId, user] of humanUsers) {
            const member = await interaction.guild?.members.fetch(userId);
            if (member && !member.roles.cache.has(role.id)) {
                await member.roles.add(role);
                addedCount++;
            }
        }

        const participantsChannelName = `participants-clan-${clanId}`;
        const participantsChannel = interaction.guild?.channels.cache.find(
            c => c.name === participantsChannelName
        ) as TextChannel;

        if (participantsChannel) {
            await interaction.guild?.members.fetch();
            const membersList = role.members.map(m => `- ${m.displayName}`).join("\n") || "Aucun";
            const content = `### Liste des participants (${roleName})\n${membersList}`;

            const messages = await participantsChannel.messages.fetch({ limit: 10 });
            const listMsg = messages.find(m => m.content.includes(`Liste des participants (${roleName})`));

            if (listMsg) await listMsg.edit(content);
            else await participantsChannel.send(content);
        }

        await interaction.editReply(`Succès ! Rôle **${roleName}** assigné à **${addedCount}** nouveaux membres. Liste mise à jour.`);

    } catch (error) {
        console.error(error);
        await interaction.editReply("Une erreur est survenue lors de l'exécution de la commande.");
    }
};

