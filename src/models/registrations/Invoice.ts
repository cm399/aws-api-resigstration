import { IsDate, IsNumber, IsString } from "class-validator";
import { BaseEntity, Column, Entity, PrimaryGeneratedColumn } from "typeorm";

@Entity('invoice', { database: process.env.MYSQL_DATABASE_REG })
export class Invoice extends BaseEntity {

    @IsNumber()
    @PrimaryGeneratedColumn()
    id: number;

    @IsString()
    @Column({ nullable: false, default: 'pending' })
    paymentStatus: string;

    @IsString()
    @Column({ nullable: true})
    receiptId: string;

    @IsNumber()
    @Column()
    registrationId: number;

    @IsNumber()
    @Column()
    userRegistrationId: number;

    @IsNumber()
    @Column()
    cartId: number

    @IsNumber()
    @Column()
    teamMemberRegId: number;

    @IsNumber()
    @Column({ nullable: true, default: null})
    matches: number;

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

    @IsString()
    @Column({nullable: true})
    paymentType: string;

    @IsString()
    @Column({nullable: true})
    subPaymentType: string;

    @IsString()
    @Column({})
    errorMessage: string;

    @IsString()
    @Column({})
    stripeSourceTransaction: string;

    @IsString()
    @Column({})
    stripeSubSourceTransaction: string;
}
