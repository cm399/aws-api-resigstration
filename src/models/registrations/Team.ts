import { IsDate, IsNumber, IsString } from "class-validator";
import { BaseEntity, Column, Entity, PrimaryGeneratedColumn } from "typeorm";

@Entity('team', { database: process.env.MYSQL_DATABASE_COMP })
export class Team extends BaseEntity {

    @IsNumber()
    @PrimaryGeneratedColumn()
    id: number;

    @IsString()
    @Column()
    name: string;     
    
    @IsNumber()
    @Column()
    organisationId: number;

    @IsString()
    @Column()
    teamUniqueKey: string;     
    
    @IsNumber()
    @Column()
    competitionMembershipProductDivisionId: number;

    @IsNumber()
    @Column()
    competitionDivisionId: number;

    @IsNumber()
    @Column()			 
    gradeRefId: Number;  
    
    @IsString()
    @Column()
    competitionDivisionGradeId: Number;  

    @IsString()
    @Column()
    responseComments: string;
    
    @IsString()
    @Column()
    comments: String;   

    @IsNumber()
    @Column()
    competitionId: Number;  

    @IsNumber()
    @Column()
    sortorder: Number;
    
    @IsNumber()
    @Column()
    DrawSortOrder: Number;  

    @IsDate()
    @Column()
    commentsCreatedOn: Date;

    @IsNumber()
    @Column()
    commentsCreatedBy: Number

    @IsDate()
    @Column()
    responseCommentsCreatedOn: Date;

    @IsNumber()
    @Column()
    responseCommentsCreatedBy: Number;

    @IsNumber()
    @Column({ default: 1 })
    isActive: number;

    @IsNumber()
    @Column()
    prevGradeRefId: Number;  

    @IsNumber()
    @Column()
    createdBy: number;

    @IsDate()
    @Column()
    createdOn: Date;

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