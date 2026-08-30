import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    UpdateDateColumn,
} from 'typeorm';

export enum Promotion {
    AL = 'AL',
    IW = 'IW',
    IABD = 'IABD',
    BC = 'BC',
    MOC = 'MOC',
    SRC = 'SRC',
    RVJV = 'RVJV',
    SI = 'SI',
    MSCI = 'MSCI',
    IABS = 'IABS',
    ID = 'ID',
}

export enum ContractType {
    ALTERNANCE = 'alternance',
    INITIAL = 'initial',
}

export enum Rentree {
    JANVIER = 'janvier',
    OCTOBRE = 'octobre',
}

@Entity('user')
export class User {
    @PrimaryGeneratedColumn()
    id!: number;

    @Column({ type: 'varchar' })
    name!: string;

    @Column({ type: 'varchar' })
    surname!: string;

    @Column({ type: 'varchar', unique: true })
    mail!: string;

    @Column({ type: 'int' })
    classe!: number;

    @Column({ type: 'enum', enum: Promotion, nullable: true })
    promotion!: Promotion | null;

    @Column({ type: 'enum', enum: ContractType, nullable: true })
    contract_type!: ContractType | null;

    @Column({ type: 'enum', enum: Rentree, nullable: true })
    rentree!: Rentree | null;

    @CreateDateColumn()
    created_at!: Date;

    @UpdateDateColumn()
    updated_at!: Date;

    @Column({ type: 'varchar', nullable: true })
    game_id!: string | null;

    @Column({ type: 'varchar', nullable: true })
    game_name!: string | null;

    @Column({ type: 'int', nullable: true })
    hdv!: number | null;

    @Column({ type: 'varchar', unique: true })
    discord_id!: string;

    @Column({ type: 'varchar' })
    discord_tag!: string;

    @Column({ type: 'float', default: 0 })
    war!: number;

    @Column({ type: 'float', default: 0 })
    ligue!: number;

    @Column({ type: 'float', default: 0 })
    clangame!: number;

    @Column({ type: 'float', default: 0 })
    raids!: number;

    @Column({ type: 'float', default: 0 })
    donation!: number;
}