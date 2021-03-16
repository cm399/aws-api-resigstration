import { IsDate, IsNumber } from "class-validator";
import { BaseEntity, Column, Entity, JoinColumn, OneToOne, PrimaryGeneratedColumn } from 'typeorm';
import { CompetitionMembershipProductDivision } from './CompetitionMembershipProductDivision';
import { CompetitionMembershipProductType } from './CompetitionMembershipProductType';
import { OrgRegistration } from './OrgRegistration';

@Entity('orgRegistrationMembershipProductType', { database: process.env.MYSQL_DATABASE_REG })
export class OrgRegistrationMembershipProductType extends BaseEntity {

    @IsNumber()
    @PrimaryGeneratedColumn()
    id: number;

    @IsNumber()
    @Column()
    orgRegistrationId: number;

    @OneToOne(type => OrgRegistration)
    @JoinColumn()
    orgRegistration: OrgRegistration;

    @IsNumber()
    @Column()
    competitionMembershipProductTypeId: number;

    @OneToOne(type => CompetitionMembershipProductType)
    @JoinColumn()
    competitionMembershipProductType: CompetitionMembershipProductType;

    @IsNumber()
    @Column({ nullable: true, default: null })
    competitionMembershipProductDivisionId: number;

    @OneToOne(type => CompetitionMembershipProductDivision)
    @JoinColumn()
    competitionMembershipProductDivision: CompetitionMembershipProductDivision;

    @IsNumber()
    @Column({ nullable: true, default: null })
    registrationLock: number;

    @IsNumber()
    @Column({ nullable: true, default: null })
    registrationTeamLock: number;

    @IsNumber()
    @Column({ nullable: true, default: null })
    isIndividualRegistration: number;

    @IsNumber()
    @Column({ nullable: true, default: null })
    isTeamRegistration: number;

    @IsNumber()
    @Column({ nullable: true, default: null })
    registrationCap: number;

    @IsNumber()
    @Column({ nullable: true, default: null })
    teamRegistrationCap: number;

    @IsNumber()
    @Column()
    createdBy: number;

    @IsDate()
    @Column({ nullable: true, default: null })
    updatedOn: Date;

    @IsNumber()
    @Column({ nullable: true, default: null })
    updatedBy: number;

    @IsNumber()
    @Column()
    isDeleted: number;
}
