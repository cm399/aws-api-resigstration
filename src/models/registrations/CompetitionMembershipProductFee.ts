import { IsDate, IsNumber } from "class-validator";
import { BaseEntity, Column, Entity, JoinColumn, OneToOne, PrimaryGeneratedColumn } from "typeorm";
import { CompetitionMembershipProductDivision } from "./CompetitionMembershipProductDivision";
import { CompetitionMembershipProductType } from "./CompetitionMembershipProductType";

@Entity('competitionMembershipProductFee', { database: process.env.MYSQL_DATABASE_REG })
export class CompetitionMembershipProductFee extends BaseEntity {

    @IsNumber()
    @PrimaryGeneratedColumn()
    id: number;

    @IsNumber()
    @Column()
    competitionMembershipProductTypeId: number;

    @OneToOne(type => CompetitionMembershipProductType)
    @JoinColumn()
    competitionMembershipProductType: CompetitionMembershipProductType;

    @IsNumber()
    @Column()
    organisationId: number;

    @IsNumber()
    @Column({ nullable: true, default: null })
    competitionMembershipProductDivisionId: number;

    @OneToOne(type => CompetitionMembershipProductDivision)
    @JoinColumn()
    competitionMembershipProductDivision: CompetitionMembershipProductDivision;

    @IsNumber()
    @Column("decimal", { precision: 15, scale: 2, nullable: true, default: null })
    casualFees: number;

    @IsNumber()
    @Column("decimal", { precision: 15, scale: 2, nullable: true, default: null })
    casualGST: number;

    @IsNumber()
    @Column("decimal", { precision: 15, scale: 2, nullable: true, default: null })
    seasonalFees: number;

    @IsNumber()
    @Column("decimal", { precision: 15, scale: 2, nullable: true, default: null })
    seasonalGST: number;

    @IsNumber()
    @Column("decimal", { precision: 15, scale: 2, nullable: true, default: null })
    teamSeasonalFees: number;

    @IsNumber()
    @Column("decimal", { precision: 15, scale: 2, nullable: true, default: null })
    teamSeasonalGST: number;

    @IsNumber()
    @Column("decimal", { precision: 15, scale: 2, nullable: true, default: null })
    teamCasualFees: number;

    @IsNumber()
    @Column("decimal", { precision: 15, scale: 2, nullable: true, default: null })
    teamCasualGST: number;

    @IsNumber()
    @Column("decimal", { precision: 15, scale: 2, nullable: true, default: null })
    nominationSeasonalFee: number;

    @IsNumber()
    @Column("decimal", { precision: 15, scale: 2, nullable: true, default: null })
    nominationSeasonalGST: number;

    @IsNumber()
    @Column("decimal", { precision: 15, scale: 2, nullable: true, default: null })
    nominationTeamSeasonalFee: number;

    @IsNumber()
    @Column("decimal", { precision: 15, scale: 2, nullable: true, default: null })
    nominationTeamSeasonalGST: number;

    @IsNumber()
    @Column()
    isSeasonal: number;

    @IsNumber()
    @Column()
    isCasual: number;

    @IsNumber()
    @Column()
    isTeamSeasonal: number;

    @IsNumber()
    @Column()
    isTeamCasual: number;
    
    @IsNumber()
    @Column()
    teamRegChargeTypeRefId: number;
    
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
