import { IsDate, IsNumber, IsString } from "class-validator";
import { BaseEntity, Column, Entity, PrimaryGeneratedColumn } from "typeorm";

@Entity('deRegister',{ database: process.env.MYSQL_DATABASE_REG })
export class DeRegister extends BaseEntity {

    @IsNumber()
    @PrimaryGeneratedColumn()
    id: number;

    @IsNumber()
    @Column()
    userId: number;

    @IsNumber()
    @Column()
    registrationId: number;

    @IsNumber()
    @Column()
    organisationId: number;

    @IsNumber()
    @Column()
    competitionId: number;

    @IsNumber()
    @Column()
    transferOrganisationId: number;

    @IsNumber()
    @Column()
    transferCompetitionId: number;

    @IsNumber()
    @Column()
    membershipMappingId: number;

    @IsNumber()
    @Column()
    teamId: number;

    @IsNumber()
    @Column()
    divisionId: number;

    @IsNumber()
    @Column()
    regChangeTypeRefId: number;

    @IsNumber()
    @Column()
    reasonTypeRefId: number;

    @IsNumber()
    @Column()
    deRegistrationOptionId: number;

    @IsString()
    @Column()
    otherInfo: string;

    @IsNumber()
    @Column()
    isAdmin: number;

    @IsNumber()
    @Column()
    statusRefId: number;

    @IsString()
    @Column()
    statusTrackData: string;

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
