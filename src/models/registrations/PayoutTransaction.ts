import { IsDate, IsNumber, IsString } from "class-validator";
import { BaseEntity, Column, Entity, PrimaryGeneratedColumn } from "typeorm";

@Entity('payoutTransactions', { database: process.env.MYSQL_DATABASE_REG })
export class PayoutTransaction extends BaseEntity {

    @IsNumber()
    @PrimaryGeneratedColumn()
    id: number;

    @IsString()
    @Column({ nullable: true })
    organisationUniqueKey: string;

    @IsString()
    @Column({ nullable: true })
    transactionId: string;

    @IsString()
    @Column({ nullable: true })
    payoutId: string;

    @IsString()
    @Column({ nullable: true })
    description: string;

    @IsString()
    @Column({ nullable: true })
    date: string;

    @IsString()
    @Column({ nullable: true })
    amount: string;

    @IsString()
    @Column({ nullable: true })
    status: string;

    @IsString()
    @Column({ nullable: true })
    createdOn: string;

    @IsNumber()
    @Column()
    createdBy: number;

    @IsDate()
    @Column({ nullable: true, default: null })
    updatedOn: Date;

    @IsNumber()
    @Column({ nullable: true, default: null })
    updatedBy: number;

    @IsNumber()
    @Column({ default: 0 })
    isDeleted: number;
}
