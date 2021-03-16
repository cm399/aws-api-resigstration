import {BaseEntity, Column, Entity, PrimaryGeneratedColumn} from "typeorm";
import {IsDate, IsNumber, IsString} from "class-validator";

@Entity('entityType',{ database: "wsa_users" })
export class EntityType extends BaseEntity {

    public static COMPETITION = 1;
    public static ORGANISATION = 2;
    public static TEAM = 3;
    public static USER = 4;
    public static PLAYER = 5;

    @IsNumber()
    @PrimaryGeneratedColumn()
    id: number;

    @IsString()
    @Column()
    name: string;

    // @IsDate()
    // @Column({name: 'created_at'})
    // createdAt: Date;

    // @IsDate()
    // @Column({name: 'updated_at'})
    // updatedAt: Date;

    @IsNumber()
    @Column({ default: 0 })
    isDeleted: number;
}
