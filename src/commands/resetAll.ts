import {
    ChatInputCommandInteraction,
    SlashCommandBuilder,
    PermissionFlagsBits,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    ComponentType,
    Role
} from "discord.js";
import { UserDatabase } from "../services/userDatabase";

const ROLES_TO_REMOVE = [
    "registered",
    "LGC1",
    "LGC2",
    "GDC1",
    "GDC2",
    "Clan1",
    "Clan2"
];

export const data = new SlashCommandBuilder()
    .setName("reset-all")
    .setDescription("Supprime TOUS les utilisateurs de la BDD et retire les rôles (GDC, Clan, registered...)")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator);

export async function execute(interaction: ChatInputCommandInteraction) {
    const response = await interaction.deferReply({ fetchReply: true });

    const confirmButton1 = new ButtonBuilder()
        .setCustomId('confirm_reset_step1')
        .setLabel('Confirmer la suppression')
        .setStyle(ButtonStyle.Danger);

    const row1 = new ActionRowBuilder<ButtonBuilder>()
        .addComponents(confirmButton1);

    await interaction.editReply({
        content: "**ATTENTION** : Vous êtes sur le point de :\n1. Supprimer **TOUS** les utilisateurs de la base de données.\n2. Retirer les rôles **registered, Clans et Events** à tout le monde.\n\nCette action est irréversible.\nAppuyez sur le bouton pour passer à la confirmation finale.",
        components: [row1]
    });

    try {
        const confirmation1 = await response.awaitMessageComponent({
            filter: i => i.user.id === interaction.user.id,
            time: 60000,
            componentType: ComponentType.Button
        });

        if (confirmation1.customId !== 'confirm_reset_step1') return;

        const confirmButton2 = new ButtonBuilder()
            .setCustomId('confirm_reset_step2')
            .setLabel('OUI, TOUT SUPPRIMER')
            .setStyle(ButtonStyle.Danger);

        const row2 = new ActionRowBuilder<ButtonBuilder>()
            .addComponents(confirmButton2);

        await confirmation1.update({
            content: "**DERNIÈRE VÉRIFICATION** : Êtes-vous absolument sûr ?\n\nCliquez sur le bouton ci-dessous pour lancer le nettoyage complet (BDD + Rôles).",
            components: [row2]
        });

        const confirmation2 = await response.awaitMessageComponent({
            filter: i => i.user.id === interaction.user.id,
            time: 60000,
            componentType: ComponentType.Button
        });

        if (confirmation2.customId !== 'confirm_reset_step2') return;

        await confirmation2.update({ content: "Nettoyage en cours... Veuillez patienter.", components: [] });

        const userDatabase = new UserDatabase();
        const deletedCount = await userDatabase.resetUsers();

        let rolesRemovedCount = 0;
        const guild = interaction.guild;

        if (guild) {
            await guild.roles.fetch();
            const targetRoles: Role[] = [];

            for (const name of ROLES_TO_REMOVE) {
                const role = guild.roles.cache.find(r => r.name === name);
                if (role) targetRoles.push(role);
            }

            if (targetRoles.length > 0) {
                const members = await guild.members.fetch();

                for (const member of members.values()) {
                    if (member.user.bot) continue;

                    const rolesToRemove = targetRoles.filter(r => member.roles.cache.has(r.id));

                    if (rolesToRemove.length > 0) {
                        try {
                            await member.roles.remove(rolesToRemove);
                            rolesRemovedCount++;
                        } catch (err) {
                            console.error(`Impossible de retirer les rôles à ${member.user.tag}`, err);
                        }
                    }
                }
            }
        }

        await interaction.editReply({
            content: `**Opération terminée avec succès.**\n\n` +
                `- **Base de données :** ${deletedCount} utilisateurs supprimés.\n` +
                `- **Discord :** Rôles retirés sur ${rolesRemovedCount} membres.\n` +
                `(Rôles ciblés : ${ROLES_TO_REMOVE.join(", ")})`,
            components: []
        });

    } catch (error) {
        console.error(error);
        await interaction.editReply({
            content: "Temps écoulé ou opération annulée/échouée.",
            components: []
        });
    }
}