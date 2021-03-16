import { BaseEntity, Column, Entity, PrimaryGeneratedColumn } from "typeorm";
import { IsNumber, IsString, IsDate } from "class-validator";

@Entity('organisationLogo', { database: "wsa_users" })
export class OrganisationLogo extends BaseEntity {

    @IsNumber()
    @PrimaryGeneratedColumn()
    id: number;

    @IsString()
    @Column()
    organisationId: string;

    @IsString()
    @Column()
    logoUrl: string;

    @IsNumber()
    @Column()
    isDefault: number;

    @IsNumber()
    @Column()
    createdBy: number;

    @IsNumber()
    @Column({ nullable: true, default: null })
    updatedBy: number;

    @IsDate()
    @Column({ type: 'datetime', default: () => new Date() })
    createdOn: Date;

    @IsDate()
    @Column({ type: 'datetime', default: () => new Date() })
    updatedOn: Date;

    @IsNumber()
    @Column({ default: 0 })
    isDeleted: number;
}
