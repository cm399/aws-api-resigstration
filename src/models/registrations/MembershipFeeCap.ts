import { IsDate, IsNumber } from "class-validator";
import { BaseEntity, Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('membershipFeeCap',{ database: process.env.MYSQL_DATABASE_REG })
export class MembershipFeeCap extends BaseEntity {
    
    @IsNumber()
    @PrimaryGeneratedColumn()
    id: number;

    @IsNumber()
    @Column()
    membershipCapId: number;

    @IsDate()
    @Column({ nullable: true, default: null })
    dobFrom:Date;

    @IsDate()
    @Column({ nullable: true, default: null })
    dobTo:Date;

    @IsNumber()
    @Column("decimal", { precision: 15, scale: 2, nullable: true, default: null })
    amount: number;

    @IsDate()
    @Column({ type: 'datetime', default: () => new Date()})
    createdOn:Date;
    
    @IsNumber()
    @Column()
    createdBy: number;

    @IsDate()
    @Column({ type: 'datetime', default: () => new Date()})
    updatedOn:Date;
    
    @IsNumber()
    @Column({ nullable: true, default: null })
    updatedBy: number;

    @IsNumber()
    @Column({ default: 0 })
    isDeleted: number;

}