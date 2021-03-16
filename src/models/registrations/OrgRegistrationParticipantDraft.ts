import { IsDate, IsNumber } from "class-validator";
import { BaseEntity, Column, Entity, PrimaryGeneratedColumn } from "typeorm";

@Entity('orgRegistrationParticipantDraft',{ database: process.env.MYSQL_DATABASE_REG })
export class OrgRegistrationParticipantDraft extends BaseEntity {

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
    parentId: string;

    @IsNumber()
    @Column()
    teamRegistrationTypeRefId: number;

    @IsNumber()
    @Column()
    tShirtSizeRefId: number;

    @IsNumber()
    @Column()
    isPlayer: number;

    @IsNumber()
    @Column()
    competitionMembershipProductTypeId: number;

    @IsNumber()
    @Column()
    competitionMembershipProductDivisionId: number;

    @IsNumber()
    @Column()
    membershipProductTypeName: string;

    @IsNumber()
    @Column()
    competitionMembershipProductTypeIdCoach: number;
    
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
