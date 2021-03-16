
import { Response } from "express";
import { Authorized, Body, HeaderParam, JsonController, Post, Res } from "routing-controllers";
import AppConstants from "../validation/AppConstants";
import { logger } from "../logger";
import { User } from "../models/security/User";
import { BaseController } from "./BaseController";
import { InvoicePaymentStatus } from "../enums/enums";
import { isArrayPopulated } from "../utils/Utils";

@JsonController('/api')
export class RegistrationProcessController extends BaseController {

    @Authorized()
    @Post("/registration/status/update")
    async registrationStatusUpdate(
        @HeaderParam("authorization") currentUser: User,
        @Body() requestBody,
        @Res() response: Response) {
        try {
            if(requestBody && requestBody.registrationId){
                const registration = await this.registrationService.findByRegistrationKey(requestBody.registrationId);
                if(registration){
                    const invoice = await this.invoiceService.findByRegistrationId(registration.id);
                    if(isArrayPopulated(invoice)){
                        const invoiceId = invoice[0].id;
                        await this.invoiceService.updatePaymentStatusByInvoiceId(invoiceId, InvoicePaymentStatus.Failed, currentUser.id);
                        await this.transactionService.deleteByInvoiceId(invoiceId);
                        await this.transactionService.deleteByInvoiceRefId(invoiceId);
                        await this.userMembershipExpiryService.updateExistingMembership(registration.id);
                        await this.player1Service.updateLivescorePlayerStatusByRegistrationId(registration.id);
                        await this.player1Service.updateStatusByRegistrationId(registration.id, 4);
                        await this.nonPlayerService.updateStatusByRegistrationId(registration.id, 4);
                        return response.status(200).send({message: "Successfully updated"});
                    }
                }
                else{
                    return response.status(212).send({ message: "Please provide the valid input" });
                }
            }
            else{
                return response.status(212).send({ message: "Please provide the valid input" });
            }
        }
        catch(error){
            logger.error(`Error Occurred in registrationStatusUpdate ${currentUser.id}` + error);
            return response.status(500).send({
                message: process.env.NODE_ENV == AppConstants.development ? AppConstants.errMessage + error : AppConstants.errMessage
            });
        }
    }
}