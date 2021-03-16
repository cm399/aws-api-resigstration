import { IsDate, IsNumber, IsString } from "class-validator";
import { BaseEntity, Column, Entity, PrimaryGeneratedColumn } from "typeorm";

@Entity("competitionDivisionGrade",{ database: process.env.MYSQL_DATABASE_REG })
export class CompetitionDivisionGrade extends BaseEntity {

    @IsNumber()
    @PrimaryGeneratedColumn()
    id: number;

    @IsString()
    @Column({ nullable: true, default: null })
    name: string;

    @IsNumber()
    @Column()
    competitionMembershipProductDivisionId: number;

    @IsNumber()
    @Column()
    competitionDivisionId: number;

    @IsNumber()
    @Column()			 
    gradeRefId: number;

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
