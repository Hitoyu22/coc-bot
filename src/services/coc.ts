import { Client } from 'clashofclans.js';
import { config } from '../config/config';

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
            this.handleError(error, `Récupération clan ${clanTag}`);
            return null;
        }
    }

    public async getPlayer(playerTag: string) {
        try {
            return await this.client.getPlayer(playerTag);
        } catch (error: any) {
            this.handleError(error, `Récupération joueur ${playerTag}`);
            return null;
        }
    }

    public async searchClans(name: string) {
        try {
            return await this.client.getClans({ name, limit: 5 });
        } catch (error: any) {
            this.handleError(error, `Recherche clan : ${name}`);
            return [];
        }
    }

    public async getCurrentWar(clanTag: string) {
        try {
            return await this.client.getClanWar(clanTag);
        } catch (error: any) {
            this.handleError(error, `Guerre actuelle ${clanTag}`);
            return null;
        }
    }

    public async getWarLog(clanTag: string, limit = 20) {
        try {
            return await this.client.getClanWarLog(clanTag, { limit });
        } catch (error: any) {
            this.handleError(error, `Historique guerres ${clanTag}`);
            return null;
        }
    }

    public async getClanWarLeagueGroup(clanTag: string) {
        try {
            return await this.client.getClanWarLeagueGroup(clanTag);
        } catch (error: any) {
            this.handleError(error, `Groupe ligue ${clanTag}`);
            return null;
        }
    }

    public async getLeagueWar(warTag: string) {
        try {
            // getClanWarLeagueRound = /clanwarleagues/wars/{warTag}
            // (getLeagueWar de la lib attend un tag de CLAN, pas un warTag !)
            return await this.client.getClanWarLeagueRound(warTag);
        } catch (error: any) {
            this.handleError(error, `Guerre ligue ${warTag}`);
            return null;
        }
    }

    public async getRaidSeasons(clanTag: string, limit = 10) {
        try {
            return await this.client.getCapitalRaidSeasons(clanTag, { limit });
        } catch (error: any) {
            this.handleError(error, `Raids ${clanTag}`);
            return null;
        }
    }

    public async getClanMembers(clanTag: string) {
        try {
            return await this.client.getClanMembers(clanTag);
        } catch (error: any) {
            this.handleError(error, `Membres clan ${clanTag}`);
            return null;
        }
    }

    private handleError(error: any, context: string) {
        if (error.reason === 'notFound') {
            console.warn(`[COC] ${context}: Ressource non trouvée.`);
        } else if (error.reason === 'accessDenied') {
            console.error(`[COC] ${context}: Accès refusé (IP/Token invalide).`);
        } else {
            console.error(`[COC] ${context}:`, error.message ?? error);
        }
    }
}

export const cocService = new ClashOfClansService();
