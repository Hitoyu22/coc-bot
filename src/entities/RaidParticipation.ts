import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    ManyToOne,
    JoinColumn,
} from 'typeorm';
import { User } from './User';
import { RaidEvent } from './RaidEvent';

@Entity('raid_participation')
export class RaidParticipation {
    @PrimaryGeneratedColumn()
    id!: number;

    @ManyToOne(() => User, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'user_id' })
    user!: User;

    @Column({ type: 'int' })
    user_id!: number;

    @ManyToOne(() => RaidEvent, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'raid_event_id' })
    raid_event!: RaidEvent;

    @Column({ type: 'int' })
    raid_event_id!: number;

    @Column({ type: 'varchar' })
    coc_tag!: string;

    @Column({ type: 'varchar' })
    coc_name!: string;

    @Column({ type: 'int', default: 0 })
    attacks_used!: number;

    @Column({ type: 'int', default: 6 })
    attacks_limit!: number;

    @Column({ type: 'int', default: 0 })
    districts_destroyed!: number;

    @Column({ type: 'int', default: 0 })
    capital_resources_looted!: number;

    @Column({ type: 'float', default: 0 })
    points_awarded!: number;
}
