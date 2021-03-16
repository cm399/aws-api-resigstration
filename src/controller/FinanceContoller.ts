import { Response } from 'express';
import { Authorized, Body, HeaderParam, JsonController, Post, QueryParam, Res } from 'routing-controllers';
import * as fastcsv from 'fast-csv';

import { User } from '../models/security/User';
import { currencyFormat, isArrayPopulated, uuidv4 } from '../utils/Utils';
import { BaseController } from './BaseController';
import AppConstants from "../validation/AppConstants";
import { TransactionTypeRefId } from "../enums/enums";
import { logger } from '../logger';

@JsonController('/api')
export class MembershipCapController extends BaseController {

    @Authorized()
    @Post('/payment/summary')
    async paymentSummary(
        @HeaderParam("authorization") currentUser: User,
        @QueryParam('sortBy') sortBy: string = undefined,
        @QueryParam('search') search: string = undefined,
        @QueryParam('sortOrder') sortOrder: 'ASC' | 'DESC' = undefined,
        @Body() requestBody: any,
        @Res() response: Response
    ): Promise<any> {
        try {
            if (requestBody.organisationId) {
                const ORGANISATION_ID = await this.organisationService.findByUniquekey(requestBody.organisationId);
                let result = await this.transactionService.paymentSummaryList(ORGANISATION_ID, requestBody, search, sortBy, sortOrder);

                return response.status(200).send(result);
            } else {
                return response.status(212).send({ message: "OrganisationUniqueKey cannot be null" });
            }
        } catch (error) {
            logger.error(`Exception occurred in Create Payments ` + error);
            return response.status(500).send(`Payment Summary Error ${error}`);
        }
    }

    @Authorized()
    @Post('/payment/summary/export')
    async paymentSummaryExport(
        @HeaderParam("authorization") currentUser: User,
        @QueryParam('sortBy') sortBy: string = undefined,
        @QueryParam('search') search: string = undefined,
        @QueryParam('sortOrder') sortOrder: 'ASC' | 'DESC' = undefined,
        @Body() requestBody: any,
        @Res() response: Response
    ): Promise<any> {
        try {
            if (requestBody.organisationId) {
                const ORGANISATION_ID = await this.organisationService.findByUniquekey(requestBody.organisationId);
                let result = await this.transactionService.paymentSummaryList(ORGANISATION_ID, requestBody, search, sortBy, sortOrder);

                let mappedPaymentSummary = [];

                if (result.paymentSummary) {
                    mappedPaymentSummary = result.paymentSummary.map(transaction => ({
                        'FirstName': transaction['firstName'],
                        'LastName': transaction['lastName'],
                        'TeamName': transaction['teamName'] === null ? '' : transaction['teamName'],
                        'FeesPaid': currencyFormat(transaction['membership']['paid']),
                        'FeesDeclined': currencyFormat(transaction['membership']['declined']),
                        'FeesOwing': currencyFormat(transaction['membership']['owing']),
                        'NominationFeesPaid': currencyFormat(transaction['competitionNomination']['paid']),
                        'NominationFeesDeclined': currencyFormat(transaction['competitionNomination']['declined']),
                        'NominationFeesOwing': currencyFormat(transaction['competitionNomination']['owing']),
                        'CompetitionFeesPaid': currencyFormat(transaction['competition']['paid']),
                        'CompetitionFeesDeclined': currencyFormat(transaction['competition']['declined']),
                        'CompetitionFeesOwing': currencyFormat(transaction['competition']['owing']),
                        'AffiliateNominationFeesPaid': currencyFormat(transaction['affiliateNomination']['paid']),
                        'AffiliateNominationFeesDeclined': currencyFormat(transaction['affiliateNomination']['declined']),
                        'AffiliateNominationFeesOwing': currencyFormat(transaction['affiliateNomination']['owing']),
                        'AffiliateCompetitionFeesPaid': currencyFormat(transaction['affiliate']['paid']),
                        'AffiliateCompetitionFeesDeclined': currencyFormat(transaction['affiliate']['declined']),
                        'AffiliateCompetitionFeesOwing': currencyFormat(transaction['affiliate']['owing']),
                    }))
                } else {
                    mappedPaymentSummary.push({
                        'FirstName': 'N/A',
                        'LastName': 'N/A',
                        'TeamName': 'N/A',
                        'FeesPaid': 'N/A',
                        'FeesDeclined': 'N/A',
                        'FeesOwing': 'N/A',
                        'NominationFeesPaid': 'N/A',
                        'NominationFeesDeclined': 'N/A',
                        'NominationFeesOwing': 'N/A',
                        'CompetitionFeesPaid': 'N/A',
                        'CompetitionFeesDeclined': 'N/A',
                        'CompetitionFeesOwing': 'N/A',
                        'AffiliateNominationFeesPaid': 'N/A',
                        'AffiliateNominationFeesDeclined': 'N/A',
                        'AffiliateNominationFeesOwing': 'N/A',
                        'AffiliateCompetitionFeesPaid': 'N/A',
                        'AffiliateCompetitionFeesDeclined': 'N/A',
                        'AffiliateCompetitionFeesOwing': 'N/A'
                    });
                }

                response.setHeader('Content-disposition', 'attachment; filename=payment-summary.csv');
                response.setHeader('content-type', 'text/csv');
                fastcsv.write(mappedPaymentSummary, { headers: true })
                    .on("finish", function () {
                    })
                    .pipe(response);
            } else {
                return response.status(212).send({ message: "OrganisationUniqueKey cannot be null" });
            }
        } catch (error) {
            logger.error(`Exception occurred in PaymentSummaryExport ` + error);
            return response.status(500).send(`Payment Summary Error ${error}`);
        }
    }

