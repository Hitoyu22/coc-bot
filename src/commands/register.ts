import {
    ChatInputCommandInteraction,
    SlashCommandBuilder,
    GuildMember,
    MessageFlags,
    ContainerBuilder,
    ThumbnailBuilder
} from "discord.js";

import { cocService } from "../services/coc";
import { UserDatabase } from "../services/userDatabase";

const SPECIALITES = ["AL", "IW", "IABD", "BC", "MOC", "SRC", "RVJV", "SI", "MSCI"];
const ANNEES_SUPERIEURES = [3, 4, 5];

const CLASSES_LIST = [
    { name: "1A (Alternance)", value: "1A" },
    { name: "1I (Initial)", value: "1I" },
    { name: "2A (Alternance)", value: "2A" },
    { name: "2I (Initial)", value: "2I" },
    { name: "2MSCI", value: "2MSCI" },
];

ANNEES_SUPERIEURES.forEach(annee => {
    SPECIALITES.forEach(spe => {
        CLASSES_LIST.push({
            name: `${annee}${spe}`,
            value: `${annee}${spe}`
        });
    });
});

export const data = new SlashCommandBuilder()
    .setName("register")
    .setDescription("S'enregistrer sur le serveur et lier son compte COC")
    .addStringOption(option =>
        option.setName("nom")
            .setDescription("Ton Nom")
            .setRequired(true))
    .addStringOption(option =>
        option.setName("prenom")
            .setDescription("Ton Prénom")
            .setRequired(true))
    .addStringOption(option =>
        option.setName("classe")
            .setDescription("Année + Filière (ex: 3IW, 5AL...). Pour la 1ère année, précise I ou A (ex: 1A, 1I).")
            .setRequired(true)
            .setAutocomplete(false))
    .addStringOption(option =>
        option.setName("tag_coc")
            .setDescription("Ton tag Clash of Clans (ex: #2PP...)")
            .setRequired(true))
    .addStringOption(option =>
        option.setName("email")
            .setDescription("Ton adresse email scolaire (@myskolae)")
            .setRequired(true));

export async function execute(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply({
        flags: MessageFlags.Ephemeral
    });

    const name = interaction.options.getString("nom", true);
    const firstname = interaction.options.getString("prenom", true);
    const email = interaction.options.getString("email", true);

    const rawClasse = interaction.options.getString("classe", true);
    const classe = rawClasse.toUpperCase().replace(/\s+/g, '');

    let tagCoc = interaction.options.getString("tag_coc", true).toUpperCase();

    const classeExiste = CLASSES_LIST.some(c => c.value === classe);
    if (!classeExiste) {
        await interaction.editReply(
            `**Classe invalide :** "${rawClasse}".\n` +
            `Merci de respecter le format : Année + Filière.\n` +
            `- Exemples valides : **1A, 1I, 2A, 3IW, 4AL, 5SI...**`
        );
        return;
    }

    if (!tagCoc.startsWith("#")) tagCoc = `#${tagCoc}`;
    const tagRegex = /^#[0-9A-Z]+$/;
    if (!tagRegex.test(tagCoc)) {
        await interaction.editReply("**Format du Tag invalide.** Un tag COC commence par # et contient des chiffres et lettres majuscules.");
        return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
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

        const member = interaction.member as GuildMember;
        const roleName = "registered";
        const role = interaction.guild?.roles.cache.find(r => r.name === roleName);

        if (role) {
            await member.roles.add(role);
        } else {
            console.warn(`Rôle "${roleName}" non trouvé sur le serveur.`);
        }

        try {
            await member.setNickname(`${player.name}`);
        } catch (error) {
            console.error("Erreur renommage :", error);
        }

        await db.createUser({
            name: name,
            surname: firstname,
            discord_tag: interaction.user.tag,
            discord_id: interaction.user.id,
            hdv: player.townHallLevel,
            classe: classe,
            mail: email,
            role: "student",
            game_name: player.name,
            game_id: tagCoc,
            info: "Inscrit via Bot"
        });

        const channelInfos = interaction.guild?.channels.cache.find(c => c.name === "infos-clans");
        const channelMention = channelInfos ? `<#${channelInfos.id}>` : "#infos-clans";

        const avatarUrl = interaction.user.displayAvatarURL({
            size: 128,
            extension: "png"
        });

        const successContainer = new ContainerBuilder()
            .setAccentColor(0x57F287)

            .addTextDisplayComponents((textDisplay) =>
                textDisplay.setContent(
                    `# Inscription validée !`)
            )

            .addSeparatorComponents((separator) => separator)

            .addSectionComponents((section) =>
                section
                    .addTextDisplayComponents((textDisplay) =>
                        textDisplay.setContent(
                            `### Récapitulatif du profil\n` +
                            `**Hôtel de Ville :** ${player.townHallLevel}\n` +
                            `**Classe :** ${classe}\n` +
                            `**Tag COC :** \`${tagCoc}\`\n\n` +
                            `> Tes données ont été sauvegardées.\n` +
                            `Rendez-vous dans ${channelMention} pour la suite.`
                        )
                    )
                    .setThumbnailAccessory(
                        new ThumbnailBuilder().setURL(avatarUrl)
                    )
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