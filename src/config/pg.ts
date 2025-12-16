import { Pool } from 'pg';
import { config } from './config';

export const pool = new Pool({
    connectionString: config.POSTGRES_URL,
});

export const testConnection = async () => {
    try {
        const client = await pool.connect();
        console.log('Connexion Postgresql réussie');
        client.release();
    } catch (error) {
        console.error('Connexion échouée', error);
    }
};