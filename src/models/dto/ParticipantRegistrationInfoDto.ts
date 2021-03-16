import { IsNumber, IsString } from "class-validator";
import { User } from "../security/User";
import { ParticipantRegistrationInfoPlayerDto } from "./ParticipantRegistrationInfoPlayerDto";
import { ParticipantRegistrationInfoProductDto } from "./ParticipantRegistrationInfoProductDto";

export class ParticipantRegistrationInfoDto {

    @IsNumber()
    userId: number;

    @IsString()
    firstName: string;

    @IsString()
    lastName: string;

    @IsString()
    password: string;

    @IsString()
    email: string;

    @IsString()
    mobileNumber: string;

    @IsNumber()
    isInActive: number;

    @IsNumber()
    userRegId: number;

    products: ParticipantRegistrationInfoProductDto[];

    creator: User;
    user: User;

    @IsNumber()
    registeringYourselfRefId: number;

    // team fields

    @IsString()
    teamName: string;

    @IsNumber()
    paymentOptionRefId: number;

    @IsNumber()
    teamRegChargeTypeRefId: number;

    @IsNumber()
    teamSeasonalFees: number;

    @IsNumber()
    teamSeasonalGST: number;

    players: ParticipantRegistrationInfoPlayerDto[];

}