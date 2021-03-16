import {BaseEntity, Column, Entity, JoinColumn, OneToOne, PrimaryGeneratedColumn} from "typeorm";
import {Role} from "./Role";
import {Function} from "./Function";
import {IsNumber} from "class-validator";

@Entity('functionRole')
export class RoleFunction extends BaseEntity {

    @IsNumber()
    @PrimaryGeneratedColumn()
    id: number;

    @OneToOne(type => Role)
    @JoinColumn()
    role: Role;

    @IsNumber()
    @Column()
    roleId: number;

    @OneToOne(type => Function)
    @JoinColumn()
    function: Function;

    @IsNumber()
    @Column()
    functionId: number;

}
