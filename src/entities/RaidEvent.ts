import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
} from 'typeorm';

@Entity('raid_event')
export class RaidEvent {
    @PrimaryGeneratedColumn()
    id!: number;

    @Column({ type: 'varchar' })
    clan_id!: string;

    @Column({ type: 'int' })
    clan_number!: number;

    @Column({ type: 'timestamp' })
    start_time!: Date;

    @Column({ type: 'timestamp', nullable: true })
    end_time!: Date | null;

    @Column({ type: 'int', default: 0 })
    total_attacks!: number;

    @Column({ type: 'int', default: 0 })
    districts_destroyed!: number;

    @Column({ type: 'boolean', default: false })
    points_saved!: boolean;

    @CreateDateColumn()
    created_at!: Date;
}
