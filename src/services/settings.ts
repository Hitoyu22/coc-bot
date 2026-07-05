import { AppDataSource } from '../config/dataSource';
import { AppSetting } from '../entities/AppSetting';

const YEAR_START_KEY = 'year_start';

export class SettingsService {
    private get repo() {
        return AppDataSource.getRepository(AppSetting);
    }

    async get(key: string): Promise<string | null> {
        const setting = await this.repo.findOne({ where: { key } });
        return setting?.value ?? null;
    }

    async set(key: string, value: string | null): Promise<void> {
        await this.repo.save({ key, value });
    }

    async getYearStart(): Promise<Date | null> {
        const raw = await this.get(YEAR_START_KEY);
        if (!raw) return null;
        const d = new Date(raw);
        return Number.isNaN(d.getTime()) ? null : d;
    }

    async startYear(date: Date): Promise<void> {
        await this.set(YEAR_START_KEY, date.toISOString());
    }

    async endYear(): Promise<void> {
        await this.set(YEAR_START_KEY, null);
    }

    async isYearActive(): Promise<boolean> {
        return (await this.getYearStart()) !== null;
    }
}

export const settingsService = new SettingsService();
