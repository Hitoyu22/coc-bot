import { SlashCommandBuilder, ChatInputCommandInteraction, PermissionFlagsBits, User } from "discord.js";
import { pool } from "../config/pg";

const ACTIVITIES = [
    { name: "GDC", value: "war" },
    { name: "Ligue", value: "ligue" },
    { name: "Dons", value: "dons" },
    { name: "Jeux de clans", value: "clangame" },
    { name: "Raids", value: "raid" }
];

export const data = new SlashCommandBuilder()
    .setName("set-points-backup")
    .setDescription("Backup : Ajoute des points manuellement (jusqu'à 10 utilisateurs)")
    .addNumberOption(option =>
        option.setName("points")
            .setDescription("Nombre de points")
            .setRequired(true)
    )
    .addStringOption(option =>
        option.setName("activite")
            .setDescription("Type d'activité")
            .setRequired(true)
            .addChoices(...ACTIVITIES)
    )
    .addUserOption(option =>
        option.setName("user1")
            .setDescription("Utilisateur 1 (Obligatoire)")
            .setRequired(true)
    );

for (let i = 2; i <= 10; i++) {
    data.addUserOption(option =>
        option.setName(`user${i}`)
            .setDescription(`Utilisateur ${i} (Optionnel)`)
            .setRequired(false)
    );
}

data.setDefaultMemberPermissions(PermissionFlagsBits.Administrator);

export async function execute(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply();

    const points = interaction.options.getNumber("points", true);
    const activityColumn = interaction.options.getString("activite", true);
    const activityName = ACTIVITIES.find(a => a.value === activityColumn)?.name;

    const users: User[] = [];
    const user1 = interaction.options.getUser("user1", true);
    users.push(user1);

    for (let i = 2; i <= 10; i++) {
        const user = interaction.options.getUser(`user${i}`);
        if (user) users.push(user);
    }

    const uniqueUsers = users.filter((user, index, self) =>
        index === self.findIndex((u) => u.id === user.id)
    );
    const uniqueUserIds = uniqueUsers.map(u => u.id);

    try {
        const query = `
            UPDATE "user"
            SET ${activityColumn} = ${activityColumn} + $1
            WHERE discord_id = ANY($2)
                RETURNING discord_id
        `;

        const result = await pool.query(query, [points, uniqueUserIds]);
        const updatedCount = result.rowCount;

        const userList = uniqueUsers.map(u => `- ${u.username}`).join("\n");

        if (updatedCount === 0) {
            await interaction.editReply(`Aucun utilisateur trouvé en base de données.`);
        } else {
            await interaction.editReply(`**${points}** points ajoutés en **${activityName}** pour **${updatedCount}** utilisateur(s).\n${userList}`);
        }

    } catch (error) {
        console.error(error);
        await interaction.editReply("Erreur lors de la mise à jour des points.");
    }
}