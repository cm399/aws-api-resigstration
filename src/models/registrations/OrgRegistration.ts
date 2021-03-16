import { BaseEntity, Column, Entity, PrimaryGeneratedColumn, OneToOne, JoinColumn } from 'typeorm';
import { IsNumber, IsString, IsDate } from "class-validator";
import { CompetitionReg } from './Competition';

@Entity('orgRegistration', { database: process.env.MYSQL_DATABASE_REG })
export class OrgRegistration extends BaseEntity {

    @IsNumber()
    @PrimaryGeneratedColumn()
    id: number;

    @IsNumber()
    @Column()
    competitionId: number;

    @OneToOne(type => CompetitionReg)
    @JoinColumn()
    competition: CompetitionReg;
    
    @IsNumber()
    @Column()
    yearRefId: number;
    
    @IsNumber()
    @Column()
    inviteTypeRefId: number;
    
    @IsNumber()
    @Column()
    genderRefId: number;

    @IsNumber()
    @Column()
    inviteYearRefId: number;
    
    @IsNumber()
    @Column()
    inviteCompetitionId: number;
    
    @IsNumber()
    @Column()
    canInviteSend: number;
        
    @IsNumber()
    @Column()
    feeStatusRefId: number;

    @IsString()
    @Column({ nullable: true, default: null })
    dobPreferenceLessThan: string;

    @IsString()
    @Column({ nullable: true, default: null })
    dobPreferenceMoreThan: string;

    @IsNumber()
    @Column({ nullable: true, default: null })
    organisationId: number;

    @IsDate()
    @Column({ nullable: true, default: null })
    registrationOpenDate: Date;

    @IsDate()
    @Column({ nullable: true, default: null })
    registrationCloseDate: Date;

    @IsString()
    @Column({ nullable: true, default: null })
    specialNote: string;

    @IsString()
    @Column({ nullable: true, default: null })
    trainingDaysAndTimes: string;

    @IsNumber()
    @Column({ nullable: true, default: null })
    trainingVenueId: number;

    @IsString()
    @Column({ nullable: true, default: null })
    replyName: string;

    @IsString()
    @Column({ nullable: true, default: null })
    replyRole: string;

    @IsString()
    @Column({ nullable: true, default: null })
    replyEmail: string;

    @IsString()
    @Column({ nullable: true, default: null })
    replyPhone: string;

    @IsNumber()
    @Column()
    statusRefId: number;

    @IsNumber()
    @Column()
    createdBy: number;

    @IsNumber()
    @Column({ nullable: true, default: null })
    updatedBy: number;

    @IsNumber()
    @Column()
    isDeleted: number;

    @IsDate()
    @Column({ nullable: true, default: null })
    updatedOn: Date;

    // @IsDate()
    // @Column({ type: 'datetime', default: () => new Date() })
    // createdOn: Date;
}