    @Authorized()
    @Post('/partial/refund')
    async partialRefund(
        @Body() transactionBody: any,
        @Res() response: Response
    ): Promise<any> {
        try {
            logger.info(`PartialRefund ${JSON.stringify(transactionBody)}`);
            if (transactionBody.transactionId) {
                let guidKey = uuidv4();
                let transactionData = await this.transactionService.findById(transactionBody.transactionId);
                let invoiceData = await this.invoiceService.findById(transactionData.invoiceId);
                logger.info(`PartialRefund transactionData ${JSON.stringify(transactionData)}`);
                if (transactionBody.amount) {
                    if (transactionData.stripeTransactionId) {
                        let transactionReversal = await this.transactionService.performTransferReversal(transactionData, transactionBody.amount, guidKey);
                        logger.info(` TransactionReversal ${JSON.stringify(transactionReversal)}`);
                        if (transactionReversal && transactionReversal.code == 200) {
                            let refundIntent = await this.transactionService.refundIntent(transactionBody.amount, invoiceData.stripeSourceTransaction, transactionData, guidKey);

                            logger.info(` RefundIntent ${JSON.stringify(refundIntent)}`);

                            if (refundIntent && refundIntent.code == 200) {
                                transactionData.id = 0;
                                transactionData.feeAmount = transactionBody.amount * (-1);
                                transactionData.gstAmount = 0;
                                transactionData.discountAmount = 0;
                                transactionData.familyDiscountAmount = 0;
                                transactionData.statusRefId = AppConstants.NOT_PAID;
                                transactionData.stripeTransactionId = refundIntent ? refundIntent.message.id : null;
                                transactionData.transactionTypeRefId = TransactionTypeRefId.PartialRefund;
                                transactionData.referenceId = guidKey;

                                let newTrans = await this.transactionService.createOrUpdate(transactionData);

                                if (newTrans) {
                                    return response.status(200).send({
                                        newTransactionId: newTrans.id,
                                        refundedAmount: transactionBody.amount, message: "Succesfully Refunded"
                                    });
                                }
                            } else {
                                return response.status(212).send({ message: refundIntent.message.message });
                            }
                        } else {
                            logger.info(` TransactionReversal ${transactionReversal.message.message}`);
                            return response.status(212).send({ message: transactionReversal.message.message });
                        }
                    } else {
                        return response.status(212).send({ message: AppConstants.refundingWarningMsg });
                    }
                } else {
                    return response.status(212).send({ message: "Amount cannot be empty or zero" });
                }
            } else {
                return response.status(212).send({ message: "TransactionId cannot be null" });
            }
        } catch (error) {
            logger.error(`Exception occurred in PartialRefund ` + error);
            return response.status(500).send(`PartialRefund Error ${error}`);
        }
    }
}