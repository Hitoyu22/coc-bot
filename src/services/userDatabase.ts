import { AppDataSource } from '../config/dataSource';
import { User, Promotion, ContractType, Rentree } from '../entities/User';

export interface NewUser {
    name: string;
    surname: string;
    mail: string;
    classe: number;
    promotion: Promotion | null;
    contract_type: ContractType | null;
    rentree: Rentree | null;
    game_id: string;
    game_name: string;
    hdv: number;
    discord_id: string;
    discord_tag: string;
}

export { Promotion, ContractType, Rentree };

export class UserDatabase {
    private get repo() {
        return AppDataSource.getRepository(User);
    }

    async findUserByDiscordId(id: string) {
        return this.repo.findOne({ where: { discord_id: id } });
    }

    async findUserByCocTag(tag: string) {
        return this.repo.findOne({ where: { game_id: tag } });
    }

    async createUser(data: NewUser) {
        const user = this.repo.create(data);
        return this.repo.save(user);
    }

    async resetUsers() {
        const result = await AppDataSource.query(`DELETE FROM "user" RETURNING id`);
        return result.length ?? 0;
    }

    async resetPoints(discordId?: string) {
        const qb = this.repo.createQueryBuilder()
            .update()
            .set({ war: 0, ligue: 0, clangame: 0, raids: 0, donation: 0 });

        if (discordId) {
            qb.where('discord_id = :discordId', { discordId });
        }

        const result = await qb.execute();
        return result.affected ?? 0;
    }

    async getAllUsers() {
        return this.repo.find({
            select: { name: true, surname: true, discord_id: true, game_name: true },
        });
    }
}
