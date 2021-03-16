import { IsString, IsNumber } from "class-validator";
import { User } from "../security/User";

export class ParticipantRegistrationInfoPlayerDto extends User {

    @IsNumber()
    paid: number;

    @IsNumber()
    notPaid: number;

    // @IsString()
    // email: string;

    // @IsString()
    // mobileNumber: string;

    // @IsString()
    // userId: number;

    // @IsString()
    // firstName: string;

    // @IsString() 
    // lastName: string;

    // @IsString()
    // password: string;

    @IsString() 
    haveToPay: number;

    @IsString()
    productType: string;

    @IsString()
    divisionName: string;

    @IsString()
    userRegUniqueKey: string;
    
    @IsString()
    membershipProductFeesTypeRefId: string;
    
}
