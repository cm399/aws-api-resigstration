import { IsDate, IsNumber } from "class-validator";
import {
    BaseEntity,
    Column,
    Entity,
    PrimaryGeneratedColumn
} from 'typeorm';

@Entity('sellProduct', { database: process.env.MYSQL_DATABASE_SHOP})
export class SellProduct extends BaseEntity {

    @IsNumber()
    @PrimaryGeneratedColumn()
    id: number;

    @IsNumber()
    @Column({ default: 0 })
    quantity: number;

    @IsNumber()
    @Column()
    productId: number;

    @IsNumber()
    @Column()
    orderId: number;

    @IsNumber()
    @Column()
    cartId: number;

    @IsNumber()
    @Column()
    skuId: number;

    @IsNumber()
    @Column({ default: 0 })
    cost: number;

    @IsNumber()
    @Column({ default: 0 })
    price: number;

    @IsNumber()
    @Column()
    createdBy: number;

    @IsNumber()
    @Column({ nullable: true, default: null })
    updatedBy: number;

    @IsDate()
    @Column({ nullable: false })
    createdOn: Date;

    @IsDate()
    @Column()
    updatedOn: Date;

    @IsNumber()
    @Column()
    isDeleted: number;
}
