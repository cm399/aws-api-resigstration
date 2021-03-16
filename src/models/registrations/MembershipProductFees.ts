import { IsDate, IsNumber, ValidateNested } from "class-validator";
import { BaseEntity, Column, Entity, JoinColumn, OneToMany, PrimaryGeneratedColumn } from 'typeorm';
import { MembershipProduct } from './MembershipProduct';

@Entity('membershipProductFees', { database: process.env.MYSQL_DATABASE_REG })
export class MembershipProductFees extends BaseEntity {

    @IsNumber()
    @PrimaryGeneratedColumn()
    id: number;

    @IsNumber()
    @Column()
    membershipProductTypeMappingId: number;

    @IsNumber()
    @Column()
    membershipProductId: number;

    @ValidateNested()
    @OneToMany(() => MembershipProduct, membershipProduct => membershipProduct.id, { onDelete: "CASCADE", cascade: true })
    @JoinColumn()
    membershipProduct: MembershipProduct[];

    @IsNumber()
    @Column()
    membershipProductFeesTypeRefId: number;

    @IsNumber()
    @Column()
    organisationId: number;

    @IsNumber()
    @Column("decimal", { precision: 15, scale: 2, nullable: true, default: null })
    casualFee: number;

    @IsNumber()
    @Column("decimal", { precision: 15, scale: 2, nullable: true, default: null })
    casualGst: number;

    @IsNumber()
    @Column("decimal", { precision: 15, scale: 2, nullable: true, default: null })
    seasonalFee: number;

    @IsNumber()
    @Column("decimal", { precision: 15, scale: 2, nullable: true, default: null })
    seasonalGst: number;

    @IsNumber()
    @Column()
    validityDays: number;

    @IsDate()
    @Column()
    extendEndDate: Date;

    @IsNumber()
    @Column()
    createdBy: number;

    @IsNumber()
    @Column({ nullable: true, default: null })
    updatedBy: number;

    @IsDate()
    @Column({ type: 'datetime', default: () => new Date() })
    createdOn: Date;

    @IsDate()
    @Column({ type: 'datetime', default: () => new Date() })
    updatedOn: Date;

    @IsNumber()
    @Column({ default: 0 })
    isDeleted: number;
}
