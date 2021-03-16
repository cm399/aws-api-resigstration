import { IsDate, IsNumber } from "class-validator";
import { BaseEntity, Column, Entity, JoinColumn, OneToOne, PrimaryGeneratedColumn } from 'typeorm';
import { OrgRegistration } from './OrgRegistration';

@Entity('orgRegistrationSettings',{ database: process.env.MYSQL_DATABASE_REG })
export class OrgRegistrationSettings extends BaseEntity {

    @IsNumber()
    @PrimaryGeneratedColumn()
    id: number;

    @IsNumber()
    @Column()
    orgRegistrationId: number;

    @OneToOne(type => OrgRegistration)
    @JoinColumn()
    orgRegistration: OrgRegistration;

    @IsNumber()
    @Column()
    registrationSettingsRefId: number;

    @IsNumber()
    @Column()
    createdBy: number;

    @IsNumber()
    @Column({ nullable: true, default: null })
    updatedBy: number;

    @IsDate()
    @Column({ nullable: true, default: null })
    updatedOn: Date;
    
    @IsNumber()
    @Column()
    isDeleted: number;
}
