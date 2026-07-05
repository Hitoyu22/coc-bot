import {
    ChatInputCommandInteraction,
    SlashCommandBuilder,
    EmbedBuilder,
} from 'discord.js';
import { cocService } from '../services/coc';
import { AppDataSource } from '../config/dataSource';
import { User } from '../entities/User';
import { getClanTag } from '../utils/clanHelper';

export const data = new SlashCommandBuilder()
    .setName('ranking')
    .setDescription('Classement du clan (trophées + points)')
    .addIntegerOption(o =>
        o.setName('clan').setDescription('Numéro du clan').setRequired(false)
            .addChoices({ name: 'Clan 1', value: 1 }, { name: 'Clan 2', value: 2 })
    )
    .addStringOption(o =>
        o.setName('tri').setDescription('Critère de tri').setRequired(false)
            .addChoices(
                { name: 'Trophées (COC)', value: 'trophies' },
                { name: 'Points Open', value: 'points' },
            )
    );

export async function execute(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply({ ephemeral: false });

    const clanNum = interaction.options.getInteger('clan') ?? 1;
    const sortBy = interaction.options.getString('tri') ?? 'trophies';

    const clanTag = getClanTag(clanNum);
    if (!clanTag) {
        await interaction.editReply(`❌ Tag CoC du clan ${clanNum} non configuré. Ajoute \`COC_CLAN_${clanNum}_TAG\` dans le .env.`);
        return;
    }

    const [clanData, registeredUsers] = await Promise.all([
        cocService.getClan(clanTag),
        AppDataSource.getRepository(User).find(),
    ]);

    if (!clanData) {
        await interaction.editReply('Impossible de récupérer les données du clan (API COC).');
        return;
    }

    const userByTag = new Map(registeredUsers.map(u => [u.game_id?.toUpperCase(), u]));
    const members: any[] = (clanData as any).members ?? [];

    type RankedMember = {
        name: string;
        tag: string;
        trophies: number;
        points: number;
        registered: boolean;
    };

    const ranked: RankedMember[] = members.map((m: any) => {
        const tag = m.tag?.toUpperCase();
        const user = userByTag.get(tag);
        const points = user
            ? (user.war || 0) + (user.ligue || 0) + (user.clangame || 0) + (user.raids || 0) + (user.donation || 0)
            : 0;
        return {
            name: m.name ?? '?',
            tag,
            trophies: m.trophies ?? 0,
            points,
            registered: !!user,
        };
    });

    ranked.sort((a, b) => sortBy === 'points' ? b.points - a.points : b.trophies - a.trophies);

    const medals = ['🥇', '🥈', '🥉'];
    const lines = ranked.slice(0, 25).map((m, i) => {
        const medal = medals[i] ?? `**${i + 1}.**`;
        const regBadge = m.registered ? '' : ' *(non inscrit)*';
        if (sortBy === 'points') {
            return `${medal} ${m.name}${regBadge} — **${m.points}pts** (${m.trophies} 🏆)`;
        }
        return `${medal} ${m.name}${regBadge} — **${m.trophies} 🏆** (${m.points}pts)`;
    });

    const embed = new EmbedBuilder()
        .setTitle(`🏆 Classement — ${(clanData as any).name} (Clan ${clanNum})`)
        .setColor(0xF1C40F)
        .setDescription(lines.join('\n') || 'Aucun membre.')
        .setFooter({ text: `${members.length} membres | Tri: ${sortBy === 'points' ? 'Points Open' : 'Trophées'}` })
        .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
}
