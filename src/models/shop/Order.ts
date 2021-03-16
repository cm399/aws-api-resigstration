import { IsDate, IsNumber, IsString } from "class-validator";
import {
  BaseEntity,
  Column,
  Entity,
  PrimaryGeneratedColumn
} from 'typeorm';


@Entity('order', { database: process.env.MYSQL_DATABASE_SHOP})
export class Order extends BaseEntity {
  @IsNumber()
  @PrimaryGeneratedColumn()
  id: number;

  @IsString()
  @Column()
  paymentMethod: string;

  @IsString()
  @Column()
  paymentStatus: string;

  @IsString()
  @Column()
  fulfilmentStatus: string;

  @IsNumber()
  @Column()
  refundedAmount: number;

  @IsNumber()
  @Column()
  organisationId: number;

  @IsNumber()
  @Column()
  userId: number;

  @IsNumber()
  @Column()
  postcode: number;

  @IsNumber()
  @Column()
  orderGroupId: number;

  @IsString()
  @Column()
  deliveryType: 'shipping' | 'pickup';

  @IsString()
  @Column()
  address: string;

  @IsString()
  @Column()
  suburb: string;

  @IsString()
  @Column()
  state: string;

  @IsNumber()
  @Column()
  invoiceId: number;

  @IsNumber()
  @Column()
  createdBy: number;

  @IsNumber()
  @Column({ nullable: true, default: null })
  updatedBy: number;

  @IsDate()
  @Column()
  createdOn: Date;

  @IsDate()
  @Column({ nullable: true, default: null })
  updatedOn: Date;

  @IsNumber()
  @Column()
  isDeleted: number;

  @Column()
  paymentIntentId: string;

  @Column()
  stripeTransferId: string;
}
