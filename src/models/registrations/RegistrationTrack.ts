import { IsDate, IsNumber, IsString } from "class-validator";
import { BaseEntity, Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('registrationTrack',{ database: process.env.MYSQL_DATABASE_REG })
export class RegistrationTrack extends BaseEntity {

    @IsNumber()
    @PrimaryGeneratedColumn()
    id: number;

    @IsNumber()
    @Column()
    registrationId: number;

    @IsNumber()
    @Column()
    userRegistrationId: number;

    @IsNumber()
    @Column()
    invoiceId: number;

    @IsNumber()
    @Column()
    stepsId: number

    @IsNumber()
    @Column()
    teamMemberRegId: number;

    @IsString()
    @Column()
    jsonData: string

    @IsNumber()
    @Column()
    createdBy: number;

    @IsNumber()
    @Column()
    updatedBy: number;

    @IsDate()
    @Column()
    updatedOn: Date;

    @IsNumber()
    @Column({ default: 0 })
    isDeleted: number;
}