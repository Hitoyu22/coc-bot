import {
    ChatInputCommandInteraction,
    SlashCommandBuilder,
    PermissionFlagsBits,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    ComponentType,
    Role,
} from 'discord.js';
import { UserDatabase } from '../services/userDatabase';
import { settingsService } from '../services/settings';
import { AppDataSource } from '../config/dataSource';

const ROLES_TO_REMOVE = [
    'registered',
    'LGC1',
    'LGC2',
    'GDC1',
    'GDC2',
    'Clan1',
    'Clan2',
];

export const data = new SlashCommandBuilder()
    .setName('end-year')
    .setDescription('Termine l\'année de l\'association : supprime les membres en BDD et reset les rôles Discord')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator);

export async function execute(interaction: ChatInputCommandInteraction) {
    const response = await interaction.deferReply({ fetchReply: true });

    const yearStart = await settingsService.getYearStart();

    const confirmButton1 = new ButtonBuilder()
        .setCustomId('end_year_step1')
        .setLabel('Terminer l\'année')
        .setStyle(ButtonStyle.Danger);

    await interaction.editReply({
        content:
            `**🏁 Fin de l'année de l'association**` +
            (yearStart ? ` (démarrée le ${yearStart.toLocaleDateString('fr-FR')})` : ' (⚠️ aucune année en cours)') +
            `\n\nCette action va :\n` +
            `1. Supprimer **tous les membres** de la base de données (points inclus)\n` +
            `2. Effacer l'historique des events\n` +
            `3. Retirer les rôles Discord (${ROLES_TO_REMOVE.join(', ')})\n` +
            `4. Fermer les inscriptions jusqu'au prochain \`/start-year\`\n\n` +
            `⚠️ **Irréversible.** Pense à faire \`/export\` et \`/backup\` avant !`,
        components: [new ActionRowBuilder<ButtonBuilder>().addComponents(confirmButton1)],
    });

    try {
        const confirmation1 = await response.awaitMessageComponent({
            filter: i => i.user.id === interaction.user.id,
            time: 60000,
            componentType: ComponentType.Button,
        });
        if (confirmation1.customId !== 'end_year_step1') return;

        const confirmButton2 = new ButtonBuilder()
            .setCustomId('end_year_step2')
            .setLabel('OUI, TERMINER L\'ANNÉE')
            .setStyle(ButtonStyle.Danger);

        await confirmation1.update({
            content: '**Dernière vérification** : as-tu bien fait `/export` et `/backup` ?\n\nClique pour confirmer la fin de l\'année.',
            components: [new ActionRowBuilder<ButtonBuilder>().addComponents(confirmButton2)],
        });

        const confirmation2 = await response.awaitMessageComponent({
            filter: i => i.user.id === interaction.user.id,
            time: 60000,
            componentType: ComponentType.Button,
        });
        if (confirmation2.customId !== 'end_year_step2') return;

        await confirmation2.update({ content: '🧹 Clôture de l\'année en cours…', components: [] });

        await AppDataSource.query('DELETE FROM "war_participation"');
        await AppDataSource.query('DELETE FROM "raid_participation"');
        await AppDataSource.query('DELETE FROM "war_event"');
        await AppDataSource.query('DELETE FROM "raid_event"');

        const userDatabase = new UserDatabase();
        const deletedCount = await userDatabase.resetUsers();

        await settingsService.endYear();

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
                            console.error(`[end-year] Impossible de retirer les rôles à ${member.user.tag}`, err);
                        }
                    }
                }
            }
        }

        await interaction.editReply({
            content:
                `**✅ Année terminée !**\n\n` +
                `- **Membres supprimés :** ${deletedCount}\n` +
                `- **Historique events effacé**\n` +
                `- **Rôles retirés** sur ${rolesRemovedCount} membres\n` +
                `- **Inscriptions fermées** — relance \`/start-year\` pour la prochaine année 🎓`,
            components: [],
        });
    } catch (error) {
        console.error('[end-year]', error);
        await interaction.editReply({
            content: 'Temps écoulé ou opération annulée.',
            components: [],
        });
    }
}