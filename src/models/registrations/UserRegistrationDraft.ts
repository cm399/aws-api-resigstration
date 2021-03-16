import { IsDate, IsNumber, IsString } from "class-validator";
import { BaseEntity, Column, Entity, PrimaryGeneratedColumn } from "typeorm";

@Entity('userRegistrationDraft',{ database: process.env.MYSQL_DATABASE_REG })
export class UserRegistrationDraft extends BaseEntity {

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
    parentId: string;

    @IsString()
    @Column()
    firstName: string;

    @IsString()
    @Column()
    lastName: string;

    @IsString()
    @Column()
    mobileNumber: string;

    @IsString()
    @Column()
    email: string;

    @IsDate()
    @Column()
    dateOfBirth: Date; 

    @IsNumber()
    @Column()
    genderRefId: number;

    @IsNumber()
    @Column()
    totalMembers: number;

    @IsString()
    @Column()
    photoUrl: string;
    
    @IsNumber()
    @Column()
    teamId: number;

    @IsString()
    @Column()
    teamName: string;

    @IsNumber()
    @Column()
    competitionMembershipProductTypeId: number;
    
    @IsString()
    @Column()
    userRegUniqueKey: string;

    @IsNumber()
    @Column()
    personRoleRefId: number;
    
    @IsNumber()
    @Column()
    registeringYourselfRefId: number;

    @IsNumber()
    @Column()
    whoAreYouRegisteringRefId: number;

    @IsNumber()
    @Column()
    isRegisteredAsPlayer: number;

    @IsNumber()
    @Column()
    noOfPlayers: number;

    @IsNumber()
    @Column()
    payingForCount: number;

    @IsNumber()
    @Column()
    payingFor: number;

    @IsNumber()
    @Column()
    isPlayer: number;

    @IsString()
    @Column({ nullable: true, default: null })
    participantData: string


    @IsString()
    @Column({ nullable: true, default: null })
    parentData: string

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
    
    @IsNumber()
    @Column()
    teamMemberRegId: number;

}
