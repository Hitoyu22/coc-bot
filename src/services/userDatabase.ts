import { pool } from '../config/pg';

export interface NewUser {
    name: string;
    surname: string;
    discord_tag: string;
    discord_id: string;
    hdv: number;
    classe: string;
    mail: string;
    role: string;
    game_name: string;
    game_id: string;
    info: string;
}

export class UserDatabase {

    public async findUserByDiscordId(id: string) {
        const result = await pool.query('SELECT * FROM "user" WHERE discord_id = $1', [id]);
        return result.rows[0];
    }

    public async findUserByCocTag(tag: string) {
        const result = await pool.query('SELECT * FROM "user" WHERE game_id = $1', [tag]);
        return result.rows[0];
    }

    public async createUser(data: NewUser) {
        const query = `
            INSERT INTO "user" 
            (name, surname, discord_tag, discord_id, hdv, classe, mail, role, game_name, game_id, info, clangame, ligue, war, raid, dons)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 0, 0, 0, 0, 0)
            RETURNING *;
        `;

        const values = [
            data.name,
            data.surname,
            data.discord_tag,
            data.discord_id,
            data.hdv,
            data.classe,
            data.mail,
            data.role,
            data.game_name,
            data.game_id,
            data.info
        ];

        const result = await pool.query(query, values);
        return result.rows[0];
    }

    public async resetUsers() {
        const result = await pool.query('DELETE FROM "user"');
        return result.rowCount;
    }

    public async resetPoints(discordId?: string) {
        let query = `
            UPDATE "user"
            SET clangame = 0, 
                ligue = 0, 
                war = 0, 
                raid = 0, 
                dons = 0
        `;

        const params: any[] = [];

        if (discordId) {
            query += ` WHERE discord_id = $1`;
            params.push(discordId);
        }

        const result = await pool.query(query, params);
        return result.rowCount;
    }

    public async getAllUsers() {
        const result = await pool.query('SELECT name, surname, discord_id, game_name FROM "user"');
        return result.rows;
    }
}