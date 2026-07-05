import { Entity, PrimaryColumn, Column, UpdateDateColumn } from 'typeorm';

@Entity('app_setting')
export class AppSetting {
    @PrimaryColumn({ type: 'varchar' })
    key!: string;

    @Column({ type: 'varchar', nullable: true })
    value!: string | null;

    @UpdateDateColumn()
    updated_at!: Date;
}
