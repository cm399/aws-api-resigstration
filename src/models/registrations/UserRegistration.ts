import { IsDate, IsNumber, IsString } from "class-validator";
import { BaseEntity, Column, Entity, PrimaryGeneratedColumn } from "typeorm";

@Entity('userRegistration',{ database: process.env.MYSQL_DATABASE_REG })
export class UserRegistration extends BaseEntity {

    @IsNumber()
    @PrimaryGeneratedColumn()
    id: number;

    @IsNumber()
    @Column()
    userId: number;
    
    @IsNumber()
    @Column()
    teamId: number;

    @IsNumber()
    @Column()
    competitionMembershipProductTypeId: number;
    
    @IsString()
    @Column()
    userRegUniqueKey: string;

    @IsString()
    @Column()
    existingMedicalCondition: string;

    @IsString()
    @Column()
    regularMedication: string;

    @IsNumber()
    @Column()
    userRegDraftId: number;

    @IsNumber()
    @Column()
    heardByRefId: number;

    @IsString()
    @Column()
    heardByOther: string;

    @IsNumber()
    @Column()
    favouriteTeamRefId: number;

    @IsNumber()
    @Column()
    personRoleRefId: number;
    
    @IsNumber()
    @Column()
    registeringYourselfRefId: number;

    // @IsNumber()
    // @Column()
    // whoAreYouRegisteringRefId: number;
    
    @IsNumber()
    @Column()
    teamMemberRegId: number;

    @IsString()
    @Column()
    favouriteFireBird: string;

    @IsNumber()
    @Column()
    isConsentPhotosGiven: number;

    @IsNumber()
    @Column()
    isDisability: number;

    @IsString()
    @Column()
    disabilityCareNumber: string;

    @IsNumber()
    @Column()
    disabilityTypeRefId: number;

    // @IsString()
    // @Column()
    // languages: string;

    @IsNumber()
    @Column()
    countryRefId: number;

    // @IsNumber()
    // @Column()
    // nationalityRefId: number;

    // @IsString()
    // @Column()
    // voucherLink: string;

    @IsNumber()
    @Column()
    identifyRefId: number;
    
    @IsString()
    @Column()
    injuryInfo: string;

    @IsString()
    @Column()
    allergyInfo: string;

    @IsNumber()
    @Column()
    yearsPlayed: number;
    
    @IsNumber()
    @Column()
    schoolId: number;
    
    @IsNumber()
    @Column()
    schoolGradeInfo: number;
    
    @IsNumber()
    @Column()
    isParticipatedInSSP: number;
    
    @IsString()
    @Column()
    volunteerInfo: string;
        
    @IsString()
    @Column()
    otherSportsInfo: string;
                
    @IsNumber()
    @Column()
    walkingNetball: string;

    @IsString()
    @Column()
    walkingNetballInfo: string;

    @IsNumber()
    @Column({ default: 1 })
    isActive: number;

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
