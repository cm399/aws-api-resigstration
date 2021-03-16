import { IsDate, IsNumber, IsString } from "class-validator";
import { BaseEntity, Column, Entity, JoinColumn, OneToOne, PrimaryGeneratedColumn } from "typeorm";
import { CompetitionMembershipProductType } from "./CompetitionMembershipProductType";

@Entity('competitionTypeDiscount', { database: process.env.MYSQL_DATABASE_REG })
export class CompetitionTypeDiscount extends BaseEntity {

    @IsNumber()
    @PrimaryGeneratedColumn()
    id: number;

    @IsNumber()
    @Column()
    competitionTypeDiscountTypeId: number;

    @IsNumber()
    @Column()
    competitionMembershipProductTypeId: number;

    @OneToOne(type => CompetitionMembershipProductType)
    @JoinColumn()
    competitionMembershipProductType: CompetitionMembershipProductType;

    @IsNumber()
    @Column()
    organisationId: number;
    
    @IsNumber()
    @Column("decimal", { precision: 15, scale: 2, nullable: true, default: null })
    percentageOffOrFixedAmount: number;

    @IsString()
    @Column({ nullable: true, default: null })
    description: string;

    @IsDate()
    @Column({ nullable: true, default: null })
    availableFrom: Date;

    @IsDate()
    @Column({ nullable: true, default: null })
    availableTo: Date;

    @IsNumber()
    @Column()
    discountTypeRefId: number;

    @IsString()
    @Column({ nullable: true, default: null })
    discountCode: string;

    @IsString()
    @Column({ nullable: true, default: null })
    question: string;

    @IsNumber()
    @Column({ default: 0 })
    applyDiscount: number;

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
