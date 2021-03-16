import { IsDate, IsNumber, IsString } from "class-validator";
import { BaseEntity, Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('competitionDivision', { database: process.env.MYSQL_DATABASE_COMP })
export class CompetitionDivision extends BaseEntity {

    @IsNumber()
    @PrimaryGeneratedColumn()
    id: number;

    @IsNumber()
    @Column()
    competitionMembershipProductId: number;

    @IsNumber()
    @Column()
    competitionMembershipProductDivisionId: number;

    @IsString()
    @Column({ nullable: true, default: null })
    divisionName: string;

    @IsNumber()
    @Column({ nullable: true, default: null })
    genderRefId: number;

    @IsDate()
    @Column({ nullable: true, default: null })
    fromDate: Date;

    @IsDate()
    @Column({ nullable: true, default: null })
    toDate: Date;

    @IsNumber()
    @Column()
    createdBy: number;

    @IsNumber()
    @Column()
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
