import { BaseEntity, Column, Entity, PrimaryGeneratedColumn, OneToOne, JoinColumn } from "typeorm";
import { IsNumber, IsString, IsDate } from "class-validator";
import { CompetitionTypeDiscount } from "./CompetitionTypeDiscount";

@Entity('competitionTypeChildDiscount', { database: process.env.MYSQL_DATABASE_REG })
export class CompetitionTypeChildDiscount extends BaseEntity {

    @IsNumber()
    @PrimaryGeneratedColumn()
    id: number;

    @IsNumber()
    @Column()
    competitionTypeDiscountId: number;

    @OneToOne(type => CompetitionTypeDiscount)
    @JoinColumn()
    competitionTypeDiscount: CompetitionTypeDiscount;

    @IsNumber()
    @Column("decimal", { precision: 15, scale: 2, nullable: true, default: null })
    percentageValue: number;

    @IsNumber()
    @Column()
    organisationId: number;
    
    @IsNumber()
    @Column({ nullable: true, default: null })
    sortOrder: number;

    @IsNumber()
    @Column()
    createdBy: number;

    @IsNumber()
    @Column({ nullable: true, default: null })
    updatedBy: number;

    @IsDate()
    @Column({ nullable: true, default: null })
    updatedOn: Date;

    // @IsDate()
    // @Column({ type: 'datetime', default: () => new Date() })
    // createdOn: Date;

    @IsNumber()
    @Column()
    isDeleted: number;
}
