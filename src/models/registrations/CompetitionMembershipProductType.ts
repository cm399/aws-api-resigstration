import { IsDate, IsNumber } from "class-validator";
import { BaseEntity, Column, Entity, JoinColumn, OneToOne, PrimaryGeneratedColumn } from "typeorm";
import { CompetitionMembershipProduct } from "./CompetitionMembershipProduct";

@Entity('competitionMembershipProductType',{ database: process.env.MYSQL_DATABASE_REG })
export class CompetitionMembershipProductType extends BaseEntity {

    @IsNumber()
    @PrimaryGeneratedColumn()
    id: number;

    @IsNumber()
    @Column()
    competitionMembershipProductId: number;

    @OneToOne(type => CompetitionMembershipProduct)
    @JoinColumn()
    competitionMembershipProduct: CompetitionMembershipProduct;

    @IsNumber()
    @Column()
    membershipProductTypeMappingId: number;

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
