import { IsDate, IsNumber, IsString } from "class-validator";
import { BaseEntity, Column, Entity, JoinColumn, OneToOne, PrimaryGeneratedColumn } from 'typeorm';
import { CompetitionMembershipProduct } from './CompetitionMembershipProduct';

@Entity('competitionMembershipProductDivision', { database: process.env.MYSQL_DATABASE_REG })
export class CompetitionMembershipProductDivision extends BaseEntity {

    @IsNumber()
    @PrimaryGeneratedColumn()
    id: number;

    @IsNumber()
    @Column()
    competitionMembershipProductId: number;

    @OneToOne(type => CompetitionMembershipProduct)
    @JoinColumn()
    competitionMembershipProduct: CompetitionMembershipProduct;

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
