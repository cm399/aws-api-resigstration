import { IsDate, IsNumber, IsString } from "class-validator";
import { BaseEntity, Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('approvalRefund',{ database: process.env.MYSQL_DATABASE_REG })
export class ApprovalRefund extends BaseEntity {

    @IsNumber()
    @PrimaryGeneratedColumn()
    id: number;

    @IsNumber()
    @Column()
    approvalId: number;

    @IsNumber()
    @Column()
    invoiceId: number;

    @IsNumber()
    @Column()
    transactionId: number;

    @IsNumber()
    @Column()
    refundAmount: number;

    @IsString()
    @Column()
    feeType: string;
    
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
