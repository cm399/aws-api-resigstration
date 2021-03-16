import { IsDate, IsNumber } from "class-validator";
import { BaseEntity, Column, Entity, JoinColumn, OneToOne, PrimaryGeneratedColumn } from 'typeorm';
import { OrgRegistration } from './OrgRegistration';

@Entity('orgRegistrationRegisterMethod',{ database: process.env.MYSQL_DATABASE_REG })
export class OrgRegistrationRegisterMethod extends BaseEntity {

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
    registrationMethodRefId: number;

    @IsNumber()
    @Column()
    createdBy: number;

    @IsDate()
    @Column({ nullable: true, default: null })
    updatedOn: Date;
    
    @IsNumber()
    @Column({ nullable: true, default: null })
    updatedBy: number;

    @IsNumber()
    @Column()
    isDeleted: number;
}
