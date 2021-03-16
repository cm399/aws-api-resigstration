import { IsDate, IsNumber, IsString } from "class-validator";
import { BaseEntity, Column, Entity, JoinColumn, OneToOne, PrimaryGeneratedColumn } from "typeorm";
import { CompetitionReg } from "./Competition";

@Entity('competitionLogo', { database: process.env.MYSQL_DATABASE_REG })
export class CompetitionLogo extends BaseEntity {

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
    organisationId: number;

    @IsString()
    @Column({ nullable: true, default: null })
    logoUrl: string;

    @IsNumber()
    @Column({ nullable: true, default: null })
    isDefault: number;

    @IsNumber()
    @Column()
    createdBy: number;

    @IsNumber()
    @Column({ nullable: true, default: null })
    updatedBy: number;

    @IsDate()
    @Column({ nullable: true, default: null })
    updatedOn: Date;

    // @IsDate()
    // @Column({ type: 'datetime', default: () => new Date() })
    // createdOn: Date;

    @IsNumber()
    @Column()
    isDeleted: number;
}
