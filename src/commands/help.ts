import {
    ChatInputCommandInteraction,
    SlashCommandBuilder,
    EmbedBuilder,
    PermissionFlagsBits,
} from 'discord.js';

interface HelpCategory {
    category: string;
    adminOnly: boolean;
    items: { name: string; desc: string }[];
}

const COMMANDS: HelpCategory[] = [
    {
        category: '📋 Inscription & Profil',
        adminOnly: false,
        items: [
            { name: '/register', desc: 'S\'inscrire et lier son compte CoC' },
            { name: '/profile [utilisateur]', desc: 'Voir le profil + stats CoC + points' },
            { name: '/history [utilisateur]', desc: 'Historique de participation aux events' },
            { name: '/ranking [clan] [tri]', desc: 'Classement du clan (trophées ou points Open)' },
        ],
    },
    {
        category: '📥 Points automatiques (CSV ClashSpot)',
        adminOnly: true,
        items: [
            { name: '/import-csv <type> <fichier> [clan]', desc: 'Importe un CSV ClashSpot → points auto (delta depuis le dernier import)' },
            { name: '/import-history [clan] [type] [detail]', desc: 'Historique des imports + détail par joueur' },
        ],
    },
    {
        category: '⚔️ Events (API CoC)',
        adminOnly: true,
        items: [
            { name: '/sync-raids [clan]', desc: 'Compte TOUS les raids terminés depuis le début d\'année (auto chaque lundi 10h)' },
            { name: '/save-ligue [clan]', desc: 'Sauvegarde la dernière CWL terminée, points ligue auto (auto le 12 du mois)' },
            { name: '/save-war [clan] [type] [war_tag]', desc: 'Sauvegarde la guerre EN COURS et attribue les points' },
            { name: '/raids [clan]', desc: 'Liste des derniers Raids Capital' },
            { name: '/save-raid [clan] [index]', desc: 'Sauvegarde UN raid précis (points auto)' },
        ],
    },
    {
        category: '🏅 Points (Manuel)',
        adminOnly: true,
        items: [
            { name: '/set-points <pts> <activité>', desc: 'Ajoute/retire des points (UserSelect, max 25)' },
            { name: '/set-points-backup <pts> <activité>', desc: 'Idem jusqu\'à 10 users nommés' },
            { name: '/reset-points [user]', desc: 'Remet les points à zéro (1 user ou tous)' },
        ],
    },
    {
        category: '📊 Export',
        adminOnly: true,
        items: [
            { name: '/export', desc: 'Export Excel des participations (par semaine)' },
        ],
    },
    {
        category: '🎮 Organisation',
        adminOnly: true,
        items: [
            { name: '/launch <clan> <event>', desc: 'Annonce GDC/Ligue avec réaction emoji' },
            { name: '/assign-role <message_id>', desc: 'Sync rôles depuis les réactions d\'un message' },
        ],
    },
    {
        category: '🎓 Année de l\'association',
        adminOnly: true,
        items: [
            { name: '/start-year [date]', desc: 'Démarre l\'année : ouvre inscriptions + imports' },
            { name: '/end-year', desc: 'Termine l\'année : purge BDD + reset rôles (double confirmation)' },
            { name: '/reset-promotion <classe> <rentree> [contrat]', desc: 'Remet à 0 les points d\'une promotion déjà récompensée' },
        ],
    },
    {
        category: '🛡️ Administration',
        adminOnly: true,
        items: [
            { name: '/backup', desc: 'Sauvegarde de la BDD (.sql envoyé sur Discord, auto lundi 3h)' },
            { name: '/reset-history', desc: 'Efface l\'historique events/participations (users conservés)' },
            { name: '/reset-all', desc: 'Supprime TOUS les utilisateurs + rôles (irréversible)' },
        ],
    },
    {
        category: 'ℹ️ Divers',
        adminOnly: false,
        items: [
            { name: '/version', desc: 'Version du bot' },
            { name: '/help', desc: 'Cette aide' },
        ],
    },
];

export const data = new SlashCommandBuilder()
    .setName('help')
    .setDescription('Affiche les commandes disponibles (adapté selon tes permissions)');

export async function execute(interaction: ChatInputCommandInteraction) {
    const isAdmin = interaction.memberPermissions?.has(PermissionFlagsBits.Administrator) ?? false;

    const categories = COMMANDS.filter(cat => isAdmin || !cat.adminOnly);

    const embed = new EmbedBuilder()
        .setTitle(isAdmin ? '🤖 CocBot — Aide (admin)' : '🤖 CocBot — Aide')
        .setColor(isAdmin ? 0xE67E22 : 0x0099FF)
        .setDescription(
            isAdmin
                ? 'Toutes les commandes, y compris celles réservées aux admins.'
                : 'Commandes accessibles à tous les membres.'
        )
        .setTimestamp();

    if (isAdmin) {
        embed.setFooter({ text: 'Barème CSV : GDC 0.25/atk | Ligue 1 (≤1 ratée) ou 0.5 | Raids 0.25/5 atk | Dons 0.25/500 | 1er import = référence' });
    } else {
        embed.setFooter({ text: 'Les points sont attribués automatiquement selon ta participation aux events.' });
    }

    for (const cat of categories) {
        embed.addFields({
            name: cat.adminOnly ? `${cat.category} 🔒` : cat.category,
            value: cat.items.map(c => `\`${c.name}\` — ${c.desc}`).join('\n'),
            inline: false,
        });
    }

    await interaction.reply({ embeds: [embed], ephemeral: true });
}
