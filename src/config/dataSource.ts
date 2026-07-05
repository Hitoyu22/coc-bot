import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { config } from './config.js';
import { User, WarEvent, WarParticipation, RaidEvent, RaidParticipation, AppSetting } from '../entities/index.js';

const isDev = config.NODE_ENV !== 'production';

export const AppDataSource = new DataSource({
    type: 'postgres',
    url: config.POSTGRES_URL,
    entities: [User, WarEvent, WarParticipation, RaidEvent, RaidParticipation, AppSetting],
    migrations: [isDev ? 'src/migrations/**/*.ts' : 'dist/migrations/**/*.js'],
    synchronize: false,
    migrationsRun: !isDev,
    logging: isDev,
});