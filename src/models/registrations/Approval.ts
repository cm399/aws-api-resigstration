import { IsDate, IsNumber, IsString } from "class-validator";
import { BaseEntity, Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('approval',{ database: process.env.MYSQL_DATABASE_REG })
export class Approval extends BaseEntity {

    @IsNumber()
    @PrimaryGeneratedColumn()
    id: number;

    @IsNumber()
    @Column()
    deRegisterId: number;

    @IsNumber()
    @Column()
    payingOrgId: number;

    @IsNumber()
    @Column()
    receivingOrgId : number;

    @IsNumber()
    @Column()
    refundTypeRefId: number;
    
    @IsNumber()
    @Column()
    declineReasonRefId: number;

    @IsString()
    @Column()
    otherInfo : string;

    @IsNumber()
    @Column()
    orgRefTypeId: number;
    
    @IsNumber()
    @Column()
    createdBy: number;

    @IsNumber()
    @Column({ nullable: true, default: null })
    updatedBy: number;

    @IsDate()
    @Column({ nullable: true, default: null })
    updatedOn: Date;
    
    @IsNumber()
    @Column({ default: 0 })
    isDeleted: number;
}
