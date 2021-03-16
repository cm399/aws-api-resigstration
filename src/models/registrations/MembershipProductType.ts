import { IsDate, IsNumber, IsString } from "class-validator";
import { BaseEntity, Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('membershipProductType', { database: process.env.MYSQL_DATABASE_REG })
export class MembershipProductType extends BaseEntity {

    @IsNumber()
    @PrimaryGeneratedColumn()
    id: number;

    @IsNumber()
    @Column()
    membershipProductId: number;

    @IsNumber()
    @Column({ nullable: true, default: null })
    isPlaying: number;

    @IsNumber()
    @Column({ nullable: true, default: null })
    isDefault: number;

    @IsString()
    @Column({ nullable: true, default: null })
    name: string;

    @IsNumber()
    @Column()
    createdBy: number;

    @IsNumber()
    @Column({ nullable: true, default: null })
    updatedBy: number;

    @IsDate()
    @Column({ type: 'datetime', default: () => new Date()})
    createdOn:Date;

    @IsDate()
    @Column({ type: 'datetime', default: () => new Date()})
    updatedOn:Date;

    @IsNumber()
    @Column({ default: 0 })
    isDeleted: number;
}
