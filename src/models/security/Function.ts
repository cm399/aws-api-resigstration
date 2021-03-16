import {BaseEntity, Column, Entity, PrimaryGeneratedColumn} from "typeorm";
import {IsNumber, IsString} from "class-validator";

@Entity()
export class Function extends BaseEntity {

    @IsNumber()
    @PrimaryGeneratedColumn()
    id: number;

    @IsString()
    @Column()
    name: string;

}
