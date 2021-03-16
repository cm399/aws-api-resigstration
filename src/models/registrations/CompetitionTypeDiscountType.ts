import { IsNumber, IsString } from "class-validator";
import { BaseEntity, Column, Entity, JoinColumn, OneToOne, PrimaryGeneratedColumn } from "typeorm";
import { CompetitionReg } from "./Competition";

@Entity('competitionTypeDiscountType', { database: process.env.MYSQL_DATABASE_REG })
export class CompetitionTypeDiscountType extends BaseEntity {

    @IsNumber()
    @PrimaryGeneratedColumn()
    id: number;

    @IsString()
    @Column()
    name: string;

    @IsNumber()
    @Column()
    organisationId: number;
    
    @IsNumber()
    @Column({ nullable: true, default: null })
    competitionId: number;

    @OneToOne(type => CompetitionReg)
    @JoinColumn()
    competition: CompetitionReg;

    @IsNumber()
    @Column()
    isDefault: number;

    @IsString()
    @Column()
    description: string;

    @IsNumber()
    @Column()
    createdBy: number;

    @IsNumber()
    @Column({ nullable: true, default: null })
    updatedBy: number;

    @IsNumber()
    @Column()
    isDeleted: number;
}
