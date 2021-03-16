import { IsDate, IsNumber, IsString } from "class-validator";
import { BaseEntity, Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('membershipProductTypeChildDiscount',{ database: process.env.MYSQL_DATABASE_REG })
export class MembershipProductTypeChildDiscount extends BaseEntity {

    @IsNumber()
    @PrimaryGeneratedColumn()
    id: number;

    @IsString()
    @Column()
    membershipProductTypeDiscountId: string;
    
    @IsNumber()
    @Column("decimal", { precision: 15, scale: 2, nullable: true, default: null })
    percentageValue: number;

    @IsNumber()
    @Column({ nullable: true, default: null })
    sortOrder: number;

    @IsNumber()
    @Column()
    createdBy: number;

    @IsNumber()
    @Column({ nullable: true, default: null })
    updatedBy: number;

    @IsNumber()
    @Column({ default: 0 })
    isDeleted: number;

    @IsDate()
    @Column({ nullable: true, default: null })
    updatedOn: Date;

    // @IsDate()
    // @Column({ type: 'datetime', default: () => new Date() })
    // createdOn: Date;
    
}
