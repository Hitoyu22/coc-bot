import 'reflect-metadata';
import {
    Client,
    Events,
    GatewayIntentBits,
    Interaction,
    MessageReaction,
    PartialMessageReaction,
    Partials,
    PartialUser,
    TextChannel,
    User,
} from "discord.js";
import cron from 'node-cron';
import { config } from "./config/config";
import { AppDataSource } from "./config/dataSource";
import { commands } from "./commands";
import { deployGuildCommands } from "./config/deploy-commands";
import { performBackup } from "./services/backup";
import { syncRaidsSince } from "./services/raidSync";
import { syncLeague } from "./services/leagueSync";
import { settingsService } from "./services/settings";
import { getClanTag } from "./utils/clanHelper";

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.GuildMessageReactions,
        GatewayIntentBits.GuildMembers,
    ],
    partials: [Partials.Message, Partials.Channel, Partials.Reaction],
});


client.once(Events.ClientReady, async () => {
    try {
        await deployGuildCommands();
        console.log("Bot Discord prêt !");
    } catch (error) {
        console.error("Erreur lors du déploiement :", error);
    }
});

client.on(Events.InteractionCreate, async (interaction: Interaction) => {
    try {
        if (interaction.isAutocomplete()) {
            const command = commands[interaction.commandName as keyof typeof commands];

            if (!command) {
                console.error(`Aucune commande trouvée pour ${interaction.commandName}`);
                return;
            }

            if ('autocomplete' in command && typeof (command as any).autocomplete === 'function') {
                try {
                    await (command as any).autocomplete(interaction);
                } catch (error) {
                    console.error(`Erreur dans l'autocomplete de ${interaction.commandName}`, error);
                }
            }
            return;
        }

        if (!interaction.isChatInputCommand()) return;

        const command = commands[interaction.commandName as keyof typeof commands];
        if (!command) return;

        await command.execute(interaction);
    } catch (error) {
        console.error("Interaction error:", error);

        if (interaction.isRepliable()) {
            if (interaction.deferred || interaction.replied) {
                await interaction.followUp({
                    content: "Une erreur est survenue.",
                    flags: 64,
                });
            } else {
                await interaction.reply({
                    content: "Une erreur est survenue.",
                    flags: 64,
                });
            }
        }
    }
});

async function isLastBotMessage(message: any): Promise<boolean> {
    const channel = message.channel as TextChannel;
    const messages = await channel.messages.fetch({ limit: 10 });

    const lastBotMessage = messages.find(
        m => m.author?.bot && m.embeds.length > 0
    );

    if (!lastBotMessage) return false;
    return message.id === lastBotMessage.id;
}

client.on(
    Events.MessageReactionAdd,
    async (reaction: MessageReaction | PartialMessageReaction, user: User | PartialUser) => {
        try {
            if (user.bot) return;

            if (reaction.partial) await reaction.fetch();
            if (reaction.message.partial) await reaction.message.fetch();

            if (reaction.emoji.name !== "gdc") return;

            const message = reaction.message;
            const guild = message.guild;
            if (!guild) return;

            if (!(await isLastBotMessage(message))) {
                return;
            }

            const footerText = message.embeds[0]?.footer?.text;
            if (!footerText?.toLowerCase().includes("id event")) return;

            const rawData = footerText.split(":").pop()?.trim();
            if (!rawData) return;

            const [eventType, clanId] = rawData.split("-");
            const roleName = `${eventType === "gdc" ? "GDC" : "LGC"}${clanId}`;

            const role =
                guild.roles.cache.find(r => r.name === roleName) ??
                (await guild.roles.fetch()).find(r => r.name === roleName);

            if (!role) {
                return;
            }

            const member = await guild.members.fetch(user.id);
            await member.roles.add(role);

            await updateParticipantsList(guild, clanId, roleName);
        } catch (err) {
            console.error("Erreur:", err);
        }
    }
);

client.on(
    Events.MessageReactionRemove,
    async (reaction: MessageReaction | PartialMessageReaction, user: User | PartialUser) => {
        try {
            if (user.bot) return;

            if (reaction.partial) await reaction.fetch();
            if (reaction.message.partial) await reaction.message.fetch();

            if (reaction.emoji.name !== "gdc") return;

            const message = reaction.message;
            const guild = message.guild;
            if (!guild) return;

            if (!(await isLastBotMessage(message))) {
                return;
            }

            const footerText = message.embeds[0]?.footer?.text;
            if (!footerText?.toLowerCase().includes("id event")) return;

            const rawData = footerText.split(":").pop()?.trim();
            if (!rawData) return;

            const [eventType, clanId] = rawData.split("-");
            const roleName = `${eventType === "gdc" ? "GDC" : "LGC"}${clanId}`;

            const role = guild.roles.cache.find(r => r.name === roleName);
            if (!role) return;

            const member = await guild.members.fetch(user.id);
            await member.roles.remove(role);

            await updateParticipantsList(guild, clanId, roleName);
        } catch (err) {
            console.error("Erreur:", err);
        }
    }
);

