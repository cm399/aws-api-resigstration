import { IsDate, IsNumber, IsString } from "class-validator";
import { BaseEntity, Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('player',{ database: process.env.MYSQL_DATABASE_COMP })
export class Player extends BaseEntity {

    @IsNumber()
    @PrimaryGeneratedColumn()
    id: number;

    @IsNumber()
    @Column()
    competitionMembershipProductDivisionId: number;

    @IsNumber()
    @Column()
    competitionMembershipProductTypeId: number;
    
    @IsNumber()
    @Column()
    competitionDivisionId: number;
    
    @IsNumber()
    @Column()
    competitionId: Number;  

    @IsNumber()
    @Column()
    organisationId: Number;  

    @IsNumber()
    @Column()		 
    userRegistrationId: number;

    @IsNumber()
    @Column()
    userId: number;

    @IsNumber()
    @Column()
    teamId: number;
    
    @IsNumber()
    @Column()
    payingFor: number;

    @IsNumber()
    @Column()
    positionId1: number;

    @IsNumber()
    @Column()
    positionId2: number;

    @IsNumber()
    @Column()
    statusRefId: number;

    @IsString()
    @Column()
    comments: string;

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
    @Column({ default: 0 })
    isDeleted: number;

}
