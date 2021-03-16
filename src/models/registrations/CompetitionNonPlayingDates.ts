import { IsDate, IsNumber, IsString } from "class-validator";
import { BaseEntity, Column, Entity, JoinColumn, OneToOne, PrimaryGeneratedColumn } from "typeorm";
import { CompetitionReg } from "./Competition";

@Entity('competitionNonPlayingDates',{ database: process.env.MYSQL_DATABASE_REG })
export class CompetitionNonPlayingDates extends BaseEntity {

    @IsNumber()
    @PrimaryGeneratedColumn()
    id: number;

    @IsString()
    @Column({ nullable: true, default: null })
    name: string;

    @IsNumber()
    @Column()
    competitionId: number;
    
    @OneToOne(type => CompetitionReg)
    @JoinColumn()
    competition: CompetitionReg;
    
    @IsDate()
    @Column({ nullable: true, default: null })
    nonPlayingDate: Date;

    @IsNumber()
    @Column()
    createdBy: number;

    @IsNumber()
    @Column({ nullable: true, default: null })
    updatedBy: number;

    @IsNumber()
    @Column()
    isDeleted: number;

    @IsDate()
    @Column({ nullable: true, default: null })
    updatedOn: Date;

    // @IsDate()
    // @Column({ type: 'datetime', default: () => new Date() })
    // createdOn: Date;

}
