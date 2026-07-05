import {
    ChatInputCommandInteraction,
    SlashCommandBuilder,
    GuildMember,
    MessageFlags,
    ContainerBuilder,
    ThumbnailBuilder,
} from "discord.js";

import { cocService } from "../services/coc";
import { UserDatabase, Promotion, ContractType, Rentree } from "../services/userDatabase";
import { settingsService } from "../services/settings";

export const data = new SlashCommandBuilder()
    .setName("register")
    .setDescription("S'enregistrer sur le serveur et lier son compte COC")
    .addStringOption(option =>
        option.setName("nom")
            .setDescription("Ton nom de famille")
            .setRequired(true))
    .addStringOption(option =>
        option.setName("prenom")
            .setDescription("Ton prénom")
            .setRequired(true))
    .addStringOption(option =>
        option.setName("email")
            .setDescription("Ton adresse email scolaire (@myskolae)")
            .setRequired(true))
    .addStringOption(option =>
        option.setName("tag_coc")
            .setDescription("Ton tag Clash of Clans (ex: #2PP...)")
            .setRequired(true))
    .addIntegerOption(option =>
        option.setName("classe")
            .setDescription("Ton année d'étude")
            .setRequired(true)
            .addChoices(
                { name: "1ère année", value: 1 },
                { name: "2ème année", value: 2 },
                { name: "3ème année", value: 3 },
                { name: "4ème année", value: 4 },
                { name: "5ème année", value: 5 },
            ))
    .addStringOption(option =>
        option.setName("contrat")
            .setDescription("Type de contrat")
            .setRequired(true)
            .addChoices(
                { name: "Alternance", value: ContractType.ALTERNANCE },
                { name: "Initial (temps plein)", value: ContractType.INITIAL },
            ))
    .addStringOption(option =>
        option.setName("rentree")
            .setDescription("Rentrée scolaire")
            .setRequired(true)
            .addChoices(
                { name: "Octobre", value: Rentree.OCTOBRE },
                { name: "Janvier", value: Rentree.JANVIER },
            ))
    .addStringOption(option =>
        option.setName("promotion")
            .setDescription("Ta filière (sélectionne ‘Aucune’ si 1ère ou 2ème année sans filière)")
            .setRequired(true)
            .addChoices(
                { name: "Aucune (1ère ou 2ème année)", value: "none" },
                { name: "MSCI — Management et Conseil en Systèmes d’Information", value: Promotion.MSCI },
                { name: "AL — Architecture des Logiciels", value: Promotion.AL },
                { name: "IW — Ingénierie du Web", value: Promotion.IW },
                { name: "IABD — Intelligence Artificielle et Big Data", value: Promotion.IABD },
                { name: "BC — Ingénierie de la Blockchain", value: Promotion.BC },
                { name: "MOC — Ingénierie Mobile et Objets Connectés", value: Promotion.MOC },
                { name: "SRC — Systèmes, Réseaux et Cloud Computing", value: Promotion.SRC },
                { name: "RVJV — Ingénierie de la Réalité Virtuelle et Jeux Vidéo", value: Promotion.RVJV },
                { name: "SI — Cybersécurité", value: Promotion.SI },
            ));

