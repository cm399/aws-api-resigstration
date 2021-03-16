import { IsDate, IsNumber } from "class-validator";
import { BaseEntity, Column, Entity, PrimaryGeneratedColumn } from "typeorm";

@Entity('userMembershipExpiry', { database: process.env.MYSQL_DATABASE_REG })
export class UserMembershipExpiry extends BaseEntity {

    @IsNumber()
    @PrimaryGeneratedColumn()
    id: number;

    @IsDate()
    @Column({ nullable: false })
    expiryDate: Date;

    @IsNumber()
    @Column({ nullable: false })
    userId: number;

    @IsNumber()
    @Column({ nullable: false })
    membershipProductMappingId: number;

    @IsNumber()
    @Column()
    registrationId: number;
    

    @IsNumber()
    @Column()
    isActive: number;

    @IsNumber()
    @Column("decimal", { precision: 15, scale: 2, nullable: false })
    amount: number;

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
