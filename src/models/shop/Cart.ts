import { IsDate, IsNumber, IsString } from "class-validator";
import {
    BaseEntity,
    Column,
    Entity,
    PrimaryGeneratedColumn
} from 'typeorm';

@Entity('cart',{ database: process.env.MYSQL_DATABASE_SHOP})
export class Cart extends BaseEntity {
    @IsNumber()
    @PrimaryGeneratedColumn()
    id: number;

    @IsNumber()
    @Column()
    createdBy: number;

    @IsNumber()
    @Column({ nullable: true, default: null })
    updatedBy: number;

    @IsString()
    @Column()
    shopUniqueKey: string;

    @IsDate()
    @Column()
    createdOn: Date;

    @IsDate()
    @Column({ nullable: true, default: null })
    updatedOn: Date;

    @IsNumber()
    @Column()
    isDeleted: number;
}