export async function execute(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    if (!(await settingsService.isYearActive())) {
        await interaction.editReply(
            "**Les inscriptions ne sont pas encore ouvertes.**\n" +
            "L'année de l'association n'a pas démarré — un admin doit lancer `/start-year`."
        );
        return;
    }

    const name = interaction.options.getString("nom", true);
    const firstname = interaction.options.getString("prenom", true);
    const email = interaction.options.getString("email", true);
    const classe = interaction.options.getInteger("classe", true);
    const contrat = interaction.options.getString("contrat", true) as ContractType;
    const rentree = interaction.options.getString("rentree", true) as Rentree;
    const promotionRaw = interaction.options.getString("promotion", true);
    const promotion: Promotion | null = promotionRaw === "none" ? null : (promotionRaw as Promotion);

    let tagCoc = interaction.options.getString("tag_coc", true).toUpperCase();

    // Validation cohérence année / filière
    if ((classe === 1 || classe === 2) && promotion && promotion !== Promotion.MSCI) {
        await interaction.editReply(
            `**En ${classe}ère/ème année, seule la filière MSCI est disponible** (ou sélectionne "Aucune").`
        );
        return;
    }

    if (classe >= 3 && !promotion) {
        await interaction.editReply(
            `**Filière obligatoire pour les années 3, 4 et 5.**\nSélectionne ta promotion (pas "Aucune").`
        );
        return;
    }

    if (!tagCoc.startsWith("#")) tagCoc = `#${tagCoc}`;
    if (!/^#[0-9A-Z]+$/.test(tagCoc)) {
        await interaction.editReply(
            "**Format du Tag invalide.** Un tag COC commence par # et contient des chiffres et lettres majuscules."
        );
        return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        await interaction.editReply("**Format de l'email invalide.**");
        return;
    }

    const db = new UserDatabase();

    try {
        const existingDiscord = await db.findUserByDiscordId(interaction.user.id);
        if (existingDiscord) {
            await interaction.editReply("**Erreur :** Tu es déjà enregistré dans la base de données.");
            return;
        }

        const existingCoc = await db.findUserByCocTag(tagCoc);
        if (existingCoc) {
            await interaction.editReply(`**Erreur :** Le tag COC \`${tagCoc}\` est déjà lié à un autre utilisateur.`);
            return;
        }

        const player = await cocService.getPlayer(tagCoc);
        if (!player) {
            await interaction.editReply(`**Joueur introuvable.** Tag: \`${tagCoc}\`.`);
            return;
        }

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

        const role = guild.roles.cache.find(r => r.name === "registered");
        if (role) {
            try {
                await member.roles.add(role);
            } catch (err: any) {
                console.warn(`[Register] Impossible d'ajouter le rôle "registered" à ${interaction.user.tag}: ${err?.message ?? err}`);
            }
        }

        try {
            await member.setNickname(player.name);
        } catch {
            // Pas de permission de renommer (admin bot nécessaire)
        }

        await db.createUser({
            name,
            surname: firstname,
            mail: email,
            classe,
            promotion,
            contract_type: contrat,
            rentree,
            game_id: tagCoc,
            game_name: player.name,
            hdv: player.townHallLevel,
            discord_id: interaction.user.id,
            discord_tag: interaction.user.tag,
        });

        const channelInfos = interaction.guild?.channels.cache.find(c => c.name === "infos-clans");
        const channelMention = channelInfos ? `<#${channelInfos.id}>` : "#infos-clans";

        const classeLabel = `${classe}ème année${promotion ? ` — ${promotion}` : ''}`;
        const contratLabel = contrat === ContractType.ALTERNANCE ? 'Alternance' : 'Initial';
        const rentreeLabel = rentree === Rentree.JANVIER ? 'Janvier' : 'Octobre';

        const avatarUrl = interaction.user.displayAvatarURL({ size: 128, extension: "png" });

        const successContainer = new ContainerBuilder()
            .setAccentColor(0x57F287)
            .addTextDisplayComponents(t => t.setContent(`# Inscription validée !`))
            .addSeparatorComponents(s => s)
            .addSectionComponents(section =>
                section
                    .addTextDisplayComponents(t =>
                        t.setContent(
                            `### Récapitulatif du profil\n` +
                            `**Classe :** ${classeLabel}\n` +
                            `**Contrat :** ${contratLabel} — Rentrée ${rentreeLabel}\n` +
                            `**HDV :** ${player.townHallLevel}\n` +
                            `**Tag COC :** \`${tagCoc}\`\n\n` +
                            `> Tes données ont été sauvegardées.\n` +
                            `Rendez-vous dans ${channelMention} pour la suite.`
                        )
                    )
                    .setThumbnailAccessory(new ThumbnailBuilder().setURL(avatarUrl))
            );

        await interaction.editReply({
            components: [successContainer],
            flags: MessageFlags.IsComponentsV2,
        });

    } catch (error) {
        console.error(error);
        await interaction.editReply("**Erreur interne** lors de l'enregistrement. Contacte un administrateur.");
    }
}
