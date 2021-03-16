import { IsDate, IsNumber, IsString } from "class-validator";
import { BaseEntity, Column, Entity, PrimaryGeneratedColumn } from "typeorm";

@Entity('orgRegistrationParticipant',{ database: process.env.MYSQL_DATABASE_REG })
export class OrgRegistrationParticipant extends BaseEntity {

    @IsNumber()
    @PrimaryGeneratedColumn()
    id: number;

    @IsNumber()
    @Column()
    registrationId: number;
    
    @IsNumber()
    @Column()
    orgRegistrationId: number;

    @IsNumber()
    @Column()
    userRegistrationId: number;

    @IsNumber()
    @Column()
    teamRegistrationTypeRefId: number;
    
    @IsNumber()
    @Column()
    paymentOptionRefId: number;    
    
    @IsNumber()
    @Column()
    tShirtSizeRefId: number;

    @IsString()
    @Column()
    voucherCode: string;

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
