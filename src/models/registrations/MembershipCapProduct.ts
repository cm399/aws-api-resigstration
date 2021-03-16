import { BaseEntity, Column, Entity, JoinColumn, OneToOne, PrimaryGeneratedColumn, Generated } from 'typeorm';
import { IsNumber, IsString, IsDate, ValidateNested } from "class-validator";

@Entity('membershipCapProduct',{ database: process.env.MYSQL_DATABASE_REG })
export class MembershipCapProduct extends BaseEntity {
    
    @IsNumber()
    @PrimaryGeneratedColumn()
    id: number;

    @IsNumber()
    @Column()
    membershipCapId: number;

    @IsNumber()
    @Column()
    membershipProductId: number;

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