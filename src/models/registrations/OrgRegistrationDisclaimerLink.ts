import { IsDate, IsNumber, IsString } from "class-validator";
import { BaseEntity, Column, Entity, JoinColumn, OneToOne, PrimaryGeneratedColumn } from 'typeorm';
import { OrgRegistration } from './OrgRegistration';

@Entity('orgRegistrationDisclaimerLink', { database: process.env.MYSQL_DATABASE_REG })
export class OrgRegistrationDisclaimerLink extends BaseEntity {

    @IsNumber()
    @PrimaryGeneratedColumn()
    id: number;

    @IsNumber()
    @Column()
    orgRegistrationId: number;

    @OneToOne(type => OrgRegistration)
    @JoinColumn()
    orgRegistration: OrgRegistration;

    @IsString()
    @Column()
    disclaimerLink: string;

    @IsString()
    @Column({ nullable: true, default: null })
    disclaimerText: string;

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
