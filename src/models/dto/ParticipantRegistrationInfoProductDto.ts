import { IsString } from "class-validator";

export class ParticipantRegistrationInfoProductDto {

    @IsString()
    startDate: string;

    @IsString()
    competitionName: string;

    @IsString()
    productTypeName: string;

    @IsString()
    organisationName: string;

    @IsString()
    organisationEmail: string;

    @IsString() 
    replyEmail: string;

    @IsString()
    replyName: string;

    @IsString() 
    replyPhone: string;

    @IsString()
    replyRole: string;

    // team info
    @IsString()
    registrationCloseDate: string;
    
}