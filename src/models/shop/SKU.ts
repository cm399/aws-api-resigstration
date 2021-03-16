import { NumberAttributeValue } from "aws-sdk/clients/clouddirectory";
import { IsDate, IsNumber, IsString } from "class-validator";
import {
    BaseEntity,
    Column,
    Entity,
    PrimaryGeneratedColumn
} from 'typeorm';

@Entity('SKU', { database: process.env.MYSQL_DATABASE_SHOP})
export class SKU extends BaseEntity {

    @IsNumber()
    @PrimaryGeneratedColumn()
    id: number;

    @IsNumber()
    @Column({ default: 0 })
    price: number;

    @IsNumber()
    @Column({ default: 0 })
    cost: number;

    @IsString()
    @Column({ default: null })
    skuCode: string;

    @IsString()
    @Column({ default: null })
    barcode: string;

    @IsString()
    @Column({ default: 0 })
    quantity: number;

    @IsNumber()
    @Column({ nullable: true, default: null })
    productId: NumberAttributeValue;

    @IsNumber()
    @Column({ nullable: true, default: null })
    productVariantOptionId: number;

    @IsNumber()
    @Column()
    createdBy: number;

    @IsNumber()
    @Column({ nullable: true, default: null })
    updatedBy: number;

    @Column()
    createdOn: Date;

    @IsDate()
    @Column()
    updatedOn: Date;

    @IsNumber()
    @Column()
    isDeleted: number;
}
