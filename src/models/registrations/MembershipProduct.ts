import { IsDate, IsNumber, IsString } from "class-validator";
import { BaseEntity, Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('membershipProduct',{ database: process.env.MYSQL_DATABASE_REG })
export class MembershipProduct extends BaseEntity {

    @IsNumber()
    @PrimaryGeneratedColumn()
    id: number;

    @IsString()
    @Column({ nullable: true, default: null })
    productName: string;

    @IsNumber()
    @Column()
    membershipProductValidityRefId: number;

    @IsNumber()
    @Column()
    statusRefId: number;

    @IsNumber()
    @Column()
    paymentOptionRefId: number;

    @IsString()
    @Column()
    membershipProductUniqueKey: string;

    @IsNumber()
    @Column()
    yearRefId: number;

    @IsDate()
    @Column({ nullable: true, default: null })
    fromDate: Date;

    @IsNumber()
    @Column()
    organisationId: number;

    @IsNumber()
    @Column()
    createdBy: number;

    @IsDate()
    @Column({ type: 'datetime', default: () => new Date()})
    createdOn:Date;

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
