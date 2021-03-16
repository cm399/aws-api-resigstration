import { IsDate, IsNumber, IsString } from "class-validator";
import { BaseEntity, Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('membershipProductTypeDiscountType',{ database: process.env.MYSQL_DATABASE_REG })
export class MembershipProductTypeDiscountType extends BaseEntity {

    @IsNumber()
    @PrimaryGeneratedColumn()
    id: number;

    @IsString()
    @Column()
    name: string;

    @IsNumber()
    @Column({ nullable: true, default: null })
    membershipProductId: number;

    @IsNumber()
    @Column()
    isDefault: number;

    @IsString()
    @Column()
    description: string;

    @IsNumber()
    @Column()
    createdBy:number;

    @IsDate()
    @Column({ type: 'datetime', default: () => new Date()})
    createdOn:Date;

    @IsDate()
    @Column({ type: 'datetime', default: () => new Date()})
    updatedOn:Date;

    @IsNumber()
    @Column()
    updatedBy:number;
    
    @IsNumber()
    @Column()
    isDeleted: number;
}
