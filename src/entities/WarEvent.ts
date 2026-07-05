import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
} from 'typeorm';

export type WarEventType = 'gdc' | 'league';

@Entity('war_event')
export class WarEvent {
    @PrimaryGeneratedColumn()
    id!: number;

    @Column({ type: 'varchar' })
    type!: WarEventType;

    @Column({ type: 'varchar' })
    clan_id!: string;

    @Column({ type: 'int' })
    clan_number!: number;

    @Column({ type: 'varchar', nullable: true })
    war_tag!: string | null;

    @Column({ type: 'timestamp' })
    start_time!: Date;

    @Column({ type: 'timestamp', nullable: true })
    end_time!: Date | null;

    @Column({ type: 'int', default: 2 })
    attacks_per_member!: number;

    @Column({ type: 'int', default: 0 })
    team_size!: number;

    @Column({ type: 'varchar', nullable: true })
    opponent_name!: string | null;

    @Column({ type: 'varchar', default: 'unknown' })
    result!: string;

    @Column({ type: 'boolean', default: false })
    points_saved!: boolean;

    @CreateDateColumn()
    created_at!: Date;
}
