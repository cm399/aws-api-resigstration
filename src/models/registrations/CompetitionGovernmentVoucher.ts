import { BaseEntity, Column, Entity, JoinColumn, OneToOne, PrimaryGeneratedColumn } from "typeorm";
import { IsNumber, IsDate } from "class-validator";
import { CompetitionReg } from "./Competition";

@Entity('competitionGovernmentVoucher',{ database: process.env.MYSQL_DATABASE_REG })
export class CompetitionGovernmentVoucher extends BaseEntity {

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
    governmentVoucherRefId: number;

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
