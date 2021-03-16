import { BaseEntity, Column, Entity, JoinColumn, OneToOne, PrimaryGeneratedColumn, OneToMany, ManyToOne } from 'typeorm';
import { IsNumber, IsString, IsDate, ValidateNested } from "class-validator";

@Entity('membershipProductTypeMapping', { database: process.env.MYSQL_DATABASE_REG })
export class MembershipProductTypeMapping extends BaseEntity {

    @IsNumber()
    @PrimaryGeneratedColumn()
    id: number;

    @IsNumber()
    @Column()
    membershipProductTypeId: number;

    @IsNumber()
    @Column()
    allowTeamRegistrationTypeRefId: number;

    @IsNumber()
    @Column()
    isChildrenCheckNumber: number;

    @IsNumber() 
    @Column()
    membershipProductId: number;

    @IsDate()
    @Column({ nullable: true, default: null })
    dobFromDate: Date;

    @IsDate()
    @Column({ nullable: true, default: null })
    dobToDate: Date;

    @IsNumber()
    @Column()
    createdBy: number;

    @IsNumber()
    @Column({ nullable: true, default: null })
    updatedBy: number;

    @IsDate()
    @Column({ type: 'datetime', default: () => new Date()})
    createdOn:Date;

    @IsDate()
    @Column({ type: 'datetime', default: () => new Date()})
    updatedOn:Date;

    @IsNumber()
    @Column({ default: 0 })
    isDeleted: number;
}
