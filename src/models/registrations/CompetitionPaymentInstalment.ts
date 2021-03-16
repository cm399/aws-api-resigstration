import { IsDate, IsNumber } from "class-validator";
import { BaseEntity, Column, Entity, PrimaryGeneratedColumn } from "typeorm";

@Entity('competitionPaymentInstalment',{ database: process.env.MYSQL_DATABASE_REG })
export class CompetitionPaymentInstalment extends BaseEntity {

    @IsNumber()
    @PrimaryGeneratedColumn()
    id: number;

    @IsNumber()
    @Column()
    competitionId: number;

    @IsNumber()
    @Column()
    feesTypeRefId: number;

    @IsNumber()
    @Column()
    paymentOptionRefId: number;

    @IsDate()
    @Column()
    instalmentDate: Date;

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