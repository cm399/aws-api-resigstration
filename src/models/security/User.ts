import {BaseEntity, Column, Entity, PrimaryGeneratedColumn} from "typeorm";
import {IsBoolean, IsDate, IsNumber, IsString} from "class-validator";

@Entity({ database: "wsa_users" })
export class User extends BaseEntity {

    @IsNumber()
    @PrimaryGeneratedColumn()
    id: number;

    @IsString()
    @Column()
    firstName: string;

    @IsString()
    @Column()
    middleName: string;

    @IsString()
    @Column()
    lastName: string;

    @IsString()
    @Column()
    mobileNumber: string;

    @IsString()
    @Column()
    stripeAccountId: string;

    @IsString()
    @Column()
    email: string;

    @IsString()
    @Column({select: false})
    password: string;

    @IsDate()
    @Column()
    dateOfBirth: Date;

    @IsString()
    @Column()
    street1: string;

    @IsString()
    @Column()
    street2: string;

    @IsString()
    @Column()
    suburb: string;

    @IsNumber()
    @Column()
    stateRefId: number;

    @IsNumber()
    @Column()
    countryRefId: number;
    
    @IsString()
    @Column()
    postalCode: string;

    @IsNumber()
    @Column()
    genderRefId: number;

    @IsNumber()
    @Column()
    statusRefId: number;

    @IsDate()
    @Column()
    lastAppLogin: Date;

    @IsString()
    @Column({select: false})
    reset: string;

    @IsString()
    @Column()
    emergencyFirstName: string;
    
    @IsString()
    @Column()
    emergencyLastName: string;

    @IsString()
    @Column()
    emergencyContactNumber: string;

    @IsNumber()
    @Column()
    emergencyContactRelationshipId: number;

    @IsBoolean()
    @Column()
    marketingOptIn: boolean;

    @IsString()
    @Column()
    photoUrl: string;

    @IsString()
    @Column()
    firebaseUID: string;

    @IsNumber()
    @Column({ default: 0 })
    isInActive: number;

    @IsDate()
    @Column()
    childrenCheckExpiryDate: Date;

    @IsString()
    @Column()
    childrenCheckNumber: string;

    @IsString()
    @Column()
    stripeCustomerAccountId: string;

    @IsNumber()
    @Column()
    createdBy: number;

    @IsNumber()
    @Column({ nullable: true, default: null })
    updatedBy: number;

    @IsDate()
    @Column({ nullable: true, default: null })
    updatedOn: Date;

    @IsNumber()
    @Column({ default: 0 })
    isDeleted: number;

    @IsNumber()
    @Column()
    accreditationLevelCoachRefId: number;

    @IsDate()
    @Column({ nullable: true, default: null })
    accreditationUmpireExpiryDate: Date;
    
    @IsNumber()
    @Column()
    accreditationLevelUmpireRefId: number;

    @IsDate()
    @Column({ nullable: true, default: null })
    accreditationCoachExpiryDate: Date;
    
    @IsString()
    @Column()
    associationLevelInfo: string;
    
    @IsNumber()
    @Column()
    isPrerequestTrainingComplete: number;
    
    
}
