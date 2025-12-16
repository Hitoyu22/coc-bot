import {
    ChatInputCommandInteraction,
    SlashCommandBuilder,
    GuildMember,
    ContainerBuilder,
    ThumbnailBuilder,
    MessageFlags
} from "discord.js";
import { UserDatabase } from "../services/userDatabase";
import { cocService } from "../services/coc";

export const data = new SlashCommandBuilder()
    .setName("profile")
    .setDescription("Affiche le profil d'un utilisateur inscrit")
    .addUserOption(option =>
        option.setName("utilisateur")
            .setDescription("Mentionne l'utilisateur cible (laisser vide pour voir ton profil)")
            .setRequired(false)
    );

export async function execute(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply();

    const member = interaction.member as GuildMember;
    const isRegistered = member.roles.cache.some(role => role.name === "registered");

    if (!isRegistered) {
        await interaction.editReply("Accès refusé. Tu dois avoir le rôle registered pour utiliser cette commande.");
        return;
    }

    const targetUser = interaction.options.getUser("utilisateur") || interaction.user;
    const db = new UserDatabase();

    try {
        const user = await db.findUserByDiscordId(targetUser.id);

        if (!user) {
            await interaction.editReply(`L'utilisateur ${targetUser.username} n'est pas enregistré ou n'a pas de profil.`);
            return;
        }

        const player = await cocService.getPlayer(user.game_id);

        if (!player) {
            await interaction.editReply(`Impossible de récupérer les infos Clash of Clans pour le tag ${user.game_id}.`);
            return;
        }

        const totalPoints = (user.clangame || 0) + (user.ligue || 0) + (user.war || 0) + (user.raid || 0) + (user.dons || 0);
        const avatarUrl = targetUser.displayAvatarURL({ size: 256, extension: "png" });

        const profileContainer = new ContainerBuilder()
            .setAccentColor(0x0099FF)
            .addTextDisplayComponents((textDisplay) =>
                textDisplay.setContent(`# Profil de ${player.name}`)
            )
            .addSeparatorComponents((separator) => separator)
            .addSectionComponents((section) =>
                section
                    .addTextDisplayComponents((textDisplay) =>
                        textDisplay.setContent(
                            `### Informations\n` +
                            `**Classe :** ${user.classe}\n` +
                            `**Tag :** \`${user.game_id}\`\n\n` +
                            `### Statistiques COC\n` +
                            `**HDV :** ${player.townHallLevel}\n` +
                            `**Trophées :** ${player.trophies} (Record: ${player.bestTrophies})\n` +
                            `**Etoiles GDC :** ${player.warStars}\n`
                        )
                    )
                    .setThumbnailAccessory(
                        new ThumbnailBuilder().setURL(avatarUrl)
                    )
            )
            .addSeparatorComponents((separator) => separator)
            .addTextDisplayComponents((textDisplay) =>
                textDisplay.setContent(
                    `### Points de Clan\n` +
                    `**JDC :** ${user.clangame}\n` +
                    `**Ligue :** ${user.ligue}\n` +
                    `**GDC :** ${user.war}\n` +
                    `**Raid :** ${user.raid}\n` +
                    `**Dons :** ${user.dons}`
                )
            )
            .addSeparatorComponents((separator) => separator)
            .addTextDisplayComponents((textDisplay) =>
                textDisplay.setContent(`# Total Open : ${totalPoints}`)
            );

        await interaction.editReply({
            components: [profileContainer],
            flags: MessageFlags.IsComponentsV2,
        });

    } catch (error) {
        console.error(error);
        await interaction.editReply("Une erreur interne est survenue.");
    }
}