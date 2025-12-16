import {Client} from 'clashofclans.js';
import {config} from '../config/config';

export class ClashOfClansService {
    private client: Client;

    constructor() {
        this.client = new Client({
            keys: [config.COC_KEY || ""]
        });
    }


    public async getClan(clanTag: string) {
        try {
            return await this.client.getClan(clanTag);
        } catch (error: any) {
            this.handleError(error, `Erreur lors de la récupération du clan ${clanTag}`);
            return null;
        }
    }


    public async getPlayer(playerTag: string) {
        try {
            return await this.client.getPlayer(playerTag);
        } catch (error: any) {
            this.handleError(error, `Erreur lors de la récupération du joueur ${playerTag}`);
            return null;
        }
    }

    public async searchClans(name: string) {
        try {
            return await this.client.getClans({name, limit: 5});
        } catch (error: any) {
            this.handleError(error, `Erreur lors de la recherche de clan : ${name}`);
            return [];
        }
    }

    private handleError(error: any, context: string) {
        if (error.reason === 'notFound') {
            console.warn(`[COC Service] ${context} : Ressource non trouvée.`);
        } else if (error.reason === 'accessDenied') {
            console.error(`[COC Service] ${context} : Accès refusé (Vérifie ton IP/Token).`);
        } else {
            console.error(`[COC Service] ${context} :`, error);
        }
    }
}


export const cocService = new ClashOfClansService();