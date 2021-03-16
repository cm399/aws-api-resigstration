import { IsNumber, IsString } from "class-validator";
import { BaseEntity, Column, Entity, PrimaryGeneratedColumn } from "typeorm";

@Entity('communicationTemplate',{ database: "wsa_common" })
export class CommunicationTemplate extends BaseEntity {

    @IsNumber()
    @PrimaryGeneratedColumn()
    id: number;

    @IsString()
    @Column()
    emailSubject: string;

    @IsString()
    @Column()
    emailBody: string;

    @IsNumber()
    @Column()
    htmlStyles: number;

    @IsString()
    @Column()
    title: string;
    
    @IsNumber()
    @Column()
    createdBy: number;

    @IsNumber()
    @Column({ nullable: true, default: null })
    updatedBy: number;

    @IsNumber()
    @Column({ default: 0 })
    isDeleted: number;

}
