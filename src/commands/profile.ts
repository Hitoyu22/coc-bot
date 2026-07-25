import {
    ChatInputCommandInteraction,
    SlashCommandBuilder,
    GuildMember,
    EmbedBuilder,
    MessageFlags,
} from "discord.js";
import { UserDatabase, ContractType, Rentree } from "../services/userDatabase";
import { cocService } from "../services/coc";
import { eventDb } from '../services/eventDatabase';

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

    const guild = interaction.guild;
    if (!guild) {
        await interaction.editReply("Cette commande doit être utilisée dans un serveur.");
        return;
    }

    let member: GuildMember;
    if (interaction.member instanceof GuildMember) {
        member = interaction.member;
    } else {
        member = await guild.members.fetch(interaction.user.id);
    }

    if (!member.roles.cache.some(role => role.name === "registered")) {
        await interaction.editReply("Accès refusé. Tu dois avoir le rôle `registered`.");
        return;
    }

    const targetUser = interaction.options.getUser("utilisateur") || interaction.user;
    const db = new UserDatabase();

    try {
        const user = await db.findUserByDiscordId(targetUser.id);

        if (!user) {
            await interaction.editReply(`${targetUser.username} n'est pas enregistré.`);
            return;
        }

        const [player, warParts, raidParts] = await Promise.all([
            cocService.getPlayer(user.game_id ?? ''),
            eventDb.getWarParticipationsForUser(user.id),
            eventDb.getRaidParticipationsForUser(user.id),
        ]);

        const totalPoints = (user.clangame || 0) + (user.ligue || 0) + (user.war || 0) + (user.raids || 0) + (user.donation || 0);
        const classeLabel = `${user.classe}ème année${user.promotion ? ` — ${user.promotion}` : ''}`;
        const contratLabel = user.contract_type === ContractType.ALTERNANCE ? 'Alternance' : 'Initial';
        const rentreeLabel = user.rentree === Rentree.JANVIER ? 'Janvier' : 'Octobre';

        const embed = new EmbedBuilder()
            .setColor(0x0099FF)
            .setTitle(`Profil — ${player?.name ?? user.game_name ?? user.surname}`)
            .setThumbnail(targetUser.displayAvatarURL({ size: 256, extension: 'png' }))
            .addFields(
                {
                    name: '📋 Informations',
                    value: [
                        `**Classe :** ${classeLabel}`,
                        `**Contrat :** ${contratLabel} — Rentrée ${rentreeLabel}`,
                        `**Tag :** \`${user.game_id}\``,
                    ].join('\n'),
                    inline: false,
                },
            );

        if (player) {
            embed.addFields({
                name: '📊 Stats COC',
                value: [
                    `**HDV :** ${player.townHallLevel}`,
                    `**Trophées :** ${player.trophies} (Record: ${player.bestTrophies})`,
                    `**Étoiles GDC :** ${player.warStars}`,
                ].join('\n'),
                inline: false,
            });
        }

        embed.addFields({
            name: '🏅 Points de Clan',
            value: [
                `**Guerre de clan :** ${user.war}`,
                `**Ligue de guerre :** ${user.ligue}`,
                `**Raids de clan :** ${user.raids}`,
                `**Jeux de clan :** ${user.clangame}`,
                `**Dons :** ${user.donation}`,
                `── ── ── ── ──`,
                `**Total :** ${totalPoints}`,
            ].join('\n'),
            inline: true,
        });

        if (warParts.length > 0) {
            const recent = warParts.slice(0, 5).map(p => {
                const we = p.war_event;
                const date = we?.start_time ? new Date(we.start_time).toLocaleDateString('fr-FR') : '?';
                const type = we?.type === 'gdc' ? 'Guerre de clan' : 'Ligue de guerre';
                return `• **${type}** ${date} — ${p.attacks_made}/${p.attacks_expected} atk`;
            });
            embed.addFields({ name: '⚔️ Dernières guerres', value: recent.join('\n'), inline: false });
        }

        if (raidParts.length > 0) {
            const recent = raidParts.slice(0, 3).map(p => {
                const re = p.raid_event;
                const date = re?.start_time ? new Date(re.start_time).toLocaleDateString('fr-FR') : '?';
                return `• **Raid de clan** ${date} — ${p.attacks_used}/${p.attacks_limit} atk`;
            });
            embed.addFields({ name: '🏰 Derniers raids', value: recent.join('\n'), inline: false });
        }

        embed.setTimestamp();

        await interaction.editReply({ embeds: [embed] });

    } catch (error: any) {
        console.error('[Profile] Erreur:', error?.message ?? error);
        console.error('[Profile] Stack:', error?.stack);
        await interaction.editReply("Une erreur interne est survenue.");
    }
}
