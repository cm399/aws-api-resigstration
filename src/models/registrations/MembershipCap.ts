import { IsDate, IsNumber } from "class-validator";
import { BaseEntity, Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('membershipCap',{ database: process.env.MYSQL_DATABASE_REG })
export class MembershipCap extends BaseEntity {
    
    @IsNumber()
    @PrimaryGeneratedColumn()
    id: number;

    @IsNumber()
    @Column()
    organisationId: number;

    @IsNumber()
    @Column()
    yearRefId: number;

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