import { IsDate, IsNumber, IsString } from "class-validator";
import { BaseEntity, Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('registration',{ database: process.env.MYSQL_DATABASE_REG })
export class Registration extends BaseEntity {

    @IsNumber()
    @PrimaryGeneratedColumn()
    id: number;

    @IsString()
    @Column()
    registrationUniqueKey: string;

    @IsString()
    @Column()
    postalCode: string;

    @IsString()
    @Column()
    alternativeLocation: string;

    @IsDate()
    @Column()
    dateOfBirth: Date;

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