import { IsDate, IsNumber, IsString } from "class-validator";
import { BaseEntity, Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('singleGameRedeem',{ database: process.env.MYSQL_DATABASE_REG })
export class SingleGameRedeem extends BaseEntity {

    @IsNumber()
    @PrimaryGeneratedColumn()
    id: number;

    @IsNumber()
    @Column()
    userId: number;

    @IsNumber()
    @Column()
    registrationId: number;

    @IsNumber()
    @Column()
    competitionId: number;

    @IsNumber()
    @Column()
    organisationId: number

    @IsNumber()
    @Column()
    membershipProductMappingId: number

    @IsNumber()
    @Column()
    divisionId: number

    @IsNumber()
    @Column()
    redeemedMatchCount: number

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