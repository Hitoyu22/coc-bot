import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    ManyToOne,
    JoinColumn,
} from 'typeorm';
import { User } from './User';
import { WarEvent } from './WarEvent';

@Entity('war_participation')
export class WarParticipation {
    @PrimaryGeneratedColumn()
    id!: number;

    @ManyToOne(() => User, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'user_id' })
    user!: User;

    @Column({ type: 'int' })
    user_id!: number;

    @ManyToOne(() => WarEvent, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'war_event_id' })
    war_event!: WarEvent;

    @Column({ type: 'int' })
    war_event_id!: number;

    @Column({ type: 'varchar' })
    coc_tag!: string;

    @Column({ type: 'varchar' })
    coc_name!: string;

    @Column({ type: 'int', default: 0 })
    attacks_made!: number;

    @Column({ type: 'int', default: 2 })
    attacks_expected!: number;

    @Column({ type: 'float', default: 0 })
    total_destruction!: number;

    @Column({ type: 'int', default: 0 })
    total_stars!: number;

    @Column({ type: 'float', default: 0 })
    points_awarded!: number;

    @Column({ type: 'jsonb', nullable: true })
    attacks_detail!: object[] | null;
}
