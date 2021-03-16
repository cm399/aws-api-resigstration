import { IsDate, IsNumber, IsString } from "class-validator";
import { BaseEntity, Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('orgRegistrationHardshipCode', { database: process.env.MYSQL_DATABASE_REG })
export class OrgRegistrationHardshipCode extends BaseEntity {

    @IsNumber()
    @PrimaryGeneratedColumn()
    id: number;

    @IsNumber()
    @Column()
    orgRegistrationId: number;

    @IsString()
    @Column()
    code: string;

    @IsNumber()
    @Column()
    isActive: number;

    @IsNumber()
    @Column()
    appliedTo: number;
    
    @IsNumber()
    @Column()
    registrationId: number;

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
    @Column()
    isDeleted: number;
}
