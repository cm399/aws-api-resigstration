import { IsDate, IsNumber, IsString } from "class-validator";
import { BaseEntity, Column, Entity, PrimaryGeneratedColumn } from "typeorm";

@Entity('friend',{ database: process.env.MYSQL_DATABASE_REG })
export class Friend extends BaseEntity {

    @IsNumber()
    @PrimaryGeneratedColumn()
    id: number;

    @IsString()
    @Column()
    firstName: string;

    @IsString()
    @Column()
    lastName: string;

    @IsString()
    @Column()
    middleName: string;

    @IsString()
    @Column()
    mobileNumber: string;

    @IsString()
    @Column()
    email: string;

    @IsNumber()
    @Column()
    playerId: number;

    @IsNumber()
    @Column()
    friendRelationshipTypeRefId: number;

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
