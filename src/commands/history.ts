import {
    ChatInputCommandInteraction,
    SlashCommandBuilder,
    EmbedBuilder,
    GuildMember,
} from 'discord.js';
import { UserDatabase } from '../services/userDatabase';
import { eventDb } from '../services/eventDatabase';

export const data = new SlashCommandBuilder()
    .setName('history')
    .setDescription('Affiche l\'historique de participation d\'un joueur')
    .addUserOption(o =>
        o.setName('utilisateur').setDescription('Joueur cible (vide = toi)').setRequired(false)
    );

export async function execute(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply({ ephemeral: true });

    const guild = interaction.guild;
    if (!guild) {
        await interaction.editReply('Commande utilisable uniquement dans un serveur.');
        return;
    }

    let member: GuildMember;
    if (interaction.member instanceof GuildMember) {
        member = interaction.member;
    } else {
        member = await guild.members.fetch(interaction.user.id);
    }

    if (!member.roles.cache.some(r => r.name === 'registered')) {
        await interaction.editReply('Rôle `registered` requis.');
        return;
    }

    const targetUser = interaction.options.getUser('utilisateur') || interaction.user;
    const db = new UserDatabase();
    const user = await db.findUserByDiscordId(targetUser.id);

    if (!user) {
        await interaction.editReply(`${targetUser.username} n'est pas enregistré.`);
        return;
    }

    const warParts = await eventDb.getWarParticipationsForUser(user.id);
    const raidParts = await eventDb.getRaidParticipationsForUser(user.id);

    const embed = new EmbedBuilder()
        .setTitle(`📜 Historique — ${user.game_name ?? user.surname}`)
        .setColor(0x9B59B6);

    if (warParts.length === 0 && raidParts.length === 0) {
        embed.setDescription('Aucune participation enregistrée.');
        await interaction.editReply({ embeds: [embed] });
        return;
    }

    if (warParts.length > 0) {
        const lines = warParts.slice(0, 10).map(p => {
            const we = p.war_event;
            const date = we?.start_time ? new Date(we.start_time).toLocaleDateString('fr-FR') : '?';
            const type = we?.type === 'gdc' ? 'GDC' : 'Ligue';
            return `• **${type}** (${date}) — ${p.attacks_made}/${p.attacks_expected} atk — ⭐ ${p.total_stars} — **+${p.points_awarded}pt**`;
        });
        embed.addFields({ name: '⚔️ Guerres (10 dernières)', value: lines.join('\n'), inline: false });
    }

    if (raidParts.length > 0) {
        const lines = raidParts.slice(0, 10).map(p => {
            const re = p.raid_event;
            const date = re?.start_time ? new Date(re.start_time).toLocaleDateString('fr-FR') : '?';
            return `• **Raid** (${date}) — ${p.attacks_used}/${p.attacks_limit} atk — **+${p.points_awarded}pt**`;
        });
        embed.addFields({ name: '🏰 Raids (10 derniers)', value: lines.join('\n'), inline: false });
    }

    const totalPoints = (user.war || 0) + (user.ligue || 0) + (user.clangame || 0) + (user.raids || 0) + (user.donation || 0);
    embed.setFooter({ text: `Total points actuels: ${totalPoints}` });

    await interaction.editReply({ embeds: [embed] });
}