async function updateParticipantsList(
    guild: any,
    clanId: string,
    roleName: string
) {
    const configId = clanId === "1" ? config.PARTICIPANT_CLAN_1_ID : config.PARTICIPANT_CLAN_2_ID;
    const partialName = `participants-clan${clanId}`;

    let channel: TextChannel | undefined;

    if (configId) {
        channel = guild.channels.cache.get(configId) as TextChannel | undefined;
    }

    if (!channel) {
        channel = guild.channels.cache.find(
            (c: any) => c.name.includes(partialName) && c.isTextBased()
        ) as TextChannel | undefined;
    }

    if (!channel) {
        return;
    }

    const role = guild.roles.cache.find((r: any) => r.name === roleName);
    if (!role) return;

    const members = [...role.members.values()];

    const list =
        members.length > 0
            ? members.map(m => `- ${m.displayName}`).join("\n")
            : "Aucun participant";

    const content =
        `### Liste des participants (${roleName})\n` +
        `${list}\n\n` +
        `🕒 Mise à jour : <t:${Math.floor(Date.now() / 1000)}:T>`;

    await channel.send(content);
}

AppDataSource.initialize()
    .then(() => {
        console.log('Base de données connectée');
        client.login(config.DISCORD_TOKEN);

        // Backup hebdomadaire le lundi à 3h du matin
        cron.schedule('0 3 * * 1', async () => {
            console.log('[Cron] Backup hebdomadaire...');
            const result = await performBackup(client);
            console.log(`[Cron] Backup: ${result.message}`);
        });

        // Synchro auto des raids le lundi à 10h (le raid se termine lundi 7h UTC).
        // Indispensable : l'API CoC ne fournit le détail par joueur que pour le
        // DERNIER raid — si on attend trop, les points sont perdus.
        cron.schedule('0 10 * * 1', async () => {
            const yearStart = await settingsService.getYearStart();
            if (!yearStart) {
                console.log('[Cron] Sync raids ignorée : année non démarrée.');
                return;
            }
            for (const clanNum of [1, 2]) {
                const clanTag = getClanTag(clanNum);
                if (!clanTag) continue;
                try {
                    const summary = await syncRaidsSince(clanTag, clanNum, yearStart);
                    const saved = summary.processed.filter(r => r.status === 'saved');
                    console.log(`[Cron] Sync raids clan ${clanNum}: ${saved.length} raid(s) comptés, ${summary.totalPoints} pts.`);
                    if (saved.length > 0 && config.BACKUP_CHANNEL_ID) {
                        const channel = client.channels.cache.get(config.BACKUP_CHANNEL_ID) as TextChannel | undefined;
                        if (channel?.isTextBased()) {
                            await channel.send(
                                `🏰 **Sync auto des raids — Clan ${clanNum}** : ${saved.length} raid(s) comptés, ` +
                                `**${summary.totalPoints.toFixed(2)} pts** distribués. Détail : \`/history\``
                            );
                        }
                    }
                } catch (err) {
                    console.error(`[Cron] Sync raids clan ${clanNum} échouée:`, err);
                }
            }
        });

        // Synchro auto de la ligue (CWL) le 12 du mois à 10h : la CWL se termine
        // vers le 11, et l'API n'expose le groupe que pendant/juste après la saison.
        cron.schedule('0 10 12 * *', async () => {
            const yearStart = await settingsService.getYearStart();
            if (!yearStart) {
                console.log('[Cron] Sync ligue ignorée : année non démarrée.');
                return;
            }
            for (const clanNum of [1, 2]) {
                const clanTag = getClanTag(clanNum);
                if (!clanTag) continue;
                try {
                    const result = await syncLeague(clanTag, clanNum);
                    console.log(`[Cron] Sync ligue clan ${clanNum}: ${result.status}${result.season ? ` (${result.season})` : ''}${result.points ? ` — ${result.points} pts` : ''}`);
                    if (result.status === 'saved' && config.BACKUP_CHANNEL_ID) {
                        const channel = client.channels.cache.get(config.BACKUP_CHANNEL_ID) as TextChannel | undefined;
                        if (channel?.isTextBased()) {
                            await channel.send(
                                `🏆 **Sync auto ligue ${result.season} — Clan ${clanNum}** : ${result.warsFound} guerres, ` +
                                `${result.matched} joueurs, **${result.points?.toFixed(2)} pts** distribués. Détail : \`/history\``
                            );
                        }
                    }
                } catch (err) {
                    console.error(`[Cron] Sync ligue clan ${clanNum} échouée:`, err);
                }
            }
        });
    })
    .catch((err) => {
        console.error('Erreur connexion base de données :', err);
        process.exit(1);
    });