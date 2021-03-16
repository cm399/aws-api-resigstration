import { IsDate, IsNumber } from "class-validator";
import { BaseEntity, Column, Entity, JoinColumn, OneToOne, PrimaryGeneratedColumn } from "typeorm";
import { CompetitionReg } from "./Competition";

@Entity('competitionMembershipProduct',{ database: process.env.MYSQL_DATABASE_REG })
export class CompetitionMembershipProduct extends BaseEntity {

    @IsNumber()
    @PrimaryGeneratedColumn()
    id: number;

    @IsNumber()
    @Column()
    competitionId: number;

    @OneToOne(type => CompetitionReg)
    @JoinColumn()
    competition: CompetitionReg;

    @IsNumber()
    @Column()
    membershipProductId: number;

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
