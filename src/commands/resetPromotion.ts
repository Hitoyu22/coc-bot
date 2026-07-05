import {
    ChatInputCommandInteraction,
    SlashCommandBuilder,
    EmbedBuilder,
    PermissionFlagsBits,
} from 'discord.js';
import { AppDataSource } from '../config/dataSource';
import { User, ContractType, Rentree } from '../entities/User';

export const data = new SlashCommandBuilder()
    .setName('reset-promotion')
    .setDescription('Remet à 0 les points d\'une promotion (ex : 3ème année Alternance Octobre déjà récompensée)')
    .addIntegerOption(o =>
        o.setName('classe').setDescription('Année d\'étude').setRequired(true)
            .addChoices(
                { name: '1ère année', value: 1 },
                { name: '2ème année', value: 2 },
                { name: '3ème année', value: 3 },
                { name: '4ème année', value: 4 },
                { name: '5ème année', value: 5 },
            )
    )
    .addStringOption(o =>
        o.setName('rentree').setDescription('Rentrée scolaire').setRequired(true)
            .addChoices(
                { name: 'Octobre', value: Rentree.OCTOBRE },
                { name: 'Janvier', value: Rentree.JANVIER },
            )
    )
    .addStringOption(o =>
        o.setName('contrat').setDescription('Type de contrat (laisser vide pour les deux)').setRequired(false)
            .addChoices(
                { name: 'Alternance', value: ContractType.ALTERNANCE },
                { name: 'Initial', value: ContractType.INITIAL },
            )
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator);

export async function execute(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply();

    const classe = interaction.options.getInteger('classe', true);
    const rentree = interaction.options.getString('rentree', true) as Rentree;
    const contrat = interaction.options.getString('contrat') as ContractType | null;

    const repo = AppDataSource.getRepository(User);

    const where: any = { classe, rentree };
    if (contrat) where.contract_type = contrat;

    const targets = await repo.find({ where });
    if (targets.length === 0) {
        await interaction.editReply(
            `Aucun membre trouvé pour **${classe}ème année — rentrée ${rentree}${contrat ? ` — ${contrat}` : ''}**.`
        );
        return;
    }

    const qb = repo.createQueryBuilder()
        .update()
        .set({ war: 0, ligue: 0, clangame: 0, raids: 0, donation: 0 })
        .where('classe = :classe AND rentree = :rentree', { classe, rentree });
    if (contrat) qb.andWhere('contract_type = :contrat', { contrat });
    await qb.execute();

    const contratLabel = contrat === ContractType.ALTERNANCE ? 'Alternance'
        : contrat === ContractType.INITIAL ? 'Initial' : 'Tous contrats';

    const embed = new EmbedBuilder()
        .setTitle('🔄 Points de promotion remis à zéro')
        .setColor(0xE67E22)
        .setDescription(
            `**Cible :** ${classe}${classe === 1 ? 'ère' : 'ème'} année — Rentrée ${rentree} — ${contratLabel}\n` +
            `**${targets.length} membre(s)** concerné(s) :`
        )
        .addFields({
            name: 'Membres',
            value: targets.slice(0, 30)
                .map(u => `• ${u.game_name ?? u.surname} (${u.surname} ${u.name})`)
                .join('\n') + (targets.length > 30 ? `\n… et ${targets.length - 30} autres` : ''),
            inline: false,
        })
        .setFooter({ text: 'Points GDC, Ligue, JdC, Raids et Dons remis à 0' })
        .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
}
