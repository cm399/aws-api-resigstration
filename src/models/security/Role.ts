import {BaseEntity, Column, Entity, PrimaryGeneratedColumn} from "typeorm";
import {IsDate, IsNumber, IsString} from "class-validator";

@Entity({ database: "wsa_users" })
export class Role extends BaseEntity {

    @IsNumber()
    @PrimaryGeneratedColumn()
    id: number;

    @IsString()
    @Column()
    name: string;

    @IsString()
    @Column()
    description: string;

    @IsNumber()
    @Column({ default: 0 })
    applicableToWeb: number;

    @IsDate()
    @Column({name: 'created_at'})
    createdAt: Date;

    @IsDate()
    @Column({name: 'updated_at'})
    updatedAt: Date;
}
