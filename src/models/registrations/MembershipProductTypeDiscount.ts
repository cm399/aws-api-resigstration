import { IsDate, IsNumber, IsString } from "class-validator";
import { BaseEntity, Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('membershipProductTypeDiscount',{ database: process.env.MYSQL_DATABASE_REG })
export class MembershipProductTypeDiscount extends BaseEntity {

    @IsNumber()
    @PrimaryGeneratedColumn()
    id: number;

    @IsNumber()
    @Column()
    membershipProductTypeDiscountTypeId: number;

    @IsNumber()
    @Column()
    membershipProductTypeMappingId: number;

    @IsNumber()
    @Column()
    discountTypeRefId: number;

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

    @IsString()
    @Column({ nullable: true, default: null })
    discountCode: string;

    @IsNumber()
    @Column()
    createdBy: number;

    @IsNumber()
    @Column({ nullable: true, default: null })
    updatedBy: number;

    @IsNumber()
    @Column({ default: 0 })
    isDeleted: number;

    @IsNumber()
    @Column({ default: 0 })
    applyDiscount: number;

    @IsString()
    @Column({nullable:true,default:null})
    question: string;

    @IsDate()
    @Column({ nullable: true, default: null })
    updatedOn: Date;

    // @IsDate()
    // @Column({ type: 'datetime', default: () => new Date() })
    // createdOn: Date;
    
}
