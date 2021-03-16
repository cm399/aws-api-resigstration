import { IsDate, IsNumber, IsString } from "class-validator";
import { BaseEntity, Column, Entity, PrimaryGeneratedColumn } from "typeorm";

@Entity('transactions', { database: process.env.MYSQL_DATABASE_REG })
export class Transaction extends BaseEntity {

    @IsNumber()
    @PrimaryGeneratedColumn()
    id: number;

    @IsNumber()
    @Column({ nullable: true })
    invoiceId: number;

    @IsNumber()
    @Column({ nullable: true })
    competitionCharityRoundUpId: number;

    @IsNumber()
    @Column("decimal", { precision: 15, scale: 2, nullable: false })
    feeAmount: number;

    @IsNumber()
    @Column("decimal", { precision: 15, scale: 2, nullable: false })
    gstAmount: number;

    @IsNumber()
    @Column("decimal", { precision: 15, scale: 2, nullable: true, default: null })
    discountAmount: number;

    @IsNumber()
    @Column("decimal", { precision: 15, scale: 2, nullable: true, default: null })
    familyDiscountAmount: number;

    @IsNumber()
    @Column("decimal", { precision: 15, scale: 2, nullable: true, default: null })
    governmentVoucherAmount: number;

    @IsString()
    @Column({ nullable: false, enum: ['membership', 'competition', 'affiliate', 'charity','nomination'] })
    feeType: 'membership'| 'competition'| 'affiliate'| 'charity' | 'nomination';

    @IsNumber()
    @Column()
    feeTypeRefId: number;
    
    @IsNumber()
    @Column()
    governmentVoucherStatusRefId: number;

    @IsNumber()
    @Column({ nullable: false })
    organisationId: number;

    @IsNumber()
    @Column({ nullable: false })
    participantId: number;

    @IsNumber()
    @Column({ nullable: false })
    membershipProductMappingId: number;

    @IsNumber()
    @Column({ nullable: false })
    competitionId: number;

    @IsNumber()
    @Column()
    paymentOptionRefId: number;

    @IsNumber()
    @Column()
    paymentFeeTypeRefId: number;

    @IsNumber()
    @Column()
    transactionTypeRefId: number;

    @IsString()
    @Column()
    stripeTransactionId: string;

    @IsNumber()
    @Column()
    isProcessed: number;

    @IsNumber()
    @Column({ nullable: true })
    divisionId: number;

    @IsNumber()
    @Column("decimal", { precision: 15, scale: 2, nullable: true, default: null })
    amountReceived: number

    @IsNumber()
    @Column({default: 1})
    statusRefId: number;

    @IsDate()
    @Column({ nullable: true, default: null })
    instalmentDate: Date

    @IsNumber()
    @Column({default: null})
    invoiceRefId: number;

    @IsNumber()
    @Column({default: null})
    paidBy: number;

    @IsString()
    @Column()
    referenceId: string;

    @IsString()
    @Column()
    paymentIntentId: string;

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
