import { Response } from 'express';
import * as fastcsv from 'fast-csv';
import * as _ from "lodash";
import moment from 'moment';
import nodeMailer from "nodemailer";
import { Authorized, Body, Get, HeaderParam, JsonController, Param, Post, QueryParam, Res } from 'routing-controllers';
import Stripe from 'stripe';
import AxiosHttpApi, { VoucherStatus } from '../http/governmentVoucher/AxiosApi';
import { logger } from '../logger';
import { CommunicationTrack } from '../models/common/CommunicationTrack';
import { Friend } from '../models/registrations/Friend';
import { Invoice } from '../models/registrations/Invoice';
import { NonPlayer } from '../models/registrations/NonPlayer';
import { OrgRegistrationParticipant } from '../models/registrations/OrgRegistrationParticipant';
import { OrgRegistrationParticipantDraft } from '../models/registrations/OrgRegistrationParticipantDraft';
import { Player } from '../models/registrations/Player';
import { RegistrationTrack } from '../models/registrations/RegistrationTrack';
import { Team } from '../models/registrations/Team';
import { Transaction } from '../models/registrations/Transaction';
import { UserMembershipExpiry } from '../models/registrations/UserMembershipExpiry';
import { UserRegistration } from '../models/registrations/UserRegistration';
import { Registration } from '../models/registrations/Registration';
import { UserRoleEntity } from '../models/security/UserRoleEntity';
import { User } from "../models/security/User";
import {
    calculateFeeGstAmount,
    calculateTotalAmount,
    currencyFormat,
    feeIsNull,
    formatDate,
    formatDateAEST,
    formatFeeForStripe1,
    formatPersonName,
    getParentEmail,
    isArrayPopulated,
    isNotNullAndUndefined,
    isNullOrEmpty,
    isNullOrUndefined,
    isNullOrZero,
    md5,
    objectIsNotEmpty,
    paginationData,
    Paging,
    stringTONumber,
    uuidv4
} from '../utils/Utils';
import AppConstants from '../validation/AppConstants';
import { BaseController } from './BaseController';
import { ParticipantRegistrationInfoDto } from '../models/dto/ParticipantRegistrationInfoDto';
import { RegistrationStep, FinanceFeeType, TransactionTypeRefId, InvoicePaymentStatus, TransactionStatus } from '../enums/enums';


const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2020-03-02' });

@JsonController('/api/payments')
export class PaymentController extends BaseController {

    // TODO: delete the below API when invoice and creating charges is ready
    @Post('/calculateFee')
    async dynaminDescription(
        @QueryParam("competitionUniqueKey", { required: true }) competitionUniqueKey: string,
        @QueryParam("organisationUniqueKey", { required: true }) organisationUniqueKey: string,
        @Body() paymentBody: any,
        @Res() response: Response
    ): Promise<any> {
        const CURRENCY_TYPE = "aud";
        try {
            if ((competitionUniqueKey && competitionUniqueKey !== "null" && competitionUniqueKey !== "undefined") && (organisationUniqueKey && organisationUniqueKey !== "null" && organisationUniqueKey !== "undefined")) {
                const foundOrganisationId = await this.organisationService.findOrganisationByUniqueKey(organisationUniqueKey);
                if (isArrayPopulated(foundOrganisationId)) {
                    const ORGANISATION_ID = foundOrganisationId[0].id;

                    const getRegistrationFormDetails = await this.orgRegistrationService.getOrgRegDetailsByCompetitionIdAndOrganisationId(competitionUniqueKey, organisationUniqueKey);
                    if (isArrayPopulated(getRegistrationFormDetails)) {
                        const ORG_REG_STATUS = getRegistrationFormDetails[0].statusRefId;
                        const ORG_REG_ID = getRegistrationFormDetails[0].id;
                        if (ORG_REG_STATUS === 2) {
                            const STATE_ACCOUNT_ID = 'acct_1Gf6A4AmOSlAADe3';
                            const STATE_ORG_NAME = 'Netball QLD';
                            const ASSOCIATION_ACCOUNT_ID = 'acct_1Gf6umLa0AS4yD49';
                            const ASSOCIATION_ORG_NAME = 'World Sports';
                            const CLUB_ACCOUNT_ID = 'acct_1Gf6qnCf6KIq1dD9';
                            const CLUB_ORG_NAME = 'Wsa';

                            const TOTAL_CLUB_FEE_STRIPE_PAY = 17000;
                            const TOTAL_MEMBERSHIP_FEE_STRIPE_PAY_PLAYER = 2000;
                            const COMPETITION_ORGANISER_FEE_STRIPE_PAY_PLAYER = 5000;
                            const TOTAL_AFFILIATE_FEE_STRIPE_PAY_PLAYER = 10000;

                            const createCustomer = await stripe.customers.create({
                                description: 'NetballConnect',
                                email: "info@netballconnect.com",
                                name: "NetballConnect",
                                source: paymentBody.token.id,
                            });

                            const paymentIntentClub = await stripe.paymentIntents.create({
                                amount: TOTAL_CLUB_FEE_STRIPE_PAY,
                                currency: CURRENCY_TYPE,
                                payment_method_types: ['card'],
                                transfer_group: ORG_REG_ID,
                                // customer: 'cus_HBDqbhK2nTTJ9E',
                                // payment_method: 'pm_1GcrOpEdRNU9eN5LyJN2svJ2',
                                customer: createCustomer.id,
                                // payment_method: createdPaymentMethodAttach.id,
                                metadata: { integration_check: 'accept_a_payment' },
                                description: "test payment intent club pay",
                                confirm: true,
                                confirmation_method: "automatic"
                            });

                            if (paymentIntentClub.status === "succeeded") {
                                // transfer to state for membershipFees
                                const transferToStateMembershipFeePlayer = await stripe.transfers.create({
                                    amount: TOTAL_MEMBERSHIP_FEE_STRIPE_PAY_PLAYER,
                                    currency: CURRENCY_TYPE,
                                    description: `Nicola Jones - Player - ${STATE_ORG_NAME} - Membership Fee`,
                                    source_transaction: paymentIntentClub.charges.data[0].id,
                                    destination: STATE_ACCOUNT_ID,
                                    transfer_group: ORG_REG_ID
                                });

                                // transfer to association for organiser fees
                                const transferToAssociationCompOrganiserPlayer = await stripe.transfers.create({
                                    amount: COMPETITION_ORGANISER_FEE_STRIPE_PAY_PLAYER,
                                    currency: CURRENCY_TYPE,
                                    description: `Nicola Jones - Player - ${ASSOCIATION_ORG_NAME} - Competition Fee`,
                                    destination: ASSOCIATION_ACCOUNT_ID,
                                    source_transaction: paymentIntentClub.charges.data[0].id,
                                    transfer_group: ORG_REG_ID
                                });

                                // transfer to club for affiliate fees
                                const transferToClubAffiliateFeePlayer = await stripe.transfers.create({
                                    amount: TOTAL_AFFILIATE_FEE_STRIPE_PAY_PLAYER,
                                    description: `Nicola Jones - Player - ${CLUB_ORG_NAME} - Affiliate Fee`,
                                    currency: CURRENCY_TYPE,
                                    destination: CLUB_ACCOUNT_ID,
                                    source_transaction: paymentIntentClub.charges.data[0].id,
                                    transfer_group: ORG_REG_ID,
                                });

                                if (transferToStateMembershipFeePlayer && transferToAssociationCompOrganiserPlayer && transferToClubAffiliateFeePlayer) {
                                    return response.send({
                                        success: true,
                                        message: "Payment successful"
                                    });
                                } else {
                                    return response.send({
                                        success: false,
                                        message: "Payment unsuccessful"
                                    });
                                }
                            }
                        }
                    } else {
                        return response.status(400).send({
                            message: 'Registration Form not published yet'
                        });
                    }
                } else {
                    return response.status(400).send({
                        message: "cannot find the organisation with the provided ID"
                    });
                }
            } else {
                return response.status(400).send({
                    message: "Please pass competitionUniqueKey and organisationUniqueKey"
                });
            }
        } catch (err) {
            return response.status(400).send({
                err,
                name: 'unexpected_error',
                message: process.env.NODE_ENV == AppConstants.development ? 'Failed to get' + err : 'Failed to get'
            });
        }
    }

    @Authorized()
    @Get('/balance')
    async checkBalance(
        @QueryParam("organisationUniqueKey") organisationUniqueKey: string,
        @Res() response: Response
    ): Promise<any> {
        try {
            const foundOrganisation = await this.organisationService.findOrganisationByUniqueKey(organisationUniqueKey);
            if (isArrayPopulated(foundOrganisation)) {
                const ACCOUNT_ID = foundOrganisation[0].stripeAccountID;
                const getBalance = await stripe.balance.retrieve({ stripeAccount: ACCOUNT_ID });
                return response.status(200).json({
                    available: (getBalance.available[0]['amount'] / 100) /*+ ' ' + getBalance.available[0]['currency'] */,
                    pending: (getBalance.pending[0]['amount'] / 100) /*+ ' ' + getBalance.pending[0]['currency'] */,
                });
            } else {
                return response.send({
                    message: "cannot find the organisation with the provided ID"
                })
            }
        } catch (err) {
            return response.status(400).send(`Checking Balance Error: ${err}`);
        }
    }

    // TODO: delete the below API when invoice and creating charges is ready
    @Authorized()
    @Get('/charges/list')
    async chargesList(@Res() response: Response): Promise<any> {
        try {
            const getChargesList = await stripe.charges.list({ limit: 100000 });
            return getChargesList;
        } catch (err) {
            return response.status(400).send(`getting charges list Error: ${err.message}`);
        }
    }

    @Authorized()
    @Get('/paymentmethods')
    async getStripePaymentMethod(@Res() response: Response): Promise<any> {
        try {
            const paymentMethods = await stripe.paymentMethods.list({
                customer: 'cus_I44G7ybiZEcruN',
                type: 'card',
            });
            //pi_1HTvTuEnewRwSTgnsLl6Zve2
            //pi_1HTulSEnewRwSTgnIZV7j7jx

            // const paymentIntent = await stripe.paymentIntents.retrieve(
            //     "pi_1HTvTuEnewRwSTgnsLl6Zve2"
            // );
            // const paymentIntent = await stripe.paymentIntents.retrieve(
            //     "pi_1HTw8AEnewRwSTgn4q9WFyyG"
            // );
            // const customer = await stripe.customers.retrieve(
            //     'cus_I44G7ybiZEcruN'
            // );

            return paymentMethods;
        } catch (err) {
            return response.status(400).send(`getting invoice Error: ${err.message}`);
        }
    }

    @Authorized()
    @Get('/invoice')
    async getStripeInvoice(@Res() response: Response): Promise<any> {
        try {
            const getInvoice = await stripe.invoices.create({ customer: 'cus_HBYTXWsLIKPTHT' });
            return getInvoice;
        } catch (err) {
            return response.status(400).send(`getting invoice Error: ${err.message}`);
        }
    }

    @Authorized()
    @Post('/save')
    async onBoardOrganisation(
        @HeaderParam("authorization") currentUser: User,
        @Body() newAccountBody: any,
        @Res() response: Response
    ): Promise<any> {
        try {
            const stripeResponse = await stripe.oauth.token({
                grant_type: 'authorization_code',
                code: newAccountBody.code
            });

            const updateStripeKey = await this.organisationService.updateOrganisationWithAccountId(newAccountBody.organisationUniqueKey, stripeResponse.stripe_user_id);

            await stripe.accounts.update(stripeResponse.stripe_user_id, { metadata: { debit_negative_balances: 'true' } });

            return response.status(updateStripeKey ? 200 : 212).send({
                organisationId: await this.organisationService.userOrganisation(currentUser.id),
                success: updateStripeKey ? true : false,
                message: updateStripeKey ? "Account ID successfully saved" : "Failed to save Account ID"
            });
        } catch (err) {
            response.status(400).send(`Failed in saving Account ID: ${err}`);
        }
    }

    @Post('/webhooks')
    async createWebHook(
        @Body() webhookBody: any,
        @Res() response: Response
    ): Promise<any> {
        try {
            switch (webhookBody.type) {
                case 'account.updated':
                    this.sendStripeWebHookEmail(webhookBody, 'account.updated');
                    break;
                case 'account.external_account.updated':
                    this.sendStripeWebHookEmail(webhookBody, 'account.external_account.updated');
                    break;
                case 'payout.failed':
                    this.sendStripeWebHookEmail(webhookBody, 'payout.failed');
                    break;
                case 'payment_intent.created':
                    this.sendStripeWebHookEmail(webhookBody, 'payment_intent.created');
                    break;
                case 'payment_intent.succeeded': // TODO: sending email as per flow
                    // this.sendStripeWebHookEmail(webhookBody, 'payment_intent.succeeded');
                    // updating the paymentStatus to success
                    // await this.invoiceService.updatePaymentStatusByRegistrationID(webhookBody.data.object.transfer_group);
                    let transferGroupWithPrefix = webhookBody.data.object.transfer_group;
                    logger.info("Web Hook Succeed::" + JSON.stringify(transferGroupWithPrefix));
                    let transferGroup = transferGroupWithPrefix.split("#");
                    logger.info("Web Hook Succeed Split::" + JSON.stringify(transferGroup));
                    if (isArrayPopulated(transferGroup)) {
                        if (transferGroup[0] == AppConstants.registration) {
                            this.processPaymentForWebHookIntentSucceed(transferGroup[1]);
                        } else if (transferGroup[0] == AppConstants.teamIndividual) {
                            this.processTeamPaymentForWebHookIntentSucceed(transferGroup[1]);
                        } else if (transferGroup[0] == AppConstants.instalment) {
                            this.processInstalmentForWebHookIntentSucceed(transferGroup);
                        } else if (transferGroup[0] == AppConstants.teamMemberRegistration) {
                            this.processTeamMemberPaymentForWebHookIntentSucceed(transferGroup);
                        }
                        if (transferGroup[0] == AppConstants.singleGame) {
                            this.processSingleGamePaymentForWebHookIntentSucceed(transferGroup[1], transferGroup[2]);
                        }
                        if (transferGroup[0] == AppConstants.shop) {
                            this.processShopPaymentForWebHookIntentSucceed(transferGroup[1]);
                        }
                        if (transferGroup[0] == 'NEGATIVE FEE' || transferGroup[0] == 'HARDSHIP FEE' || transferGroup[0] == 'DISCOUNT FEE') {
                            this.processOnBehalfOfForWebHookIntentSucceed(transferGroup);
                        }
                        if(transferGroup[3] == 'GOVT VOUCHER') {
                            this.processGovtVoucherForWebHookIntentSucceed(transferGroup);
                        }
                    }
                    break;
                case 'charge.refunded':
                    logger.info("Web Hook Charge Refunded::" + JSON.stringify(webhookBody.data.object));
                    logger.info(`Metadata Object :: ${JSON.stringify(webhookBody.data.object.refunds.data)}`);
                    let data = webhookBody.data.object.refunds.data;
                    if (isArrayPopulated(data)) {
                        for (let item of data) {
                            let partialRefundWithPrefix = item.metadata.partialRefund;
                            logger.info("Web Hook Succeed::" + JSON.stringify(partialRefundWithPrefix));
                            let partialRefund = partialRefundWithPrefix.split("#");
                            logger.info("Web Hook Succeed Split::" + JSON.stringify(partialRefund));

                            if (partialRefund[0] == 'PARTIALREFUND') {
                                await this.updateRefundedTransaction(partialRefund[1]);
                            }
                        }
                    }
                    break;
                case 'transfer.reversed':
                    logger.info("Web Hook Transfer Reversed::" + JSON.stringify(webhookBody.data.object));
                    logger.info("Metadata Object :: " + JSON.stringify(webhookBody.data.object.reversals.data));
                    let dataArr = webhookBody.data.object.reversals.data;
                    if (isArrayPopulated(dataArr)) {
                        for (let item of dataArr) {
                            let transferReversalWithPrefix = item.metadata.transferReversal;
                            logger.info("Web Hook Succeed::" + JSON.stringify(transferReversalWithPrefix));
                            let transferReversal = transferReversalWithPrefix.split("#");
                            logger.info("Web Hook Succeed Split::" + JSON.stringify(transferReversal));

                            if (transferReversal[0] == 'TRANSFERREVERSAL') {
                                console.log("inside transfer reversal" + JSON.stringify(transferReversal[1]));
                            }
                        }
                    }
                    break;
                case 'payment_intent.payment_failed':
                    await this.paymentIntentFailed(webhookBody);
                    break;
                default:
                    return response.status(400).end();
            }

            return response.json({ received: true });
        } catch (err) {
            response.status(400).send(`Webhook Error: ${err.message}`);
        }
    }

    @Get('/login')
    async createLoginLink(
        @QueryParam("organisationUniqueKey", { required: true }) organisationUniqueKey: string,
        @Res() response: Response
    ): Promise<any> {
        try {
            const foundOrganisationId = await this.organisationService.findOrganisationByUniqueKey(organisationUniqueKey);
            if (isArrayPopulated(foundOrganisationId)) {
                const ACCOUNT_ID = foundOrganisationId[0].stripeAccountID;
                const redirect_url = process.env.STRIPE_SECRET_KEY.includes("test")
                    ? `https://dashboard.stripe.com/${ACCOUNT_ID}/test/dashboard`
                    : `https://dashboard.stripe.com/${ACCOUNT_ID}/dashboard`;
                return (await stripe.accounts.createLoginLink(ACCOUNT_ID, { redirect_url })).url;
            } else {
                return response.send({
                    message: "cannot find the organisation with the provided ID"
                });
            }
        } catch (err) {
            response.status(400).send(`Error in creating login link: ${err}`);
        }
    }

    @Authorized()
    @Post('/list')
    async transfersAndPayoutsListWithPagination(
        @Body() listingBody: ListingRequest,
        @QueryParam('sortBy') sortBy: string = undefined,
        @QueryParam('sortOrder') sortOrder: 'ASC' | 'DESC' = undefined,
        @Res() response: Response,
        @QueryParam('year') year?: number,
        @QueryParam('startDate') startDate?: string,
        @QueryParam('endDate') endDate?: string
    ): Promise<any> {
        try {
            const foundOrganisation = await this.organisationService.findOrganisationByUniqueKey(listingBody.organisationUniqueKey);
            if (isArrayPopulated(foundOrganisation)) {
                const stripeAccountId = foundOrganisation[0].stripeAccountID;
                let ListingObject = Object.assign({});
                if (listingBody.paging.starting_after) ListingObject.starting_after = listingBody.paging.starting_after;
                if (listingBody.paging.ending_before) ListingObject.ending_before = listingBody.paging.ending_before;
                if (listingBody.paging.limit) ListingObject.limit = listingBody.paging.limit;
                if (year) {
                    const yearStartInMs = new Date(`${year}`).getTime()
                    const yearEndInMs = new Date(`${year + 1}`).getTime()
                    const yearEnd = parseInt(`${yearEndInMs / 1000}`) // Division by 1000 to convert it to unix timestamp
                    const yearStart = parseInt(`${yearStartInMs / 1000}`)

                    ListingObject.created = {
                        lt: yearEnd, // Less then first second of next year
                        gte: yearStart // More than or equal to first second of select year
                    }
                } else if (startDate || endDate) {
                    ListingObject.created = {}

                    if (startDate) {
                        const startDateInMs = new Date(startDate).getTime()
                        ListingObject.created.gte = parseInt(`${startDateInMs / 1000}`)
                    }
                    if (endDate) {
                        const endDateInMs = new Date(endDate).getTime()
                        ListingObject.created.lte = parseInt(`${endDateInMs / 1000}`)
                    }
                }
                ListingObject["include[]"] = "total_count";
                if (listingBody.type === "transfer") {
                    ListingObject.destination = stripeAccountId;
                    const transferList = await stripe.transfers.list(ListingObject);
                    const transferArray = transferList.data;
                    const finalTransferObject = Object.assign({});
                    finalTransferObject['hasmore'] = transferList.has_more;
                    finalTransferObject['totalCount'] = transferList['total_count'];
                    const transformedTransferArray = transferArray.map(e => {
                        e['amount'] = e['amount'] / 100;
                        delete e.object;
                        delete e.destination;
                        delete e.destination_payment;
                        delete e.livemode;
                        delete e.metadata;
                        delete e.reversals;
                        delete e.source_transaction;
                        delete e.source_type;
                        return e;
                    });

                    if (isNotNullAndUndefined(sortBy) && isNotNullAndUndefined(sortOrder)) {
                        finalTransferObject['transfers'] = _.orderBy(transformedTransferArray, sortBy, sortOrder);
                    } else {
                        finalTransferObject['transfers'] = transformedTransferArray;
                    }
                    return finalTransferObject;
                } else if (listingBody.type === "payout") {
                    const payoutList = await stripe.payouts.list(ListingObject, { stripeAccount: stripeAccountId });
                    const payoutArray = payoutList.data;
                    let mappedPayoutArray = payoutArray.map(e => {
                        e['amount'] = e['amount'] / 100;
                        delete e.object;
                        delete e.destination;
                        delete e.livemode;
                        delete e.metadata;
                        delete e.source_type;
                        return e;
                    });

                    const transformedPayoutArray = await Promise.all(mappedPayoutArray);

                    const finalPayoutResult = Object.assign({});
                    finalPayoutResult['hasmore'] = payoutList.has_more;
                    finalPayoutResult['totalCount'] = payoutList['total_count'];

                    if (isNotNullAndUndefined(sortBy) && isNotNullAndUndefined(sortOrder)) {
                        finalPayoutResult['payouts'] = _.orderBy(transformedPayoutArray, sortBy, sortOrder);
                    } else {
                        finalPayoutResult['payouts'] = transformedPayoutArray;
                    }
                    return finalPayoutResult;
                } else if (listingBody.type === "refunds") {
                    // ListingObject.charge = stripeAccountId;
                    const refundList = await stripe.refunds.list(ListingObject);
                    const refundsArray = refundList.data;
                    const finalRefundObject = Object.assign({});
                    finalRefundObject['hasmore'] = refundList.has_more;
                    finalRefundObject['totalCount'] = refundList['total_count'];
                    const transformedRefundArray = refundsArray.map(e => {
                        e['amount'] = e['amount'] / 100;
                        e['description'] = 'STRIPE REFUND' 
                        delete e.object;
                        delete e.metadata;
                        return e;
                    });

                    if (isNotNullAndUndefined(sortBy) && isNotNullAndUndefined(sortOrder)) {
                        finalRefundObject['refunds'] = _.orderBy(transformedRefundArray, sortBy, sortOrder);
                    } else {
                        finalRefundObject['refunds'] = transformedRefundArray;
                    }
                    return finalRefundObject;
                }
            } else {
                return response.status(212).send({
                    message: "cannot find the organisation with the provided ID"
                });
            }
        } catch (err) {
            return response.status(400).send(`getting transfers and payouts list Error: ${err}`);
        }
    }

    @Authorized()
    @Post('/payoutTransferList')
    async payoutsTransferListWithPagination(
        @Body() listingBody: PayoutTransferListingRequest,
        @Res() response: Response
    ): Promise<any> {
        try {
            const foundOrganisation = await this.organisationService.findOrganisationByUniqueKey(listingBody.organisationUniqueKey);
            if (isArrayPopulated(foundOrganisation)) {
                const stripeAccountId = foundOrganisation[0].stripeAccountID;
                if (listingBody.type === "payoutTransfer") {
                    let ListingObject = Object.assign({});
                    if (listingBody.paging.starting_after) ListingObject.starting_after = listingBody.paging.starting_after;
                    if (listingBody.paging.ending_before) ListingObject.ending_before = listingBody.paging.ending_before;
                    if (listingBody.paging.limit) ListingObject.limit = listingBody.paging.limit;
                    ListingObject["include[]"] = "total_count";
                    ListingObject['payout'] = listingBody.payoutId;
                    ListingObject['expand'] = ["data.source.source_transfer"];

                    const transfersDetailsForEachPayout = await stripe.balanceTransactions.list(ListingObject, { stripe_account: stripeAccountId });
                    const payoutTransferArray = transfersDetailsForEachPayout.data.filter(e => e.type === "payment");
                    let mappedPayoutTransferArray = payoutTransferArray.map(e => {
                        e['amount'] = e['amount'] / 100;
                        e['net'] = e['net'] / 100;
                        e['source_transfer'] = e['source']['source_transfer'];
                        e['source_transfer']['amount'] = e['source_transfer']['amount'] / 100;
                        delete e['reporting_category'];
                        delete e['source'];
                        delete e.object;
                        return e;
                    });

                    const finalPayoutTransferResult = Object.assign({});
                    finalPayoutTransferResult['payoutTransfers'] = mappedPayoutTransferArray;
                    finalPayoutTransferResult['hasmore'] = transfersDetailsForEachPayout.has_more;
                    finalPayoutTransferResult['totalCount'] = transfersDetailsForEachPayout['total_count'];
                    return finalPayoutTransferResult;
                }
            } else {
                return response.status(212).send({
                    message: "cannot find the organisation with the provided ID"
                });
            }
        } catch (err) {
            return response.status(400).send(`getting payoutTransfer list Error: ${err}`);
        }
    }

    // TODO: delete the below API when invoice and creating charges is ready
    @Post('/createPayment')
    async createPayment(
        @Body() paymentBody: PaymentRequest,
        @Res() response: Response
    ): Promise<any> {
        try {
            const registrationId = paymentBody.registrationId;
            const checkPaymentStatus = await this.invoiceService.findByRegistrationId(registrationId);

            if (isArrayPopulated(checkPaymentStatus)) {
                const PAYMENT_STATUS = checkPaymentStatus[0].paymentStatus;
                if (PAYMENT_STATUS === 'success') {
                    return response.status(200).send({ success: true, message: "no need to pay, as its already paid" });
                } else if (PAYMENT_STATUS === 'pending') {
                    return response.status(212).send({
                        success: false,
                        message: "you have an ongoing payment already, avoid to pay more than once"
                    });
                }
            } else {
                const CURRENCY_TYPE: string = "aud";
                const getInvoiceData = await this.registrationService.getInvoice(paymentBody.registrationId, null);
                const REGISTRATION_ID: string = paymentBody.registrationId.toString();
                const STRIPE_EXTRA_CHARGES: number = 0; // TODO: needs discussion
                if (isArrayPopulated(getInvoiceData)) {
                    const REGISTRATION_CREATOR_USER_ID: number = getInvoiceData[0]['userRegistrationCreator'];
                    let TOTAL_FEE_PER_PERSON: number = 0;

                    // creating entry in invoice table
                    const inv = new Invoice();
                    inv.createdBy = REGISTRATION_CREATOR_USER_ID;
                    inv.id = 0;
                    inv.registrationId = registrationId;
                    const invoiceDetails = await this.invoiceService.createOrUpdate(inv);

                    for (let i of getInvoiceData) {
                        const membershipData = (i['membership'] !== null && i['membership'] !== undefined) ? i['membership'] : Object.assign({});
                        const compOrgData = (i['competitionOrganiser'] !== null && i['competitionOrganiser'] !== undefined) ? i['competitionOrganiser'] : Object.assign({});
                        const affiliateData = (i['affiliate'] !== null && i['affiliate'] !== undefined) ? i['affiliate'] : Object.assign({});

                        // calculating total fees
                        let TOTAL_MEM_PRO_FEES: number = 0;
                        let TOTAL_COMP_ORG_FEES: number = 0;
                        let TOTAL_AFFIL_FEES: number = 0;
                        if (isArrayPopulated(membershipData)) {
                            for (let i of membershipData) {
                                if (isArrayPopulated(i['membershipProductTypes'])) {
                                    for (let j of i['membershipProductTypes']) {
                                        TOTAL_MEM_PRO_FEES += calculateTotalAmount(j['mCasualFee'], j['mCasualGst'], j['mSeasonalFee'], j['mSeasonalGst']);
                                    }
                                }
                            }
                        }

                        if (isArrayPopulated(compOrgData.fees)) {
                            for (let i of compOrgData.fees) {
                                TOTAL_COMP_ORG_FEES += calculateTotalAmount(i['cSeasonalFees'], i['cCasualFees'], i['cCasualGST'], i['cSeasonalGST']);
                            }
                        }

                        if (isArrayPopulated(affiliateData.fees)) {
                            for (let i of affiliateData.fees) {
                                TOTAL_AFFIL_FEES += calculateTotalAmount(i['aCasualGST'], i['aCasualFees'], i['aSeasonalGST'], i['aSeasonalFees']);
                            }
                        }

                        TOTAL_FEE_PER_PERSON += TOTAL_MEM_PRO_FEES + TOTAL_COMP_ORG_FEES + TOTAL_AFFIL_FEES;
                    }

                    const TOTAL_FEE_STRIPE_PAY: number = formatFeeForStripe1(TOTAL_FEE_PER_PERSON + STRIPE_EXTRA_CHARGES);

                    let userData = {};
                    const createCustomer = await stripe.customers.create({

                        description: `${formatPersonName(userData['firstName'], userData['middleName'], userData['lastName'])}`,
                        email: `${userData['email']}`,
                        name: `${formatPersonName(userData['firstName'], userData['middleName'], userData['lastName'])}`,
                        source: paymentBody.token.id
                    });

                    const paymentIntent = await stripe.paymentIntents.create({
                        amount: TOTAL_FEE_STRIPE_PAY,
                        currency: CURRENCY_TYPE,
                        payment_method_types: ['card'],
                        customer: createCustomer.id,
                        metadata: { integration_check: 'accept_a_payment' },
                        description: "testing invoice payment intent club pay",
                        confirm: true,
                        confirmation_method: "automatic",
                        transfer_group: REGISTRATION_ID
                    });

                    if (paymentIntent.status === "succeeded") {
                        for (let i of getInvoiceData) {
                            const userData = (i['userDetail'] !== null && i['userDetail'] !== undefined) ? i['userDetail'] : Object.assign({});
                            const membershipData = (i['membership'] !== null && i['membership'] !== undefined) ? i['membership'] : Object.assign({});
                            const compOrgData = (i['competitionOrganiser'] !== null && i['competitionOrganiser'] !== undefined) ? i['competitionOrganiser'] : Object.assign({});
                            const affiliateData = (i['affiliate'] !== null && i['affiliate'] !== undefined) ? i['affiliate'] : Object.assign({});

                            const competitionOrganiserOrganisationName_: string = compOrgData['details']['compOrgName'];
                            const playerName_: string = formatPersonName(userData['firstName'], userData['middleName'], userData['lastName']);

                            if (isArrayPopulated(membershipData)) {
                                for (let i of membershipData) {
                                    const membershipProductName_: string = `${i['membershipProductName']}`;
                                    const membershipProductOrganisationName_: string = `${i['membershipOrgName']}`;

                                    let membershipProductTypeName_: string;
                                    let membershipProductCompetitionName_: string;
                                    let membershipProductTypeFeeAmount_: number;
                                    let membershipProductTypeGstAmount_: number;
                                    let membershipProductTypeTotalAmount_: number;
                                    let membershipOrganisationAccountId_: string;
                                    let membershipMappingId_: number;
                                    let competitionId_: number;
                                    let membershipOrganisationId_: number;

                                    if (isArrayPopulated(i['membershipProductTypes'])) {
                                        for (let j of i['membershipProductTypes']) {
                                            membershipProductTypeName_ = j['mTypeName'];
                                            membershipProductTypeTotalAmount_ = calculateTotalAmount(j['mCasualFee'], j['mSeasonalFee'], j['mCasualGst'], j['mSeasonalGst']);
                                            membershipProductTypeFeeAmount_ = calculateFeeGstAmount(j['mCasualFee'], j['mSeasonalFee']);
                                            membershipProductTypeGstAmount_ = calculateFeeGstAmount(j['mCasualGst'], j['mSeasonalGst']);
                                            membershipProductCompetitionName_ = j['competitionName'];
                                            membershipOrganisationAccountId_ = j['mOrganisationAccountId'];
                                            membershipMappingId_ = j['membershipMappingId'];
                                            competitionId_ = j['competitionId'];
                                            membershipOrganisationId_ = j['mOrganisationId'];

                                            // transfer for membershipFees
                                            const transferForMembershipFee = await stripe.transfers.create({
                                                amount: formatFeeForStripe1(membershipProductTypeTotalAmount_),
                                                currency: CURRENCY_TYPE,
                                                description: `${playerName_} - ${membershipProductTypeName_} - ${membershipProductOrganisationName_} - Membership Fee`,
                                                source_transaction: paymentIntent.charges.data[0].id,
                                                destination: membershipOrganisationAccountId_,
                                                transfer_group: REGISTRATION_ID
                                            });

                                            const trxn = new Transaction();
                                            trxn.id = 0;
                                            trxn.invoiceId = invoiceDetails.id;
                                            trxn.participantId = REGISTRATION_CREATOR_USER_ID;
                                            trxn.createdBy = REGISTRATION_CREATOR_USER_ID;
                                            trxn.feeAmount = membershipProductTypeFeeAmount_;
                                            trxn.gstAmount = membershipProductTypeGstAmount_;
                                            trxn.discountAmount = null; // TODO: have to change  as per discussion
                                            trxn.feeType = 'membership';
                                            trxn.membershipProductMappingId = membershipMappingId_;
                                            trxn.competitionId = competitionId_;
                                            trxn.organisationId = membershipOrganisationId_;
                                            await this.transactionService.createOrUpdate(trxn);
                                        }
                                    }
                                }
                            }

                            if (isArrayPopulated(compOrgData.fees)) {
                                for (let i of compOrgData.fees) {
                                    // transfer to state for membershipFees
                                    let competitionTotalAmount_: number = calculateTotalAmount(i['cCasualFees'], i['cCasualGST'], i['cSeasonalGST'], i['cSeasonalFees']);
                                    let competitionFeeAmount_: number = calculateFeeGstAmount(i['cCasualFees'], i['cSeasonalFees']);
                                    let competitionGstAmount_: number = calculateFeeGstAmount(i['cCasualGST'], i['cSeasonalGST']);
                                    let cOrganisationAccountId_: string = i['cOrganisationAccountId'];
                                    let cOrganisationId_: number = i['cOrganisationId'];
                                    let competitionId_: number = i['competitionId'];

                                    let cMembershipMappingId_: number = i['membershipMappingId'];
                                    let cmTypeName_: string = i['cmTypeName'];

                                    // transfer to association for organiser fees
                                    const transferForCompetitionOrganiser = await stripe.transfers.create({
                                        amount: formatFeeForStripe1(competitionTotalAmount_),
                                        currency: CURRENCY_TYPE,
                                        description: `${playerName_} - ${cmTypeName_} - ${competitionOrganiserOrganisationName_} - Competition Fee`,
                                        destination: cOrganisationAccountId_,
                                        source_transaction: paymentIntent.charges.data[0].id,
                                        transfer_group: REGISTRATION_ID
                                    });

                                    const trxn = new Transaction();
                                    trxn.id = 0;
                                    trxn.invoiceId = invoiceDetails.id;
                                    trxn.participantId = REGISTRATION_CREATOR_USER_ID;
                                    trxn.createdBy = REGISTRATION_CREATOR_USER_ID;
                                    trxn.feeAmount = competitionFeeAmount_;
                                    trxn.gstAmount = competitionGstAmount_;
                                    trxn.discountAmount = null; // TODO: have to change  as per discussion
                                    trxn.feeType = 'competition';
                                    trxn.membershipProductMappingId = cMembershipMappingId_;
                                    trxn.competitionId = competitionId_;
                                    trxn.organisationId = cOrganisationId_;
                                    await this.transactionService.createOrUpdate(trxn);
                                }
                            }

                            if (isArrayPopulated(affiliateData.fees)) {
                                for (let i of affiliateData.fees) {
                                    const affiliateOrganisationName_: string = affiliateData['details']['affOrgName'];
                                    let affiliateTotalAmount_: number = calculateTotalAmount(i['aCasualGST'], i['aCasualFees'], i['aSeasonalGST'], i['aSeasonalFees']);
                                    let affiliateFeeAmount_: number = calculateFeeGstAmount(i['aCasualFees'], i['aSeasonalFees']);
                                    let affiliateGstAmount_: number = calculateFeeGstAmount(i['aCasualGST'], i['aSeasonalGST']);
                                    let competitionId_: number = i['competitionId'];
                                    let aOrganisationId_: number = i['aOrganisationId'];
                                    let membershipMappingId_: number = i['membershipMappingId'];
                                    let aOrganisationAccountId_: string = i['aOrganisationAccountId'];
                                    let amTypeName_: string = i['amTypeName'];

                                    // transfer for affiliateFees
                                    const transferForAffiliateFee = await stripe.transfers.create({
                                        amount: formatFeeForStripe1(affiliateTotalAmount_),
                                        description: `${playerName_} - ${amTypeName_} - ${affiliateOrganisationName_} - Affiliate Fee`,
                                        currency: CURRENCY_TYPE,
                                        destination: aOrganisationAccountId_,
                                        source_transaction: paymentIntent.charges.data[0].id,
                                        transfer_group: REGISTRATION_ID
                                    });

                                    const trxn = new Transaction();
                                    trxn.id = 0;
                                    trxn.invoiceId = invoiceDetails.id;
                                    trxn.participantId = REGISTRATION_CREATOR_USER_ID;
                                    trxn.createdBy = REGISTRATION_CREATOR_USER_ID;
                                    trxn.feeAmount = affiliateFeeAmount_;
                                    trxn.gstAmount = affiliateGstAmount_;
                                    trxn.discountAmount = null; // TODO: have to change  as per discussion
                                    trxn.feeType = 'affiliate';
                                    trxn.membershipProductMappingId = membershipMappingId_;
                                    trxn.competitionId = competitionId_;
                                    trxn.organisationId = aOrganisationId_;
                                    await this.transactionService.createOrUpdate(trxn);
                                }
                            }
                        }
                        return response.status(200).send({ success: true, message: "Payment successful" });
                    } else {
                        return response.status(212).send({
                            error: 11,
                            success: false,
                            message: "cannot create payment, an error occurred"
                        });
                    }
                } else {
                    return response.status(212).send({
                        success: false,
                        message: "cannot get invoice details, an error occurred"
                    });
                }
            }
        } catch (err) {
            return response.status(212).send(`creating payment error: ${err}`);
        }
    }

    @Post('/saveInvoice')
    async saveInvoice(
        @Body() invoiceBody: InvoiceTransactionRequest,
        @Res() response: Response
    ): Promise<any> {
        try {
            if (invoiceBody.invoiceId === null || invoiceBody.invoiceId == 0) {
                invoiceBody.invoiceId = null;
            }
            const getInvoiceData = await this.registrationService.getInvoice(invoiceBody.registrationId, invoiceBody.invoiceId);
            if (isArrayPopulated(getInvoiceData)) {
                const REGISTRATION_CREATOR_USER_ID = getInvoiceData[0]['userRegistrationCreator'];
                const inv = new Invoice();
                inv.id = invoiceBody.invoiceId;
                inv.registrationId = invoiceBody.registrationId;

                if (isNullOrZero(invoiceBody.invoiceId)) {
                    inv.createdBy = REGISTRATION_CREATOR_USER_ID;
                } else {
                    inv.createdBy = REGISTRATION_CREATOR_USER_ID;
                    inv.updatedBy = REGISTRATION_CREATOR_USER_ID;
                    inv.updatedOn = new Date();
                }

                const invoiceDetails = await this.invoiceService.createOrUpdate(inv);

                let transactionDetails: any = Object.assign({});
                if (invoiceBody.charity !== null) {
                    const trxnCharity = new Transaction();
                    trxnCharity.id = invoiceBody.transactionId;
                    trxnCharity.invoiceId = invoiceDetails.id;
                    trxnCharity.participantId = REGISTRATION_CREATOR_USER_ID;
                    trxnCharity.createdBy = REGISTRATION_CREATOR_USER_ID;
                    trxnCharity.feeAmount = invoiceBody.charity.charityValue;
                    trxnCharity.gstAmount = 0;
                    trxnCharity.discountAmount = null;
                    trxnCharity.feeType = 'charity';
                    trxnCharity.competitionCharityRoundUpId = invoiceBody.charity.roundUpId;
                    trxnCharity.membershipProductMappingId = invoiceBody.charity.membershipMappingId;
                    trxnCharity.competitionId = invoiceBody.charity.competitionId;
                    trxnCharity.organisationId = invoiceBody.charity.competitionOrganisationId;
                    trxnCharity.paidBy = REGISTRATION_CREATOR_USER_ID;

                    if (isNullOrZero(invoiceBody.transactionId)) {
                        trxnCharity.createdBy = REGISTRATION_CREATOR_USER_ID;
                    } else {
                        trxnCharity.createdBy = REGISTRATION_CREATOR_USER_ID;
                        trxnCharity.updatedBy = REGISTRATION_CREATOR_USER_ID;
                        trxnCharity.updatedOn = new Date();
                    }

                    transactionDetails = await this.transactionService.createOrUpdate(trxnCharity);
                } else {
                    // delete existing charity if exists => user opts "none" as selection to charity
                    if (invoiceBody.registrationId !== null && invoiceBody.transactionId !== null) {
                        await this.transactionService.deleteByTransactionId(invoiceBody.transactionId);
                    }
                }

                let invoiceData: any = { ...invoiceDetails };
                invoiceData.invoiceId = invoiceDetails.id;
                delete invoiceData.id;
                if (objectIsNotEmpty(transactionDetails)) {
                    let transactionData: any = { ...transactionDetails };
                    invoiceData.transactionDetails = transactionData;
                    invoiceData.transactionDetails.transactionId = invoiceData.transactionDetails.id;
                    delete invoiceData.transactionDetails.id;
                }

                return response.status(200).json({ success: true, data: invoiceData });
            } else {
                return response.status(212).send(`An error occurred while fetching invoice details, please contact Administrator`);
            }
        } catch (err) {
            return response.status(212).send(`creating invoice error: ${err}`);
        }
    }

    @Post('/getInvoiceStatus')
    async getInvoiceStatus(
        @Body() invoiceBody,
        @Res() response: Response
    ): Promise<any> {
        try {
            let getInvoiceData = null;
            if (invoiceBody.invoiceId != null) {
                getInvoiceData = await this.invoiceService.getPaymentStatusByInvoiceId(invoiceBody.invoiceId);
            } else if (invoiceBody.registrationId != null) {
                let registration = await this.registrationService.findByRegistrationKey(invoiceBody.registrationId);
                getInvoiceData = await this.invoiceService.findByRegistrationId(registration.id);
            } else if (invoiceBody.userRegId != null) {
                let userRegistration = await this.userRegistrationService.findByRegistrationKey(invoiceBody.userRegId);
                getInvoiceData = await this.invoiceService.getPaymentStatusTeamIndividual(userRegistration.registrationId, userRegistration.userRegId);
            }

            if (isArrayPopulated(getInvoiceData)) {
                const invoiceId = getInvoiceData[0].id
                const transaction = await this.transactionService.getTransactionStatus(invoiceId);
                return response.status(200).json({
                    isNewUser: false, data: {
                        invoiceId,
                        transactionId: isArrayPopulated(transaction) ? transaction[0].id : null
                    }
                });
            } else {
                return response.status(200).send({ isNewUser: true, data: null });
            }
        } catch (err) {
            return response.status(212).send(`getting invoice status error: ${err}`);
        }
    }

    @Post('/createpayments')
    async createPayments(
        @Body() paymentBody,
        @Res() response: Response
    ): Promise<any> {
        try {
            let registrationUniqueKey = paymentBody.registrationId;
            let registration = await this.registrationService.findByRegistrationKey(registrationUniqueKey);
            let registrationId = registration.id;
            let registrationProduct = paymentBody.payload;

            let cardResponse = await this.checkCardDefault(registrationProduct, paymentBody);
            if (cardResponse != null) {
                return response.status(212).send(cardResponse);
            }

            let voucherRes = await this.performGovernmentVoucherRedeem(registrationProduct)
            if (voucherRes !== null) {
                return response.status(212).send(voucherRes)
            }

            await this.saveYoursInfo(registrationProduct.yourInfo, registration);
            const paidBy = registrationProduct.yourInfo.id;
            let invoice = await this.createOrUpdateInvoice(registration, AppConstants.registration, null);

            const PAYMENT_STATUS = invoice.paymentStatus;
            const INVOICE_ID = invoice.id
            let totalFee = 0;

            if (PAYMENT_STATUS === 'success') {
                return response.status(200).send({ success: true, message: "no need to pay, as its already paid" });
            } else if (PAYMENT_STATUS === 'pending') {
                return response.status(212).send({ success: true, message: "no need to pay, as its already paid" });
            } else {

                // insert Review Product into the track table
                await this.reviewProductTrackSave(registrationProduct, registration, RegistrationStep.RegistrationTrackStep, null, INVOICE_ID);

                const CURRENCY_TYPE: string = "aud";
                const REGISTRATION_ID: string = registrationId.toString();
                const STRIPE_EXTRA_CHARGES: number = 0; // TODO: needs discussion

                if (isArrayPopulated(registrationProduct.compParticipants)) {
                    let account = await this.checkOrganisationStripeAccount(registrationProduct);
                    if ((!account.membershipStripeAccountIdError) &&
                        (!account.competitionStripeAccountIdError) &&
                        (!account.affiliateStripeAccountIdError)) {
                        totalFee = feeIsNull(registrationProduct.total.targetValue);
                        if (totalFee == 0) {
                            totalFee = 1;
                        }
                        const TOTAL_FEE_STRIPE_PAY: number = formatFeeForStripe1(totalFee + STRIPE_EXTRA_CHARGES);

                        let paymentIntent = null;
                        if (paymentBody.paymentType != null) {
                            paymentIntent = await this.getStripePaymentIntent(
                                paymentBody, TOTAL_FEE_STRIPE_PAY, CURRENCY_TYPE, registration, paymentBody.paymentType,
                                AppConstants.registration, null, null, null, null
                            );
                        }

                        logger.info(`*****paymentIntent*********" ${JSON.stringify(paymentIntent)}`);

                        let transArr = [];
                        if (paymentBody.paymentType === AppConstants.directDebit) {
                            return response.status(200).send({
                                success: true,
                                clientSecret: paymentIntent.client_secret,
                                message: "PaymentIntent created successful",
                                totalFee: totalFee
                            });
                        } else if (paymentBody.paymentType === AppConstants.card) {
                            if (paymentIntent.status === "succeeded") {
                                this.updateInvoice(INVOICE_ID, AppConstants.pending);
                                await this.saveRegistrationInfo(registration, registrationProduct);
                                this.performCCInvoicePayment(
                                    registrationProduct, paymentIntent, CURRENCY_TYPE, registration, INVOICE_ID,
                                    paymentBody.paymentType, transArr, totalFee, paidBy, null
                                );
                            } else {
                                return response.status(212).send({
                                    success: false,
                                    message: "cannot create payment, an error occurred"
                                });
                            }
                        } else if (paymentBody.paymentType == null) {
                            logger.info(`School Registration`);
                            this.updateInvoice(INVOICE_ID, AppConstants.pending);
                            let transArr = [];
                            await this.saveRegistrationInfo(registration, registrationProduct);
                            this.performCCInvoicePayment(
                                registrationProduct, paymentIntent, CURRENCY_TYPE, registration, INVOICE_ID,
                                paymentBody.paymentType, transArr, totalFee, paidBy, null
                            );
                        }
                    } else {
                        let message: string = '';
                        if (account.membershipStripeAccountIdError && account.competitionStripeAccountIdError
                            && account.affiliateStripeAccountIdError) {
                            message = `Please contact ${account.membershipOrganisationName} & ${account.competitionOrganisationName} & ${account.affiliateOrganisationName} organisation regarding integration with Stripe`
                        } else if (account.membershipStripeAccountIdError && account.competitionStripeAccountIdError) {
                            message = `Please contact ${account.membershipOrganisationName} & ${account.competitionOrganisationName} organisation regarding integration with Stripe`
                        } else if (account.membershipStripeAccountIdError) {
                            message = `Please contact ${account.membershipOrganisationName} organisation regarding integration with Stripe`
                        } else {
                            message = `Please contact ${account.competitionOrganisationName} organisation regarding integration with Stripe`
                        }
                        return response.status(212).send({ success: false, message });
                    }
                } else {
                    return response.status(212).send({
                        success: false,
                        message: "cannot get invoice details, an error occurred"
                    });
                }

                return response.status(200).send({
                    success: true, message: "Payment successful", totalFee: totalFee,
                    clientSecret: null, invoiceId: INVOICE_ID
                });
            }
        } catch (err) {
            if (err.type === 'StripeCardError') {
                switch (err.code) {
                    case 'card_declined':
                        switch (err.decline_code) {
                            case 'insufficient_funds':
                                return response.status(400).json({success: false, message: AppConstants.cardDeclinedInsufficientFunds});
                            case 'lost_card':
                                return response.status(400).json({success: false, message: AppConstants.cardDeclinedLostCard});
                            case 'stolen_card':
                                return response.status(400).json({success: false, message: AppConstants.cardDeclinedStolenCard});
                            case 'generic_decline':
                                return response.status(400).json({success: false, message: AppConstants.cardGenericDecline});
                            default:
                                return response.status(400).json({success: false, message: AppConstants.cardDeclined});
                        }
                    case 'incorrect_cvc':
                        return response.status(400).json({success: false, message: AppConstants.incorrectCVC});
                    case 'expired_card':
                        return response.status(400).json({success: false, message: AppConstants.expiredCard});
                    case 'processing_error':
                        return response.status(400).json({success: false, message: AppConstants.cardProcessingError});
                    case 'incorrect_number': // unlikely, since this will not pass the frontend
                        return response.status(400).json({success: false, message: AppConstants.cardIncorrectNumber});
                    default:
                        return response.status(400).json({success: false, message: AppConstants.cardErrDefault});
                }
            }

            logger.error(`Exception occurred in Create Payments createPayments` + err);
            return response.status(500).send(`creating payment error: ${err}`);
        }
    }

    @Post('/createpayments/directdebit')
    async createPaymentsDD(
        @Body() paymentBody,
        @Res() response: Response
    ): Promise<any> {
        try {
            let registrationUniqueKey = paymentBody.registrationId;
            let registration = await this.registrationService.findByRegistrationKey(registrationUniqueKey);
            let registrationTrackData = await this.registrationTrackService.findByRegistrationId(registration.id, RegistrationStep.RegistrationTrackStep);
            let registrationProduct = registrationTrackData.jsonData;
            const invoiceId = registrationTrackData.invoiceId;
            let invoice = null;
            if (invoiceId) {
                invoice = await this.invoiceService.findById(invoiceId);
            } else {
                invoice = await this.invoiceService.findByRegistrationId(registration.id);
            }

            const PAYMENT_STATUS = invoice.paymentStatus;

            if (PAYMENT_STATUS === 'success') {
                return response.status(200).send({ success: true, message: "no need to pay, as its already paid" });
            } else if (PAYMENT_STATUS === 'pending') {
                return response.status(212).send({ success: true, message: "no need to pay, as its already paid" });
            } else {
                this.updateInvoice(invoiceId, AppConstants.pending);
            }

            await this.processPaymentForRegistrationDD(registrationUniqueKey, null);
            if (invoiceId) {
                const orders = await this.orderService.findOrderByInvoiceId(invoiceId);
                await orders.forEach(async (item) => {
                    if (item.paymentMethod === 'Direct debit') {
                        item.paymentStatus = '2';
                        await this.orderService.createOrUpdate(item);
                    }
                });
            }

            return response.status(200).send({ success: true, message: "Payment successful", clientSecret: null });
        } catch (err) {
            logger.error(`Exception occurred in createPaymentsDD ` + err);
            return response.status(500).send(`creating payment error: ${err}`);
        }
    }

    @Post('/createteampayments')
    async createTeamPayments(
        @Body() paymentBody,
        @Res() response: Response
    ): Promise<any> {
        try {
            let userRegId = paymentBody.userRegId;
            let userRegistration = await this.userRegistrationService.findByRegistrationKey(userRegId);
            let registration = await this.registrationService.findById(userRegistration.registrationId);
            let registrationId = registration.id;
            let registrationProduct = paymentBody.payload;
            if (paymentBody.paymentType === AppConstants.card) {
                let voucherRes = await this.performGovernmentVoucherRedeem(registrationProduct)
                if (voucherRes != null) {
                    return response.status(212).send(voucherRes)
                }
            }

            let yourInfo = registrationProduct.yourInfo;
            let paidBy = 0;
            if (yourInfo) {
                let createdByUser = await this.userService.findByEmail(yourInfo.email);
                if (createdByUser) {
                    registration.createdBy = createdByUser.id;
                    paidBy = createdByUser.id;
                    yourInfo["id"] = createdByUser.id;
                }
            } else {
                let createdByUserId = registrationProduct.compParticipants.find(x => x).userId;
                if (createdByUserId) {
                    paidBy = createdByUserId;
                }
            }

            let invoice = await this.createOrUpdateInvoice(registration, AppConstants.teamIndividual, userRegistration.userRegId);

            const PAYMENT_STATUS = invoice.paymentStatus;
            const INVOICE_ID = invoice.id

            if (PAYMENT_STATUS === 'success') {
                return response.status(200).send({ success: true, message: "no need to pay, as its already paid" });
            } else if (PAYMENT_STATUS === 'pending') {
                return response.status(212).send({ success: true, message: "no need to pay, as its already paid" });
            } else {
                // insert Review Product into the track table
                await this.reviewProductTrackSave(registrationProduct, registration, RegistrationStep.TeamInviteSuccessTrackStep, userRegistration.userRegId, INVOICE_ID);

                const CURRENCY_TYPE: string = "aud";
                const REGISTRATION_ID: string = registrationId.toString();
                const STRIPE_EXTRA_CHARGES: number = 0; // TODO: needs discussion

                if (isArrayPopulated(registrationProduct.compParticipants)) {
                    let account = await this.checkOrganisationStripeAccount(registrationProduct);
                    if ((!account.membershipStripeAccountIdError) &&
                        (!account.competitionStripeAccountIdError) &&
                        (!account.affiliateStripeAccountIdError)) {
                        let totalFee = feeIsNull(registrationProduct.total.targetValue);
                        if (totalFee == 0) {
                            totalFee = 1;
                        }
                        const TOTAL_FEE_STRIPE_PAY: number = formatFeeForStripe1(totalFee + STRIPE_EXTRA_CHARGES);

                        let paymentIntent = null;
                        if (paymentBody.paymentType != null) {
                            paymentIntent = await this.getStripePaymentIntent(
                                paymentBody, TOTAL_FEE_STRIPE_PAY, CURRENCY_TYPE, registration, paymentBody.paymentType,
                                AppConstants.teamIndividual, userRegistration, null, null, null
                            );
                        }

                        logger.info(`*****paymentIntent*********" ${JSON.stringify(paymentIntent)}`);

                        this.updateInvoice(INVOICE_ID, AppConstants.pending);

                        if (paymentBody.paymentType === AppConstants.directDebit || paymentBody.paymentType === AppConstants.cashDirectDebit) {
                            return response.status(200).send({
                                success: true,
                                clientSecret: paymentIntent.client_secret,
                                message: "PaymentIntent created successful"
                            });
                        } else if (paymentBody.paymentType === AppConstants.card || paymentBody.paymentType === AppConstants.cashCard) {
                            if (paymentIntent.status === "succeeded") {
                                if (feeIsNull(registrationProduct.total.targetValue) != 0) {
                                    let transferGroup = AppConstants.teamIndividual + "#" + userRegId;
                                    let transArr = await this.performInvoicePayment(
                                        registrationProduct, paymentIntent, CURRENCY_TYPE, registration, INVOICE_ID,
                                        transferGroup, AppConstants.teamIndividual, paymentBody.paymentType, paidBy
                                    );

                                    await this.createTransactions(transArr, registration, paidBy);

                                    await this.createInstalmentTransactions(registration, userRegistration.userRegId, RegistrationStep.TeamInviteInstalmentTrackStep, INVOICE_ID, paidBy);
                                    await this.performShopPayment(paymentIntent, registration, registrationProduct, INVOICE_ID, paymentBody.paymentType)
                                } else {
                                    await this.performTeamRegZeroTransaction(INVOICE_ID, registrationProduct, paidBy);
                                    await this.createInstalmentTransactions(registration, userRegistration.userRegId, RegistrationStep.TeamInviteInstalmentTrackStep, INVOICE_ID, paidBy);
                                }
                            } else {
                                return response.status(212).send({
                                    success: false,
                                    message: "cannot create payment, an error occurred"
                                });
                            }
                        } else if (paymentBody.paymentType == null) {
                            await this.performTeamRegZeroTransaction(INVOICE_ID, registrationProduct, paidBy);
                            await this.createInstalmentTransactions(registration, userRegistration.userRegId, RegistrationStep.TeamInviteInstalmentTrackStep, INVOICE_ID, paidBy);
                            await this.updateInvoice(INVOICE_ID, AppConstants.success);
                        }
                    } else {
                        let message: string = '';
                        if (account.membershipStripeAccountIdError && account.competitionStripeAccountIdError && account.affiliateStripeAccountIdError) {
                            message = `Please contact ${account.membershipOrganisationName} & ${account.competitionOrganisationName} & ${account.affiliateOrganisationName} organisation regarding integration with Stripe`
                        } else if (account.membershipStripeAccountIdError && account.competitionStripeAccountIdError) {
                            message = `Please contact ${account.membershipOrganisationName} & ${account.competitionOrganisationName} organisation regarding integration with Stripe`
                        } else if (account.membershipStripeAccountIdError) {
                            message = `Please contact ${account.membershipOrganisationName} organisation regarding integration with Stripe`
                        } else {
                            message = `Please contact ${account.competitionOrganisationName} organisation regarding integration with Stripe`
                        }
                        return response.status(212).send({ success: false, message });
                    }
                } else {
                    return response.status(212).send({
                        success: false,
                        message: "cannot get invoice details, an error occurred"
                    });
                }

                // Send Invoice Template
                let invoiceData = await this.getInvoiceData(registration, registrationProduct);

                let fileName = await this.invoiceService.printTeamRegistrationInvoiceTemplate(invoiceData);
                if (fileName != null) {
                    await this.individualMailForTeamReg(userRegistration.userRegId, userRegistration.userId, fileName)
                }
                return response.status(200).send({ success: true, message: "Payment successful" });
            }

            // let invoiceData = await this.getInvoiceData(registration);
            // let fileName = await this.invoiceService.printTeamRegistrationInvoiceTemplate(invoiceData);
            // return response.status(200).send(`Success: ` + fileName);
        } catch (err) {
            if (err.type === 'StripeCardError') {
                switch (err.code) {
                    case 'card_declined':
                        switch (err.decline_code) {
                            case 'insufficient_funds':
                                return response.status(400).json({success: false, message: AppConstants.cardDeclinedInsufficientFunds});
                            case 'lost_card':
                                return response.status(400).json({success: false, message: AppConstants.cardDeclinedLostCard});
                            case 'stolen_card':
                                return response.status(400).json({success: false, message: AppConstants.cardDeclinedStolenCard});
                            case 'generic_decline':
                                return response.status(400).json({success: false, message: AppConstants.cardGenericDecline});
                            default:
                                return response.status(400).json({success: false, message: AppConstants.cardDeclined});
                        }
                    case 'incorrect_cvc':
                        return response.status(400).json({success: false, message: AppConstants.incorrectCVC});
                    case 'expired_card':
                        return response.status(400).json({success: false, message: AppConstants.expiredCard});
                    case 'processing_error':
                        return response.status(400).json({success: false, message: AppConstants.cardProcessingError});
                    case 'incorrect_number': // unlikely, since this will not pass the frontend
                        return response.status(400).json({success: false, message: AppConstants.cardIncorrectNumber});
                    default:
                        return response.status(400).json({success: false, message: AppConstants.cardErrDefault});
                }
            }

            logger.error(`Exception occurred in Create Payments createTeamPayments` + err);
            return response.status(500).send(`creating payment error: ${err}`);
        }
    }

    @Post('/createteampayments/directdebit')
    async createTeamPaymentsDD(
        @Body() paymentBody,
        @Res() response: Response
    ): Promise<any> {
        try {
            let userRegId = paymentBody.userRegId;
            let userRegistration = await this.userRegistrationService.findByRegistrationKey(userRegId);
            let registration = await this.registrationService.findById(userRegistration.registrationId);
            let registrationTrackData = await this.registrationTrackService.findByRegistrationId(registration.id, RegistrationStep.RegistrationTrackStep);
            let registrationProduct = registrationTrackData.jsonData;
            const invoiceId = registrationTrackData.invoiceId;
            let voucherRes = await this.performGovernmentVoucherRedeem(registrationProduct);
            if (voucherRes != null) {
                return response.status(212).send(voucherRes)
            }
            await this.processTeamInvitePaymentForDD(userRegId);

            if (invoiceId) {
                const orders = await this.orderService.findOrderByInvoiceId(invoiceId);
                await orders.forEach(async (item) => {
                    if (item.paymentMethod === 'Direct debit') {
                        item.paymentStatus = '2';
                        await this.orderService.createOrUpdate(item);
                    }
                });
            }

            return response.status(200).send({ success: true, message: "Payment successful", clientSecret: null });
        } catch (err) {
            logger.error(`Exception occurred in Create Payments createTeamPaymentsDD` + err);
            return response.status(500).send(`creating payment error: ${err}`);
        }
    }

    @Post('/createsinglegame')
    async createSingleGamePayments(
        @Body() paymentBody,
        @Res() response: Response
    ): Promise<any> {
        try {
            let registrationUniqueKey = paymentBody.registrationId;
            let registration = await this.registrationService.findByRegistrationKey(registrationUniqueKey);
            let registrationId = registration.id;
            let registrationProduct = paymentBody.payload;
            await this.saveYoursInfo(registrationProduct.yourInfo, registration, AppConstants.singleGame);
            const matches = registrationProduct.total.noOfMatch;
            let paidBy = 0;

            let yourInfo = registrationProduct.yourInfo;
            if (yourInfo) {
                let createdByUser = await this.userService.findByEmail(yourInfo.email);
                if (createdByUser) {
                    registration.createdBy = createdByUser.id;
                    paidBy = createdByUser.id;
                }
            }

            let invoice = await this.createOrUpdateInvoice(registration, AppConstants.singleGame, null, matches);
            const PAYMENT_STATUS = invoice.paymentStatus;
            const INVOICE_ID = invoice.id
            let totalFee = 0;

            if (PAYMENT_STATUS === 'success') {
                return response.status(200).send({ success: true, message: "no need to pay, as its already paid" });
            } else if (PAYMENT_STATUS === 'pending') {
                return response.status(212).send({ success: true, message: "no need to pay, as its already paid" });
            } else {
                // insert Review Product into the track table
                await this.reviewProductTrackSave(registrationProduct, registration, RegistrationStep.RegistrationTrackStep, null, INVOICE_ID);

                const CURRENCY_TYPE: string = "aud";
                const STRIPE_EXTRA_CHARGES: number = 0; // TODO: needs discussion

                if (isArrayPopulated(registrationProduct.compParticipants)) {
                    let account = await this.checkOrganisationStripeAccount(registrationProduct);
                    if ((!account.membershipStripeAccountIdError) &&
                        (!account.competitionStripeAccountIdError) &&
                        (!account.affiliateStripeAccountIdError)) {
                        totalFee = feeIsNull(registrationProduct.total.targetValue);
                        if (totalFee == 0) {
                            totalFee = 1;
                        }

                        const TOTAL_FEE_STRIPE_PAY: number = formatFeeForStripe1(totalFee + STRIPE_EXTRA_CHARGES);

                        let paymentIntent = null;
                        if (paymentBody.paymentType != null) {
                            paymentIntent = await this.getStripePaymentIntent(
                                paymentBody, TOTAL_FEE_STRIPE_PAY, CURRENCY_TYPE, registration, paymentBody.paymentType,
                                AppConstants.singleGame, null, INVOICE_ID, null, null
                            );
                        }

                        logger.info(`*****paymentIntent*********" ${JSON.stringify(paymentIntent)}`);
                        this.updateInvoice(INVOICE_ID, AppConstants.pending);
                        let transArr = [];
                        if (paymentBody.paymentType === AppConstants.card || paymentBody.paymentType === AppConstants.cashCard) {
                            if (paymentIntent.status === "succeeded") {
                                if (totalFee > 0) {
                                    let transferGroup = AppConstants.singleGame + "#" + registration.registrationUniqueKey + "#" + INVOICE_ID;

                                    for (let i = 0; i < matches; i++) {
                                        let trans = await this.performInvoicePayment(
                                            registrationProduct, paymentIntent, CURRENCY_TYPE, registration, INVOICE_ID,
                                            transferGroup, AppConstants.singleGame, paymentBody.paymentType, paidBy
                                        );
                                        transArr.push(...trans);
                                    }
                                }
                                await this.createTransactions(transArr, registration, paidBy);
                            } else {
                                return response.status(212).send({
                                    success: false,
                                    message: "cannot create payment, an error occurred"
                                });
                            }
                        }
                    } else {
                        let message: string = '';
                        if (account.membershipStripeAccountIdError && account.competitionStripeAccountIdError && account.affiliateStripeAccountIdError) {
                            message = `Please contact ${account.membershipOrganisationName} & ${account.competitionOrganisationName} & ${account.affiliateOrganisationName} organisation regarding integration with Stripe`
                        } else if (account.membershipStripeAccountIdError && account.competitionStripeAccountIdError) {
                            message = `Please contact ${account.membershipOrganisationName} & ${account.competitionOrganisationName} organisation regarding integration with Stripe`
                        } else if (account.membershipStripeAccountIdError) {
                            message = `Please contact ${account.membershipOrganisationName} organisation regarding integration with Stripe`
                        } else {
                            message = `Please contact ${account.competitionOrganisationName} organisation regarding integration with Stripe`
                        }
                        return response.status(212).send({ success: false, message });
                    }
                } else {
                    return response.status(212).send({
                        success: false,
                        message: "cannot get invoice details, an error occurred"
                    });
                }

                return response.status(200).send({
                    success: true, message: "Payment successful", registrationId: registration.registrationUniqueKey,
                    clientSecret: null, invoiceId: INVOICE_ID
                });
            }
        } catch (err) {
            logger.error(`Exception occurred in Create Payments createSingleGamePayments ` + err);
            return response.status(500).send(`creating payment error: ${err}`);
        }
    }

    @Post('/createpermatchpayments')
    async createPerMatchPayments(
        @Body() paymentBody,
        @Res() response: Response
    ): Promise<any> {
        try {
            logger.info("Inside the createPerMatchPayments RegistrationId " + JSON.stringify(paymentBody.registrationId));
            let registrationUniqueKey = paymentBody.registrationId;
            let registration = await this.registrationService.findByRegistrationKey(registrationUniqueKey);
            let invoiceId = paymentBody.invoiceId;
            let subPaymentType = paymentBody.subPaymentType;
            let invoice = await this.invoiceService.findById(invoiceId);
            const CURRENCY_TYPE: string = "aud";
            let paymentType = invoice.paymentType;

            logger.info("createPerMatchPayments invoice" + JSON.stringify(invoice));

            if (subPaymentType == AppConstants.card) {
                if (!invoice.stripeSourceTransaction) {
                    const TOTAL_FEE_STRIPE_PAY: number = formatFeeForStripe1(1);
                    await this.getStripePaymentIntent(
                        paymentBody, TOTAL_FEE_STRIPE_PAY, CURRENCY_TYPE, registration, paymentType,
                        AppConstants.registration, null, null, subPaymentType, null
                    );
                }
            } else {
                invoice.subPaymentType = AppConstants.cash;
                await this.invoiceService.createOrUpdate(invoice);
            }

            return response.status(200).send({
                success: true, message: "Payment successful", totalFee: 1,
                clientSecret: null
            });
        } catch (err) {
            if (err.type === 'StripeCardError') {
                switch (err.code) {
                    case 'card_declined':
                        switch (err.decline_code) {
                            case 'insufficient_funds':
                                return response.status(400).json({success: false, message: AppConstants.cardDeclinedInsufficientFunds});
                            case 'lost_card':
                                return response.status(400).json({success: false, message: AppConstants.cardDeclinedLostCard});
                            case 'stolen_card':
                                return response.status(400).json({success: false, message: AppConstants.cardDeclinedStolenCard});
                            case 'generic_decline':
                                return response.status(400).json({success: false, message: AppConstants.cardGenericDecline});
                            default:
                                return response.status(400).json({success: false, message: AppConstants.cardDeclined});
                        }
                    case 'incorrect_cvc':
                        return response.status(400).json({success: false, message: AppConstants.incorrectCVC});
                    case 'expired_card':
                        return response.status(400).json({success: false, message: AppConstants.expiredCard});
                    case 'processing_error':
                        return response.status(400).json({success: false, message: AppConstants.cardProcessingError});
                    case 'incorrect_number': // unlikely, since this will not pass the frontend
                        return response.status(400).json({success: false, message: AppConstants.cardIncorrectNumber});
                    default:
                        return response.status(400).json({success: false, message: AppConstants.cardErrDefault});
                }
            }

            logger.error(`Exception occurred in createPerMatchPayments ` + err);
            return response.status(500).send(`CreatePerMatchPayments Error: ${err}`);
        }
    }

    @Post('/createteammemberpayments')
    async createTeamMemberPayments(
        @Body() paymentBody,
        @Res() response: Response
    ): Promise<any> {
        try {
            logger.info("Inside the Create Team Member Payments RegistrationId " + JSON.stringify(paymentBody.registrationId));
            let registrationUniqueKey = paymentBody.registrationId;
            let registration = await this.registrationService.findByRegistrationKey(registrationUniqueKey);
            let registrationId = registration.id;
            let registrationProduct = paymentBody.payload;
            let teamMemberRegId = paymentBody.teamMemberRegId;
            await this.saveYoursInfo(registrationProduct.yourInfo, registration);
            const paidBy = registrationProduct.yourInfo.id;
            let invoice = await this.createOrUpdateInvoice(registration, AppConstants.teamMemberRegistration, null, null, teamMemberRegId);

            const PAYMENT_STATUS = invoice.paymentStatus;
            const INVOICE_ID = invoice.id
            let totalFee = 0;

            if (PAYMENT_STATUS === 'success') {
                return response.status(200).send({ success: true, message: "no need to pay, as its already paid" });
            } else if (PAYMENT_STATUS === 'pending') {
                return response.status(212).send({ success: true, message: "no need to pay, as its already paid" });
            } else {
                // insert Review Product into the track table
                await this.reviewProductTrackSave(registrationProduct, registration, RegistrationStep.TeamMemberRegistrationTrackStep, null, INVOICE_ID, teamMemberRegId);

                const CURRENCY_TYPE: string = "aud";
                const REGISTRATION_ID: string = registrationId.toString();
                const STRIPE_EXTRA_CHARGES: number = 0; // TODO: needs discussion

                if (isArrayPopulated(registrationProduct.compParticipants)) {
                    let account = await this.checkOrganisationStripeAccount(registrationProduct);
                    if ((!account.membershipStripeAccountIdError) &&
                        (!account.competitionStripeAccountIdError) &&
                        (!account.affiliateStripeAccountIdError)) {
                        totalFee = feeIsNull(registrationProduct.total.targetValue);
                        if (totalFee == 0) {
                            totalFee = 1;
                        }
                        const TOTAL_FEE_STRIPE_PAY: number = formatFeeForStripe1(totalFee + STRIPE_EXTRA_CHARGES);

                        let paymentIntent = null;
                        if (paymentBody.paymentType != null) {
                            paymentIntent = await this.getStripePaymentIntent(
                                paymentBody, TOTAL_FEE_STRIPE_PAY, CURRENCY_TYPE, registration, paymentBody.paymentType,
                                AppConstants.teamMemberRegistration, null, null, null, teamMemberRegId
                            );
                        }

                        logger.info(`*****paymentIntent*********" ${JSON.stringify(paymentIntent)}`);
                        this.updateInvoice(INVOICE_ID, AppConstants.pending);
                        let transArr = [];
                        if (paymentBody.paymentType === AppConstants.directDebit) {
                            return response.status(200).send({
                                success: true,
                                clientSecret: paymentIntent.client_secret,
                                message: "PaymentIntent created successful",
                                totalFee: totalFee
                            });
                        } else if (paymentBody.paymentType === AppConstants.card) {
                            if (paymentIntent.status === "succeeded") {
                                await this.saveTeamMembersInfo(registration, teamMemberRegId);
                                this.performCCInvoicePayment(
                                    registrationProduct, paymentIntent, CURRENCY_TYPE, registration, INVOICE_ID,
                                    paymentBody.paymentType, transArr, totalFee, paidBy, teamMemberRegId
                                );

                                // await this.performPaymentOperation(registrationProduct, registration, INVOICE_ID, transArr, totalFee, paymentIntent, paymentBody.paymentType, paidBy);
                            } else {
                                return response.status(212).send({
                                    success: false,
                                    message: "cannot create payment, an error occurred"
                                });
                            }
                        } else if (paymentBody.paymentType == null) {
                            logger.info(`School Registration`);
                            let transArr = [];
                            await this.saveTeamMembersInfo(registration, teamMemberRegId);
                            this.performCCInvoicePayment(
                                registrationProduct, paymentIntent, CURRENCY_TYPE, registration, INVOICE_ID,
                                paymentBody.paymentType, transArr, totalFee, paidBy, teamMemberRegId
                            );

                            // if (paymentBody.isSchoolRegistration == 1 || paymentBody.isHardshipEnabled == 1) {
                            //     transArr = await this.performSchoolOrHardshipInvoicePayment(registrationProduct, registration, INVOICE_ID);
                            // }

                            // await this.saveRegistrationInfo(registration, registrationProduct);
                            // await this.createTransactions(transArr, registration, paidBy);
                            // await this.performHardshipUpdate(registrationProduct, registration);
                            // await this.invoiceService.updatePaymentStatusByRegistrationID(registration.id);
                            // this.registrationMail(registration, registrationProduct,1, INVOICE_ID)
                        }
                    } else {
                        let message: string = '';
                        if (account.membershipStripeAccountIdError && account.competitionStripeAccountIdError && account.affiliateStripeAccountIdError) {
                            message = `Please contact ${account.membershipOrganisationName} & ${account.competitionOrganisationName} & ${account.affiliateOrganisationName} organisation regarding integration with Stripe`
                        } else if (account.membershipStripeAccountIdError && account.competitionStripeAccountIdError) {
                            message = `Please contact ${account.membershipOrganisationName} & ${account.competitionOrganisationName} organisation regarding integration with Stripe`
                        } else if (account.membershipStripeAccountIdError) {
                            message = `Please contact ${account.membershipOrganisationName} organisation regarding integration with Stripe`
                        } else {
                            message = `Please contact ${account.competitionOrganisationName} organisation regarding integration with Stripe`
                        }
                        return response.status(212).send({ success: false, message });
                    }
                } else {
                    return response.status(212).send({
                        success: false,
                        message: "cannot get invoice details, an error occurred"
                    });
                }

                return response.status(200).send({
                    success: true, message: "Payment successful", totalFee: totalFee,
                    clientSecret: null, invoiceId: INVOICE_ID
                });
            }

            // let invoiceData = await this.getInvoiceData(registration);
            // let fileName = await this.invoiceService.printTeamRegistrationInvoiceTemplate(invoiceData);
            // return response.status(200).send(`Success: ` + fileName);
        } catch (err) {
            if (err.type === 'StripeCardError') {
                switch (err.code) {
                    case 'card_declined':
                        switch (err.decline_code) {
                            case 'insufficient_funds':
                                return response.status(400).json({success: false, message: AppConstants.cardDeclinedInsufficientFunds});
                            case 'lost_card':
                                return response.status(400).json({success: false, message: AppConstants.cardDeclinedLostCard});
                            case 'stolen_card':
                                return response.status(400).json({success: false, message: AppConstants.cardDeclinedStolenCard});
                            case 'generic_decline':
                                return response.status(400).json({success: false, message: AppConstants.cardGenericDecline});
                            default:
                                return response.status(400).json({success: false, message: AppConstants.cardDeclined});
                        }
                    case 'incorrect_cvc':
                        return response.status(400).json({success: false, message: AppConstants.incorrectCVC});
                    case 'expired_card':
                        return response.status(400).json({success: false, message: AppConstants.expiredCard});
                    case 'processing_error':
                        return response.status(400).json({success: false, message: AppConstants.cardProcessingError});
                    case 'incorrect_number': // unlikely, since this will not pass the frontend
                        return response.status(400).json({success: false, message: AppConstants.cardIncorrectNumber});
                    default:
                        return response.status(400).json({success: false, message: AppConstants.cardErrDefault});
                }
            }

            logger.error(`Exception occurred in Create team members Payments ` + err);
            return response.status(500).send(`creating team members payment error: ${err}`);
        }
    }

    @Post('/createteammemberpayments/directdebit')
    async createTeamMemberPaymentsDD(
        @Body() paymentBody,
        @Res() response: Response
    ): Promise<any> {
        try {
            logger.info("Inside the Create Team Member Payments DD RegistrationId " + JSON.stringify(paymentBody.registrationId));
            let registrationUniqueKey = paymentBody.registrationId;
            let registration = await this.registrationService.findByRegistrationKey(registrationUniqueKey);
            let teamMemberRegId = paymentBody.teamMemberRegId;
            let registrationTrackData = await this.registrationTrackService.findByteamMemberRegId(registration.id, RegistrationStep.TeamMemberRegistrationTrackStep, teamMemberRegId);
            let registrationProduct = registrationTrackData.jsonData;
            let invoice = await this.createOrUpdateInvoice(registration, AppConstants.teamMemberRegistration, null, null, teamMemberRegId);
            // let voucherRes = await this.performGovernmentVoucherRedeem(registrationProduct)
            // if (voucherRes != null) {
            //     return response.status(212).send(voucherRes)
            // }
            await this.processPaymentForRegistrationDD(registrationUniqueKey, teamMemberRegId);
            if (invoice.id) {
                const orders = await this.orderService.findOrderByInvoiceId(invoice.id);
                await orders.forEach(async (item) => {
                    if (item.paymentMethod === 'Direct debit') {
                        item.paymentStatus = '2';
                        await this.orderService.createOrUpdate(item);
                    }
                });
            }
            return response.status(200).send({ success: true, message: "Payment successful", clientSecret: null });
        } catch (err) {
            logger.error(`Exception occurred in Create team members Payments ` + err);
            return response.status(500).send(`creating team members payment error: ${err}`);
        }
    }

    @Authorized()
    @Post('/transactions')
    async transactionsListing(
        @Body() listingBody: PaymentTransactionsListingRequest,
        @QueryParam('sortBy') sortBy: string = undefined,
        @QueryParam('search') search: string = undefined,
        @QueryParam('sortOrder') sortOrder: 'ASC' | 'DESC' = undefined,
        @Res() response: Response
    ): Promise<any> {
        try {
            const foundOrganisation = await this.organisationService.findOrganisationByUniqueKey(listingBody.organisationUniqueKey);

            if (isArrayPopulated(foundOrganisation)) {
                const ORGANISATION_ID = foundOrganisation[0].id;
                const LIMIT = listingBody.paging.limit;
                const OFFSET = listingBody.paging.offset;
                const userId = listingBody.userId;
                const registrationId = listingBody.registrationId;
                const yearId = listingBody.yearId;
                const competitionKey = listingBody.competitionKey;
                const paymentFor = listingBody.paymentFor;
                const dateFrom = listingBody.dateFrom;
                const dateTo = listingBody.dateTo;
                const feeTypeRefId = listingBody.feeTypeRefId;
                const paymentOption = listingBody.paymentOption;
                const paymentMethod = listingBody.paymentMethod;
                const membershipType = listingBody.membershipType;
                const paymentStatus = listingBody.paymentStatus;
                const discountMethod = listingBody.discountMethod;

                const getResult = await this.transactionService.getPaymentTransactionList(
                    ORGANISATION_ID,
                    OFFSET,
                    LIMIT,
                    userId,
                    registrationId,
                    sortBy,
                    sortOrder,
                    yearId,
                    competitionKey,
                    paymentFor,
                    dateFrom,
                    dateTo,
                    search,
                    feeTypeRefId,
                    paymentOption,
                    paymentMethod,
                    membershipType,
                    paymentStatus,
                    discountMethod
                );

                let responseObject = paginationData(stringTONumber(getResult.count), LIMIT, OFFSET);
                responseObject["transactions"] = getResult.data;
                responseObject["competitionList"] = getResult.competitionList;

                return response.status(200).send(responseObject);
            } else {
                return response.status(212).send({
                    message: "cannot find the organisation with the provided ID"
                });
            }
        } catch (err) {
            return response.status(400).send(`getting transactions list Error: ${err}`);
        }
    }

    @Authorized()
    @Get('/mailParticipantRegistration')
    async mailParticipantRegistration(
        @QueryParam('registrationId') registrationId: number,
        @HeaderParam("authorization") currentUser: User,
        @Res() response: Response
    ) {
        try {
            let invoiceRecieverType = await this.invoiceRecieverType(registrationId)
            await this.mailToParticipant(registrationId, currentUser.id, 'invoice', invoiceRecieverType)
            return response.status(200).send("Success")
        } catch (error) {
            return response.status(500).send({
                message: process.env.NODE_ENV == AppConstants.development ? 'Something went wrong. Please contact administrator' + error : 'Something went wrong. Please contact administrator'
            });
        }
    }

    @Authorized()
    @Get('/mailForTeamRegistration')
    async mailtoTeamRegistration(
        @QueryParam('registrationId') registrationId: number,
        @HeaderParam("authorization") currentUser: User,
        @Res() response: Response
    ) {
        try {
            // let invoiceReciever = await this.invoiceRecieverType(registrationId)
            let registrationTrackData = await this.registrationTrackService.findByRegistrationId(registrationId, RegistrationStep.RegistrationTrackStep);
            let registrationTrackJson = registrationTrackData.jsonData;
            let registration = await this.registrationService.findById(registrationId)
            // let invoiceData = await this.getInvoiceData(registration, registrationTrackJson);
            // let futureInstalments = [];
            let INVOICE_ID = await this.invoiceService.findByRegistrationId(registration.id);
            // let fileName = await this.invoiceService.printTeamRegistrationInvoiceTemplate(invoiceData);
            await this.registrationMail(registration, registrationTrackJson, 1, INVOICE_ID)

            // await this.mailForTeamRegistration(registrationId, currentUser.id, fileName, invoiceReciever, futureInstalments)
            return response.status(200).send("Success")
        } catch (error) {
            return response.status(500).send({
                message: process.env.NODE_ENV == AppConstants.development ? 'Something went wrong. Please contact administrator' + error : 'Something went wrong. Please contact administrator'
            });
        }
    }

    @Authorized()
    @Get('/mailFriendRegistration')
    async mailFriendRegistration(
        @QueryParam('registrationId') registrationId: number,
        @HeaderParam("authorization") currentUser: User,
        @Res() response: Response
    ) {
        try {
            // let invoiceReciever = await this.invoiceRecieverType(registrationId)
            let friendArray = await this.friendService.findByRegistrationId(registrationId)

            if (isArrayPopulated(friendArray)) {
                await this.mailToReferFriend(registrationId, friendArray, currentUser.id)
            }
            return response.status(200).send("Success")
        } catch (error) {
            return response.status(500).send({
                message: process.env.NODE_ENV == AppConstants.development ? 'Something went wrong. Please contact administrator' + error : 'Something went wrong. Please contact administrator'
            });
        }
    }

    //@Authorized()
    @Get('/mailForPaymentProccessing')
    async mailForPaymentProccessing(
        @QueryParam('registrationId') registrationId: number,
        // @HeaderParam("authorization") currentUser: User,
        @Res() response: Response
    ) {
        try {
            // const paymentIntent = await stripe.paymentIntents.create({
            //     amount: 100,
            //     currency: 'aud',
            //     payment_method_types: ['card'],
            //     on_behalf_of: "acct_1HNH1mAYocsoAgBP",
            //     transfer_data: {
            //         destination: "acct_1HCO7fCgnM79C4D7",
            //     },
            // });

            const currency = 'aud';
            let paymentIntent = await stripe.paymentIntents.create({
                amount: 1000,
                currency: 'aud',
                payment_method_types: ["au_becs_debit"],
                customer: "cus_IcS2fUdZlTWqee",
                payment_method: "pm_1I1D8rEnewRwSTgn31dFkK29",
                confirm: true,
                on_behalf_of: "acct_1HNH1mAYocsoAgBP",
                mandate_data: {
                    customer_acceptance: {
                        type: "offline",
                    },
                },
                transfer_data: {
                    destination: "acct_1HNH1mAYocsoAgBP",
                },
            });

            // acct_1HNH1mAYocsoAgBP
            // await this.mailForDirectDebitPayment(registrationId , currentUser.id, currentUser,0);
            return response.status(200).send("Success");
        } catch (error) {
            throw error
        }
    }

    @Authorized()
    @Post('/transactions/export')
    async exportPayoutTransaction(
        @Body() listingBody: PayoutTransactionExportRequest,
        @Res() response: Response
    ): Promise<any> {
        try {
            const foundOrganisation = await this.organisationService.findOrganisationByUniqueKey(listingBody.organisationUniqueKey);

            if (isArrayPopulated(foundOrganisation)) {
                const stripeAccountId = foundOrganisation[0].stripeAccountID;

                let ListingObject = Object.assign({});
                ListingObject.limit = 100;

                ListingObject["include[]"] = "total_count";
                ListingObject['payout'] = listingBody.payoutId;
                ListingObject['expand'] = ["data.source.source_transfer"];

                const resultArray = [];
                let hasMore = false;
                let totalCount = 0;
                do {
                    const responseData = await stripe.balanceTransactions.list(ListingObject, { stripeAccount: stripeAccountId });

                    resultArray.push(...responseData.data);
                    hasMore = responseData.has_more;
                    totalCount = responseData['total_count'];

                    if (hasMore) {
                        let i = 0;
                        let lastElem = responseData.data.pop();
                        ListingObject.starting_after = null;
                        while (i < 3) {
                            if (!lastElem) {
                                break;
                            }

                            if (lastElem.id) {
                                ListingObject.starting_after = lastElem.id;
                                break;
                            }

                            lastElem = responseData.data.pop();
                            i++;
                        }
                    }
                } while (hasMore)

                // const transfersDetailsForEachPayout = await stripe.balanceTransactions.list(ListingObject, { stripe_account: stripeAccountId });
                const payoutTransferArray = resultArray.filter(e => e.type === "payment");
                let mappedPayoutTransferArray = []
                if (isArrayPopulated(payoutTransferArray)) {
                    mappedPayoutTransferArray = payoutTransferArray.map(transaction => {
                        const item = {};
                        item['Transaction Id'] = transaction.id;
                        item['Description'] = transaction.source.source_transfer.description;
                        item['Date'] = moment(transaction.created * 1000).format("DD/MM/YYYY");
                        item['Amount'] = currencyFormat(transaction.amount / 100);
                        item['Status'] = transaction.status;
                        item['Source Transfer Id'] = transaction.source.source_transfer.id;
                        return item;
                    });
                } else {
                    mappedPayoutTransferArray.push({
                        'Transaction Id': 'N/A',
                        'Description': 'N/A',
                        'Date': 'N/A',
                        'Amount': 'N/A',
                        'Status': 'N/A',
                        'Source Transfer Id': 'N/A',
                    });
                }

                const current = new Date().toISOString();
                mappedPayoutTransferArray.forEach((item) => {
                    this.payoutTransactionService.save({
                        organisationUniqueKey: listingBody.organisationUniqueKey,
                        transactionId: item['Transaction Id'],
                        payoutId: listingBody.payoutId,
                        description: item['Description'],
                        date: item['Date'],
                        amount: item['Amount'],
                        status: item['Status'],
                        sourceTransferId: item['Source Transfer Id'],
                        createdOn: current,
                    });
                });

                response.setHeader('Content-disposition', `attachment; filename=payment-transaction.csv`);
                response.setHeader('content-type', 'text/csv');
                fastcsv.write(mappedPayoutTransferArray, { headers: true })
                    .on("finish", function () {
                    })
                    .pipe(response);
            } else {
                return response.status(212).send({
                    message: "cannot find the organisation with the provided ID"
                });
            }
        } catch (err) {
            return response.status(400).send(`getting payoutTransfer list Error: ${err}`);
        }
    }

    @Authorized()
    @Post('/dashboard/export')
    async exportPaymentDashBoard(
        @Body() listingBody: PaymentTransactionsListingRequest,
        @QueryParam('sortBy') sortBy: string = undefined,
        @QueryParam('search') search: string = undefined,
        @QueryParam('sortOrder') sortOrder: 'ASC' | 'DESC' = undefined,
        @QueryParam("organisationUniqueKey", { required: true }) organisationUniqueKey: string,
        @Res() response: Response
    ): Promise<any> {
        try {
            const foundOrganisation = await this.organisationService.findOrganisationByUniqueKey(organisationUniqueKey);
            if (isArrayPopulated(foundOrganisation)) {
                const ORGANISATION_ID = foundOrganisation[0].id;

                const LIMIT = null;
                const OFFSET = null;
                const userId = listingBody.userId;
                const registrationId = listingBody.registrationId;
                const yearId = listingBody.yearId;
                const competitionKey = listingBody.competitionKey;
                const paymentFor = listingBody.paymentFor;
                const dateFrom = listingBody.dateFrom;
                const dateTo = listingBody.dateTo;
                const feeTypeRefId = listingBody.feeTypeRefId;
                const paymentOption = listingBody.paymentOption;
                const paymentMethod = listingBody.paymentMethod;
                const membershipType = listingBody.membershipType;
                const discountMethod = listingBody.discountMethod;

                const getTransactionsResult = await this.transactionService.getPaymentTransactionList(
                    ORGANISATION_ID, OFFSET,
                    LIMIT,
                    userId,
                    registrationId,
                    sortBy,
                    sortOrder,
                    yearId,
                    competitionKey,
                    paymentFor,
                    dateFrom,
                    dateTo,
                    search,
                    feeTypeRefId,
                    paymentOption,
                    paymentMethod,
                    membershipType,
                    discountMethod
                );
                let mappedTransactions = [];

                if (isArrayPopulated(getTransactionsResult.data)) {
                    mappedTransactions = getTransactionsResult.data.map(transaction => ({
                        'Name': transaction['userFirstName'] + ' ' + transaction['userLastName'],
                        'Paid by': transaction['paidBy'] === null ? 'N/A' : transaction['paidBy'],
                        'Organisation': transaction['affiliateName'] === null ? 'N/A' : transaction['affiliateName'],
                        'Competition': transaction['competitionName'] === null ? 'N/A' : transaction['competitionName'],
                        'Fee Type': transaction['feeType'],
                        'Payment Type': transaction['paymentType'],
                        'Membership Type': transaction['membershipTypeName'],
                        'Total Fee (inc GST)': '$' + transaction['invoiceTotal'],
                        'Portion': '$' + transaction['affiliatePortion'],
                        'Payment Method': transaction['paymentMethod'],
                        'Status': transaction['paymentStatus'] === 'success' ? 'Paid' : (transaction['paymentStatus'] === 'pending' ? 'Not Paid' : ''),
                    }));
                } else {
                    mappedTransactions.push({
                        'Name': 'N/A',
                        'Paid by': 'N/A',
                        'Organisation': 'N/A',
                        'Competition': 'N/A',
                        'Fee Type': 'N/A',
                        'Payment Type': 'N/A',
                        'Membership Type': 'N/A',
                        'Total Fee (inc GST)': 'N/A',
                        'Portion': 'N/A',
                        'Payment Method': 'N/A',
                        'Status': 'N/A',
                    });
                }

                response.setHeader('Content-disposition', 'attachment; filename=payment-dashboard.csv');
                response.setHeader('content-type', 'text/csv');
                fastcsv.write(mappedTransactions, { headers: true })
                    .on("finish", function () {
                    })
                    .pipe(response);
            } else {
                return response.status(212).send({
                    message: "cannot find the organisation with the provided ID"
                });
            }
        } catch (err) {
            return response.status(400).send(`getting transactions list Error: ${err}`);
        }
    }

    @Authorized()
    @Post('/gateway/export')
    async exportPaymentGateway(
        @Body() listingBody: RegistrationPaymentRequest,
        @QueryParam("organisationUniqueKey", { required: true }) organisationUniqueKey: string,
        @QueryParam("type", { required: true }) type: string,
        @Res() response: Response
    ): Promise<any> {
        try {
            const { year, dateFrom, dateTo } = listingBody;
            const ListingObject = Object.assign({});
            ListingObject.organisationUniqueKey = organisationUniqueKey;
            ListingObject.type = type;
            const pagingObject = Object.assign({});
            pagingObject.ending_before = null
            pagingObject.starting_after = null
            pagingObject.limit = 100;
            if (year) {
                const yearStartInMs = new Date(`${year}`).getTime()
                const yearEndInMs = new Date(`${year + 1}`).getTime()
                const yearEnd = parseInt(`${yearEndInMs / 1000}`) // Division by 1000 to convert it to unix timestamp
                const yearStart = parseInt(`${yearStartInMs / 1000}`)

                ListingObject.created = {
                    lt: yearEnd, // Less then first second of next year
                    gte: yearStart // More than or equal to first second of select year
                }
            } else if (dateFrom || dateTo) {
                ListingObject.created = {}

                if (dateFrom) {
                    const startDateInMs = new Date(dateFrom).getTime()
                    ListingObject.created.gte = parseInt(`${startDateInMs / 1000}`)
                }
                if (dateTo) {
                    const endDateInMs = new Date(dateTo).getTime()
                    ListingObject.created.lte = parseInt(`${endDateInMs / 1000}`)
                }
            }
            // https://stripe.com/docs/api/transfers/list#list_transfers-limit
            // default limit is 10 in stripe transfer/payout listing if limit is not sent. passed static limit of max 50000

            ListingObject.paging = pagingObject;

            const foundOrganisation = await this.organisationService.findOrganisationByUniqueKey(ListingObject.organisationUniqueKey);
            if (isArrayPopulated(foundOrganisation)) {
                const stripeAccountId = foundOrganisation[0].stripeAccountID;
                const resultArray = [];
                let hasMore = false;
                do {
                    const getPaymentGatewayData = await this.getTransfersListing(ListingObject, stripeAccountId);
                    resultArray.push(...getPaymentGatewayData[type === 'payout' ? 'payouts' : 'transfers']);
                    hasMore = getPaymentGatewayData.hasmore;

                    if (hasMore) {
                        const lastElem = getPaymentGatewayData[type === 'payout' ? 'payouts' : 'transfers'].pop();
                        ListingObject.paging.starting_after = lastElem ? lastElem.id : null;
                    }
                } while (hasMore)
                let mappedPaymentGatewayData = [];
                if (type === 'payout') {
                    if (isArrayPopulated(resultArray)) {
                        mappedPaymentGatewayData = resultArray.map(transaction => {
                            return {
                                'Payout Id': transaction['id'],
                                'Transaction Id': transaction['balance_transaction'],
                                'Description': transaction['description'],
                                'Date (AEST)': formatDateAEST(transaction['created']),
                                'Amount': '$' + transaction['amount'],
                                'Status': transaction['status'],
                            }
                        })
                    } else {
                        mappedPaymentGatewayData.push({
                            'Payout Id': 'N/A',
                            'Transaction Id': 'N/A',
                            'Description': 'N/A',
                            'Date (AEST)': 'N/A',
                            'Amount': 'N/A',
                            'Status': 'N/A'
                        });
                    }
                } else if (type === 'transfer') {
                    if (isArrayPopulated(resultArray)) {
                        mappedPaymentGatewayData = resultArray.map(transaction => {
                            return {
                                'Transfer Id': transaction['id'],
                                'Transaction Id': transaction['balance_transaction'],
                                'Description': transaction['description'],
                                'Date (AEST)': formatDateAEST(transaction['created']),
                                'Amount': '$' + transaction['amount'],
                            }
                        })
                    } else {
                        mappedPaymentGatewayData.push({
                            'Transfer Id': 'N/A',
                            'Transaction Id': 'N/A',
                            'Description': 'N/A',
                            'Date (AEST)': 'N/A',
                            'Amount': 'N/A'
                        });
                    }
                }

                response.setHeader('Content-disposition', `attachment; filename=payment-${type}.csv`);
                response.setHeader('content-type', 'text/csv');
                fastcsv.write(mappedPaymentGatewayData, { headers: true })
                    .on("finish", function () {
                    })
                    .pipe(response);
            } else {
                return response.status(212).send({
                    message: "cannot find the organisation with the provided ID"
                });
            }
        } catch (error) {

        }
    }

    @Authorized()
    @Post('/regitrations/retry')
    async retryFailedRegistrationPayment(
        @Body() paymentBody,
        @Res() response: Response
    ) {
        try {
            logger.info(`Inside the retryFailedRegistrationPayment ${paymentBody.registrationId}`)
            if (paymentBody && paymentBody.registrationId) {
                let result = await this.processPaymentForWebHookIntentSucceed(paymentBody.registrationId, true);
                logger.info("result::" + JSON.stringify(result));
                if(result.success){
                    return response.status(200).send({message: "Retry Registration Successfully"});
                }
                else{
                    return response.status(212).send({message: result.message});
                }

            } else {
                return response.status(212).send('Please provide valid input');
            }
        } catch (error) {
            if (error.type === 'StripeCardError') {
                switch (error.code) {
                    case 'processing_error':
                    case 'expired_card':
                    case 'card_declined': // with declination due to fraudulent, this is the code that returns
                    case 'incorrect_number': // unlikely, since this will not pass the frontend
                    case 'incorrect_cvc':
                    default:
                        return response.status(212).json({ success: false, message: AppConstants.cardErrDefault });
                }
            }
            else if(error.type === 'StripeInvalidRequestError'){
                return response.status(212).json({ success: false, message: AppConstants.cardErrDefault });
            }

            logger.error(`Exception occured in retryFailedRegistrationPayment in Payment Controller ${error}`);
            return response.status(500).send({
                message: process.env.NODE_ENV == AppConstants.development ? AppConstants.errMessage + error : AppConstants.errMessage
            });
        }
    }

    private async updateInvoice(invoiceId, paymentStatus) {
        try {
            let invoice = new Invoice()
            invoice.id = invoiceId;
            invoice.paymentStatus = paymentStatus;
            await this.invoiceService.createOrUpdate(invoice);
        } catch (error) {
            logger.error(`Exception occurred in updateInvoice ${error}`);
            throw error;
        }
    }

    private async performTeamRegZeroTransaction(invoiceId, registrationProduct, userId) {
        for (let item of registrationProduct) {
            let paymentOptionRefId = item.selectedOptions.paymentOptionRefId;
            let paymentFeeTypeRefId = this.getPaymentFeeTypeRefId(paymentOptionRefId, item.isTeamRegistration);

            if (isArrayPopulated(item.membershipProducts)) {
                for (let mem of item.membershipProducts) {
                    const membershipData = isNotNullAndUndefined(mem.fees.membershipFee) ? mem.fees.membershipFee : Object.assign({});
                    const compOrgData = isNotNullAndUndefined(mem.fees.competitionOrganisorFee) ? mem.fees.competitionOrganisorFee : Object.assign({});
                    const affiliateData = isNotNullAndUndefined(mem.fees.affiliateFee) ? mem.fees.affiliateFee : Object.assign({});

                    if (objectIsNotEmpty(membershipData)) {
                        if (membershipData.transactionId)
                            await this.updateTransaction(invoiceId, paymentFeeTypeRefId, paymentOptionRefId, userId, membershipData.transactionId)
                    }

                    if (objectIsNotEmpty(compOrgData)) {
                        if (compOrgData.transactionId)
                            await this.updateTransaction(invoiceId, paymentFeeTypeRefId, paymentOptionRefId, userId, compOrgData.transactionId);
                        if (compOrgData.nominationTransId)
                            await this.updateTransaction(invoiceId, paymentFeeTypeRefId, paymentOptionRefId, userId, compOrgData.nominationTransId)
                    }

                    if (objectIsNotEmpty(affiliateData)) {
                        if (affiliateData.transactionId)
                            await this.updateTransaction(invoiceId, paymentFeeTypeRefId, paymentOptionRefId, userId, affiliateData.transactionId);
                        if (affiliateData.nominationTransId)
                            await this.updateTransaction(invoiceId, paymentFeeTypeRefId, paymentOptionRefId, userId, affiliateData.nominationTransId)
                    }
                }

            }
        }
    }

    private async updateTransaction(invoiceId, paymentFeeTypeRefId, paymentOptionRefId, userId, transactionId) {
        let transaction = new Transaction();
        transaction.id = transactionId;
        transaction.statusRefId = AppConstants.PAID;
        transaction.invoiceId = invoiceId;
        transaction.paymentFeeTypeRefId = paymentFeeTypeRefId;
        transaction.paymentOptionRefId = paymentOptionRefId;
        transaction.updatedBy = userId;
        transaction.updatedOn = new Date();
        await this.transactionService.createOrUpdate(transaction);
    }

    // private async performPaymentOperation(registrationProduct, registration, INVOICE_ID, transArr, totalFee, paymentIntent, paymentType, paidBy) {
    //     try {
    //         // let voucherRes = await this.performGovernmentVoucherRedeem(registrationProduct)
    //         // if (voucherRes != null) {
    //         //     return (voucherRes)
    //         // }
    //         let transSchoolArr = await this.performSchoolOrHardshipInvoicePayment(registrationProduct, registration, INVOICE_ID);
    //         transArr.push(...transSchoolArr);
    //
    //         await this.saveRegistrationInfo(registration, registrationProduct);
    //         await this.createTransactions(transArr, registration, paidBy);
    //         await this.performHardshipUpdate(registrationProduct, registration);
    //         await this.createTeamTransactions(registration, INVOICE_ID);
    //         await this.createInstalmentTransactions(registration, null, 14, INVOICE_ID, paidBy);
    //
    //         if (totalFee == 0) {
    //             await this.invoiceService.updatePaymentStatusByRegistrationID(registration.id);
    //         }
    //         await this.performShopPayment(paymentIntent, registration, registrationProduct, INVOICE_ID, paymentType)
    //         return null;
    //     } catch (error) {
    //         logger.error(`Exception occurred in performPaymentOperation ${error}`);
    //         throw error;
    //     }
    // }

    private async performCreditCardPaymentOperation(
        registrationProduct, registration, INVOICE_ID, totalFee,
        paymentIntent, paymentType, paidBy, teamMemberRegId, personMap
    ) {
        try {
            // let transArr = [];
            // let transSchoolArr = await this.performSchoolOrHardshipInvoicePayment(registrationProduct, registration, INVOICE_ID);
            // transArr.push(...transSchoolArr);

            // await this.createTransactions(transArr, registration, paidBy);
            await this.performHardshipUpdate(registrationProduct, registration);
            await this.createTeamTransactions(registration, INVOICE_ID, teamMemberRegId);
            await this.createInstalmentTransactions(registration, null, RegistrationStep.FutureInstalmentTrackStep, INVOICE_ID, paidBy);
            await this.performNegativeFeeTransactions(registration, INVOICE_ID, paidBy, personMap);
            await this.performHardhipTransaction(registrationProduct, registration, INVOICE_ID, paidBy);
            await this.performDiscountFeeTransactions(registration, INVOICE_ID, paidBy);
            if (totalFee == 0) {
                await this.invoiceService.updatePaymentStatusByRegistrationID(registration.id);
            }
            await this.performShopPayment(paymentIntent, registration, registrationProduct, INVOICE_ID, paymentType)
        } catch (error) {
            logger.error(`Exception occurred in performPaymentOperation ${error}`);
            throw error;
        }
    }

    async getStripePaymentIntent(
        paymentBody, totalStripeFee, currencyType, registration, paymentType,
        transferGroupPrefix, userRegistration, invoiceId, subPaymentType, teamMemberRegId
    ) {
        let PAYMENT_INTENT_ID = '';
        let userRegId = null;

        try {
            let paymentIntentObject = Object.assign({});
            let email = null;
            let name = null;
            let stripeCustomerId = null;
            let userInfo = await this.userService.findById(registration.createdBy);
            if (isNotNullAndUndefined(userInfo)) {
                email = userInfo.email;
                name = userInfo.firstName + ' ' + userInfo.lastName;
                stripeCustomerId = userInfo.stripeCustomerAccountId;
                if (userInfo.isInActive == 1) {
                    email = getParentEmail(userInfo.email);
                }
                // if (isNullOrEmpty(stripeCustomerId)) {
                //     let customerObject = {
                //         email: email,
                //         name: name,
                //     }
                //     const createCustomer = await stripe.customers.create(customerObject);
                //     stripeCustomerId = createCustomer.id;
                //     userInfo.stripeCustomerAccountId = stripeCustomerId;
                //     await this.updateStripeCustomerAccount(userInfo, registration.createdBy);
                // }
            }

            let paymentIntent = null;

            if (totalStripeFee > 0) {
                if (isNotNullAndUndefined(paymentBody.token) && isNotNullAndUndefined(paymentBody.token.id) &&
                    (paymentType == AppConstants.card || subPaymentType == AppConstants.card)) {
                    paymentIntentObject['confirm'] = true;
                    paymentIntentObject['setup_future_usage'] = "off_session";
                    if (isNullOrEmpty(stripeCustomerId)) {
                        let customerObject = {
                            description: name,
                            // email: "testclub@wsa.com",
                            // name: "Club Test 1",
                            email: email,
                            name: name,
                            source: paymentBody.token.id
                        }
                        const createCustomer = await stripe.customers.create(customerObject);
                        stripeCustomerId = createCustomer.id;
                        userInfo.stripeCustomerAccountId = stripeCustomerId;
                        await this.updateStripeCustomerAccount(userInfo, registration.createdBy);
                    } else {
                        const cards = await stripe.customers.listSources(
                            stripeCustomerId,
                            { object: 'card', limit: 3 }
                        );

                        if ((cards && cards.data && cards.data.length) || cards.data.length == 0) {
                            await this.updateStripeCustorAccountDefaultSource(stripeCustomerId, paymentBody.token);
                        }
                    }
                } else if (paymentType == AppConstants.directDebit) {
                    paymentIntentObject['setup_future_usage'] = "off_session";
                    if (isNullOrEmpty(stripeCustomerId)) {
                        let customerObject = {
                            email: email,
                            name: name,
                        }
                        const createCustomer = await stripe.customers.create(customerObject);
                        stripeCustomerId = createCustomer.id;
                        userInfo.stripeCustomerAccountId = stripeCustomerId;
                        await this.updateStripeCustomerAccount(userInfo, registration.createdBy);
                    }
                }
                paymentIntentObject['customer'] = stripeCustomerId;
                paymentIntentObject['amount'] = totalStripeFee;
                paymentIntentObject['currency'] = currencyType;
                paymentIntentObject['metadata'] = { integration_check: 'accept_a_payment' };
                paymentIntentObject['description'] = "Registration Payment";
                paymentIntentObject['confirmation_method'] = "automatic";
                if (transferGroupPrefix == AppConstants.registration) {
                    paymentIntentObject['transfer_group'] = transferGroupPrefix + "#" + registration.registrationUniqueKey;
                } else if (transferGroupPrefix == AppConstants.teamIndividual) {
                    paymentIntentObject['transfer_group'] = transferGroupPrefix + "#" + userRegistration.userRegUniqueKey;
                    userRegId = userRegistration.userRegId;
                } else if (transferGroupPrefix == AppConstants.singleGame) {
                    paymentIntentObject['transfer_group'] = transferGroupPrefix + "#" + registration.registrationUniqueKey + "#" + invoiceId;
                } else if (transferGroupPrefix == AppConstants.teamMemberRegistration) {
                    paymentIntentObject['transfer_group'] = transferGroupPrefix + "#" + registration.registrationUniqueKey + "#" + teamMemberRegId;
                }
                paymentIntentObject['payment_method_types'] = ['card', 'au_becs_debit'];

                logger.info(`***** paymentIntentObject+ ${JSON.stringify(paymentIntentObject)}`);

                paymentIntent = await stripe.paymentIntents.create(paymentIntentObject);

                PAYMENT_INTENT_ID = paymentIntent.id;
            }

            const updateTransaction = await this.updateErrorMessageAndPaymentTypeWithTransaction(
                registration.id, paymentType, null, PAYMENT_INTENT_ID,
                userRegId, invoiceId, transferGroupPrefix, subPaymentType, teamMemberRegId
            );
            return paymentIntent;
        } catch (error) {
            logger.info(`Error occurred in getStripePaymentIntent" ${error}`);
            const updateTransaction = await this.updateErrorMessageAndPaymentTypeWithTransaction(
                registration.id, paymentType, error.message, PAYMENT_INTENT_ID,
                userRegId, invoiceId, transferGroupPrefix, subPaymentType, teamMemberRegId
            );
            throw error;
        }
    }

    private async updateStripeCustomerAccount(user: User, createdBy) {
        try {
            user.updatedBy = createdBy;
            user.updatedOn = new Date();
            await this.userService.createOrUpdate(user);
        } catch (error) {
            throw error;
        }
    }

    private async updateStripeCustorAccountDefaultSource(stripeCustomerAccountId, token) {
        try {
            logger.debug(`UpdateStripeCustorAccountDefaultSource Card Id  CustId ${stripeCustomerAccountId}`)
            const card = await stripe.customers.createSource(
                stripeCustomerAccountId,
                { source: token.id }
            );
            const customer = await stripe.customers.update(
                stripeCustomerAccountId,
                { default_source: card.id }
            );
        } catch (error) {
            logger.error(`Error Occurred in updateStripeCustorAccountDefaultSource ${error}`)
            throw error;
        }
    }

    async createOrUpdateInvoice(registration, flag, userRegId, matches = undefined, teamMemberRegId = undefined) {
        try {
            const REGISTRATION_CREATOR_USER_ID = registration.createdBy;
            let getInvoiceStatus = null;
            if (flag == AppConstants.registration) {
                getInvoiceStatus = await this.invoiceService.findByRegistrationId(registration.id);
            } else if (flag == AppConstants.teamIndividual) {
                getInvoiceStatus = await this.invoiceService.getPaymentStatusTeamIndividual(registration.id, userRegId);
            } else if (flag == AppConstants.singleGame) {
                getInvoiceStatus = [];
            } else if (flag == AppConstants.teamMemberRegistration) {
                getInvoiceStatus = await this.invoiceService.getPaymentStatusByteamMemberRegId(teamMemberRegId);
            }
            let inv = new Invoice();
            if (!isArrayPopulated(getInvoiceStatus)) {
                let invoiceReceipt = await this.invoiceService.getInvoiceReciptId();
                let receiptId = feeIsNull(invoiceReceipt.receiptId) + 1;
                inv.id = 0;
                inv.createdBy = REGISTRATION_CREATOR_USER_ID;
                //inv.paymentStatus = "pending";
                inv.paymentStatus = "initiated";
                inv.receiptId = receiptId.toString();
                inv.matches = matches ? matches : null;
                //  inv.paymentType = paymentBody.paymentType;
            } else {
                inv.id = getInvoiceStatus[0].id
                inv.paymentStatus = getInvoiceStatus[0].paymentStatus;
                inv.updatedBy = REGISTRATION_CREATOR_USER_ID;
                inv.updatedOn = new Date();
            }
            inv.registrationId = registration.id;
            inv.userRegistrationId = userRegId;
            inv.teamMemberRegId = teamMemberRegId;
            let invoiceDetails = await this.invoiceService.createOrUpdate(inv);

            return invoiceDetails;
        } catch (error) {
            throw error;
        }
    }

    async reviewProductTrackSave(requestBody, registration, stepsId, userRegId, invoiceId = undefined, teamMemberRegId = undefined) {
        try {
            let registrationTrack = new RegistrationTrack();
            let registrationTrackDB = null;
            if (userRegId != null) {
                registrationTrackDB = await this.registrationTrackService.findByUserRegistrationId(registration.id, stepsId, userRegId);
            }
            if (invoiceId && !registrationTrackDB) {
                registrationTrackDB = await this.registrationTrackService.findByInvoiceId(registration.id, stepsId, invoiceId);
            }
            if (teamMemberRegId && !registrationTrackDB) {
                registrationTrackDB = await this.registrationTrackService.findByteamMemberRegId(registration.id, stepsId, teamMemberRegId);
            }
            if (!registrationTrackDB) {
                registrationTrackDB = await this.registrationTrackService.findByRegistrationId(registration.id, stepsId);
            }

            if (registrationTrackDB != null && registrationTrackDB != undefined) {
                registrationTrack.id = registrationTrackDB.id;
                registrationTrack.updatedBy = registration.createdBy;
                registrationTrack.updatedOn = new Date();
            } else {
                registrationTrack.id = 0;
                registrationTrack.createdBy = registration.createdBy;
            }
            registrationTrack.teamMemberRegId = teamMemberRegId;
            registrationTrack.registrationId = registration.id;
            registrationTrack.userRegistrationId = userRegId;
            registrationTrack.stepsId = stepsId;
            registrationTrack.jsonData = JSON.stringify(requestBody)
            registrationTrack.invoiceId = invoiceId ? invoiceId : null;
            await this.registrationTrackService.createOrUpdate(registrationTrack);

            if (isArrayPopulated(requestBody.deletedProducts)) {
                for (let item of requestBody.deletedProducts) {
                    let orgParticipant = new OrgRegistrationParticipantDraft();
                    orgParticipant.id = item;
                    orgParticipant.isDeleted = 2;
                    orgParticipant.updatedBy = registration.createdBy;
                    orgParticipant.updatedOn = new Date();
                    await this.orgRegistrationParticipantDraftService.createOrUpdate(orgParticipant);
                }
            }
        } catch (error) {
            throw error;
        }
    }

    async saveYoursInfo(userObj, registration, source = undefined) {
        try {
            logger.info(`--- UserObj -userId = ${userObj.userId}`)

            let userDb = await this.userService.findByEmail(userObj.email)
            if (!userDb) {
                userDb = await this.userService.findByNameAndNumber(userObj.firstName, userObj.lastName, userObj.mobileNumber);
            }
            if (userDb) {
                let tempMail = this.getTempMail(userDb)

                if (tempMail == AppConstants.playerwsaDomain) {
                    userDb.password = null;
                    await this.userService.createOrUpdate(userDb);
                }
            }

            let user = new User();
            user.id = (userDb ? userDb.id : 0);
            user.firstName = userObj.firstName;
            user.middleName = userObj.middleName;
            user.lastName = userObj.lastName;
            user.mobileNumber = userObj.mobileNumber;
            user.genderRefId = userObj.genderRefId;
            user.email = userObj.email.toLowerCase();
            user.dateOfBirth = userObj.dateOfBirth;
            user.street1 = userObj.street1;
            user.street2 = userObj.street2;
            user.suburb = userObj.suburb;
            user.stateRefId = userObj.stateRefId;
            user.postalCode = userObj.postalCode;
            user.isInActive = userObj.referParentEmail ? 1 : 0;
            let userRes = await this.userService.createOrUpdate(user);
            if (userDb != undefined) {
                if (userDb.email !== userObj.email.toLowerCase()) {
                    await this.updateFirebaseData(userRes, userDb.password);
                }
            } else {
                let user1 = new User();
                user1.id = userRes.id;
                user1.createdBy = userRes.id;
                await this.userService.createOrUpdate(user1);
            }
            userObj['id'] = userRes.id;
            if (source == AppConstants.singleGame) {
                registration.updatedBy = userRes.id;
            } else {
                registration.createdBy = userRes.id;
            }

            await this.registrationService.createOrUpdate(registration);

            return userRes;
        } catch (error) {
            logger.error(`---###--- Error Occurred in Payment Controller Your info save ${error}`)
            throw error;
        }
    }

    async saveTeamMembersInfo(registrationRes, teamMemberRegId) {
        try {
            let registrationData = await this.userRegistrationDraftService.findByTeamMemberRegId(teamMemberRegId);
            let userRegistrations = []

            if (isArrayPopulated(registrationData)) {
                for (let data of registrationData) {
                    if (isNotNullAndUndefined(data.participantData)) {
                        data.participantData["participantId"] = data.userRegUniqueKey;
                        userRegistrations.push(data.participantData);
                    }
                }

                let getDeletedProducts = await this.orgRegistrationParticipantDraftService.getDeletedProducts(registrationRes.id);
                getDeletedProducts = getDeletedProducts != null ? getDeletedProducts : [];
                // let yourInfo = registrationProduct.yourInfo;
                // let userInfo = await this.saveYoursInfo(requestBody.yourInfo);
                // userId = userInfo.id;

                let i = 0;
                let parentOrGuardianMap = new Map();
                let tempParentArray = [];
                let playerArr = []
                let teamRegisteringUser = null;
                let userRegList = await this.userRegistrationService.findByRegistrationId(registrationRes.id);
                for (let userReg of userRegistrations) {
                    if (isNotNullAndUndefined(userReg)) {
                        let userId = userReg.registeringPersonUserId;
                        let competitionId = await this.competitionRegService.findByUniquekey(userReg.competitionId);
                        let organisationId = await this.organisationService.findByUniquekey(userReg.organisationId);
                        let orgRegistrationId = await this.orgRegistrationService.findOrgRegId(competitionId, organisationId);
                        let compDivisionDb = await this.competitionDivisionService.findBycmpd(userReg.competitionMembershipProductDivisionId)
                        let registererUserRegDraftData = userRegList.find(x => x.personRoleRefId != null && x.teamId == userReg.teamId);

                        if (isArrayPopulated(userReg.teamMembers)) {
                            let playersList = userReg.teamMembers
                            if (isArrayPopulated(playersList)) {
                                for (let p of playersList) {
                                    // let userDb1 = await this.userService.findUserByUniqueFields(p.email.toLowerCase(), p.firstName, p.lastName, p.mobileNumber);
                                    let userDb1 = await this.userService.findByEmail(p.email)

                                    let user = new User;
                                    user.id = userDb1 != undefined ? userDb1.id : 0;
                                    user.firstName = p.firstName;
                                    user.middleName = p.middleName;
                                    user.email = p.email.toLowerCase();
                                    user.lastName = p.lastName;
                                    user.mobileNumber = p.mobileNumber;
                                    user.dateOfBirth = p.dateOfBirth;
                                    user.genderRefId = p.genderRefId;
                                    user.street1 = p.street1;
                                    user.street2 = p.street2;
                                    user.suburb = p.suburb;
                                    user.stateRefId = p.stateRefId;
                                    user.countryRefId = p.countryRefId;
                                    user.postalCode = p.postalCode;
                                    user.emergencyFirstName = p.emergencyFirstName;
                                    user.emergencyLastName = p.emergencyLastName;
                                    user.emergencyContactNumber = p.emergencyContactNumber;
                                    user.emergencyContactRelationshipId = p.emergencyContactRelationshipId;
                                    let password = Math.random().toString(36).slice(-8);
                                    if (userDb1 == undefined) {
                                        user.createdBy = userReg.registeringPersonUserId;
                                        // user.password = md5(password);
                                    }
                                    let userRes1 = await this.userService.createOrUpdate(user);
                                    if (userDb1 == undefined) {
                                        await this.updateFirebaseData(userRes1, user.password);
                                    }

                                    if (isArrayPopulated(p.parentOrGuardian)) {
                                        for (let pg of p.parentOrGuardian) {
                                            let userParentDb = null;
                                            if (pg.userId == 0) {
                                                userParentDb = await this.userService.findByEmail(pg.email)
                                            } else {
                                                userParentDb = await this.userService.findById(pg.userId);
                                            }
                                            let userPG = new User();
                                            userPG.id = userParentDb != undefined ? userParentDb.id : pg.userId;
                                            userPG.firstName = pg.firstName;
                                            userPG.lastName = pg.lastName;
                                            userPG.middleName = pg.middleName;
                                            userPG.mobileNumber = pg.mobileNumber;
                                            userPG.email = pg.email.toLowerCase();
                                            userPG.street1 = pg.street1;
                                            userPG.street2 = pg.street2;
                                            userPG.suburb = pg.suburb;
                                            userPG.stateRefId = pg.stateRefId;
                                            userPG.countryRefId = pg.countryRefId;
                                            userPG.postalCode = pg.postalCode;
                                            let password = Math.random().toString(36).slice(-8);
                                            if (pg.userId == 0 || pg.userId == "" || pg.userId == null) {
                                                userPG.createdBy = userId;
                                                // userPG.password = md5(AppConstants.password);
                                            }
                                            let parentOrGuardianUser = await this.userService.createOrUpdate(userPG);
                                            if (pg.userId == 0 || pg.userId == null || pg.userId == "") {
                                                // await this.updateFirebaseData(parentOrGuardianUser, userPG.password);
                                            }
                                            if (userParentDb != undefined) {
                                                if (userParentDb.email !== pg.email.toLowerCase()) {
                                                    await this.updateFirebaseData(parentOrGuardianUser, userParentDb.password);
                                                }
                                            }
                                            let ureparentDb = await this.ureService.findExisting(userPG.id, userRes1.id, 4, 9)
                                            let ureparent = new UserRoleEntity();
                                            if (ureparentDb) {
                                                ureparent.id = ureparentDb.id;
                                                ureparent.updatedBy = userId;
                                                ureparent.updatedAt = new Date();
                                            } else {
                                                ureparent.id = 0;
                                                ureparent.createdBy = userId;
                                            }
                                            ureparent.roleId = 9;
                                            ureparent.userId = parentOrGuardianUser.id
                                            ureparent.entityId = userRes1.id;
                                            ureparent.entityTypeId = 4;
                                            await this.ureService.createOrUpdate(ureparent);
                                            parentOrGuardianMap.set(pg.email, parentOrGuardianUser.id)
                                        }
                                    }

                                    let userRegister1 = new UserRegistration();
                                    userRegister1.id = 0;
                                    userRegister1.userId = userRes1.id;
                                    userRegister1.teamId = userReg.teamId;
                                    userRegister1.competitionMembershipProductTypeId = userReg.competitionMembershipProductTypeId;
                                    userRegister1.heardByRefId = userReg.heardByRefId;
                                    userRegister1.heardByOther = userReg.heardByOther;
                                    userRegister1.favouriteTeamRefId = userReg.favouriteTeamRefId;
                                    userRegister1.favouriteFireBird = userReg.favouriteFireBird;
                                    userRegister1.isConsentPhotosGiven = userReg.isConsentPhotosGiven;
                                    userRegister1.registeringYourselfRefId = userReg.registeringYourself;
                                    userRegister1.userRegUniqueKey = uuidv4();
                                    userRegister1.countryRefId = userReg.countryRefId;
                                    userRegister1.teamMemberRegId = teamMemberRegId;
                                    userRegister1.createdBy = userId;
                                    let UserRegistrationRes1 = await this.userRegistrationService.createOrUpdate(userRegister1);
                                    let orptExist1 = await this.orgRegistrationParticipantService.findByTemplate(orgRegistrationId, registrationRes.id, UserRegistrationRes1.id);
                                    if (orptExist1 == undefined) {
                                        let orpt = new OrgRegistrationParticipant();
                                        orpt.id = 0;
                                        orpt.orgRegistrationId = orgRegistrationId;
                                        orpt.registrationId = registrationRes.id;
                                        orpt.userRegistrationId = UserRegistrationRes1.id;
                                        orpt.teamRegistrationTypeRefId = 1;
                                        orpt.paymentOptionRefId = registererUserRegDraftData.paymentOptionRefId;
                                        orpt.createdBy = userId;
                                        await this.orgRegistrationParticipantService.createOrUpdate(orpt);
                                    }
                                    let selectedProducts = p.membershipProductTypes.filter(x => x.isChecked == 1);
                                    if (isArrayPopulated(selectedProducts)) {
                                        for (let sp of selectedProducts) {
                                            if (sp.isPlayer == 1) {
                                                let playerDb1 = await this.player1Service.findExistingPlayer(userRes1.id, competitionId, organisationId, userReg.competitionMembershipProductDivisionId)

                                                let playerObj = new Player();
                                                playerObj.id = 0;//playerDb1 != undefined ? playerDb1.id : 0;
                                                playerObj.competitionDivisionId = compDivisionDb != null ? compDivisionDb.id : null;
                                                playerObj.competitionMembershipProductDivisionId = userReg.competitionMembershipProductDivisionId;
                                                playerObj.competitionMembershipProductTypeId = sp.competitionMembershipProductTypeId;
                                                playerObj.competitionId = competitionId;
                                                playerObj.organisationId = organisationId;
                                                playerObj.userRegistrationId = UserRegistrationRes1.id
                                                playerObj.teamId = userReg.teamId;
                                                playerObj.statusRefId = 2;
                                                playerObj.payingFor = p.payingFor;
                                                playerObj.userId = userRes1.id;
                                                playerObj.createdBy = userId;
                                                playerArr.push(playerObj);

                                                let ureplayerDb = await this.ureService.findExisting(userRes1.id, competitionId, 1, 18)
                                                if (ureplayerDb == undefined) {
                                                    await this.createTeamUre(userRes1.id, competitionId, userId, 18)
                                                }
                                            } else {
                                                let nonPlayerDb1 = await this.nonPlayerService.findExistingNonPlayer(userRes1.id, competitionId, organisationId, p.competitionMembershipProductTypeId)

                                                let nonPlayer = new NonPlayer();
                                                nonPlayer.id = 0;//nonPlayerDb1 != undefined ? nonPlayerDb1.id : 0;
                                                nonPlayer.userId = userRes1.id;
                                                nonPlayer.payingFor = p.payingFor;
                                                nonPlayer.competitionId = competitionId;
                                                nonPlayer.organisationId = organisationId;
                                                nonPlayer.statusRefId = 2;
                                                nonPlayer.userRegistrationId = UserRegistrationRes1.id
                                                nonPlayer.competitionMembershipProductTypeId = sp.competitionMembershipProductTypeId;
                                                // nonPlayer.childrenCheckNumber = userReg.childrenCheckNumber;
                                                nonPlayer.createdBy = userId;
                                                await this.nonPlayerService.createOrUpdate(nonPlayer);
                                                //--- to use      let productType = userReg.membershipProducts.find(x => x.name == "Coach");

                                                let roleId = 16;
                                                if (sp.productTypeName == AppConstants.coach) {
                                                    roleId = AppConstants.coachRoleId
                                                } else if (sp.productTypeName == AppConstants.umpire) {
                                                    roleId = AppConstants.umpireRoleId
                                                }
                                                let ureplayerDb = await this.ureService.findExisting(userRes1.id, competitionId, 1, roleId)
                                                if (ureplayerDb == undefined) {
                                                    await this.createTeamUre(userRes1.id, competitionId, userId, roleId)
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                        }

                        await this.player1Service.batchCreateOrUpdate(playerArr);
                    }
                }
            }
        } catch (error) {
            throw error;
        }
    }

    async createTeam(teamName: string, competitionId: number, organisationId: number, competitionDivisionId: number, competitionMembershipProductDivisionId: number, userId: number) {
        try {
            let teamSortMax = await this.teamService.findMaxSortId(competitionDivisionId, organisationId);
            let team = new Team();
            team.id = 0;
            team.competitionId = competitionId;
            team.competitionDivisionId = competitionDivisionId;
            team.competitionMembershipProductDivisionId = competitionMembershipProductDivisionId;
            team.name = teamName;
            team.organisationId = organisationId;
            team.createdBy = userId;
            team.gradeRefId = null;
            team.teamUniqueKey = uuidv4()
            if (teamSortMax != null && teamSortMax[0] != null && teamSortMax[0] != undefined) {
                team.sortorder = teamSortMax[0].sortOrder == null ? 1 : Number(teamSortMax[0].sortOrder) + 1;
            } else {
                team.sortorder = 1;
            }

            let teamRes = await this.teamService.createOrUpdate(team);

            return teamRes.id;
        } catch (error) {
            logger.error(`---###--- Error Occurred in Team save ${error}`)
            throw error;
        }
    }

    async createTeamUre(ureUserId: number, competitionId: number, userId: number, roleId: number) {
        let ureDb = await this.ureService.findExisting(ureUserId, competitionId, 1, roleId)

        let ure = new UserRoleEntity()
        if (ureDb)
            ure.id = ureDb.id;
        else
            ure.id = 0;
        ure.entityTypeId = 1;
        ure.entityId = competitionId;
        ure.userId = ureUserId;
        ure.roleId = roleId;
        ure.createdBy = userId;
        await this.ureService.createOrUpdate(ure);
    }

    async findRoleId(product: any) {
        try {
            let productTypeName = product.membershipTypeName;
            let roleId;
            if (productTypeName == AppConstants.coach) {
                roleId = AppConstants.coachRoleId;
            } else if (productTypeName == AppConstants.umpire) {
                roleId = AppConstants.umpireRoleId;
            } else {
                roleId = AppConstants.nonPlayerRoleId;
            }
            return roleId;
        } catch (error) {
            logger.error(`---###--- Error Occurred in  findRoleId ${error}`)
            throw error;
        }
    }

    async saveRegistrationInfo(registrationRes, registrationProduct) {
        try {
            let iAmRegisteringMyself = 0;
            let userId = registrationRes.createdBy;
            let registrationData = await this.userRegistrationDraftService.findByRegistrationId(registrationRes.id);
            let requestBody = {
                userRegistrations: []
            };

            if (isArrayPopulated(registrationData)) {
                for (let data of registrationData) {
                    if (isNotNullAndUndefined(data.participantData)) {
                        data.participantData["participantId"] = data.userRegUniqueKey;
                        let par = JSON.stringify(data.participantData);
                        logger.debug(`$$$ participant email is ${par}`);
                        if (data.participantData["email"] == null) {
                            logger.debug(`$$$ participant email is null`);
                            if (data.parentData && data.parentData.length > 1) {
                                logger.debug(`$$$ using parent email`);
                                data.participantData["email"] = data.parentData[0]["email"] + "." + data.participantData["firstName"];
                            }
                        }

                        requestBody.userRegistrations.push(data.participantData);
                    }
                }

                let getDeletedProducts = await this.orgRegistrationParticipantDraftService.getDeletedProducts(registrationRes.id);
                getDeletedProducts = getDeletedProducts != null ? getDeletedProducts : [];
                // let yourInfo = registrationProduct.yourInfo;
                // let userInfo = await this.saveYoursInfo(requestBody.yourInfo);
                // userId = userInfo.id;

                let volunteerInfo = registrationProduct.volunteerInfo;
                let i = 0;
                let parentOrGuardianMap = new Map();
                let tempParentArray = [];
                let isTeamRegAvailable = false;
                let isParticipantAvailable = false;
                let teamRegisteringUser = null;

                for (let userReg of requestBody.userRegistrations) {
                    // let competitionId = await this.competitionRegService.findByUniquekey(userReg.competitionUniqueKey);
                    // let organisationId = await this.organisationService.findByUniquekey(userReg.organisationUniqueKey);
                    // let orgRegistrationId = await this.orgRegistrationService.findOrgRegId(competitionId, organisationId);
                    if (isNotNullAndUndefined(userReg)) {
                        if (userReg.registeringYourself == 1) {
                            iAmRegisteringMyself = 1;
                        }

                        if (userReg.registeringYourself == 4) {
                            let userRegDraftRes = await this.userRegistrationDraftService.findByUniqueKey(userReg.participantId);

                            let competitionId = await this.competitionRegService.findByUniquekey(userReg.competitionId);
                            let organisationId = await this.organisationService.findByUniquekey(userReg.organisationId);
                            let orgRegistrationId = await this.orgRegistrationService.findOrgRegId(competitionId, organisationId);
                            isTeamRegAvailable = true;
                            // let userDb = await this.user1Service.findUserByTemplate(userReg.team.email.toLowerCase(), userReg.team.firstName, userReg.team.lastName, userReg.team.mobileNumber)
                            let orgParticipant = registrationProduct.compParticipants.find(x => x.isTeamRegistration == 1 && x.email.toLowerCase() == userReg.email.toLowerCase()
                                && x.competitionUniqueKey == userReg.competitionId && x.organisationUniqueKey == userReg.organisationId)
                            let userDb = await this.userService.findByEmail(userReg.email)
                            let user = new User();
                            user.id = (userDb ? userDb.id : 0);
                            // user.id = userDb != undefined ? userDb.id : 0;
                            user.firstName = userReg.firstName;
                            user.middleName = userReg.middleName;
                            user.lastName = userReg.lastName;
                            user.mobileNumber = userReg.mobileNumber;
                            user.email = userReg.email.toLowerCase();
                            user.dateOfBirth = userReg.dateOfBirth;
                            user.genderRefId = userReg.genderRefId;
                            user.street1 = userReg.street1;
                            user.street2 = userReg.street2;
                            user.suburb = userReg.suburb;
                            user.stateRefId = userReg.stateRefId;
                            user.postalCode = userReg.postalCode;
                            user.countryRefId = userReg.countryRefId;
                            user.childrenCheckNumber = userReg.additionalInfo.childrenCheckNumber;
                            user.childrenCheckExpiryDate = userReg.additionalInfo.childrenCheckExpiryDate;
                            user.accreditationLevelUmpireRefId = userReg.additionalInfo.accreditationLevelUmpireRefId;
                            user.accreditationUmpireExpiryDate = userReg.additionalInfo.accreditationUmpireExpiryDate;
                            user.associationLevelInfo = userReg.additionalInfo.associationLevelInfo;
                            user.accreditationLevelCoachRefId = userReg.additionalInfo.accreditationLevelCoachRefId;
                            user.accreditationCoachExpiryDate = userReg.additionalInfo.accreditationCoachExpiryDate;
                            user.isPrerequestTrainingComplete = userReg.additionalInfo.isPrerequestTrainingComplete;
                            user.emergencyFirstName = userReg.emergencyFirstName;
                            user.emergencyLastName = userReg.emergencyLastName;
                            user.emergencyContactNumber = userReg.emergencyContactNumber;
                            user.emergencyContactRelationshipId = userReg.emergencyContactRelationshipId;
                            if (userDb) {
                                user.updatedBy = userId;
                                user.updatedOn = new Date();
                            } else {
                                user.createdBy = userId;
                            }

                            let password = Math.random().toString(36).slice(-8);

                            let userRes = await this.userService.createOrUpdate(user);
                            teamRegisteringUser = userRes;

                            if (!isNullOrUndefined(userDb)) {
                                await this.updateFirebaseData(userRes, user.password);
                            }

                            if (isArrayPopulated(userReg.parentOrGuardian)) {
                                for (let pg of userReg.parentOrGuardian) {
                                    let userParentDb = await this.userService.findByEmail(pg.email.toLowerCase());
                                    // if (pg.userId == 0) {
                                    //     userParentDb = await this.userService.findByEmail(pg.email.toLowerCase())
                                    // } else {
                                    //     userParentDb = await this.userService.findById(pg.userId);
                                    // }
                                    let userPG = new User();
                                    userPG.id = userParentDb != undefined ? userParentDb.id : 0;
                                    userPG.firstName = pg.firstName;
                                    userPG.lastName = pg.lastName;
                                    userPG.middleName = pg.middleName;
                                    userPG.mobileNumber = pg.mobileNumber;
                                    userPG.email = pg.email.toLowerCase();
                                    userPG.street1 = pg.street1;
                                    userPG.street2 = pg.street2;
                                    userPG.suburb = pg.suburb;
                                    userPG.stateRefId = pg.stateRefId;
                                    userPG.countryRefId = pg.countryRefId;
                                    userPG.postalCode = pg.postalCode;
                                    let password = Math.random().toString(36).slice(-8);
                                    if (pg.userId == 0 || pg.userId == "" || pg.userId == null) {
                                        userPG.createdBy = userId;
                                        // userPG.password = md5(AppConstants.password);
                                    }
                                    let parentOrGuardianUser = await this.userService.createOrUpdate(userPG);
                                    if (pg.userId == 0 || pg.userId == null || pg.userId == "") {
                                        // await this.updateFirebaseData(parentOrGuardianUser, userPG.password);
                                    }
                                    if (userParentDb != undefined) {
                                        if (userParentDb.email !== pg.email.toLowerCase()) {
                                            await this.updateFirebaseData(parentOrGuardianUser, userParentDb.password);
                                        }
                                    }
                                    let ureparentDb = await this.ureService.findExisting(userPG.id, userRes.id, 4, 9)
                                    let ureparent = new UserRoleEntity();
                                    if (ureparentDb) {
                                        ureparent.id = ureparentDb.id;
                                        ureparent.updatedBy = userId;
                                        ureparent.updatedAt = new Date();
                                    } else {
                                        ureparent.id = 0;
                                        ureparent.createdBy = userId;
                                    }
                                    ureparent.roleId = 9;
                                    ureparent.userId = parentOrGuardianUser.id
                                    ureparent.entityId = userRes.id;
                                    ureparent.entityTypeId = 4;
                                    await this.ureService.createOrUpdate(ureparent);
                                    parentOrGuardianMap.set(pg.email, parentOrGuardianUser.id)
                                }
                            }

                            let compDivisionDb = await this.competitionDivisionService.findBycmpd(userReg.competitionMembershipProductDivisionId)
                            let compDivisionId = compDivisionDb ? compDivisionDb.id : null;
                            let teamId = await this.createTeam(userReg.teamName, competitionId, organisationId, compDivisionId, userReg.competitionMembershipProductDivisionId, userRes.id)
                            logger.info(':::: TEAM ID =', teamId)
                            logger.info(`:::: TEAM ID =${teamId}`)
                            let userRegister = new UserRegistration();
                            userRegister.id = 0;
                            userRegister.userId = userRes.id;
                            userRegister.teamId = teamId;
                            userRegister.competitionMembershipProductTypeId = userReg.competitionMembershipProductTypeId;
                            userRegister.existingMedicalCondition = userReg.additionalInfo.existingMedicalCondition;
                            userRegister.regularMedication = userReg.additionalInfo.regularMedication;
                            userRegister.heardByRefId = userReg.additionalInfo.heardByRefId;
                            userRegister.heardByOther = userReg.additionalInfo.heardByOther;
                            userRegister.favouriteTeamRefId = userReg.additionalInfo.favouriteTeamRefId;
                            userRegister.favouriteFireBird = userReg.additionalInfo.favouriteFireBird;
                            userRegister.isConsentPhotosGiven = userReg.additionalInfo.isConsentPhotosGiven;
                            userRegister.personRoleRefId = userReg.personRoleRefId
                            userRegister.isDisability = userReg.additionalInfo.isDisability;
                            userRegister.registeringYourselfRefId = userReg.registeringYourself;
                            userRegister.disabilityCareNumber = userReg.additionalInfo.disabilityCareNumber;
                            userRegister.disabilityTypeRefId = userReg.additionalInfo.disabilityTypeRefId;
                            userRegister.userRegUniqueKey = uuidv4();
                            userRegister.identifyRefId = userReg.additionalInfo.identifyRefId;
                            userRegister.injuryInfo = userReg.additionalInfo.injuryInfo;
                            userRegister.allergyInfo = userReg.additionalInfo.allergyInfo;
                            userRegister.yearsPlayed = userReg.additionalInfo.yearsPlayed;
                            userRegister.schoolId = userReg.additionalInfo.schoolId;
                            userRegister.schoolGradeInfo = userReg.additionalInfo.schoolGradeInfo;
                            userRegister.isParticipatedInSSP = userReg.additionalInfo.isParticipatedInSSP;
                            userRegister.otherSportsInfo = (userReg.additionalInfo.otherSportsInfo ? JSON.stringify(userReg.additionalInfo.otherSportsInfo) : null);
                            userRegister.volunteerInfo = (volunteerInfo ? JSON.stringify(volunteerInfo) : null);
                            userRegister.walkingNetball = (userReg.additionalInfo.walkingNetball ? JSON.stringify(userReg.additionalInfo.walkingNetball) : null);
                            userRegister.walkingNetballInfo = userReg.additionalInfo.walkingNetballInfo;
                            userRegister.countryRefId = userReg.countryRefId;
                            if (userRegDraftRes != undefined)
                                userRegister.userRegDraftId = userRegDraftRes.id
                            // if (userReg.userRegistrationId == 0 || userReg.userRegistrationId == "") {
                            userRegister.createdBy = userId;
                            // }
                            let UserRegistrationRes = await this.userRegistrationService.createOrUpdate(userRegister);
                            let orptExist = await this.orgRegistrationParticipantService.findByTemplate(orgRegistrationId, registrationRes.id, UserRegistrationRes.id);
                            if (orptExist == undefined) {
                                let orpt = new OrgRegistrationParticipant();
                                orpt.id = 0;
                                orpt.orgRegistrationId = orgRegistrationId;
                                orpt.registrationId = registrationRes.id;
                                orpt.userRegistrationId = UserRegistrationRes.id;
                                orpt.teamRegistrationTypeRefId = 1;
                                orpt.paymentOptionRefId = (orgParticipant && orgParticipant.selectedOptions) ? orgParticipant.selectedOptions.paymentOptionRefId : 0;
                                orpt.voucherCode = (orgParticipant && orgParticipant.selectedOptions && isArrayPopulated(orgParticipant.selectedOptions.selectedGovernmentVouchers)) ?
                                    orgParticipant.selectedOptions.selectedGovernmentVouchers.find(x => x).voucherCode : null;
                                orpt.createdBy = userId;
                                await this.orgRegistrationParticipantService.createOrUpdate(orpt);
                            }

                            let roleTempId;
                            switch (userReg.personRoleRefId) {
                                case 1:
                                    roleTempId = 21;
                                    break;

                                case 2:
                                    roleTempId = 17;
                                    break;

                                case 3:
                                    roleTempId = 3;
                                    break;

                                default:
                                    roleTempId = 18;
                            }
                            await this.createTeamUre(userRes.id, competitionId, userId, roleTempId)

                            let playerArr = []

                            //Coach
                            if (userReg.personRoleRefId == 2 || userReg.personRoleRefId == 3) {
                                let nonPlayerDb = await this.nonPlayerService.findExistingNonPlayer(userRes.id, competitionId, organisationId, userReg.competitionMembershipProductTypeId)
                                // let coachProductType =  await this.competitionMembershipProductTypeService.findcouchProductType()
                                let productType = null;
                                if (userReg.personRoleRefId == 2)
                                    productType = userReg.membershipProducts.find(x => x.name == "Coach");
                                else
                                    productType = userReg.membershipProducts.find(x => x.competitionMembershipProductTypeId == userReg.competitionMembershipProductTypeId);

                                if (isNotNullAndUndefined(productType)) {
                                    let nonPlayer = new NonPlayer();
                                    nonPlayer.id = 0;//nonPlayerDb != undefined ? nonPlayerDb.id : 0;
                                    nonPlayer.userId = userRes.id;
                                    nonPlayer.competitionId = competitionId;
                                    nonPlayer.organisationId = organisationId;
                                    nonPlayer.payingFor = 1;
                                    nonPlayer.statusRefId = 2;
                                    nonPlayer.userRegistrationId = UserRegistrationRes.id
                                    nonPlayer.competitionMembershipProductTypeId = productType.competitionMembershipProductTypeId;
                                    // nonPlayer.childrenCheckNumber = userReg.childrenCheckNumber;
                                    nonPlayer.createdBy = userRes.id;
                                    await this.nonPlayerService.createOrUpdate(nonPlayer);

                                    // let ureplayerDb = await this.ureService.findExisting(userRes.id, teamId, 3, 16)
                                    // if (ureplayerDb == undefined) {
                                    //     await this.createTeamUre(userRes.id, teamId, userId, 16)
                                    // }
                                }
                            }

                            //player
                            if (userReg.personRoleRefId == 4) {
                                let playerDb = await this.player1Service.findExistingPlayer(userRes.id, competitionId, organisationId, userReg.competitionMembershipProductDivisionId)

                                if (userReg.competitionMembershipProductTypeId != undefined) {
                                    let playerObj = new Player();
                                    playerObj.id = 0;//playerDb != undefined ? playerDb.id : 0;
                                    playerObj.competitionDivisionId = compDivisionDb ? compDivisionDb.id : null;
                                    playerObj.competitionMembershipProductDivisionId = userReg.competitionMembershipProductDivisionId;
                                    playerObj.competitionMembershipProductTypeId = userReg.competitionMembershipProductTypeId;
                                    playerObj.userRegistrationId = UserRegistrationRes.id
                                    playerObj.competitionId = competitionId;
                                    playerObj.organisationId = organisationId;
                                    playerObj.statusRefId = 2;
                                    playerObj.payingFor = 1;
                                    playerObj.teamId = teamId;
                                    playerObj.userId = userRes.id;
                                    playerObj.createdBy = userRes.id
                                    playerArr.push(playerObj);
                                }
                            }

                            //named players
                            if (userReg.allowTeamRegistrationTypeRefId == 1) {
                                if (userReg.personRoleRefId != 4) {
                                    if (userReg.registeringAsAPlayer == 1) {
                                        let playerDb = await this.player1Service.findExistingPlayer(userRes.id, competitionId, organisationId, userReg.competitionMembershipProductDivisionId)

                                        let playerObj = new Player();
                                        playerObj.id = 0;//playerDb != undefined ? playerDb.id : 0;
                                        playerObj.competitionDivisionId = compDivisionDb ? compDivisionDb.id : null;
                                        playerObj.competitionMembershipProductDivisionId = userReg.competitionMembershipProductDivisionId;
                                        playerObj.competitionMembershipProductTypeId = userReg.competitionMembershipProductTypeId;
                                        playerObj.userRegistrationId = UserRegistrationRes.id
                                        playerObj.competitionId = competitionId;
                                        playerObj.organisationId = organisationId;
                                        playerObj.payingFor = 1;
                                        playerObj.statusRefId = 2;
                                        playerObj.teamId = teamId;
                                        playerObj.userId = userRes.id;
                                        playerObj.createdBy = userRes.id
                                        playerArr.push(playerObj);

                                        //Except Player Person Role

                                        let ureplayerDb = await this.ureService.findExisting(userRes.id, competitionId, 1, 18)
                                        if (ureplayerDb == undefined) {
                                            await this.createTeamUre(userRes.id, competitionId, userRes.id, 18)
                                        }
                                    }
                                }

                                if (isArrayPopulated(userReg.teamMembers)) {
                                    let playersList = userReg.teamMembers
                                    if (isArrayPopulated(playersList)) {
                                        for (let p of playersList) {
                                            // let userDb1 = await this.userService.findUserByUniqueFields(p.email.toLowerCase(), p.firstName, p.lastName, p.mobileNumber);
                                            let userDb1 = await this.userService.findByEmail(p.email)

                                            let user = new User;
                                            user.id = userDb1 != undefined ? userDb1.id : 0;
                                            user.firstName = p.firstName;
                                            user.middleName = p.middleName;
                                            user.email = p.email.toLowerCase();
                                            user.lastName = p.lastName;
                                            user.mobileNumber = p.mobileNumber;
                                            user.dateOfBirth = p.dateOfBirth;
                                            user.genderRefId = p.genderRefId;
                                            user.street1 = p.street1;
                                            user.street2 = p.street2;
                                            user.suburb = p.suburb;
                                            user.stateRefId = p.stateRefId;
                                            user.countryRefId = p.countryRefId;
                                            user.postalCode = p.postalCode;
                                            user.emergencyFirstName = p.emergencyFirstName;
                                            user.emergencyLastName = p.emergencyLastName;
                                            user.emergencyContactNumber = p.emergencyContactNumber;
                                            user.emergencyContactRelationshipId = p.emergencyContactRelationshipId;
                                            let password = Math.random().toString(36).slice(-8);
                                            if (userDb1 == undefined) {
                                                user.createdBy = userRes.id;
                                                // user.password = md5(password);
                                            }
                                            let userRes1 = await this.userService.createOrUpdate(user);
                                            if (userDb1 == undefined) {
                                                await this.updateFirebaseData(userRes1, user.password);
                                            }

                                            if (isArrayPopulated(p.parentOrGuardian)) {
                                                for (let pg of p.parentOrGuardian) {
                                                    let userParentDb = null;
                                                    if (pg.userId == 0) {
                                                        userParentDb = await this.userService.findByEmail(pg.email)
                                                    } else {
                                                        userParentDb = await this.userService.findById(pg.userId);
                                                    }
                                                    let userPG = new User();
                                                    userPG.id = userParentDb != undefined ? userParentDb.id : pg.userId;
                                                    userPG.firstName = pg.firstName;
                                                    userPG.lastName = pg.lastName;
                                                    userPG.middleName = pg.middleName;
                                                    userPG.mobileNumber = pg.mobileNumber;
                                                    userPG.email = pg.email.toLowerCase();
                                                    userPG.street1 = pg.street1;
                                                    userPG.street2 = pg.street2;
                                                    userPG.suburb = pg.suburb;
                                                    userPG.stateRefId = pg.stateRefId;
                                                    userPG.countryRefId = pg.countryRefId;
                                                    userPG.postalCode = pg.postalCode;
                                                    let password = Math.random().toString(36).slice(-8);
                                                    if (pg.userId == 0 || pg.userId == "" || pg.userId == null) {
                                                        userPG.createdBy = userId;
                                                        // userPG.password = md5(AppConstants.password);
                                                    }
                                                    let parentOrGuardianUser = await this.userService.createOrUpdate(userPG);
                                                    if (pg.userId == 0 || pg.userId == null || pg.userId == "") {
                                                        // await this.updateFirebaseData(parentOrGuardianUser, userPG.password);
                                                    }
                                                    if (userParentDb != undefined) {
                                                        if (userParentDb.email !== pg.email.toLowerCase()) {
                                                            await this.updateFirebaseData(parentOrGuardianUser, userParentDb.password);
                                                        }
                                                    }
                                                    let ureparentDb = await this.ureService.findExisting(userPG.id, userRes1.id, 4, 9)
                                                    let ureparent = new UserRoleEntity();
                                                    if (ureparentDb) {
                                                        ureparent.id = ureparentDb.id;
                                                        ureparent.updatedBy = userId;
                                                        ureparent.updatedAt = new Date();
                                                    } else {
                                                        ureparent.id = 0;
                                                        ureparent.createdBy = userId;
                                                    }
                                                    ureparent.roleId = 9;
                                                    ureparent.userId = parentOrGuardianUser.id
                                                    ureparent.entityId = userRes1.id;
                                                    ureparent.entityTypeId = 4;
                                                    await this.ureService.createOrUpdate(ureparent);
                                                    parentOrGuardianMap.set(pg.email, parentOrGuardianUser.id)
                                                }
                                            }

                                            let userRegister1 = new UserRegistration();
                                            userRegister1.id = 0;
                                            userRegister1.userId = userRes1.id;
                                            userRegister1.teamId = teamId;
                                            userRegister1.competitionMembershipProductTypeId = userReg.competitionMembershipProductTypeId;
                                            userRegister1.heardByRefId = userReg.heardByRefId;
                                            userRegister1.heardByOther = userReg.heardByOther;
                                            userRegister1.favouriteTeamRefId = userReg.favouriteTeamRefId;
                                            userRegister1.favouriteFireBird = userReg.favouriteFireBird;
                                            userRegister1.isConsentPhotosGiven = userReg.isConsentPhotosGiven;
                                            userRegister1.registeringYourselfRefId = userReg.registeringYourself;
                                            userRegister1.userRegUniqueKey = uuidv4();
                                            userRegister1.countryRefId = userReg.countryRefId;

                                            userRegister1.createdBy = userId;
                                            let UserRegistrationRes1 = await this.userRegistrationService.createOrUpdate(userRegister1);
                                            let orptExist1 = await this.orgRegistrationParticipantService.findByTemplate(orgRegistrationId, registrationRes.id, UserRegistrationRes1.id);
                                            if (orptExist1 == undefined) {
                                                let orpt = new OrgRegistrationParticipant();
                                                orpt.id = 0;
                                                orpt.orgRegistrationId = orgRegistrationId;
                                                orpt.registrationId = registrationRes.id;
                                                orpt.userRegistrationId = UserRegistrationRes1.id;
                                                orpt.teamRegistrationTypeRefId = 1;
                                                orpt.paymentOptionRefId = (orgParticipant && orgParticipant.selectedOptions) ? orgParticipant.selectedOptions.paymentOptionRefId : 0;
                                                orpt.voucherCode = (orgParticipant && orgParticipant.selectedOptions && isArrayPopulated(orgParticipant.selectedOptions.selectedGovernmentVouchers)) ?
                                                    orgParticipant.selectedOptions.selectedGovernmentVouchers.find(x => x).voucherCode : null;
                                                orpt.createdBy = userId;
                                                await this.orgRegistrationParticipantService.createOrUpdate(orpt);
                                            }
                                            let selectedProducts = p.membershipProductTypes.filter(x => x.isChecked == 1);
                                            if (isArrayPopulated(selectedProducts)) {
                                                for (let sp of selectedProducts) {
                                                    if (sp.isPlayer == 1) {
                                                        let playerDb1 = await this.player1Service.findExistingPlayer(userRes1.id, competitionId, organisationId, userReg.competitionMembershipProductDivisionId)

                                                        let playerObj = new Player();
                                                        playerObj.id = 0;//playerDb1 != undefined ? playerDb1.id : 0;
                                                        playerObj.competitionDivisionId = compDivisionDb ? compDivisionDb.id : null;
                                                        playerObj.competitionMembershipProductDivisionId = userReg.competitionMembershipProductDivisionId;
                                                        playerObj.competitionMembershipProductTypeId = sp.competitionMembershipProductTypeId;
                                                        playerObj.competitionId = competitionId;
                                                        playerObj.organisationId = organisationId;
                                                        playerObj.userRegistrationId = UserRegistrationRes1.id
                                                        playerObj.teamId = teamId;
                                                        playerObj.statusRefId = 2;
                                                        playerObj.payingFor = p.payingFor;
                                                        playerObj.userId = userRes1.id;
                                                        playerObj.createdBy = userRes.id;
                                                        playerArr.push(playerObj);

                                                        let ureplayerDb = await this.ureService.findExisting(userRes1.id, competitionId, 1, 18)
                                                        if (ureplayerDb == undefined) {
                                                            await this.createTeamUre(userRes1.id, competitionId, userRes.id, 18)
                                                        }
                                                    } else {
                                                        let nonPlayerDb1 = await this.nonPlayerService.findExistingNonPlayer(userRes1.id, competitionId, organisationId, p.competitionMembershipProductTypeId)

                                                        let nonPlayer = new NonPlayer();
                                                        nonPlayer.id = 0;//nonPlayerDb1 != undefined ? nonPlayerDb1.id : 0;
                                                        nonPlayer.userId = userRes1.id;
                                                        nonPlayer.payingFor = p.payingFor;
                                                        nonPlayer.competitionId = competitionId;
                                                        nonPlayer.organisationId = organisationId;
                                                        nonPlayer.statusRefId = 2;
                                                        nonPlayer.userRegistrationId = UserRegistrationRes1.id
                                                        nonPlayer.competitionMembershipProductTypeId = sp.competitionMembershipProductTypeId;
                                                        // nonPlayer.childrenCheckNumber = userReg.childrenCheckNumber;
                                                        nonPlayer.createdBy = userRes.id;
                                                        await this.nonPlayerService.createOrUpdate(nonPlayer);
                                                        //--- to use      let productType = userReg.membershipProducts.find(x => x.name == "Coach");

                                                        let roleId = 16;
                                                        if (sp.productTypeName == AppConstants.coach) {
                                                            roleId = AppConstants.coachRoleId
                                                        } else if (sp.productTypeName == AppConstants.umpire) {
                                                            roleId = AppConstants.umpireRoleId
                                                        }
                                                        let ureplayerDb = await this.ureService.findExisting(userRes1.id, competitionId, 1, roleId)
                                                        if (ureplayerDb == undefined) {
                                                            await this.createTeamUre(userRes1.id, competitionId, userRes.id, roleId)
                                                        }
                                                    }
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                            await this.player1Service.batchCreateOrUpdate(playerArr);
                        } else {
                            isParticipantAvailable = true;
                            // let userFromDb = await this.userService.findById(userReg.userId);
                            // AS 16/2  only update claimed profiles!

                            let userDb = null;//= userFromDb;
                            // userDb = await this.userService.findByEmail(userReg.email.toLowerCase());
                            // if (!userDb) {
                            //     userDb = await this.userService.findByNameAndNumber(userReg.firstName.toLowerCase(), userReg.lastName.toLowerCase(), userReg.mobileNumber);
                            // }
                            // if (userDb) {
                            //     let tempMail = this.getTempMail(userDb)
                            //
                            //     if (tempMail == AppConstants.playerwsaDomain) {
                            //         userDb.password = null;
                            //         await this.userService.createOrUpdate(userDb);
                            //     }
                            // }

                            if (!userDb) {
                                userDb = await this.userService.findUserByMatchingDetails(userReg)
                            }
                            let participantEmail = '';

                            if (userReg.referParentEmail) {
                                if (isArrayPopulated(userReg.tempParents)) {
                                    let parentEmail = userReg.tempParents[0];
                                    // let parentUserId = parentOrGuardianMap.get(tempParentId);
                                    // let parentUser = await this.userService.findById(parentUserId);
                                    participantEmail = parentEmail.toLowerCase() + '.' + userReg.firstName.toLowerCase();
                                } else {
                                    let parent = userReg.parentOrGuardian[0]
                                    participantEmail = parent.email.toLowerCase() + '.' + userReg.firstName.toLowerCase();
                                }
                            } else {
                                participantEmail = userReg.email.toLowerCase();
                            }

                            let user = new User();
                            // this was just a temp address so we blank out the password, so that a password is created
                            // if (userFromDb) {
                            //     let tempMail = this.getTempMail(userFromDb)
                            //     if (tempMail == AppConstants.playerwsaDomain) {
                            //         userFromDb.password = null;
                            //         await this.userService.createOrUpdate(userFromDb);
                            //     }
                            // }

                            user.id = (userDb ? userDb.id : 0);
                            user.firstName = userReg.firstName;
                            user.middleName = userReg.middleName;
                            user.lastName = userReg.lastName;
                            user.mobileNumber = userReg.mobileNumber;
                            user.genderRefId = userReg.genderRefId;
                            user.email = participantEmail;
                            user.dateOfBirth = userReg.dateOfBirth;
                            user.childrenCheckNumber = userReg.additionalInfo.childrenCheckNumber;
                            user.childrenCheckExpiryDate = userReg.additionalInfo.childrenCheckExpiryDate;
                            user.photoUrl = userReg.photoUrl;
                            user.street1 = userReg.street1;
                            user.street2 = userReg.street2;
                            user.suburb = userReg.suburb;
                            user.stateRefId = userReg.stateRefId;
                            user.countryRefId = userReg.countryRefId;
                            user.postalCode = userReg.postalCode;
                            user.emergencyFirstName = userReg.emergencyFirstName;
                            user.emergencyLastName = userReg.emergencyLastName;
                            user.emergencyContactNumber = userReg.emergencyContactNumber;
                            user.emergencyContactRelationshipId = userReg.emergencyContactRelationshipId;
                            user.statusRefId = userReg.referParentEmail ? 0 : 1;
                            user.isInActive = userReg.referParentEmail ? 1 : 0;
                            user.accreditationLevelUmpireRefId = userReg.additionalInfo.accreditationLevelUmpireRefId;
                            user.accreditationUmpireExpiryDate = userReg.additionalInfo.accreditationUmpireExpiryDate;
                            user.associationLevelInfo = userReg.additionalInfo.associationLevelInfo;
                            user.accreditationLevelCoachRefId = userReg.additionalInfo.accreditationLevelCoachRefId;
                            user.accreditationCoachExpiryDate = userReg.additionalInfo.accreditationCoachExpiryDate;
                            user.isPrerequestTrainingComplete = userReg.additionalInfo.isPrerequestTrainingComplete;

                            let password = Math.random().toString(36).slice(-8);
                            if (!isNullOrUndefined(userDb)) {
                                user.createdBy = userId;
                                // user.password = md5(AppConstants.password);
                            } else {
                                user.updatedBy = userId;
                                user.updatedOn = new Date();
                            }

                            let userRes = await this.userService.createOrUpdate(user);

                            if (userDb != undefined) {
                                if (userDb.email !== participantEmail.toLowerCase()) {
                                    await this.updateFirebaseData(userRes, userDb.password);
                                }
                            }

                            i++;

                            if (isArrayPopulated(userReg.parentOrGuardian)) {
                                for (let pg of userReg.parentOrGuardian) {
                                    let userParentDb = await this.userService.findByEmail(pg.email.toLowerCase())
                                    // if (pg.userId == 0) {
                                    //     userParentDb = await this.userService.findByEmail(pg.email.toLowerCase())
                                    // } else {
                                    //     userParentDb = await this.userService.findById(pg.userId);
                                    // }
                                    let userPG = new User();
                                    userPG.id = userParentDb != undefined ? userParentDb.id : 0;
                                    userPG.firstName = pg.firstName;
                                    userPG.lastName = pg.lastName;
                                    userPG.middleName = pg.middleName;
                                    userPG.mobileNumber = pg.mobileNumber;
                                    userPG.email = pg.email.toLowerCase();
                                    userPG.street1 = pg.street1;
                                    userPG.street2 = pg.street2;
                                    userPG.suburb = pg.suburb;
                                    userPG.stateRefId = pg.stateRefId;
                                    userPG.countryRefId = pg.countryRefId;
                                    userPG.postalCode = pg.postalCode;
                                    let password = Math.random().toString(36).slice(-8);
                                    if (pg.userId == 0 || pg.userId == "" || pg.userId == null) {
                                        userPG.createdBy = userId;
                                        // userPG.password = md5(AppConstants.password);
                                    }
                                    let parentOrGuardianUser = await this.userService.createOrUpdate(userPG);
                                    if (pg.userId == 0 || pg.userId == null || pg.userId == "") {
                                        // await this.updateFirebaseData(parentOrGuardianUser, userPG.password);
                                    }
                                    if (userParentDb != undefined) {
                                        if (userParentDb.email !== pg.email.toLowerCase()) {
                                            await this.updateFirebaseData(parentOrGuardianUser, userParentDb.password);
                                        }
                                    }
                                    let ureparentDb = await this.ureService.findExisting(userPG.id, userRes.id, 4, 9)
                                    let ureparent = new UserRoleEntity();
                                    if (ureparentDb) {
                                        ureparent.id = ureparentDb.id;
                                        ureparent.updatedBy = userId;
                                        ureparent.updatedAt = new Date();
                                    } else {
                                        ureparent.id = 0;
                                        ureparent.createdBy = userId;
                                    }
                                    ureparent.roleId = 9;
                                    ureparent.userId = parentOrGuardianUser.id
                                    ureparent.entityId = userRes.id;
                                    ureparent.entityTypeId = 4;
                                    await this.ureService.createOrUpdate(ureparent);
                                    parentOrGuardianMap.set(pg.email, parentOrGuardianUser.id)
                                }
                            }
                            if (isArrayPopulated(userReg.tempParents)) {
                                for (let tempParent of userReg.tempParents) {
                                    let tempParentObj = {
                                        userId: userRes.id,
                                        parentEmail: tempParent
                                    }
                                    tempParentArray.push(tempParentObj);
                                }
                            }
                            let userRegister = new UserRegistration();
                            userRegister.id = userReg.userRegistrationId;
                            userRegister.userId = userRes.id;
                            userRegister.existingMedicalCondition = userReg.additionalInfo.existingMedicalCondition;
                            userRegister.regularMedication = userReg.additionalInfo.regularMedication;
                            userRegister.heardByRefId = userReg.additionalInfo.heardByRefId;
                            userRegister.heardByOther = userReg.additionalInfo.heardByOther;
                            userRegister.favouriteTeamRefId = userReg.additionalInfo.favouriteTeamRefId;
                            userRegister.favouriteFireBird = userReg.additionalInfo.favouriteFireBird;
                            userRegister.isConsentPhotosGiven = userReg.additionalInfo.isConsentPhotosGiven;
                            userRegister.isDisability = userReg.additionalInfo.isDisability;
                            userRegister.registeringYourselfRefId = userReg.registeringYourself;
                            userRegister.disabilityCareNumber = userReg.additionalInfo.disabilityCareNumber;
                            userRegister.disabilityTypeRefId = userReg.additionalInfo.disabilityTypeRefId;
                            userRegister.userRegUniqueKey = uuidv4();
                            userRegister.identifyRefId = userReg.additionalInfo.identifyRefId;
                            userRegister.injuryInfo = userReg.additionalInfo.injuryInfo;
                            userRegister.allergyInfo = userReg.additionalInfo.allergyInfo;
                            userRegister.yearsPlayed = userReg.additionalInfo.yearsPlayed;
                            userRegister.schoolId = userReg.additionalInfo.schoolId;
                            userRegister.schoolGradeInfo = userReg.additionalInfo.schoolGradeInfo;
                            userRegister.isParticipatedInSSP = userReg.additionalInfo.isParticipatedInSSP;
                            userRegister.otherSportsInfo = (userReg.additionalInfo.otherSportsInfo ? JSON.stringify(userReg.additionalInfo.otherSportsInfo) : null);
                            userRegister.volunteerInfo = (volunteerInfo ? JSON.stringify(volunteerInfo) : null);
                            userRegister.walkingNetball = (userReg.additionalInfo.walkingNetball ? JSON.stringify(userReg.additionalInfo.walkingNetball) : null);
                            userRegister.walkingNetballInfo = userReg.additionalInfo.walkingNetballInfo;

                            userRegister.countryRefId = userReg.additionalInfo.countryRefId;

                            // if (userReg.userRegistrationId == 0 || userReg.userRegistrationId == "") {
                            userRegister.createdBy = userId;
                            // }
                            let UserRegistrationRes = await this.userRegistrationService.createOrUpdate(userRegister);
                            if (isArrayPopulated(userReg.competitions)) {
                                for (let comp of userReg.competitions) {
                                    let orgParticipant = registrationProduct.compParticipants.find(x => (x.isTeamRegistration == 0 || x.isTeamRegistration == null) && x.email.toLowerCase() == userReg.email.toLowerCase()
                                        && x.competitionUniqueKey == comp.competitionId && x.organisationUniqueKey == comp.organisationId)
                                    let competitionId = await this.competitionRegService.findByUniquekey(comp.competitionId);
                                    let organisationId = await this.organisationService.findByUniquekey(comp.organisationId);
                                    let orgRegistrationId = await this.orgRegistrationService.findOrgRegId(competitionId, organisationId)
                                    let orptExist = await this.orgRegistrationParticipantService.findByTemplate(orgRegistrationId, registrationRes.id, UserRegistrationRes.id);
                                    if (orptExist == undefined) {
                                        let orpt = new OrgRegistrationParticipant();
                                        orpt.id = 0;
                                        orpt.orgRegistrationId = orgRegistrationId;
                                        orpt.registrationId = registrationRes.id;
                                        orpt.userRegistrationId = UserRegistrationRes.id;
                                        orpt.paymentOptionRefId = ((orgParticipant && orgParticipant.selectedOptions) ? orgParticipant.selectedOptions.paymentOptionRefId : 0);
                                        orpt.voucherCode = (orgParticipant && orgParticipant.selectedOptions && isArrayPopulated(orgParticipant.selectedOptions.selectedGovernmentVouchers)) ?
                                            orgParticipant.selectedOptions.selectedGovernmentVouchers.find(x => x).voucherCode : null;
                                        orpt.createdBy = userId;
                                        orpt.tShirtSizeRefId = comp.tShirtSizeRefId ? comp.tShirtSizeRefId : null;
                                        await this.orgRegistrationParticipantService.createOrUpdate(orpt);
                                    }
                                    if (isArrayPopulated(comp.divisions)) {
                                        for (let div of comp.divisions) {
                                            // let deletedMembershipProduct = getDeletedProducts.find(x => x.competitionMembershipProductTypeId == div.competitionMembershipProductTypeId &&
                                            //     x.competitionMembershipProductDivisionId == div.competitionMembershipProductDivisionId);

                                            // if (deletedMembershipProduct == undefined) {
                                            let compDivisionDb = await this.competitionDivisionService.findBycmpd(div.competitionMembershipProductDivisionId)
                                            let player = new Player();
                                            player.id = 0;
                                            player.userRegistrationId = UserRegistrationRes.id;
                                            player.userId = userRes.id;
                                            player.competitionId = competitionId;
                                            player.organisationId = organisationId;
                                            player.statusRefId = 2;
                                            player.competitionDivisionId = compDivisionDb ? compDivisionDb.id : null;
                                            player.competitionMembershipProductDivisionId = div.competitionMembershipProductDivisionId;
                                            player.competitionMembershipProductTypeId = div.competitionMembershipProductTypeId;
                                            player.positionId1 = comp.positionId1;
                                            player.positionId2 = comp.positionId2;
                                            // if (userReg.playerId == 0 || userReg.playerId == "") {
                                            player.createdBy = userId;
                                            // }
                                            let ureplayerDb = await this.ureService.findExisting(userRes.id, competitionId, 1, 18)
                                            let ureplayer = new UserRoleEntity();
                                            if (ureplayerDb) {
                                                ureplayer.id = ureplayerDb.id;
                                                ureplayer.updatedBy = userId;
                                                ureplayer.updatedAt = new Date();
                                            } else {
                                                ureplayer.id = 0;
                                                ureplayer.createdBy = userId;
                                            }
                                            ureplayer.roleId = 18;
                                            ureplayer.userId = userRes.id;
                                            ureplayer.entityId = competitionId;
                                            ureplayer.entityTypeId = 1;
                                            await this.ureService.createOrUpdate(ureplayer);
                                            let playerRes = await this.player1Service.createOrUpdate(player);

                                            if (isArrayPopulated(comp.friends)) {
                                                for (let friendBody of comp.friends) {
                                                    if ((friendBody.firstName != null && friendBody.firstName != '') || (friendBody.lastName != null && friendBody.lastName != '') || (friendBody.mobileNumber != null && friendBody.mobileNumber != '') || (friendBody.email != null && friendBody.email != '')) {
                                                        let friend = new Friend();
                                                        friend.id = 0;
                                                        friend.firstName = friendBody.firstName;
                                                        friend.lastName = friendBody.lastName;
                                                        friend.middleName = friendBody.middleName;
                                                        friend.email = friendBody.email ? friendBody.email.toLowerCase() : null;
                                                        friend.mobileNumber = friendBody.mobileNumber;
                                                        friend.friendRelationshipTypeRefId = 1;
                                                        friend.playerId = playerRes.id;
                                                        friend.createdBy = userId;
                                                        await this.friendService.createOrUpdate(friend)
                                                    }
                                                }
                                            }
                                            if (isArrayPopulated(comp.referFriends)) {
                                                for (let friendBody of comp.referFriends) {
                                                    if ((friendBody.firstName != null && friendBody.firstName != '') || (friendBody.lastName != null && friendBody.lastName != '') || (friendBody.mobileNumber != null && friendBody.mobileNumber != '') || (friendBody.email != null && friendBody.email != '')) {
                                                        let friend = new Friend();
                                                        friend.id = 0;
                                                        friend.firstName = friendBody.firstName;
                                                        friend.lastName = friendBody.lastName;
                                                        friend.middleName = friendBody.middleName;
                                                        friend.email = friendBody.email ? friendBody.email.toLowerCase() : null;
                                                        friend.mobileNumber = friendBody.mobileNumber
                                                        friend.playerId = playerRes.id;
                                                        friend.friendRelationshipTypeRefId = 2;
                                                        friend.createdBy = userId;
                                                        await this.friendService.createOrUpdate(friend)
                                                    }
                                                }
                                            }
                                        }
                                    }
                                    if (isArrayPopulated(comp.products)) {
                                        for (let product of comp.products) {
                                            if (product.isPlayer != 1) {
                                                // let deletedMembershipProduct = getDeletedProducts.find(x =>
                                                //     x.competitionMembershipProductTypeId == product.competitionMembershipProductTypeId);

                                                // if (deletedMembershipProduct == undefined) {
                                                let nonPlayer = new NonPlayer();
                                                nonPlayer.id = 0;
                                                nonPlayer.userId = userRes.id;
                                                nonPlayer.competitionId = competitionId;
                                                nonPlayer.organisationId = organisationId;
                                                nonPlayer.userRegistrationId = UserRegistrationRes.id;
                                                nonPlayer.statusRefId = 2;
                                                nonPlayer.competitionMembershipProductTypeId = product.competitionMembershipProductTypeId;
                                                // nonPlayer.childrenCheckNumber = userReg.childrenCheckNumber;
                                                // if (userReg.playerId == 0 || userReg.playerId == "") {
                                                nonPlayer.createdBy = userId;
                                                // }

                                                let roleId = await this.findRoleId(product)
                                                let ureplayerDb = await this.ureService.findExisting(userRes.id, competitionId, 1, roleId)
                                                let ureplayer = new UserRoleEntity();
                                                if (ureplayerDb) {
                                                    ureplayer.id = ureplayerDb.id;
                                                    ureplayer.updatedBy = userId;
                                                    ureplayer.updatedAt = new Date();
                                                } else {
                                                    ureplayer.id = 0;
                                                    ureplayer.createdBy = userId;
                                                }
                                                ureplayer.roleId = roleId;
                                                ureplayer.userId = userRes.id;
                                                ureplayer.entityId = competitionId;
                                                ureplayer.entityTypeId = 1;
                                                await this.ureService.createOrUpdate(ureplayer);
                                                await this.nonPlayerService.createOrUpdate(nonPlayer);
                                                //}
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }

                if (isArrayPopulated(tempParentArray)) {
                    for (let tempParent of tempParentArray) {
                        let ureparentDb = await this.ureService.findExisting(parentOrGuardianMap.get(tempParent.parentEmail), tempParent.userId, 4, 9)
                        let ureparent = new UserRoleEntity();
                        if (ureparentDb) {
                            ureparent.id = ureparentDb.id;
                            ureparent.updatedBy = userId;
                            ureparent.updatedAt = new Date();
                        } else {
                            ureparent.id = 0;
                            ureparent.createdBy = userId;
                        }
                        ureparent.roleId = 9;
                        ureparent.userId = parentOrGuardianMap.get(tempParent.parentEmail)
                        ureparent.entityId = tempParent.userId;
                        ureparent.entityTypeId = 4;

                        await this.ureService.createOrUpdate(ureparent);
                    }
                }
            }
        } catch (error) {
            logger.error(` ERROR occurred in Payment Controller registration save ` + error)
            throw error;
        }
    }

    async checkOrganisationStripeAccount(registrationData) {
        try {
            let obj = {
                membershipStripeAccountIdError: false,
                competitionStripeAccountIdError: false,
                affiliateStripeAccountIdError: false,
                competitionOrganisationName: '',
                affiliateOrganisationName: '',
                membershipOrganisationName: ''
            }
            if (isArrayPopulated(registrationData.compParticipants)) {
                for (let j of registrationData.compParticipants) {
                    if (isArrayPopulated(j.membershipProducts)) {
                        for (let k of j.membershipProducts) {
                            const membershipData = isNotNullAndUndefined(k.fees.membershipFee) ? k.fees.membershipFee : Object.assign({});
                            const compOrgData = isNotNullAndUndefined(k.fees.competitionOrganisorFee) ? k.fees.competitionOrganisorFee : Object.assign({});
                            const affiliateData = isNotNullAndUndefined(k.fees.affiliateFee) ? k.fees.affiliateFee : Object.assign({});

                            if (objectIsNotEmpty(membershipData) || objectIsNotEmpty(compOrgData) || objectIsNotEmpty(affiliateData)) {
                                if (objectIsNotEmpty(membershipData)) {
                                    let mOrgData = await this.organisationService.findOrganisationByUniqueKey(membershipData.organisationId);
                                    let mStripeAccountId = null;
                                    if (isArrayPopulated(mOrgData)) {
                                        mStripeAccountId = mOrgData[0].stripeAccountID;
                                        membershipData["organisationAccountId"] = mStripeAccountId;
                                    }
                                    if (mStripeAccountId === null) {
                                        obj.membershipStripeAccountIdError = true;
                                        obj.membershipOrganisationName = membershipData['name'];
                                        break;
                                    }
                                }

                                if (objectIsNotEmpty(compOrgData)) {
                                    let cOrgData = await this.organisationService.findOrganisationByUniqueKey(compOrgData.organisationId);
                                    let cStripeAccountId = null;
                                    if (isArrayPopulated(cOrgData)) {
                                        cStripeAccountId = cOrgData[0].stripeAccountID;
                                        compOrgData["organisationAccountId"] = cStripeAccountId;
                                    }

                                    if (cStripeAccountId === null) {
                                        obj.competitionStripeAccountIdError = true;
                                        obj.competitionOrganisationName = compOrgData['name'];
                                        break;
                                    }
                                }

                                if (objectIsNotEmpty(affiliateData)) {
                                    let aOrgData = await this.organisationService.findOrganisationByUniqueKey(affiliateData.organisationId);
                                    let aStripeAccountId = null;
                                    if (isArrayPopulated(aOrgData)) {
                                        aStripeAccountId = aOrgData[0].stripeAccountID;
                                        affiliateData["organisationAccountId"] = aStripeAccountId;
                                    }
                                    if (aStripeAccountId === null) {
                                        obj.affiliateStripeAccountIdError = true;
                                        obj.affiliateOrganisationName = affiliateData['name'];
                                        break;
                                    }
                                }
                            }
                        }
                    }
                }
            }
            return obj;
        } catch (error) {
            throw error;
        }
    }

    public async performCCInvoicePayment(
        registrationProduct, paymentIntent, CURRENCY_TYPE, registration,
        INVOICE_ID, paymentType, transArr, totalFee, paidBy, teamMemberRegId
    ) {
        try {
            let personMap = null;
            if (totalFee > 0) {
                let transferGroup = null;
                if (teamMemberRegId) {
                    transferGroup = AppConstants.teamMemberRegistration + "#" + registration.registrationUniqueKey + "#" + teamMemberRegId;
                } else {
                    transferGroup = AppConstants.registration + "#" + registration.registrationUniqueKey;
                }
                let trans = await this.performInvoicePayment(
                    registrationProduct, paymentIntent, CURRENCY_TYPE, registration, INVOICE_ID,
                    transferGroup, AppConstants.registration, paymentType, paidBy
                );
                transArr.push(...trans);

                personMap = await this.createTransactions(transArr, registration, paidBy);
            }
            await this.performCreditCardPaymentOperation(
                registrationProduct, registration, INVOICE_ID, totalFee,
                paymentIntent, paymentType, paidBy, teamMemberRegId, personMap
            )
            if (teamMemberRegId == null)
                await this.registrationMail(registration, registrationProduct, 1, INVOICE_ID)
            else
                await this.teamMemberRegMail(registration, teamMemberRegId)

            if (paymentType == null) await this.updateInvoice(INVOICE_ID, AppConstants.success);
        } catch (error) {
            throw error;
        }
    }

    async performInvoicePayment(registrationData, paymentIntent, currencyType, registration, invoiceId, transferGroup, registrationMode, paymentType, paidBy) {
        try {
            logger.info(`Inside the performInvoicePayment ${JSON.stringify(paymentIntent)}`);
            let organsationList = [];
            let transArr = [];
            let otherParticipants = [];
            let statusRefId = this.getTransactionStatus(paymentType);
            let statusRefIdDD = this.getTransactionStatusDD(paymentType);

            (registrationData.compParticipants.map((item) => {
                if ((item.selectedOptions.paymentOptionRefId != 5 ||
                    (item.selectedOptions.paymentOptionRefId == 5 && item.selectedOptions.isSchoolRegCodeApplied == 0)) &&
                    item.selectedOptions.isHardshipCodeApplied == 0) {
                    //otherParticipants.push(item);
                    item["canPerformTransaction"] = 1;
                } else {
                    item["canPerformTransaction"] = 0;
                    statusRefId = AppConstants.NOT_PAID;
                    statusRefIdDD = AppConstants.NOT_PAID;
                }
                if (!paymentIntent) {
                    item["canPerformTransaction"] = 0;
                }
                otherParticipants.push(item);
            }));

            for (let item of otherParticipants) {
                let transObj = null;
                let playerName = null;
                let registeringPerson = null;
                let registeringOrgName = item['organisationName'];
                if (item.isTeamRegistration == null || item.isTeamRegistration == 0) {
                    transObj = JSON.parse(JSON.stringify(this.getTransObj()));
                    registeringPerson = formatPersonName(item.firstName, null, item.lastName);
                }

                // let orgRegistration = await this.orgRegistrationService.findById(item.orgRegistrationId);
                // if (orgRegistration) {
                //     let registeringOrganisation = await this.organisationService.findById(orgRegistration.organisationId);
                //     registeringOrgName = registeringOrganisation ? registeringOrganisation.name : "";
                // }

                let paymentOptionRefId = item.selectedOptions.paymentOptionRefId;
                let paymentFeeTypeRefId = this.getPaymentFeeTypeRefId(paymentOptionRefId, item.isTeamRegistration);
                if (isArrayPopulated(item.membershipProducts)) {
                    for (let mem of item.membershipProducts) {
                        if (item.isTeamRegistration == 1) {
                            transObj = JSON.parse(JSON.stringify(this.getTransObj()));
                            playerName = formatPersonName(mem.firstName, null, mem.lastName);
                            registeringPerson = formatPersonName(item.firstName, null, item.lastName);
                        }
                        const membershipData = isNotNullAndUndefined(mem.fees.membershipFee) ? mem.fees.membershipFee : Object.assign({});
                        const compOrgData = isNotNullAndUndefined(mem.fees.competitionOrganisorFee) ? mem.fees.competitionOrganisorFee : Object.assign({});
                        const affiliateData = isNotNullAndUndefined(mem.fees.affiliateFee) ? mem.fees.affiliateFee : Object.assign({});
                        let description = null;
                        const competitionOrganiserOrganisationName_: string = compOrgData['name'];
                        // const playerName_: string = formatPersonName(item.firstName, null, item.lastName);
                        const competitionId_ = await this.competitionRegService.findByUniquekey(item.competitionUniqueKey);

                        const membershipProductTypeName_ = mem.membershipTypeName;
                        const membershipMappingId_ = mem.membershipMappingId;
                        let compDivisionDb = await this.competitionDivisionService.findBycmpd(mem.divisionId)
                        const divisionId_ = compDivisionDb != undefined ? compDivisionDb.id : 0;
                        transObj.firstName = mem.firstName;
                        transObj.lastName = mem.lastName;
                        transObj.mobileNumber = mem.mobileNumber;
                        transObj.email = mem.email;
                        if (item.isTeamRegistration && item.email != mem.email) {
                            description = `${registeringPerson} -  ${membershipProductTypeName_} - ${playerName}`;
                        } else {
                            description = `${registeringPerson} - ${membershipProductTypeName_}`;
                        }

                        if (objectIsNotEmpty(membershipData)) {
                            const membershipProductOrganisationName_: string = `${membershipData['name']}`;
                            const membershipProductTypeTotalAmount_ = feeIsNull(membershipData.feesToPay) +
                                feeIsNull(membershipData.feesToPayGST) -
                                feeIsNull(membershipData.discountsToDeduct) -
                                feeIsNull(membershipData.childDiscountsToDeduct) -
                                feeIsNull(membershipData.governmentVoucherAmount);
                            const membershipProductTypeFeeAmount_ = feeIsNull(membershipData.feesToPay);
                            const membershipProductTypeGstAmount_ = feeIsNull(membershipData.feesToPayGST);
                            const membershipProductTypeDiscountAmount_ = feeIsNull(membershipData.discountsToDeduct);
                            const membershipProductFamilyDiscountAmount_ = feeIsNull(membershipData.childDiscountsToDeduct);
                            const membershipProductGVAmount_ = feeIsNull(membershipData.governmentVoucherAmount);
                            const STRIPE_MEMBERSHIP_TOTAL_FEE = formatFeeForStripe1(membershipProductTypeTotalAmount_);

                            const membershipOrganisationAccountId_ = membershipData.organisationAccountId;
                            const orgData = await this.organisationService.findOrgByUniquekey(membershipData.organisationId);
                            const membershipOrganisationId_ = orgData.id;

                            organsationList.push({ org: orgData, type: AppConstants.membership });

                            // transfer for membershipFees
                            let transferForMembershipFee = null;

                            if (STRIPE_MEMBERSHIP_TOTAL_FEE >= 1) {
                                if (item.canPerformTransaction) {
                                    if (transferGroup != null) {
                                        transferForMembershipFee = await stripe.transfers.create({
                                            amount: STRIPE_MEMBERSHIP_TOTAL_FEE,
                                            currency: currencyType,
                                            description: `${description} - ${membershipProductOrganisationName_} - ${registeringOrgName} - MEMBERSHIP FEE`,
                                            source_transaction: paymentIntent.charges.data.length > 0 ? paymentIntent.charges.data[0].id : paymentIntent.id,
                                            destination: membershipOrganisationAccountId_,
                                            transfer_group: transferGroup
                                        });
                                    } else {
                                        transferForMembershipFee = await stripe.transfers.create({
                                            amount: STRIPE_MEMBERSHIP_TOTAL_FEE,
                                            currency: currencyType,
                                            description: `${description} - ${membershipProductOrganisationName_} - ${registeringOrgName} - MEMBERSHIP FEE`,
                                            source_transaction: paymentIntent.charges.data.length > 0 ? paymentIntent.charges.data[0].id : paymentIntent.id,
                                            destination: membershipOrganisationAccountId_
                                        });
                                    }
                                }
                            } else {
                                await this.deleteByTransactionId(membershipData.transactionId)
                            }

                            let transactionId = this.getTransactionId(registrationMode, membershipData.transactionId);

                            let trxnMembership = this.getTransactionObj(invoiceId, registration.createdBy, membershipProductTypeFeeAmount_,
                                membershipProductTypeGstAmount_, membershipProductTypeDiscountAmount_, membershipProductFamilyDiscountAmount_, AppConstants.membership,
                                membershipMappingId_, competitionId_, membershipOrganisationId_, paymentOptionRefId, paymentFeeTypeRefId,
                                divisionId_, membershipProductGVAmount_, transferForMembershipFee, transactionId, statusRefIdDD, mem.divisionId, FinanceFeeType.Membership);

                            transObj.transactions.push(trxnMembership);
                        }

                        if (objectIsNotEmpty(compOrgData)) {
                            const competitionTotalAmount_: number = feeIsNull(compOrgData.feesToPay) +
                                feeIsNull(compOrgData.feesToPayGST) -
                                feeIsNull(compOrgData.discountsToDeduct) -
                                feeIsNull(compOrgData.childDiscountsToDeduct) -
                                feeIsNull(compOrgData.governmentVoucherAmount);

                            const competitionFeeAmount_: number = feeIsNull(compOrgData.feesToPay);
                            const competitionGstAmount_: number = feeIsNull(compOrgData.feesToPayGST);
                            const competitionDiscountAmount_: number = feeIsNull(compOrgData.discountsToDeduct);
                            const competitionFamilyDiscountAmount_: number = feeIsNull(compOrgData.childDiscountsToDeduct);
                            const competitionGVAmount_: number = feeIsNull(compOrgData.governmentVoucherAmount);
                            const nominationGVAmount_: number = feeIsNull(compOrgData.nominationGVAmount);
                            const competitionNominationFeeAmount_: number = feeIsNull(compOrgData.nominationFeeToPay);
                            const competitionNominationGstAmount_: number = feeIsNull(compOrgData.nominationGSTToPay);
                            const competitionNomDiscountAmount_: number = feeIsNull(compOrgData.nomDiscountsToDeduct);
                            const competitionNomChildDiscountAmount_: number = feeIsNull(compOrgData.nomChildDiscountsToDeduct);
                            const STRIPE_COMPETITION_TOTAL_FEE = formatFeeForStripe1(competitionTotalAmount_);

                            const cOrganisationAccountId_: string = compOrgData.organisationAccountId;
                            const orgData = await this.organisationService.findOrgByUniquekey(compOrgData.organisationId);
                            const cOrganisationId_: number = orgData.id;
                            organsationList.push({ org: orgData, type: AppConstants.competition });

                            let transferForCompetitionOrganiser = null;
                            // transfer to association for organiser fees
                            if (STRIPE_COMPETITION_TOTAL_FEE >= 1) {
                                if (item.canPerformTransaction) {
                                    if (transferGroup != null) {
                                        transferForCompetitionOrganiser = await stripe.transfers.create({
                                            amount: STRIPE_COMPETITION_TOTAL_FEE,
                                            currency: currencyType,
                                            description: `${description} - ${competitionOrganiserOrganisationName_} - ${registeringOrgName} - COMPETITION FEE`,
                                            destination: cOrganisationAccountId_,
                                            source_transaction: paymentIntent.charges.data.length > 0 ? paymentIntent.charges.data[0].id : paymentIntent.id,
                                            transfer_group: transferGroup
                                        });
                                    } else {
                                        transferForCompetitionOrganiser = await stripe.transfers.create({
                                            amount: STRIPE_COMPETITION_TOTAL_FEE,
                                            currency: currencyType,
                                            description: `${description} - ${competitionOrganiserOrganisationName_} - ${registeringOrgName} - COMPETITION FEE`,
                                            destination: cOrganisationAccountId_,
                                            source_transaction: paymentIntent.charges.data.length > 0 ? paymentIntent.charges.data[0].id : paymentIntent.id,
                                        });
                                    }
                                }
                            } else {
                                await this.deleteByTransactionId(compOrgData.transactionId)
                            }

                            let transactionId = this.getTransactionId(registrationMode, compOrgData.transactionId);

                            let trxnCompetition = this.getTransactionObj(invoiceId, registration.createdBy, competitionFeeAmount_,
                                competitionGstAmount_, competitionDiscountAmount_, competitionFamilyDiscountAmount_, AppConstants.competition,
                                membershipMappingId_, competitionId_, cOrganisationId_, paymentOptionRefId, paymentFeeTypeRefId,
                                divisionId_, competitionGVAmount_, transferForCompetitionOrganiser, transactionId, statusRefId, mem.divisionId, FinanceFeeType.Competition);

                            transObj.transactions.push(trxnCompetition);

                            const nominationTotalAmount_: number = competitionNominationFeeAmount_ +
                                competitionNominationGstAmount_ - nominationGVAmount_ -
                                competitionNomDiscountAmount_ - competitionNomChildDiscountAmount_;

                            const STRIPE_NOMINATION_TOTAL_FEE = formatFeeForStripe1(nominationTotalAmount_);
                            let transferForCompetitionNomOrganiser = null;
                            if (STRIPE_NOMINATION_TOTAL_FEE >= 1) {
                                if (item.canPerformTransaction) {
                                    if (transferGroup != null) {
                                        transferForCompetitionNomOrganiser = await stripe.transfers.create({
                                            amount: STRIPE_NOMINATION_TOTAL_FEE,
                                            currency: currencyType,
                                            description: `${description} - ${competitionOrganiserOrganisationName_} - ${registeringOrgName} - NOMINATION FEE`,
                                            destination: cOrganisationAccountId_,
                                            source_transaction: paymentIntent.charges.data.length > 0 ? paymentIntent.charges.data[0].id : paymentIntent.id,
                                            transfer_group: transferGroup
                                        });
                                    } else {
                                        transferForCompetitionNomOrganiser = await stripe.transfers.create({
                                            amount: STRIPE_NOMINATION_TOTAL_FEE,
                                            currency: currencyType,
                                            description: `${description} - ${competitionOrganiserOrganisationName_} - ${registeringOrgName} - NOMINATION FEE`,
                                            destination: cOrganisationAccountId_,
                                            source_transaction: paymentIntent.charges.data.length > 0 ? paymentIntent.charges.data[0].id : paymentIntent.id,
                                        });
                                    }
                                }
                            } else {
                                await this.deleteByTransactionId(compOrgData.nominationTransId)
                            }

                            let transactionIdCompNom = this.getTransactionId(registrationMode, compOrgData.nominationTransId);

                            let trxnNomination = this.getTransactionObj(invoiceId, registration.createdBy, competitionNominationFeeAmount_,
                                competitionNominationGstAmount_, competitionNomDiscountAmount_, competitionNomChildDiscountAmount_, AppConstants.nomination,
                                membershipMappingId_, competitionId_, cOrganisationId_, paymentOptionRefId, paymentFeeTypeRefId,
                                divisionId_, nominationGVAmount_, transferForCompetitionNomOrganiser, transactionIdCompNom, statusRefIdDD, mem.divisionId, FinanceFeeType.Nomination);

                            transObj.transactions.push(trxnNomination);
                        }

                        if (objectIsNotEmpty(affiliateData)) {
                            let affiliateTotalAmount_: number = feeIsNull(affiliateData.feesToPay) +
                                feeIsNull(affiliateData.feesToPayGST) -
                                feeIsNull(affiliateData.discountsToDeduct) -
                                feeIsNull(affiliateData.childDiscountsToDeduct) -
                                feeIsNull(affiliateData.governmentVoucherAmount);

                            let affiliateFeeAmount_: number = feeIsNull(affiliateData.feesToPay);
                            let affiliateGstAmount_: number = feeIsNull(affiliateData.feesToPayGST);
                            let affiliateDiscountAmount_: number = feeIsNull(affiliateData.discountsToDeduct);
                            let affiliateFamilyDiscountAmount_: number = feeIsNull(affiliateData.childDiscountsToDeduct);
                            let affiliateGVAmount_: number = feeIsNull(affiliateData.governmentVoucherAmount);
                            const nominationGVAmount_: number = feeIsNull(affiliateData.nominationGVAmount);
                            const affiliateNominationFeeAmount_: number = feeIsNull(affiliateData.nominationFeeToPay);
                            const affiliateNominationGstAmount_: number = feeIsNull(affiliateData.nominationGSTToPay);
                            const affiliateNomDiscountAmount_: number = feeIsNull(affiliateData.nomDiscountsToDeduct);
                            const affiliateFamilyNomDiscountAmount_: number = feeIsNull(affiliateData.nomChildDiscountsToDeduct);

                            const STRIPE_AFFILIATE_TOTAL_AMOUNT = formatFeeForStripe1(affiliateTotalAmount_);
                            const orgData = await this.organisationService.findOrgByUniquekey(affiliateData.organisationId);
                            let aOrganisationId_: number = orgData.id;
                            let aOrganisationAccountId_: string = affiliateData.organisationAccountId;
                            const affiliateOrganisationName_: string = affiliateData.name;

                            organsationList.push({ org: orgData, type: AppConstants.affiliate });

                            let transferForAffiliateFee = null;
                            // transfer for affiliateFees
                            if (STRIPE_AFFILIATE_TOTAL_AMOUNT >= 1) {
                                if (item.canPerformTransaction) {
                                    if (transferGroup != null) {
                                        transferForAffiliateFee = await stripe.transfers.create({
                                            amount: STRIPE_AFFILIATE_TOTAL_AMOUNT,
                                            description: `${description} - ${affiliateOrganisationName_} - ${registeringOrgName} - AFFILIATE FEE`,
                                            currency: currencyType,
                                            destination: aOrganisationAccountId_,
                                            source_transaction: paymentIntent.charges.data.length > 0 ? paymentIntent.charges.data[0].id : paymentIntent.id,
                                            transfer_group: transferGroup
                                        });
                                    } else {
                                        transferForAffiliateFee = await stripe.transfers.create({
                                            amount: STRIPE_AFFILIATE_TOTAL_AMOUNT,
                                            description: `${description} - ${affiliateOrganisationName_} - ${registeringOrgName} - AFFILIATE FEE`,
                                            currency: currencyType,
                                            destination: aOrganisationAccountId_,
                                            source_transaction: paymentIntent.charges.data.length > 0 ? paymentIntent.charges.data[0].id : paymentIntent.id,
                                        });
                                    }
                                }

                                // await this.transactionService.createOrUpdate(trxnAffiliate);
                            } else {
                                await this.deleteByTransactionId(affiliateData.transactionId)
                            }

                            let transactionId = this.getTransactionId(registrationMode, affiliateData.transactionId);

                            let trxnAffiliate = this.getTransactionObj(invoiceId, registration.createdBy, affiliateFeeAmount_,
                                affiliateGstAmount_, affiliateDiscountAmount_, affiliateFamilyDiscountAmount_, AppConstants.affiliate,
                                membershipMappingId_, competitionId_, aOrganisationId_, paymentOptionRefId, paymentFeeTypeRefId,
                                divisionId_, affiliateGVAmount_, transferForAffiliateFee, transactionId, statusRefId, mem.divisionId, FinanceFeeType.AffiliateCompetition);

                            transObj.transactions.push(trxnAffiliate);

                            const nominationTotalAmount_: number = affiliateNominationFeeAmount_ +
                                affiliateNominationGstAmount_ - nominationGVAmount_ - affiliateNomDiscountAmount_ -
                                affiliateFamilyNomDiscountAmount_;
                            const STRIPE_NOMINATION_TOTAL_FEE = formatFeeForStripe1(nominationTotalAmount_);
                            let transferForAffiliateNomFee = null;
                            if (STRIPE_NOMINATION_TOTAL_FEE >= 1) {
                                if (item.canPerformTransaction) {
                                    if (transferGroup != null) {
                                        transferForAffiliateNomFee = await stripe.transfers.create({
                                            amount: STRIPE_NOMINATION_TOTAL_FEE,
                                            currency: currencyType,
                                            description: `${description} - ${affiliateOrganisationName_} - ${registeringOrgName} - NOMINATION FEE`,
                                            destination: aOrganisationAccountId_,
                                            source_transaction: paymentIntent.charges.data.length > 0 ? paymentIntent.charges.data[0].id : paymentIntent.id,
                                            transfer_group: transferGroup
                                        });
                                    } else {
                                        transferForAffiliateNomFee = await stripe.transfers.create({
                                            amount: STRIPE_NOMINATION_TOTAL_FEE,
                                            currency: currencyType,
                                            description: `${description} - ${affiliateOrganisationName_} - ${registeringOrgName} - NOMINATION FEE`,
                                            destination: aOrganisationAccountId_,
                                            source_transaction: paymentIntent.charges.data.length > 0 ? paymentIntent.charges.data[0].id : paymentIntent.id,
                                        });
                                    }
                                }
                            } else {
                                await this.deleteByTransactionId(affiliateData.nominationTransId)
                            }
                            let transactionIdAffNom = this.getTransactionId(registrationMode, affiliateData.nominationTransId);

                            let trxnNomination = this.getTransactionObj(invoiceId, registration.createdBy, affiliateNominationFeeAmount_,
                                affiliateNominationGstAmount_, affiliateNomDiscountAmount_, affiliateFamilyNomDiscountAmount_, AppConstants.nomination,
                                membershipMappingId_, competitionId_, aOrganisationId_, paymentOptionRefId, paymentFeeTypeRefId,
                                divisionId_, nominationGVAmount_, transferForAffiliateNomFee, transactionIdAffNom, statusRefIdDD, mem.divisionId, FinanceFeeType.AffiliateNomination);

                            transObj.transactions.push(trxnNomination);
                        }
                        if (item.isTeamRegistration == 1)
                            transArr.push(transObj);
                    }
                }

                if (item.isTeamRegistration == null || item.isTeamRegistration == 0)
                    transArr.push(transObj);
            }

            /// Charity amount for State Organisation

            if (isArrayPopulated(organsationList)) {
                let orgData = organsationList.find(x => x.type == AppConstants.membership);
                let stateOrg = null;
                if (isNotNullAndUndefined(orgData)) {
                    stateOrg = orgData.org;
                } else {
                    let organisation = organsationList.find(x => x);
                    stateOrg = await this.affiliateService.getStateOrganisation(organisation.id, organisation.organisationTypeRefId);
                }

                if (isNotNullAndUndefined(stateOrg)) {
                    if (isNotNullAndUndefined(registrationData.charity)) {
                        if (registrationData.charityRoundUpRefId > 0) {
                            let charity = registrationData.charity;
                            const charityValue = feeIsNull(registrationData.total.charityValue);
                            let STRIPE_CHARITY_TOTAL_AMOUNT = formatFeeForStripe1(charityValue);
                            const CHARITY_TITLE = charity.name;
                            let transferForCharitySelected = null;
                            if (stateOrg.refOrgId) {
                                const organisationData = await this.organisationService.findById(stateOrg.refOrgId);
                                const organisationAccountId_: string = organisationData ? organisationData.stripeAccountID : null;
                                const organisationId_: number = organisationData.id;
                                const organisationName_: string = `${organisationData.name}`;

                                if (STRIPE_CHARITY_TOTAL_AMOUNT >= 1) {
                                    if (paymentIntent) {
                                        if (transferGroup != null) {
                                            transferForCharitySelected = await stripe.transfers.create({
                                                amount: STRIPE_CHARITY_TOTAL_AMOUNT,
                                                currency: currencyType,
                                                description: `${organisationName_}  - CHARITY-${CHARITY_TITLE}`,
                                                destination: organisationAccountId_,
                                                source_transaction: paymentIntent.charges.data.length > 0 ? paymentIntent.charges.data[0].id : paymentIntent.id,
                                                transfer_group: transferGroup
                                            });
                                        } else {
                                            transferForCharitySelected = await stripe.transfers.create({
                                                amount: STRIPE_CHARITY_TOTAL_AMOUNT,
                                                currency: currencyType,
                                                description: `${organisationName_}  - CHARITY-${CHARITY_TITLE}`,
                                                destination: organisationAccountId_,
                                                source_transaction: paymentIntent.charges.data.length > 0 ? paymentIntent.charges.data[0].id : paymentIntent.id
                                            });
                                        }
                                    }

                                    let trxnCharity = this.getTransactionObj(invoiceId, registration.createdBy, charityValue,
                                        0, 0, 0, AppConstants.charity,
                                        0, 0, organisationId_, null, null, null, 0, transferForCharitySelected, 0, statusRefIdDD, null, FinanceFeeType.Charity);
                                    trxnCharity.paidBy = paidBy;
                                    await this.transactionService.createOrUpdate(trxnCharity);
                                }
                            }
                        }
                    }
                }
            }

            return transArr;
        } catch (error) {
            logger.error(`Exception in Invoice Payment ${error}`);
            const updateTransaction = await this.updateErrorMessageAndPaymentTypeWithTransaction(
                registration.id, paymentType, error.message, paymentIntent.id,
                null, invoiceId, null, null, null
            );
            throw error;
        }
    }

    async performInvoicePaymentDD(
        registrationData, paymentIntent, currencyType, registration,
        invoiceId, transferGroup, registrationMode, paymentType, paidBy
    ) {
        try {
            logger.info(`Inside the performInvoicePaymentDD ${JSON.stringify(paymentIntent)}`);
            let organsationList = [];
            let transArr = [];
            let otherParticipants = [];
            let statusRefId = this.getTransactionStatus(paymentType);
            let statusRefIdDD = this.getTransactionStatusDD(paymentType);

            (registrationData.compParticipants.map((item) => {
                if ((item.selectedOptions.paymentOptionRefId != 5 ||
                    (item.selectedOptions.paymentOptionRefId == 5 && item.selectedOptions.isSchoolRegCodeApplied == 0)) &&
                    item.selectedOptions.isHardshipCodeApplied == 0) {
                    item["canPerformTransaction"] = 1;
                } else {
                    item["canPerformTransaction"] = 0;
                    statusRefId = AppConstants.NOT_PAID;
                    statusRefIdDD = AppConstants.NOT_PAID;
                }
                if (!paymentIntent) {
                    item["canPerformTransaction"] = 0;
                }
                otherParticipants.push(item);
            }));

            for (let item of otherParticipants) {
                let transObj = null;
                let playerName = null;

                if (item.isTeamRegistration == null || item.isTeamRegistration == 0) {
                    transObj = JSON.parse(JSON.stringify(this.getTransObj()));
                    playerName = formatPersonName(item.firstName, null, item.lastName);
                }

                let paymentOptionRefId = item.selectedOptions.paymentOptionRefId;
                let paymentFeeTypeRefId = this.getPaymentFeeTypeRefId(paymentOptionRefId, item.isTeamRegistration);
                if (isArrayPopulated(item.membershipProducts)) {
                    for (let mem of item.membershipProducts) {
                        if (item.isTeamRegistration == 1) {
                            transObj = JSON.parse(JSON.stringify(this.getTransObj()));
                            playerName = formatPersonName(mem.firstName, null, mem.lastName);
                        }

                        const membershipData = isNotNullAndUndefined(mem.fees.membershipFee) ? mem.fees.membershipFee : Object.assign({});
                        const compOrgData = isNotNullAndUndefined(mem.fees.competitionOrganisorFee) ? mem.fees.competitionOrganisorFee : Object.assign({});
                        const affiliateData = isNotNullAndUndefined(mem.fees.affiliateFee) ? mem.fees.affiliateFee : Object.assign({});

                        const competitionId_ = await this.competitionRegService.findByUniquekey(item.competitionUniqueKey);

                        const membershipMappingId_ = mem.membershipMappingId;
                        let compDivisionDb = await this.competitionDivisionService.findBycmpd(mem.divisionId)
                        const divisionId_ = compDivisionDb != undefined ? compDivisionDb.id : 0;

                        transObj.firstName = mem.firstName;
                        transObj.lastName = mem.lastName;
                        transObj.mobileNumber = mem.mobileNumber;
                        transObj.email = mem.email;

                        if (objectIsNotEmpty(membershipData)) {
                            const membershipProductTypeFeeAmount_ = feeIsNull(membershipData.feesToPay);
                            const membershipProductTypeGstAmount_ = feeIsNull(membershipData.feesToPayGST);
                            const membershipProductTypeDiscountAmount_ = feeIsNull(membershipData.discountsToDeduct);
                            const membershipProductFamilyDiscountAmount_ = feeIsNull(membershipData.childDiscountsToDeduct);
                            const membershipProductGVAmount_ = feeIsNull(membershipData.governmentVoucherAmount);

                            const orgData = await this.organisationService.findOrgByUniquekey(membershipData.organisationId);
                            const membershipOrganisationId_ = orgData.id;

                            organsationList.push({ org: orgData, type: AppConstants.membership });

                            if (membershipProductTypeFeeAmount_ || membershipProductTypeGstAmount_ || membershipProductTypeDiscountAmount_ ||
                                membershipProductFamilyDiscountAmount_ || membershipProductGVAmount_) {
                            } else {
                                await this.deleteByTransactionId(membershipData.transactionId)
                            }

                            let transactionId = this.getTransactionId(registrationMode, membershipData.transactionId);

                            let trxnMembership = this.getTransactionObj(invoiceId, registration.createdBy, membershipProductTypeFeeAmount_,
                                membershipProductTypeGstAmount_, membershipProductTypeDiscountAmount_, membershipProductFamilyDiscountAmount_, AppConstants.membership,
                                membershipMappingId_, competitionId_, membershipOrganisationId_, paymentOptionRefId, paymentFeeTypeRefId,
                                divisionId_, membershipProductGVAmount_, null, transactionId, statusRefIdDD, mem.divisionId, FinanceFeeType.Membership);

                            transObj.transactions.push(trxnMembership);
                        }

                        if (objectIsNotEmpty(compOrgData)) {
                            const competitionTotalAmount_: number = feeIsNull(compOrgData.feesToPay) +
                                feeIsNull(compOrgData.feesToPayGST) -
                                feeIsNull(compOrgData.discountsToDeduct) -
                                feeIsNull(compOrgData.childDiscountsToDeduct) -
                                feeIsNull(compOrgData.governmentVoucherAmount);

                            const competitionFeeAmount_: number = feeIsNull(compOrgData.feesToPay);
                            const competitionGstAmount_: number = feeIsNull(compOrgData.feesToPayGST);
                            const competitionDiscountAmount_: number = feeIsNull(compOrgData.discountsToDeduct);
                            const competitionFamilyDiscountAmount_: number = feeIsNull(compOrgData.childDiscountsToDeduct);
                            const competitionGVAmount_: number = feeIsNull(compOrgData.governmentVoucherAmount);
                            const nominationGVAmount_: number = feeIsNull(compOrgData.nominationGVAmount);
                            const competitionNominationFeeAmount_: number = feeIsNull(compOrgData.nominationFeeToPay);
                            const competitionNominationGstAmount_: number = feeIsNull(compOrgData.nominationGSTToPay);
                            const competitionNomDiscountAmount_: number = feeIsNull(compOrgData.nomDiscountsToDeduct);
                            const competitionNomFamilyDiscountAmount_: number = feeIsNull(compOrgData.nomChildDiscountsToDeduct);

                            const orgData = await this.organisationService.findOrgByUniquekey(compOrgData.organisationId);
                            const cOrganisationId_: number = orgData.id;
                            organsationList.push({ org: orgData, type: AppConstants.competition });

                            // transfer to association for organiser fees
                            if (competitionTotalAmount_ < 1) {
                                await this.deleteByTransactionId(compOrgData.transactionId)
                            }

                            let transactionId = this.getTransactionId(registrationMode, compOrgData.transactionId);

                            let trxnCompetition = this.getTransactionObj(invoiceId, registration.createdBy, competitionFeeAmount_,
                                competitionGstAmount_, competitionDiscountAmount_, competitionFamilyDiscountAmount_, AppConstants.competition,
                                membershipMappingId_, competitionId_, cOrganisationId_, paymentOptionRefId, paymentFeeTypeRefId,
                                divisionId_, competitionGVAmount_, null, transactionId, statusRefId, mem.divisionId, FinanceFeeType.Competition);

                            transObj.transactions.push(trxnCompetition);

                            // if (!isNullOrZero(competitionNominationFeeAmount_) || !isNullOrZero(competitionNominationGstAmount_)) {
                            const nominationTotalAmount_: number = competitionNominationFeeAmount_ +
                                competitionNominationGstAmount_ - nominationGVAmount_ -
                                competitionNomDiscountAmount_ - competitionNomFamilyDiscountAmount_;
                            const STRIPE_NOMINATION_TOTAL_FEE = formatFeeForStripe1(nominationTotalAmount_);

                            if (STRIPE_NOMINATION_TOTAL_FEE < 1) {
                                await this.deleteByTransactionId(compOrgData.nominationTransId)
                            }

                            transactionId = this.getTransactionId(registrationMode, compOrgData.nominationTransId);

                            let trxnNomination = this.getTransactionObj(invoiceId, registration.createdBy, competitionNominationFeeAmount_,
                                competitionNominationGstAmount_, competitionNomDiscountAmount_, competitionNomFamilyDiscountAmount_, AppConstants.nomination,
                                membershipMappingId_, competitionId_, cOrganisationId_, paymentOptionRefId, paymentFeeTypeRefId,
                                divisionId_, nominationGVAmount_, null, transactionId, statusRefIdDD, mem.divisionId, FinanceFeeType.Nomination);

                            transObj.transactions.push(trxnNomination);
                            // }
                        }

                        if (objectIsNotEmpty(affiliateData)) {
                            let affiliateTotalAmount_: number = feeIsNull(affiliateData.feesToPay) +
                                feeIsNull(affiliateData.feesToPayGST) -
                                feeIsNull(affiliateData.discountsToDeduct) -
                                feeIsNull(affiliateData.childDiscountsToDeduct) -
                                feeIsNull(affiliateData.governmentVoucherAmount);

                            let affiliateFeeAmount_: number = feeIsNull(affiliateData.feesToPay);
                            let affiliateGstAmount_: number = feeIsNull(affiliateData.feesToPayGST);
                            let affiliateDiscountAmount_: number = feeIsNull(affiliateData.discountsToDeduct);
                            let affiliateFamilyDiscountAmount_: number = feeIsNull(affiliateData.childDiscountsToDeduct);
                            let affiliateGVAmount_: number = feeIsNull(affiliateData.governmentVoucherAmount);
                            let nominationGVAmount_: number = feeIsNull(affiliateData.nominationGVAmount);
                            const affiliateNominationFeeAmount_: number = feeIsNull(affiliateData.nominationFeeToPay);
                            const affiliateNominationGstAmount_: number = feeIsNull(affiliateData.nominationGSTToPay);
                            let affiliateNomDiscountAmount_: number = feeIsNull(affiliateData.nomDiscountsToDeduct);

                            const orgData = await this.organisationService.findOrgByUniquekey(affiliateData.organisationId);
                            let aOrganisationId_: number = orgData.id;

                            // transfer for affiliateFees
                            //#@#@ check deleted lines
                            if (affiliateTotalAmount_ < 1) {
                                await this.deleteByTransactionId(affiliateData.transactionId)
                            }

                            if (affiliateTotalAmount_ < 1) {
                                await this.deleteByTransactionId(affiliateData.transactionId)
                            }

                            let transactionId = this.getTransactionId(registrationMode, affiliateData.transactionId);

                            let trxnAffiliate = this.getTransactionObj(invoiceId, registration.createdBy, affiliateFeeAmount_,
                                affiliateGstAmount_, affiliateDiscountAmount_, affiliateFamilyDiscountAmount_, AppConstants.affiliate,
                                membershipMappingId_, competitionId_, aOrganisationId_, paymentOptionRefId, paymentFeeTypeRefId,
                                divisionId_, affiliateGVAmount_, null, transactionId, statusRefId, mem.divisionId, FinanceFeeType.AffiliateCompetition);

                            transObj.transactions.push(trxnAffiliate);

                            // if (!isNullOrZero(affiliateNominationFeeAmount_) || !isNullOrZero(affiliateNominationGstAmount_)) {
                            const nominationTotalAmount_: number = affiliateNominationFeeAmount_ +
                                affiliateNominationGstAmount_ - nominationGVAmount_ - affiliateNomDiscountAmount_;
                            const STRIPE_NOMINATION_TOTAL_FEE = formatFeeForStripe1(nominationTotalAmount_);
                            if (STRIPE_NOMINATION_TOTAL_FEE < 1) {
                                await this.deleteByTransactionId(affiliateData.nominationTransId)
                            }

                            transactionId = this.getTransactionId(registrationMode, affiliateData.nominationTransId);

                            let trxnNomination = this.getTransactionObj(invoiceId, registration.createdBy, affiliateNominationFeeAmount_,
                                affiliateNominationGstAmount_, affiliateNomDiscountAmount_, 0, AppConstants.nomination,
                                membershipMappingId_, competitionId_, aOrganisationId_, paymentOptionRefId, paymentFeeTypeRefId,
                                divisionId_, nominationGVAmount_, null, transactionId, statusRefIdDD, mem.divisionId, FinanceFeeType.AffiliateNomination);

                            transObj.transactions.push(trxnNomination);
                            // }
                        }
                        if (item.isTeamRegistration == 1)
                            transArr.push(transObj);
                    }
                }

                if (item.isTeamRegistration == null || item.isTeamRegistration == 0)
                    transArr.push(transObj);
            }

            /// Charity amount for State Organisation

            if (isArrayPopulated(organsationList)) {
                let orgData = organsationList.find(x => x.type == AppConstants.membership);
                let stateOrg = null;
                if (isNotNullAndUndefined(orgData)) {
                    stateOrg = orgData.org;
                } else {
                    let organisation = organsationList.find(x => x);
                    stateOrg = await this.affiliateService.getStateOrganisation(organisation.id, organisation.organisationTypeRefId);
                }

                if (isNotNullAndUndefined(stateOrg)) {
                    if (isNotNullAndUndefined(registrationData.charity)) {
                        if (registrationData.charityRoundUpRefId > 0) {
                            const charityValue = feeIsNull(registrationData.total.charityValue);
                            let STRIPE_CHARITY_TOTAL_AMOUNT = formatFeeForStripe1(charityValue);
                            const organisationData = await this.organisationService.findById(stateOrg.refOrgId);
                            if (organisationData) {
                                const organisationId_: number = organisationData.id;

                                if (STRIPE_CHARITY_TOTAL_AMOUNT >= 1) {
                                    let trxnCharity = this.getTransactionObj(invoiceId, registration.createdBy, charityValue,
                                        0, 0, 0, AppConstants.charity,
                                        0, 0, organisationId_, null, null, null, 0, null, 0, statusRefIdDD, null, FinanceFeeType.Charity);
                                    trxnCharity.paidBy = paidBy;
                                    await this.transactionService.createOrUpdate(trxnCharity);
                                }
                            }
                        }
                    }
                }
            }

            return transArr;
        } catch (error) {
            logger.error(`Exception in Invoice Payment ${error}`);
            const updateTransaction = await this.updateErrorMessageAndPaymentTypeWithTransaction(
                registration.id, paymentType, error.message, paymentIntent.id,
                null, invoiceId, null, null, null
            );
            throw error;
        }
    }

    async performInvoiceTransactionDDPayment(registrationData, paymentIntent, currencyType, transferGroup, paymentType, transactionData, registration) {
        try {
            logger.info(`Inside the performInvoiceTransactionDDPayment ${JSON.stringify(paymentIntent)}`);
            let organsationList = [];
            let transArr = [];
            let otherParticipants = [];

            (registrationData.compParticipants.map((item) => {
                if ((item.selectedOptions.paymentOptionRefId != 5 ||
                    (item.selectedOptions.paymentOptionRefId == 5 && item.selectedOptions.isSchoolRegCodeApplied == 0)) &&
                    item.selectedOptions.isHardshipCodeApplied == 0) {
                    item["canPerformTransaction"] = 1;
                } else {
                    item["canPerformTransaction"] = 0;
                }
                if (!paymentIntent) {
                    item["canPerformTransaction"] = 0;
                }
                otherParticipants.push(item);
            }));

            for (let item of otherParticipants) {
                let playerName = null;
                let registeringPerson = null;
                let registeringOrgName = item['organisationName'];
                if (item.isTeamRegistration == null || item.isTeamRegistration == 0) {
                    registeringPerson = formatPersonName(item.firstName, null, item.lastName);
                }
                const competitionId_ = await this.competitionRegService.findByUniquekey(item.competitionUniqueKey);
                // let orgRegistration = await this.orgRegistrationService.findById(item.orgRegistrationId);
                // if (orgRegistration) {
                //     let registeringOrganisation = await this.organisationService.findById(orgRegistration.organisationId);
                //     registeringOrgName = registeringOrganisation ? registeringOrganisation.name : "";
                // }

                if (isArrayPopulated(item.membershipProducts)) {
                    for (let mem of item.membershipProducts) {
                        if (item.isTeamRegistration == 1) {
                            playerName = formatPersonName(mem.firstName, null, mem.lastName);
                            registeringPerson = formatPersonName(item.firstName, null, item.lastName);
                        }
                        const membershipData = isNotNullAndUndefined(mem.fees.membershipFee) ? mem.fees.membershipFee : Object.assign({});
                        const compOrgData = isNotNullAndUndefined(mem.fees.competitionOrganisorFee) ? mem.fees.competitionOrganisorFee : Object.assign({});
                        const affiliateData = isNotNullAndUndefined(mem.fees.affiliateFee) ? mem.fees.affiliateFee : Object.assign({});

                        const competitionOrganiserOrganisationName_: string = compOrgData['name'];
                        // const playerName_: string = formatPersonName(item.firstName, null, item.lastName);

                        const membershipProductTypeName_ = mem.membershipTypeName;
                        const membershipMappingId_ = mem.membershipMappingId;
                        let compDivisionDb = await this.competitionDivisionService.findBycmpd(mem.divisionId)
                        const divisionId_ = compDivisionDb != undefined ? compDivisionDb.id : 0;
                        let description = null;

                        if (item.isTeamRegistration && item.email != mem.email) {
                            description = `${registeringPerson} -  ${membershipProductTypeName_} - ${playerName}`;
                        } else {
                            description = `${registeringPerson} - ${membershipProductTypeName_}`;
                        }

                        if (objectIsNotEmpty(membershipData)) {
                            console.log(`inside membershipData ${membershipData}`)
                            const membershipProductOrganisationName_: string = `${membershipData['name']}`;
                            const membershipProductTypeTotalAmount_ = feeIsNull(membershipData.feesToPay) +
                                feeIsNull(membershipData.feesToPayGST) -
                                feeIsNull(membershipData.discountsToDeduct) -
                                feeIsNull(membershipData.childDiscountsToDeduct) -
                                feeIsNull(membershipData.governmentVoucherAmount);


                            const membershipOrganisationAccountId_ = membershipData.organisationAccountId;
                            const orgData = await this.organisationService.findOrgByUniquekey(membershipData.organisationId);
                            const membershipOrganisationId_ = orgData.id;

                            organsationList.push({ org: orgData, type: AppConstants.membership });
                            console.log(`transaction membershipData ${JSON.stringify(transactionData)}`);

                            let transaction = await this.getDeRegisterOperation(transactionData, competitionId_, membershipOrganisationId_,
                                                    AppConstants.membership, FinanceFeeType.Membership, membershipMappingId_, mem.divisionId, membershipProductTypeTotalAmount_);
                            console.log(`transaction ${JSON.stringify(transaction)}`);
                            const STRIPE_MEMBERSHIP_TOTAL_FEE = formatFeeForStripe1(transaction.STRIPE_TOTAL_FEE);
                            const STRIPE_MEMBERSHIP_REFUND_FEE = formatFeeForStripe1(transaction.STRIPE_REFUND_FEE);

                            let transferForMembershipFee = null;
                            // transfer for membershipFees
                            if (STRIPE_MEMBERSHIP_TOTAL_FEE >= 1) {
                                console.log(`STRIPE_MEMBERSHIP_TOTAL_FEE ${STRIPE_MEMBERSHIP_TOTAL_FEE}`)
                                if (item.canPerformTransaction) {
                                    if (transferGroup != null) {
                                        transferForMembershipFee = await stripe.transfers.create({
                                            amount: STRIPE_MEMBERSHIP_TOTAL_FEE,
                                            currency: currencyType,
                                            description: `${description} - ${membershipProductOrganisationName_} - ${registeringOrgName} - MEMBERSHIP FEE`,
                                            source_transaction: paymentIntent.charges.data.length > 0 ? paymentIntent.charges.data[0].id : paymentIntent.id,
                                            destination: membershipOrganisationAccountId_,
                                            transfer_group: transferGroup
                                        });
                                    } else {
                                        transferForMembershipFee = await stripe.transfers.create({
                                            amount: STRIPE_MEMBERSHIP_TOTAL_FEE,
                                            currency: currencyType,
                                            description: `${description} - ${membershipProductOrganisationName_} - ${registeringOrgName} - MEMBERSHIP FEE`,
                                            source_transaction: paymentIntent.charges.data.length > 0 ? paymentIntent.charges.data[0].id : paymentIntent.id,
                                            destination: membershipOrganisationAccountId_
                                        });
                                    }
                                }

                                if(transaction.transaction.statusRefId == TransactionStatus.Deregistered) {
                                    if(STRIPE_MEMBERSHIP_REFUND_FEE >= 1) {
                                        console.log(`STRIPE_MEMBERSHIP_REFUND_FEE ${JSON.stringify(STRIPE_MEMBERSHIP_REFUND_FEE)}`)
                                        await this.updateRefundDDStatus(transaction, divisionId_, paymentIntent, STRIPE_MEMBERSHIP_REFUND_FEE);
                                    }
                                }
                            }
                            await this.updateTransactionIdDD(
                                transactionData, competitionId_, membershipOrganisationId_, membershipMappingId_,
                                divisionId_, AppConstants.membership, transferForMembershipFee, mem.divisionId
                            );
                        }

                        if (objectIsNotEmpty(compOrgData)) {
                            const competitionTotalAmount_: number = feeIsNull(compOrgData.feesToPay) +
                                feeIsNull(compOrgData.feesToPayGST) -
                                feeIsNull(compOrgData.discountsToDeduct) -
                                feeIsNull(compOrgData.childDiscountsToDeduct) -
                                feeIsNull(compOrgData.governmentVoucherAmount);

                            const nominationGVAmount_: number = feeIsNull(compOrgData.nominationGVAmount);
                            const competitionNominationFeeAmount_: number = feeIsNull(compOrgData.nominationFeeToPay);
                            const competitionNominationGstAmount_: number = feeIsNull(compOrgData.nominationGSTToPay);
                            const competitionNomDiscountAmount_: number = feeIsNull(compOrgData.nomDiscountsToDeduct);
                            const competitionNomChildDiscountAmount_: number = feeIsNull(compOrgData.nomChildDiscountsToDeduct);

                            const cOrganisationAccountId_: string = compOrgData.organisationAccountId;
                            const orgData = await this.organisationService.findOrgByUniquekey(compOrgData.organisationId);
                            const cOrganisationId_: number = orgData.id;
                            console.log(`transaction compOrgData ${JSON.stringify(transactionData)}`);

                            organsationList.push({ org: orgData, type: AppConstants.competition });

                            let transaction = await this.getDeRegisterOperation(transactionData, competitionId_, cOrganisationId_,
                                AppConstants.competition, FinanceFeeType.Competition, membershipMappingId_, mem.divisionId, competitionTotalAmount_);
                            const STRIPE_COMPETITION_TOTAL_FEE = formatFeeForStripe1(transaction.STRIPE_TOTAL_FEE);
                            const STRIPE_COMPETITION_REFUND_FEE = formatFeeForStripe1(transaction.STRIPE_REFUND_FEE);
                            console.log(`transaction ${JSON.stringify(transaction)}`);

                            let transferForCompetitionOrganiser = null;
                            // transfer to association for organiser fees
                            if (STRIPE_COMPETITION_TOTAL_FEE >= 1) {
                                console.log(`STRIPE_COMPETITION_TOTAL_FEE ${JSON.stringify(STRIPE_COMPETITION_TOTAL_FEE)}`);
                                if (item.canPerformTransaction) {
                                    if (transferGroup != null) {
                                        transferForCompetitionOrganiser = await stripe.transfers.create({
                                            amount: STRIPE_COMPETITION_TOTAL_FEE,
                                            currency: currencyType,
                                            description: `${description} - ${competitionOrganiserOrganisationName_} - ${registeringOrgName} - COMPETITION FEE`,
                                            destination: cOrganisationAccountId_,
                                            source_transaction: paymentIntent.charges.data.length > 0 ? paymentIntent.charges.data[0].id : paymentIntent.id,
                                            transfer_group: transferGroup
                                        });
                                    } else {
                                        transferForCompetitionOrganiser = await stripe.transfers.create({
                                            amount: STRIPE_COMPETITION_TOTAL_FEE,
                                            currency: currencyType,
                                            description: `${description} - ${competitionOrganiserOrganisationName_} - ${registeringOrgName} - COMPETITION FEE`,
                                            destination: cOrganisationAccountId_,
                                            source_transaction: paymentIntent.charges.data.length > 0 ? paymentIntent.charges.data[0].id : paymentIntent.id,
                                        });
                                    }
                                }

                                if(transaction.transaction.statusRefId == TransactionStatus.Deregistered) {
                                    if(STRIPE_COMPETITION_REFUND_FEE >= 1) {
                                        console.log(`STRIPE_COMPETITION_REFUND_FEE ${JSON.stringify(STRIPE_COMPETITION_REFUND_FEE)}`);
                                        await this.updateRefundDDStatus(transaction, divisionId_, paymentIntent, STRIPE_COMPETITION_REFUND_FEE);
                                    }
                                }
                            }

                            await this.updateTransactionIdDD(transactionData, competitionId_, cOrganisationId_,
                                membershipMappingId_, divisionId_, AppConstants.competition, transferForCompetitionOrganiser, mem.divisionId);


                            if (!isNullOrZero(competitionNominationFeeAmount_) || !isNullOrZero(competitionNominationGstAmount_)) {
                                const nominationTotalAmount_: number = competitionNominationFeeAmount_ +
                                    competitionNominationGstAmount_ - competitionNomDiscountAmount_ -
                                    competitionNomChildDiscountAmount_ - nominationGVAmount_;

                                let transaction = await this.getDeRegisterOperation(transactionData, competitionId_, cOrganisationId_,
                                    AppConstants.nomination, FinanceFeeType.Nomination, membershipMappingId_, mem.divisionId, nominationTotalAmount_);
                                const STRIPE_NOMINATION_TOTAL_FEE = formatFeeForStripe1(transaction.STRIPE_TOTAL_FEE);
                                const STRIPE_NOMINATION_REFUND_FEE = formatFeeForStripe1(transaction.STRIPE_REFUND_FEE);
                                console.log(`transaction competitionNominationFeeAmount_ ${JSON.stringify(transaction)}`);

                                let transferForCompetitionOrganiser = null;
                                if (STRIPE_NOMINATION_TOTAL_FEE >= 1) {
                                    console.log(`STRIPE_NOMINATION_TOTAL_FEE ${JSON.stringify(STRIPE_NOMINATION_TOTAL_FEE)}`);
                                    if (item.canPerformTransaction) {
                                        if (transferGroup != null) {
                                            transferForCompetitionOrganiser = await stripe.transfers.create({
                                                amount: STRIPE_NOMINATION_TOTAL_FEE,
                                                currency: currencyType,
                                                description: `${description} - ${competitionOrganiserOrganisationName_} - ${registeringOrgName} - NOMINATION FEE`,
                                                destination: cOrganisationAccountId_,
                                                source_transaction: paymentIntent.charges.data.length > 0 ? paymentIntent.charges.data[0].id : paymentIntent.id,
                                                transfer_group: transferGroup
                                            });
                                        } else {
                                            transferForCompetitionOrganiser = await stripe.transfers.create({
                                                amount: STRIPE_NOMINATION_TOTAL_FEE,
                                                currency: currencyType,
                                                description: `${description} - ${competitionOrganiserOrganisationName_} - ${registeringOrgName} - NOMINATION FEE`,
                                                destination: cOrganisationAccountId_,
                                                source_transaction: paymentIntent.charges.data.length > 0 ? paymentIntent.charges.data[0].id : paymentIntent.id,
                                            });
                                        }
                                    }

                                    if(transaction.transaction.statusRefId == TransactionStatus.Deregistered) {
                                        if(STRIPE_NOMINATION_REFUND_FEE >= 1) {
                                            console.log(`STRIPE_NOMINATION_REFUND_FEE ${JSON.stringify(STRIPE_NOMINATION_REFUND_FEE)}`);
                                            await this.updateRefundDDStatus(transaction, divisionId_, paymentIntent, STRIPE_NOMINATION_REFUND_FEE);
                                        }
                                    }
                                }
                                
                                await this.updateTransactionIdDD(
                                    transactionData, competitionId_, cOrganisationId_, membershipMappingId_,
                                    divisionId_, AppConstants.nomination, transferForCompetitionOrganiser, mem.divisionId
                                );
                            }
                        }

                        if (objectIsNotEmpty(affiliateData)) {
                            let affiliateTotalAmount_: number = feeIsNull(affiliateData.feesToPay) +
                                feeIsNull(affiliateData.feesToPayGST) -
                                feeIsNull(affiliateData.discountsToDeduct) -
                                feeIsNull(affiliateData.childDiscountsToDeduct) -
                                feeIsNull(affiliateData.governmentVoucherAmount);

                            const nominationGVAmount_: number = feeIsNull(affiliateData.nominationGVAmount);
                            const affiliateNominationFeeAmount_: number = feeIsNull(affiliateData.nominationFeeToPay);
                            const affiliateNominationGstAmount_: number = feeIsNull(affiliateData.nominationGSTToPay);
                            const affiliateNomDiscountAmount_: number = feeIsNull(affiliateData.nomDiscountsToDeduct);
                            const affiliateFamilyNomDiscountAmount_: number = feeIsNull(affiliateData.nomChildDiscountsToDeduct);

                            const affiliateOrganisationName_: string = affiliateData.name;

                            const aOrganisationAccountId_: string = affiliateData.organisationAccountId;
                            const orgData = await this.organisationService.findOrgByUniquekey(affiliateData.organisationId);
                            const aOrganisationId_: number = orgData.id;

                            console.log(`transaction affiliateData ${JSON.stringify(transactionData)}`);

                            let transaction = await this.getDeRegisterOperation(transactionData, competitionId_, aOrganisationId_,
                                AppConstants.affiliate, FinanceFeeType.AffiliateCompetition, membershipMappingId_, mem.divisionId, affiliateTotalAmount_);
                            const STRIPE_AFFILIATE_TOTAL_AMOUNT = formatFeeForStripe1(transaction.STRIPE_TOTAL_FEE);
                            const STRIPE_AFFILIATE_REFUND_AMOUNT = formatFeeForStripe1(transaction.STRIPE_REFUND_FEE);
                            console.log(`transaction ${JSON.stringify(transaction)}`);

                            let transferForAffiliateFee = null;
                            // transfer for affiliateFees
                            if (STRIPE_AFFILIATE_TOTAL_AMOUNT >= 1) {
                                console.log(`STRIPE_AFFILIATE_TOTAL_AMOUNT ${JSON.stringify(STRIPE_AFFILIATE_TOTAL_AMOUNT)}`);
                                if (item.canPerformTransaction) {
                                    if (transferGroup != null) {
                                        transferForAffiliateFee = await stripe.transfers.create({
                                            amount: STRIPE_AFFILIATE_TOTAL_AMOUNT,
                                            description: `${description} - ${affiliateOrganisationName_} - ${registeringOrgName} - AFFILIATE FEE`,
                                            currency: currencyType,
                                            destination: aOrganisationAccountId_,
                                            source_transaction: paymentIntent.charges.data.length > 0 ? paymentIntent.charges.data[0].id : paymentIntent.id,
                                            transfer_group: transferGroup
                                        });
                                    } else {
                                        transferForAffiliateFee = await stripe.transfers.create({
                                            amount: STRIPE_AFFILIATE_TOTAL_AMOUNT,
                                            description: `${description} - ${affiliateOrganisationName_} - ${registeringOrgName} - AFFILIATE FEE`,
                                            currency: currencyType,
                                            destination: aOrganisationAccountId_,
                                            source_transaction: paymentIntent.charges.data.length > 0 ? paymentIntent.charges.data[0].id : paymentIntent.id,
                                        });
                                    }
                                }

                                if(transaction.transaction.statusRefId == TransactionStatus.Deregistered) {
                                    if(STRIPE_AFFILIATE_REFUND_AMOUNT >= 1) {
                                        console.log(`STRIPE_AFFILIATE_REFUND_AMOUNT ${JSON.stringify(STRIPE_AFFILIATE_REFUND_AMOUNT)}`);
                                        await this.updateRefundDDStatus(transaction, divisionId_, paymentIntent, STRIPE_AFFILIATE_REFUND_AMOUNT);
                                    }
                                }
                            }
                            
                            await this.updateTransactionIdDD(
                                transactionData, competitionId_, aOrganisationId_, membershipMappingId_,
                                divisionId_, AppConstants.affiliate, transferForAffiliateFee, mem.divisionId
                            );

                            if (!isNullOrZero(affiliateNominationFeeAmount_) || !isNullOrZero(affiliateNominationGstAmount_)) {
                                const nominationTotalAmount_: number = affiliateNominationFeeAmount_ +
                                    affiliateNominationGstAmount_ - affiliateNomDiscountAmount_ - affiliateFamilyNomDiscountAmount_ -
                                    nominationGVAmount_;

                                let transaction = await this.getDeRegisterOperation(transactionData, competitionId_, aOrganisationId_,
                                    AppConstants.nomination, FinanceFeeType.AffiliateNomination, membershipMappingId_, mem.divisionId, nominationTotalAmount_);
                                const STRIPE_NOMINATION_TOTAL_FEE = formatFeeForStripe1(transaction.STRIPE_TOTAL_FEE);
                                const STRIPE_NOMINATION_REFUND_FEE = formatFeeForStripe1(transaction.STRIPE_REFUND_FEE);
                                console.log(`transaction affiliateNominationFeeAmount_ ${JSON.stringify(transaction)}`);

                                let transferForAffiliateFee = null;
                                if (STRIPE_NOMINATION_TOTAL_FEE >= 1) {
                                    console.log(`STRIPE_NOMINATION_TOTAL_FEE ${JSON.stringify(STRIPE_NOMINATION_TOTAL_FEE)}`);
                                    if (item.canPerformTransaction) {
                                        if (transferGroup != null) {
                                            transferForAffiliateFee = await stripe.transfers.create({
                                                amount: STRIPE_NOMINATION_TOTAL_FEE,
                                                currency: currencyType,
                                                description: `${description} - ${affiliateOrganisationName_} - ${registeringOrgName} - NOMINATION FEE`,
                                                destination: aOrganisationAccountId_,
                                                source_transaction: paymentIntent.charges.data.length > 0 ? paymentIntent.charges.data[0].id : paymentIntent.id,
                                                transfer_group: transferGroup
                                            });
                                        } else {
                                            transferForAffiliateFee = await stripe.transfers.create({
                                                amount: STRIPE_NOMINATION_TOTAL_FEE,
                                                currency: currencyType,
                                                description: `${description} - ${affiliateOrganisationName_} - ${registeringOrgName} - NOMINATION FEE`,
                                                destination: aOrganisationAccountId_,
                                                source_transaction: paymentIntent.charges.data.length > 0 ? paymentIntent.charges.data[0].id : paymentIntent.id,
                                            });
                                        }
                                    }

                                    if(transaction.transaction.statusRefId == TransactionStatus.Deregistered) {
                                        if(STRIPE_NOMINATION_REFUND_FEE >= 1) {
                                            console.log(`STRIPE_NOMINATION_REFUND_FEE ${JSON.stringify(STRIPE_NOMINATION_REFUND_FEE)}`);
                                            await this.updateRefundDDStatus(transaction, divisionId_, paymentIntent, STRIPE_NOMINATION_REFUND_FEE);
                                        }
                                    }
                                }
                                
                                await this.updateTransactionIdDD(
                                    transactionData, competitionId_, aOrganisationId_, membershipMappingId_,
                                    divisionId_, AppConstants.nomination, transferForAffiliateFee, mem.divisionId
                                );
                            }
                        }
                    }
                }
            }

            /// Charity amount for State Organisation

            if (isArrayPopulated(organsationList)) {
                let orgData = organsationList.find(x => x.type == AppConstants.membership);
                let stateOrg = null;
                if (isNotNullAndUndefined(orgData)) {
                    stateOrg = orgData.org;
                } else {
                    let organisation = organsationList.find(x => x);
                    stateOrg = await this.affiliateService.getStateOrganisation(organisation.id, organisation.organisationTypeRefId);
                }

                if (isNotNullAndUndefined(stateOrg)) {
                    if (isNotNullAndUndefined(registrationData.charity)) {
                        if (registrationData.charityRoundUpRefId > 0) {
                            let charity = registrationData.charity;
                            const charityValue = feeIsNull(registrationData.total.charityValue);
                            let STRIPE_CHARITY_TOTAL_AMOUNT = formatFeeForStripe1(charityValue);
                            const CHARITY_TITLE = charity.name;

                            const organisationData = await this.organisationService.findById(stateOrg.refOrgId);
                            if (organisationData) {
                                const organisationAccountId_: string = organisationData ? organisationData.stripeAccountID : null;
                                const organisationName_: string = `${organisationData.name}`;
                                if (STRIPE_CHARITY_TOTAL_AMOUNT >= 1) {
                                    let transferForCharitySelected = null;
                                    if (paymentIntent) {
                                        if (transferGroup != null) {
                                            transferForCharitySelected = await stripe.transfers.create({
                                                amount: STRIPE_CHARITY_TOTAL_AMOUNT,
                                                currency: currencyType,
                                                description: `${organisationName_}  - CHARITY-${CHARITY_TITLE}`,
                                                destination: organisationAccountId_,
                                                source_transaction: paymentIntent.charges.data.length > 0 ? paymentIntent.charges.data[0].id : paymentIntent.id,
                                                transfer_group: transferGroup
                                            });
                                        } else {
                                            transferForCharitySelected = await stripe.transfers.create({
                                                amount: STRIPE_CHARITY_TOTAL_AMOUNT,
                                                currency: currencyType,
                                                description: `${organisationName_}  - CHARITY-${CHARITY_TITLE}`,
                                                destination: organisationAccountId_,
                                                source_transaction: paymentIntent.charges.data.length > 0 ? paymentIntent.charges.data[0].id : paymentIntent.id
                                            });
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }

            return transArr;
        } catch (error) {
            logger.error(`Exception in PerformInvoiceTransactionDDPayment ${error.message} ::: ${error.type} ::: ${error.code}`);
            const updateTransaction = await this.updateErrorMessageAndPaymentTypeWithTransaction(
                registration.id, paymentType, error.message, paymentIntent.id,
                null, null, null, null, null
            );
            throw error;
        }
    }

    private async getDeRegisterOperation(transactionData, competitionId_, membershipOrganisationId_, feeType, feeTypeRefId, membershipMappingId, divisionId_, totalPayingAmount) {
        if (isArrayPopulated(transactionData)) {
            let transaction = transactionData.find(x => x.competitionId == competitionId_ &&
                x.organisationId == membershipOrganisationId_ && x.membershipProductMappingId == membershipMappingId &&
                x.feeType == feeType && x.feeTypeRefId == feeTypeRefId &&
                ((divisionId_ != null && divisionId_ != 0) ? (x.divisionId == divisionId_) : (1 == 1)));

            console.log(`inside getDeRegisterOperation ${JSON.stringify(transaction)}`);
            let STRIPE_TOTAL_FEE = totalPayingAmount;
            let STRIPE_REFUND_FEE = 0;
            let approvalRefund = null;
            if(transaction && transaction.statusRefId == TransactionStatus.Deregistered) {
                approvalRefund = await this.approvalRefundService.getApprovalRefundsByTransactionId(transaction.id);
                console.log(`inside approval refund ${JSON.stringify(approvalRefund)}`);
                STRIPE_TOTAL_FEE = feeIsNull(totalPayingAmount) - feeIsNull(approvalRefund.refundAmount);
                STRIPE_REFUND_FEE = feeIsNull(approvalRefund.refundAmount);
            }
            return {
                STRIPE_TOTAL_FEE,
                STRIPE_REFUND_FEE,
                transaction,
                approvalRefund
            }
        }
    }

    private async updateRefundDDStatus(transaction, divisionId_, paymentIntent, STRIPE_REFUND_FEE) {
        console.log(`inside updateRefundDDStatus ${JSON.stringify(paymentIntent)}`)
        let guidKey = uuidv4();
        let refundIntent = null;
        if(paymentIntent != null && STRIPE_REFUND_FEE > 0) {
            refundIntent = await this.transactionService.refundIntent(STRIPE_REFUND_FEE, paymentIntent, transaction.transaction, guidKey);
            console.log(`inside refund ${JSON.stringify(refundIntent)}`);
            let trxn = await this.createRefundTransactionObject(transaction.transaction, divisionId_, transaction.approvalRefund, refundIntent, guidKey);
            console.log(`trxn ${JSON.stringify(trxn)}`)
            await this.transactionService.createOrUpdate(trxn);
        }
    }

    private async createRefundTransactionObject(transData, divisionId_, approvalRefund, refundIntent, guidKey) {
        try {
            const trxn = new Transaction();
            trxn.id = 0;
            trxn.invoiceId = approvalRefund.invoiceId;
            trxn.participantId = transData.participantId;
            trxn.createdBy = approvalRefund.createdBy;
            trxn.feeAmount = -approvalRefund.refundAmount;
            trxn.feeType = approvalRefund.feeType;
            trxn.feeTypeRefId = transData != null ? transData.feeTypeRefId : 0;
            trxn.statusRefId = (refundIntent ? (refundIntent.status === "succeeded" ? AppConstants.PAID : AppConstants.NOT_PAID) : AppConstants.PAID);
            trxn.membershipProductMappingId = transData.membershipProductMappingId;
            trxn.competitionId = transData.competitionId;
            trxn.organisationId = transData.organisationId;
            trxn.paymentOptionRefId = transData != null ? transData.paymentOptionRefId : 0;
            trxn.paymentFeeTypeRefId = transData != null ? transData.paymentFeeTypeRefId : 0;
            trxn.stripeTransactionId = refundIntent ? refundIntent.id : null;
            trxn.transactionTypeRefId = AppConstants.TRANSACTION_TYPE_REFUND;
            trxn.divisionId = divisionId_;
            trxn.referenceId = guidKey;

            return trxn;
        }
        catch(error) {
            throw error;
        }
    }

    private async deleteByTransactionId(transactionId) {
        try {
            if (transactionId) {
                await this.transactionService.deleteByTransactionId(transactionId);
            }
        } catch (error) {
            logger.error(`Exception in Invoice Payment deleteByTransactionId ${error}`);
            throw error;
        }
    }

    private getTransObj() {
        let transObj = {
            firstName: null,
            lastName: null,
            email: null,
            mobileNumber: null,
            transactions: []
        }

        return transObj;
    }

    private getTransactionObj(
        invoiceId, createdBy, fee, gst, discount, familyDiscount, feeType, membershipMappingId,
        competitionId, organisationId, paymentOptionRefId, paymentFeeTypeRefId, divisionId,
        gvrnmAmount, stripeTransaction, transactionId, statusRefId, memDivisionId, feeTypeRefId
    ) {
        const trxn = new Transaction();
        trxn.id = transactionId ? transactionId : 0;
        trxn.invoiceId = invoiceId;
        trxn.participantId = 0;
        trxn.createdBy = createdBy;
        trxn.feeAmount = fee;
        trxn.gstAmount = gst;
        trxn.discountAmount = discount;
        trxn.familyDiscountAmount = familyDiscount;
        trxn.feeType = feeType;
        trxn.feeTypeRefId = feeTypeRefId;
        trxn.membershipProductMappingId = membershipMappingId;
        trxn.competitionId = competitionId;
        trxn.organisationId = organisationId;
        trxn.paymentOptionRefId = paymentOptionRefId
        trxn.paymentFeeTypeRefId = paymentFeeTypeRefId;
        trxn.divisionId = (statusRefId == AppConstants.NOT_PAID ? memDivisionId : divisionId);
        trxn.governmentVoucherAmount = gvrnmAmount;
        if (!(isNullOrZero(gvrnmAmount)))
            trxn.governmentVoucherStatusRefId = 1;
        trxn.statusRefId = statusRefId;
        trxn.stripeTransactionId = stripeTransaction ? stripeTransaction.id : null;

        return trxn;
    }

    private getTransactionId(registrationMode, transactionId) {
        if (registrationMode != AppConstants.registration) {
            return transactionId;
        } else {
            return 0;
        }
    }

    private getTempMail(userDb) {
        let tempMail = userDb.email.toLowerCase().slice(0, 6)
        let temp2Mail = userDb.email.split('').reverse().join('').slice(0, 8)
        temp2Mail = temp2Mail.split('').reverse().join('')
        tempMail = tempMail + temp2Mail
        return tempMail;
    }

    private async updateTransactionIdDD(transactionData, compId, orgId, memId, divId, feeType, transferTransRef, memDivisionId) {
        try {
            let transactionId = 0;
            if (isArrayPopulated(transactionData)) {
                let transaction = transactionData.find(x => x.competitionId == compId &&
                    x.organisationId == orgId && x.membershipProductMappingId == memId &&
                    x.feeType == feeType &&
                    ((memDivisionId != null && memDivisionId != 0) ? (x.divisionId == memDivisionId) : (1 == 1)));
                if (transaction) {
                    transactionId = transaction.id;
                    let tr = new Transaction()
                    tr.id = transactionId;
                    tr.divisionId = divId;
                    tr.stripeTransactionId = transferTransRef ? transferTransRef.id : null;
                    await this.transactionService.createOrUpdate(tr);
                }
            }

            return transactionId;
        } catch (error) {
            logger.error(`Exception occurred in getTransactionIdDD ${error}`);
        }
    }

    private getTransactionStatus(paymentType) {
        let statusRefId = AppConstants.PAID;
        if (paymentType == AppConstants.cash || paymentType == AppConstants.cashCard ||
            paymentType == AppConstants.cashDirectDebit || paymentType == AppConstants.directDebit) {
            statusRefId = AppConstants.NOT_PAID;
        }

        return statusRefId;
    }

    private getTransactionStatusDD(paymentType) {
        let statusRefId = AppConstants.PAID;
        if (paymentType == AppConstants.directDebit
            || paymentType == AppConstants.cashDirectDebit) {
            statusRefId = AppConstants.NOT_PAID;
        }

        return statusRefId;
    }

    private isCash(paymentType) {
        let flag = false;
        if (paymentType == AppConstants.cash || paymentType == AppConstants.cashCard ||
            paymentType == AppConstants.cashDirectDebit) {
            flag = true;
        }
        return flag;
    }

    async performSchoolOrHardshipInvoicePayment(registrationData, registration, invoiceId) {
        try {
            logger.info(`Inside the performSchoolOrHardshipInvoicePayment`);
            let transArr = [];
            let schoolOrHardshipParticipants = [];

            (registrationData.compParticipants.map((item) => {
                if (item.selectedOptions.paymentOptionRefId == 5 && item.selectedOptions.isSchoolRegCodeApplied == 1) {
                    schoolOrHardshipParticipants.push(item);
                } else if (item.selectedOptions.isHardshipCodeApplied == 1) {
                    schoolOrHardshipParticipants.push(item);
                }
            }));

            if (isArrayPopulated(schoolOrHardshipParticipants)) {
                for (let item of schoolOrHardshipParticipants) {
                    let transObj = {
                        firstName: null,
                        lastName: null,
                        email: null,
                        mobileNumber: null,
                        transactions: []
                    }

                    let paymentOptionRefId = item.selectedOptions.paymentOptionRefId;
                    let paymentFeeTypeRefId = this.getPaymentFeeTypeRefId(paymentOptionRefId, item.isTeamRegistration)
                    if (isArrayPopulated(item.membershipProducts)) {
                        for (let mem of item.membershipProducts) {
                            const membershipData = isNotNullAndUndefined(mem.fees.membershipFee) ? mem.fees.membershipFee : Object.assign({});
                            const compOrgData = isNotNullAndUndefined(mem.fees.competitionOrganisorFee) ? mem.fees.competitionOrganisorFee : Object.assign({});
                            const affiliateData = isNotNullAndUndefined(mem.fees.affiliateFee) ? mem.fees.affiliateFee : Object.assign({});

                            const competitionId_ = await this.competitionRegService.findByUniquekey(item.competitionUniqueKey);
                            const membershipMappingId_ = membershipData.membershipMappingId;
                            let compDivisionDb = await this.competitionDivisionService.findBycmpd(mem.divisionId)
                            const divisionId_ = compDivisionDb != undefined ? compDivisionDb.id : 0;

                            const membershipOrganisationId_ = await this.organisationService.findByUniquekey(membershipData.organisationId);
                            transObj.firstName = item.firstName;
                            transObj.lastName = item.lastName;
                            transObj.mobileNumber = item.mobileNumber;
                            transObj.email = item.email;

                            const trxnMembership = new Transaction();
                            trxnMembership.id = 0;
                            trxnMembership.invoiceId = invoiceId;
                            trxnMembership.participantId = 0;
                            trxnMembership.createdBy = registration.createdBy;
                            trxnMembership.feeAmount = 0;
                            trxnMembership.gstAmount = 0;
                            trxnMembership.discountAmount = 0;
                            trxnMembership.feeType = 'membership';
                            trxnMembership.membershipProductMappingId = membershipMappingId_;
                            trxnMembership.competitionId = competitionId_;
                            trxnMembership.organisationId = membershipOrganisationId_;
                            trxnMembership.paymentOptionRefId = paymentOptionRefId;
                            trxnMembership.paymentFeeTypeRefId = paymentFeeTypeRefId;
                            trxnMembership.divisionId = divisionId_
                            trxnMembership.statusRefId = AppConstants.PAID;
                            transObj.transactions.push(trxnMembership);

                            const cOrganisationId_: number = await this.organisationService.findByUniquekey(compOrgData.organisationId);
                            const trxnCompetition = new Transaction();
                            trxnCompetition.id = 0;
                            trxnCompetition.invoiceId = invoiceId;
                            trxnCompetition.participantId = 0;
                            trxnCompetition.createdBy = registration.createdBy;
                            trxnCompetition.feeAmount = 0;
                            trxnCompetition.gstAmount = 0;
                            trxnCompetition.discountAmount = 0;
                            trxnCompetition.feeType = 'competition';
                            trxnCompetition.membershipProductMappingId = membershipMappingId_;
                            trxnCompetition.competitionId = competitionId_;
                            trxnCompetition.organisationId = cOrganisationId_;
                            trxnCompetition.paymentOptionRefId = paymentOptionRefId;
                            trxnCompetition.paymentFeeTypeRefId = paymentFeeTypeRefId;
                            trxnCompetition.divisionId = divisionId_
                            trxnCompetition.statusRefId = AppConstants.PAID;
                            transObj.transactions.push(trxnCompetition);

                            if (objectIsNotEmpty(affiliateData)) {
                                let aOrganisationId_: number = await this.organisationService.findByUniquekey(affiliateData.organisationId);
                                const trxnAffiliate = new Transaction();
                                trxnAffiliate.id = 0;
                                trxnAffiliate.invoiceId = invoiceId;
                                trxnAffiliate.participantId = 0;
                                trxnAffiliate.createdBy = registration.createdBy;
                                trxnAffiliate.feeAmount = 0;
                                trxnAffiliate.gstAmount = 0;
                                trxnAffiliate.discountAmount = 0;
                                trxnAffiliate.feeType = 'affiliate';
                                trxnAffiliate.membershipProductMappingId = membershipMappingId_;
                                trxnAffiliate.competitionId = competitionId_;
                                trxnAffiliate.organisationId = aOrganisationId_;
                                trxnAffiliate.paymentOptionRefId = paymentOptionRefId;
                                trxnAffiliate.paymentFeeTypeRefId = paymentFeeTypeRefId;
                                trxnAffiliate.divisionId = divisionId_
                                trxnAffiliate.statusRefId = AppConstants.PAID;
                                transObj.transactions.push(trxnAffiliate);
                            }
                        }
                    }

                    transArr.push(transObj);
                }
            }

            return transArr;
        } catch (error) {
            logger.error(`Exception in Invoice School or Hardship Payment ${error}`);
            throw error;
        }
    }

    async performHardshipUpdate(registrationData, registration) {
        try {
            for (let item of registrationData.compParticipants) {
                if (item.selectedOptions.isHardshipCodeApplied == 1) {
                    if (isArrayPopulated(item.selectedOptions.discountCodes)) {
                        for (let discount of item.selectedOptions.discountCodes) {
                            if (discount.isHardshipCode == 1) {
                                let appliedTo = 0;
                                let userDb = await this.userService.findUserByUniqueFields(item.email.toLowerCase(), item.firstName, item.lastName, item.mobileNumber);
                                if (userDb) {
                                    appliedTo = userDb.id;
                                }
                                await this.orgRegistrationHardshipCodeService.updateByCode(item.orgRegistrationId, discount.discountCode, registration, appliedTo);

                            }
                        }
                    }
                }
            }
        } catch (error) {
            logger.error(`Exception occurred in performHardshipUpdate ${error}`);
        }
    }

    private getPaymentFeeTypeRefId(paymentOptionRefId, isTeamRegistration) {
        if (paymentOptionRefId <= 2 && (isTeamRegistration == null || isTeamRegistration == 0)) {
            return AppConstants.CASUAL_FEE;
        } else {
            return AppConstants.SEASONAL_FEE;
        }
    }

    private async createTransactions(transArr, registration, paidBy) {
        try {
            let personMap = new Map();
            let expiryArr = [];
            if (isArrayPopulated(transArr)) {
                for (let item of transArr) {
                    let email = item.email ? item.email.toLowerCase() : null;
                    let userDb = await this.userService.findByEmail(email);
                    let participantId_ = isNotNullAndUndefined(userDb) ? userDb.id : 0;
                    for (let tran of item.transactions) {
                        tran.participantId = participantId_;
                        if (tran.paymentFeeTypeRefId == AppConstants.SEASONAL_FEE && tran.feeType == AppConstants.membership) {
                            let key = participantId_ + "#" + tran.competitionId + "#" + tran.membershipProductMappingId;
                            if (personMap.get(key) == undefined) {
                                let obj = {
                                    participantId: participantId_,
                                    competitionId: tran.competitionId,
                                    membershipProductMappingId: tran.membershipProductMappingId,
                                    organisationId: tran.organisationId,
                                    amount: feeIsNull(tran.feeAmount)
                                }

                                expiryArr.push(obj);
                                personMap.set(key, obj);
                            }
                        }

                        if (!tran.id) {
                            tran.updatedBy = participantId_;
                            tran.updatedOn = new Date();
                        }
                        if (tran.invoiceId) {
                            tran.paidBy = paidBy;
                        }
                        await this.transactionService.createOrUpdate(tran);
                    }
                }

                if (isArrayPopulated(expiryArr)) {
                    await this.performExpiryValidation(expiryArr, registration);
                }
            }
            return personMap;
        } catch (error) {
            throw error;
        }
    }

    private async createTeamTransactions(registration, invoiceId, teamMemberRegId) {
        logger.info(`Inside createTeamTransactions :: ${registration.id}`);
        try {
            let trackData = null;
            if (teamMemberRegId) {
                trackData = await this.registrationTrackService.findByteamMemberRegId(registration.id, RegistrationStep.TeamInviteTrackStep, teamMemberRegId);
            } else {
                trackData = await this.registrationTrackService.findByRegistrationId(registration.id, RegistrationStep.TeamInviteTrackStep);
            }

            let transArr = [];
            if (isNotNullAndUndefined(trackData)) {
                let jsonData = trackData.jsonData;
                if (isNotNullAndUndefined(jsonData)) {
                    let transactions = jsonData;
                    if (isArrayPopulated(transactions)) {
                        for (let item of transactions) {
                            let userDb = await this.userService.findByEmail(item.email.toLowerCase());
                            let participantId_ = isNotNullAndUndefined(userDb) ? userDb.id : 0;
                            let feeTypeRefId = await this.getTransFeeTypeRefId(item.feeType);
                            const trxn = new Transaction();
                            trxn.id = 0;
                            trxn.invoiceRefId = invoiceId;
                            trxn.participantId = participantId_;
                            trxn.createdBy = registration.createdBy;
                            trxn.feeAmount = item.feeAmount;
                            trxn.gstAmount = item.gstAmount;
                            trxn.discountAmount = item.discountAmount;
                            trxn.familyDiscountAmount = 0;
                            trxn.feeType = item.feeType;
                            trxn.feeTypeRefId = feeTypeRefId.feeTypeRefId ? feeTypeRefId.feeTypeRefId : FinanceFeeType.Membership;
                            trxn.membershipProductMappingId = item.membershipProductMappingId;
                            trxn.competitionId = item.competitionId;
                            trxn.organisationId = item.organisationId;
                            trxn.divisionId = item.divisionId;
                            trxn.governmentVoucherAmount = item.governmentVoucherAmount;
                            trxn.paidBy = participantId_;
                            transArr.push(trxn);

                            if (trxn.feeType == "competition" || trxn.feeType == "affiliate") {
                                if (!isNullOrZero(item.nominationFee) || !isNullOrZero(item.nominationGST)) {
                                    if (item.nominationFeeToPay) {
                                        const trxn = new Transaction();
                                        trxn.id = 0;
                                        trxn.invoiceRefId = invoiceId;
                                        trxn.participantId = participantId_;
                                        trxn.createdBy = registration.createdBy;
                                        trxn.feeAmount = item.nominationFeeToPay;
                                        trxn.gstAmount = item.nominationGSTToPay;
                                        trxn.feeType = "nomination";
                                        trxn.feeTypeRefId = feeTypeRefId.nominationFeeTypeRefId;
                                        trxn.membershipProductMappingId = item.membershipProductMappingId;
                                        trxn.competitionId = item.competitionId;
                                        trxn.organisationId = item.organisationId;
                                        trxn.divisionId = item.divisionId;
                                        trxn.paidBy = participantId_;
                                        transArr.push(trxn);
                                    }
                                }
                            }
                        }
                    }

                    if (isArrayPopulated(transArr)) {
                        await this.transactionService.batchCreateOrUpdate(transArr);
                    }
                }
            }
        } catch (error) {
            logger.error(`Exception occurred in createTeamTransactions ${error} `);
            throw error;
        }
    }

    private async createInstalmentTransactions(registration, userRegId, stepsId, invoiceId, paidBy) {
        try {
            let trackData = null;
            if (userRegId != null) {
                trackData = await this.registrationTrackService.findByUserRegistrationId(registration.id, stepsId, userRegId);
            } else {
                trackData = await this.registrationTrackService.findByRegistrationId(registration.id, stepsId);
            }

            let transArr = [];
            if (isNotNullAndUndefined(trackData)) {
                let jsonData = trackData.jsonData;
                if (isNotNullAndUndefined(jsonData)) {
                    let transactions = jsonData;
                    if (isArrayPopulated(transactions)) {
                        for (let item of transactions) {
                            let userDb = await this.userService.findByEmail(item.email.toLowerCase());
                            let participantId_ = isNotNullAndUndefined(userDb) ? userDb.id : 0;
                            let feeTypeRefId = await this.getTransFeeTypeRefId(item.feeType);
                            if (item.feeAmount) {
                                const trxn = new Transaction();
                                trxn.id = 0;
                                trxn.invoiceRefId = invoiceId;
                                trxn.participantId = participantId_;
                                trxn.instalmentDate = item.instalmentDate;
                                trxn.createdBy = registration.createdBy;
                                trxn.feeAmount = item.feeAmount;
                                trxn.gstAmount = item.gstAmount;
                                trxn.discountAmount = item.discountAmount;
                                trxn.familyDiscountAmount = item.familyDiscountAmount;
                                trxn.feeType = item.feeType;
                                trxn.feeTypeRefId = feeTypeRefId.feeTypeRefId ? feeTypeRefId.feeTypeRefId : FinanceFeeType.Membership;
                                trxn.membershipProductMappingId = item.membershipProductMappingId;
                                trxn.competitionId = item.competitionId;
                                trxn.organisationId = item.organisationId;
                                trxn.paymentOptionRefId = item.paymentOptionRefId;
                                trxn.paymentFeeTypeRefId = item.paymentFeeTypeRefId;
                                trxn.divisionId = item.divisionId;
                                trxn.governmentVoucherAmount = item.governmentVoucherAmount;
                                trxn.paidBy = paidBy;
                                transArr.push(trxn);
                            }

                            if (item.feeType == "competition" || item.feeType == "affiliate") {
                                if (!isNullOrZero(item.nominationFee) || !isNullOrZero(item.nominationGST)) {
                                    if (item.nominationFeeToPay) {
                                        const trxn = new Transaction();
                                        trxn.id = 0;
                                        trxn.invoiceRefId = invoiceId;
                                        trxn.instalmentDate = item.instalmentDate;
                                        trxn.participantId = participantId_;
                                        trxn.createdBy = registration.createdBy;
                                        trxn.feeAmount = item.nominationFeeToPay;
                                        trxn.gstAmount = item.nominationGSTToPay;
                                        trxn.feeType = "nomination";
                                        trxn.feeTypeRefId = feeTypeRefId.nominationFeeTypeRefId;
                                        trxn.membershipProductMappingId = item.membershipProductMappingId;
                                        trxn.competitionId = item.competitionId;
                                        trxn.organisationId = item.organisationId;
                                        trxn.divisionId = item.divisionId;
                                        trxn.paidBy = paidBy;
                                        trxn.paymentOptionRefId = item.paymentOptionRefId;
                                        trxn.paymentFeeTypeRefId = item.paymentFeeTypeRefId;
                                        transArr.push(trxn);
                                    }
                                }
                            }
                        }
                    }

                    if (isArrayPopulated(transArr)) {
                        await this.transactionService.batchCreateOrUpdate(transArr);
                    }
                }
            }
        } catch (error) {
            logger.error(`Exception occurred in createTeamTransactions ${error} `);
            throw error;
        }
    }

    private async performNegativeFeeTransactions(registration, invoiceId, paidBy, personMap) {
        try {
            let trackData = await this.registrationTrackService.findByRegistrationId(registration.id, RegistrationStep.NegativeFeeTrackStep);
            let transfer_Group = "NEGATIVE FEE" + "#" + registration.registrationUniqueKey;
            let expiryError = [];
            if (isNotNullAndUndefined(trackData)) {
                let jsonData = trackData.jsonData;
                if (isNotNullAndUndefined(jsonData)) {
                    let transactions = jsonData;
                    if (isArrayPopulated(transactions)) {
                        for (let item of transactions) {
                            let guidKey = uuidv4();
                            const transferGroup = transfer_Group  + "#" + guidKey;
                            let onBehalfOf = await this.onBehalfOfData(item, 'NEGATIVE FEE');
                            if (onBehalfOf.sourceOrgId != null && onBehalfOf.targetOrgId != null) {
                                let amount = feeIsNull(item.feeAmount) + feeIsNull(item.gstAmount);
                                let feeTypeRefId = await this.getTransFeeTypeRefId(item.feeType);
                                // if (onBehalfOf.becsMandateId != null && onBehalfOf.sourceOrgCustId != null && onBehalfOf.targetOrgAccId != null) {
                                const STRIPE_TOTAL_FEE = formatFeeForStripe1(amount);

                                let trans = null;
                                if (onBehalfOf.becsMandateId != null && onBehalfOf.sourceOrgCustId != null && onBehalfOf.targetOrgAccId != null && STRIPE_TOTAL_FEE >= 50) {
                                    trans = await this.transferOnBehalfOf(
                                        STRIPE_TOTAL_FEE, onBehalfOf.sourceOrgCustId, onBehalfOf.becsMandateId,
                                        onBehalfOf.targetOrgAccId, onBehalfOf.description, transferGroup
                                    );
                                }

                                let userDb = await this.userService.findByEmail(item.email.toLowerCase());
                                let participantId_ = isNotNullAndUndefined(userDb) ? userDb.id : 0;
                                if (!isNullOrZero(item.feeAmount) || !isNullOrZero(item.gstAmount)) {
                                    let trxn = await this.onBehalfOfTransaction(
                                        item, invoiceId, participantId_, registration, paidBy, item.feeType,
                                        feeTypeRefId.feeTypeRefId, TransactionTypeRefId.NegativeFee, trans, guidKey,TransactionStatus.Draft
                                    );
                                    await this.transactionService.createOrUpdate(trxn);
                                    this.negativeExpiryCheck(item, participantId_, personMap, expiryError);
                                }
                                trans = null;
                                if (!isNullOrZero(item.nominationFeeToPay) || !isNullOrZero(item.nominationGSTToPay)) {
                                    let amount = feeIsNull(item.nominationFeeToPay) + feeIsNull(item.nominationGSTToPay);
                                    const STRIPE_TOTAL_FEE = formatFeeForStripe1(amount);
                                    if (onBehalfOf.becsMandateId != null && onBehalfOf.sourceOrgCustId != null && onBehalfOf.targetOrgAccId != null && STRIPE_TOTAL_FEE >= 50) {
                                        trans = await this.transferOnBehalfOf(
                                            STRIPE_TOTAL_FEE, onBehalfOf.sourceOrgCustId, onBehalfOf.becsMandateId,
                                            onBehalfOf.targetOrgAccId, onBehalfOf.description, transferGroup
                                        );
                                    }
                                    let trxn = await this.onBehalfOfTransaction(
                                        item, invoiceId, participantId_, registration, paidBy, AppConstants.nomination,
                                        feeTypeRefId.nominationFeeTypeRefId, TransactionTypeRefId.NegativeFee, trans, guidKey,TransactionStatus.Draft
                                    );
                                    await this.transactionService.createOrUpdate(trxn);
                                }
                                //}
                            } else if (onBehalfOf.sourceOrgId == null && onBehalfOf.targetOrgId != null) {
                                let userDb = await this.userService.findByEmail(item.email.toLowerCase());
                                let participantId_ = isNotNullAndUndefined(userDb) ? userDb.id : 0;
                                let feeTypeRefId = await this.getTransFeeTypeRefId(item.feeType);
                                if (!isNullOrZero(item.feeAmount) || !isNullOrZero(item.gstAmount)) {
                                    let trxn = await this.onBehalfOfTransaction(
                                        item, invoiceId, participantId_, registration, paidBy, item.feeType,
                                        feeTypeRefId.feeTypeRefId, TransactionTypeRefId.NegativeFee, null, guidKey,TransactionStatus.Success
                                    );
                                    await this.transactionService.createOrUpdate(trxn);
                                    this.negativeExpiryCheck(item, participantId_, personMap, expiryError);
                                }

                                if (!isNullOrZero(item.nominationFeeToPay) || !isNullOrZero(item.nominationGSTToPay)) {
                                    let amount = feeIsNull(item.nominationFeeToPay) + feeIsNull(item.nominationGSTToPay);
                                    // const STRIPE_TOTAL_FEE = formatFeeForStripe1(amount);
                                    let trxn = await this.onBehalfOfTransaction(
                                        item, invoiceId, participantId_, registration, paidBy, AppConstants.nomination,
                                        feeTypeRefId.nominationFeeTypeRefId, TransactionTypeRefId.NegativeFee, null, guidKey,TransactionStatus.Success
                                    );
                                    await this.transactionService.createOrUpdate(trxn);
                                }
                            }
                        }
                    }
                }
            }

            if (isArrayPopulated(expiryError)) {
                await this.performExpiryValidation(expiryError, registration);
            }
        } catch (error) {
            logger.error(`Exception occurred in performOnBehalfOfTransaction ${error} `);
            throw error;
        }
    }

    public async getTransFeeTypeRefId(feeType) {
        try {
            let feeTypeRefId = null;
            let nominationFeeTypeRefId = null;
            if (feeType == AppConstants.competition) {
                feeTypeRefId = FinanceFeeType.Competition;
                nominationFeeTypeRefId = FinanceFeeType.Nomination;
            } else if (feeType == AppConstants.affiliate) {
                feeTypeRefId = FinanceFeeType.AffiliateCompetition;
                nominationFeeTypeRefId = FinanceFeeType.AffiliateNomination;
            } else if (feeType == AppConstants.membership) {
                feeTypeRefId = FinanceFeeType.Membership;
            } else if (feeType == AppConstants.nomination) {
                feeTypeRefId = FinanceFeeType.Nomination;
            }
            return { feeTypeRefId, nominationFeeTypeRefId };
        } catch (error) {
            throw (error);
        }
    }

    public async transferOnBehalfOf(STRIPE_TOTAL_FEE, sourceOrgCustId, becsMandateId, targetOrgAccId, description, transferGroup) {
        try {
            let paymentIntent = await stripe.paymentIntents.create({
                amount: STRIPE_TOTAL_FEE,
                currency: 'aud',
                payment_method_types: ["au_becs_debit"],
                customer: sourceOrgCustId,
                payment_method: becsMandateId,
                confirm: true,
                description: description,
                on_behalf_of: targetOrgAccId,
                mandate_data: {
                    customer_acceptance: {
                        type: "offline",
                    },
                },
                transfer_data: {
                    destination: targetOrgAccId
                },
                transfer_group: transferGroup
            });

            logger.info(`transferOnBehalfOf paymentIntent ${JSON.stringify(paymentIntent)}`);

            return paymentIntent;
        } catch (error) {
            logger.error(`Exception occurred in transferOnBehalfOf ${error} `);
            throw error;
        }
    }

    private negativeExpiryCheck(tran, participantId_, personMap, expiryArr) {
        try {
            let paymentFeeTypeRefId = this.getPaymentFeeTypeRefId(tran.paymentFeeTypeRefId, 0)
            if (paymentFeeTypeRefId == AppConstants.SEASONAL_FEE && tran.feeType == AppConstants.membership) {
                let key = participantId_ + "#" + tran.competitionId + "#" + tran.membershipProductMappingId;
                if (personMap.get(key) == undefined) {
                    let obj = {
                        participantId: participantId_,
                        competitionId: tran.competitionId,
                        membershipProductMappingId: tran.membershipProductMappingId,
                        organisationId: tran.organisationId,
                        amount: feeIsNull(tran.feeAmount)
                    }

                    expiryArr.push(obj);
                    personMap.set(key, obj);
                }
            }
        } catch (error) {
            throw error;
        }
    }

    private async performHardhipTransaction(registrationProduct, registration, invoiceId, paidBy) {
        try {
            let trackData = await this.registrationTrackService.findByRegistrationId(registration.id, RegistrationStep.HardshipFeeTrackStep);
            let transfer_Group = 'HARDSHIP FEE' + "#" + registration.registrationUniqueKey;
            let hardshipApplied = registrationProduct.compParticipants.find((item) => (item.selectedOptions.isHardshipCodeApplied == 0));
            if (isNotNullAndUndefined(trackData)) {
                let jsonData = trackData.jsonData;
                if (isNotNullAndUndefined(jsonData)) {
                    let transactions = jsonData;
                    if (isArrayPopulated(transactions)) {
                        for (let item of transactions) {
                            let guidKey = uuidv4();
                            const transactionGroup = transfer_Group + "#" + guidKey;
                            let onBehalfOf = await this.onBehalfOfData(item, 'HARDSHIP FEE');

                            if (onBehalfOf.sourceOrgId != null && onBehalfOf.targetOrgId != null) {
                                let amount = feeIsNull(item.feeAmount) + feeIsNull(item.gstAmount);

                                // if (onBehalfOf.becsMandateId != null && onBehalfOf.sourceOrgCustId != null && onBehalfOf.targetOrgAccId != null) {
                                let trans = null;
                                const STRIPE_TOTAL_FEE = formatFeeForStripe1(amount);
                                if (onBehalfOf.becsMandateId != null && onBehalfOf.sourceOrgCustId != null && onBehalfOf.targetOrgAccId != null && STRIPE_TOTAL_FEE >= 50) {
                                    trans = await this.transferOnBehalfOf(
                                        STRIPE_TOTAL_FEE, onBehalfOf.sourceOrgCustId, onBehalfOf.becsMandateId,
                                        onBehalfOf.targetOrgAccId, onBehalfOf.description, transactionGroup
                                    );
                                }
                                //TODO: update the stripe transaction
                                let feeTypeRefId = await this.getTransFeeTypeRefId(item.feeType);
                                let userDb = await this.userService.findByEmail(item.email.toLowerCase());
                                let participantId_ = isNotNullAndUndefined(userDb) ? userDb.id : 0;
                                if ((!isNullOrZero(item.feeAmount) || !isNullOrZero(item.gstAmount))) {
                                    let trxn = await this.onBehalfOfTransaction(
                                        item, invoiceId, participantId_, registration, paidBy, item.feeType,
                                        feeTypeRefId.feeTypeRefId, TransactionTypeRefId.HardshipFee, trans, guidKey,TransactionStatus.Draft
                                    );
                                    await this.transactionService.createOrUpdate(trxn);
                                }
                                trans = null;
                                if (!isNullOrZero(item.nominationFeeToPay) || !isNullOrZero(item.nominationGSTToPay)) {
                                    let amount = feeIsNull(item.nominationFeeToPay) + feeIsNull(item.nominationGSTToPay);
                                    const STRIPE_TOTAL_FEE = formatFeeForStripe1(amount);
                                    if (onBehalfOf.becsMandateId != null && onBehalfOf.sourceOrgCustId != null && onBehalfOf.targetOrgAccId != null && STRIPE_TOTAL_FEE >= 50) {
                                        trans = await this.transferOnBehalfOf(
                                            STRIPE_TOTAL_FEE, onBehalfOf.sourceOrgCustId, onBehalfOf.becsMandateId,
                                            onBehalfOf.targetOrgAccId, onBehalfOf.description, transactionGroup
                                        );
                                    }
                                    let trxn = await this.onBehalfOfTransaction(
                                        item, invoiceId, participantId_, registration, paidBy, AppConstants.nomination,
                                        feeTypeRefId.nominationFeeTypeRefId, TransactionTypeRefId.HardshipFee, trans, guidKey,TransactionStatus.Draft
                                    );
                                    await this.transactionService.createOrUpdate(trxn);
                                    //TODO: update the stripe transaction id
                                }
                                // }
                            } else if (onBehalfOf.sourceOrgId == null && onBehalfOf.targetOrgId != null) {
                                let userDb = await this.userService.findByEmail(item.email.toLowerCase());
                                let participantId_ = isNotNullAndUndefined(userDb) ? userDb.id : 0;
                                let feeTypeRefId = await this.getTransFeeTypeRefId(item.feeType);
                                let trxn = await this.onBehalfOfTransaction(
                                    item, invoiceId, participantId_, registration, paidBy, item.feeType,
                                    feeTypeRefId.feeTypeRefId, TransactionTypeRefId.HardshipFee, null, guidKey,TransactionStatus.Success
                                );
                                await this.transactionService.createOrUpdate(trxn);
                                if (!isNullOrZero(item.nominationFeeToPay)) {
                                    let trxn = await this.onBehalfOfTransaction(
                                        item, invoiceId, participantId_, registration, paidBy, AppConstants.nomination,
                                        feeTypeRefId.nominationFeeTypeRefId, TransactionTypeRefId.HardshipFee, null, guidKey,
                                    TransactionStatus.Success);
                                    await this.transactionService.createOrUpdate(trxn);
                                }
                            }
                        }
                    }
                }
            }
            if(hardshipApplied) {
                // Updating Transaction Status Reference By invoice Id
                await this.transactionService.updateTransactionByInvoice(invoiceId,TransactionStatus.Success,TransactionTypeRefId.Registration);
            }
        } catch (error) {
            logger.error(`Exception occurred in performHardhipTransaction ${error} `);
            throw error;
        }
    }

    private async onBehalfOfData(item, feeDesc) {
        try {
            let obj = {
                sourceOrgId: item.sourceOrgId,
                targetOrgId: item.organisationId,
                description: null,
                sourceOrgCustId: null,
                becsMandateId: null,
                targetOrgAccId: null
            }

            if (obj.sourceOrgId != null && obj.targetOrgId != null) {
                let sourceOrg = await this.organisationService.findById(obj.sourceOrgId);
                let targetOrg = await this.organisationService.findById(obj.targetOrgId);
                const orgName = targetOrg.name;
                const playerName = formatPersonName(item.firstName, null, item.lastName);
                const membershipProductTypeName_ = item.membershipTypeName;
                obj.description = `${playerName} - ${membershipProductTypeName_} - ${orgName} - ${feeDesc}`;
                obj.sourceOrgCustId = sourceOrg ? sourceOrg.stripeCustomerAccountId : null;
                obj.becsMandateId = sourceOrg ? sourceOrg.stripeBecsMandateId : null;
                obj.targetOrgAccId = targetOrg ? targetOrg.stripeAccountID : null;
            }

            return obj;
        } catch (error) {
            logger.error(`Exception occurred in onBehalfOfHandling ${error} `);
            throw error;
        }
    }

    private async onBehalfOfTransaction(item, invoiceId, participantId_, registration, paidBy, feeType, feeTypeRefId, transactionTypeRefId, paymentIntent, guidKey,transactionStatus) {
        try {
            let compDivisionDb = await this.competitionDivisionService.findBycmpd(item.divisionId)
            const divisionId_ = compDivisionDb != undefined ? compDivisionDb.id : 0;
            const trxn = new Transaction();
            trxn.id = 0;
            trxn.invoiceId = invoiceId;
            trxn.participantId = participantId_;
            trxn.createdBy = registration.createdBy;
            trxn.feeAmount = (feeType == AppConstants.competition || feeType == AppConstants.membership || feeType == AppConstants.affiliate)
                ? item.feeAmount
                : item.nominationFeeToPay;
            trxn.gstAmount = (feeType == AppConstants.competition || feeType == AppConstants.membership || feeType == AppConstants.affiliate)
                ? item.gstAmount
                : item.nominationGSTToPay;
            trxn.discountAmount = item.discountAmount;
            trxn.familyDiscountAmount = 0;
            trxn.feeType = feeType;
            trxn.feeTypeRefId = feeTypeRefId;
            trxn.membershipProductMappingId = item.membershipProductMappingId;
            trxn.competitionId = item.competitionId;
            trxn.organisationId = item.organisationId;
            trxn.divisionId = divisionId_;
            trxn.governmentVoucherAmount = 0;
            trxn.paidBy = paidBy;
            trxn.paymentOptionRefId = item.paymentOptionRefId;
            trxn.paymentFeeTypeRefId = this.getPaymentFeeTypeRefId(item.paymentOptionRefId, 0);
            trxn.statusRefId = transactionStatus;
            trxn.referenceId = guidKey;
            trxn.transactionTypeRefId = transactionTypeRefId;
            trxn.paymentIntentId = (paymentIntent ? paymentIntent.id : null);
            return trxn;
        } catch (error) {
            throw error;
        }
    }

    private async performDiscountFeeTransactions(registration, invoiceId, paidBy) {
        try {
            let trackData = await this.registrationTrackService.findByRegistrationId(registration.id, RegistrationStep.DiscountFeeTrackStep);
            let transfer_Group = 'DISCOUNT FEE' + "#" + registration.registrationUniqueKey;
            if (isNotNullAndUndefined(trackData)) {
                let jsonData = trackData.jsonData;
                if (isNotNullAndUndefined(jsonData)) {
                    let transactions = jsonData;
                    if (isArrayPopulated(transactions)) {
                        for (let item of transactions) {
                            let guidKey = uuidv4();
                            const transferGroup = transfer_Group + '#' + guidKey;
                            let onBehalfOf = await this.onBehalfOfData(item, 'DISCOUNT FEE');
                            if (onBehalfOf.sourceOrgId != null && onBehalfOf.targetOrgId != null) {
                                if (onBehalfOf.sourceOrgId != onBehalfOf.targetOrgId) {
                                    let amount = feeIsNull(item.feeAmount) + feeIsNull(item.gstAmount);
                                    const STRIPE_TOTAL_FEE = formatFeeForStripe1(amount);

                                    let trans = null;
                                    if (onBehalfOf.becsMandateId != null && onBehalfOf.sourceOrgCustId != null && onBehalfOf.targetOrgAccId != null && STRIPE_TOTAL_FEE >= 50) {
                                        trans = await this.transferOnBehalfOf(
                                            STRIPE_TOTAL_FEE, onBehalfOf.sourceOrgCustId, onBehalfOf.becsMandateId,
                                            onBehalfOf.targetOrgAccId, onBehalfOf.description, transferGroup
                                        );
                                    }

                                    let feeTypeRefId = await this.getTransFeeTypeRefId(item.feeType);
                                    let userDb = await this.userService.findByEmail(item.email.toLowerCase());
                                    let participantId_ = isNotNullAndUndefined(userDb) ? userDb.id : 0;
                                    if (!isNullOrZero(item.feeAmount) || !isNullOrZero(item.gstAmount)) {
                                        if (item.feeType == AppConstants.nomination) {
                                            item['nominationFeeToPay'] = item.feeAmount;
                                            item['nominationGSTToPay'] = item.gstAmount;
                                        }
                                        let trxn = await this.onBehalfOfTransaction(
                                            item, invoiceId, participantId_, registration, paidBy, item.feeType,
                                            feeTypeRefId.feeTypeRefId, TransactionTypeRefId.Discount, trans, guidKey,TransactionStatus.Draft
                                        );
                                        await this.transactionService.createOrUpdate(trxn);
                                    }
                                }
                            } else if (onBehalfOf.sourceOrgId != null && onBehalfOf.targetOrgId == null) {
                                let userDb = await this.userService.findByEmail(item.email.toLowerCase());
                                let participantId_ = isNotNullAndUndefined(userDb) ? userDb.id : 0;
                                let feeTypeRefId = await this.getTransFeeTypeRefId(item.feeType);
                                item["organisationId"] = onBehalfOf.sourceOrgId;
                                let trxn = await this.onBehalfOfTransaction(
                                    item, invoiceId, participantId_, registration, paidBy, item.feeType,
                                    feeTypeRefId.feeTypeRefId, TransactionTypeRefId.Discount, null, guidKey,TransactionStatus.Success
                                );
                                await this.transactionService.createOrUpdate(trxn);
                            }
                        }
                    }
                }
            }
        } catch (error) {
            logger.error(`Exception occurred in performOnBehalfOfTransaction ${error} `);
            throw error;
        }
    }

    public async sendStripeWebHookEmail(data, hookedby) {
        // TODO: as per doc
        const emailBody = `just a check for mails. This mail is regarding the check for webhooks that is hooked by ${hookedby} with data as ${JSON.stringify(data)}
        and 
        ${JSON.parse(data)}
        `
        const transporter = nodeMailer.createTransport({
            host: "smtp.gmail.com",
            port: 587,
            secure: false,
            auth: {
                user: process.env.MAIL_USERNAME,
                pass: process.env.MAIL_PASSWORD
            },
            tls: { rejectUnauthorized: false }
        });

        const mailOptions = {
            from: {
                name: process.env.MAIL_FROM_NAME,
                address: process.env.MAIL_FROM_ADDRESS
            },
            to: "iphonestatus1@gmail.com",
            replyTo: "donotreply@worldsportaction.com",
            subject: 'test email for webhooks 1.0',
            html: emailBody
        };
        if (Number(process.env.SOURCE_MAIL) == 1) {
            mailOptions.html = ' To: ' + mailOptions.to + '<br><br>' + mailOptions.html
            mailOptions.to = process.env.TEMP_DEV_EMAIL
        }
        await transporter.sendMail(mailOptions, (err, info) => {
            return Promise.resolve();
        });
    }

    public async createStripeInvoice(customer: string, amount: number, currency: string, description: string): Promise<any> {
        return await stripe.invoiceItems.create({ customer, amount, currency, description });
    }

    private async getInvoiceData(registration, registrationTrackJson) {
        let invoiceData = null;
        try {
            // let registrationTrackJson = await this.registrationTrackService.findByRegistrationId(registration.id, 3);
            if (isNotNullAndUndefined(registrationTrackJson)) {
                let billTo = await this.userService.getUserInfo(registration.createdBy);
                invoiceData = registrationTrackJson;
                let stateOrgId = null;
                let organisationLogoUrl = null;
                for (let item of invoiceData.compParticipants) {
                    for (let mem of item.membershipProducts) {
                        if (mem.fees.membershipFee) {
                            stateOrgId = mem.fees.membershipFee.organisationId;
                            break;
                        }
                    }
                }
                if (stateOrgId != null) {
                    let organisationId = await this.organisationService.findByUniquekey(stateOrgId);
                    let organisationLogo = await this.organisationLogoService.findByOrganisationId(organisationId);
                    if (isNotNullAndUndefined(organisationLogo)) {
                        organisationLogoUrl = organisationLogo.logoUrl;
                    }
                }
                invoiceData["billTo"] = billTo;
                invoiceData["organisationLogo"] = organisationLogoUrl;
            }
        } catch (error) {
            logger.error(`Exception occurred in getInvoiceData ` + error);
            throw error;
        }

        return invoiceData;
    }

    private async registrationMail(registration: Registration, registrationTrackJson: string, friend, invoiceId) {
        try {
            // Send Invoice Template
            let invoiceData = await this.getInvoiceData(registration, registrationTrackJson);
            let fileName = await this.invoiceService.printTeamRegistrationInvoiceTemplate(invoiceData);
            if (fileName != null) {
                // Send Mail
                let res1 = await this.registrationService.findMailReceiverType(registration.id);
                let res = res1.find((x) => x);
                let futureInstalments = await this.transactionService.findFutureInstallmentByInvoiceId(invoiceId);
                let invoiceRecieverType = await this.invoiceRecieverType(registration.id);
                let friendArray = await this.friendService.findByRegistrationId(registration.id);
                let userId = res.userId;

                if (Number(res.teamReg) > 0) {
                    await this.mailForTeamRegistration(registration.id, userId, fileName, invoiceRecieverType, futureInstalments);
                }
                if (Number(res.individualReg) == 1) {
                    await this.mailToParticipant(registration.id, userId, fileName, invoiceRecieverType);
                }
                if (friend == 1 && isArrayPopulated(friendArray)) {
                    await this.mailToReferFriend(registration.id, friendArray, userId);
                }
            }
        } catch (error) {
            throw error;
        }
    }

    private async teamMemberRegMail(registration, teamMemberRegId) {
        try {
            let result = await this.registrationService.findTeamRegistrationInfo(registration.id);

            let passwordMap = new Map();
            let userMap = new Map();
            if (isArrayPopulated(result)) {
                let res = result.find(x => x);
                let players = [];
                let resPlayers = res.players.filter((x) => x.teamMemberRegId == teamMemberRegId)
                for (let p of resPlayers) {
                    let userObj = {
                        player: p,
                        roleArray: []
                    }
                    let userTemp = userMap.get(p.userId)
                    if (userTemp == undefined) {
                        if (p.divisionName != null) {
                            userObj.roleArray.push(p.divisionName)
                        }
                        players.push(userObj);
                        userMap.set(p.userId, userObj.roleArray)
                    } else {
                        if (p.divisionName != null) {
                            userTemp.push(p.divisionName)
                        }
                    }
                }
                for (let userObj of players) {
                    let p = userObj.player;
                    let mailObj1 = await this.communicationTemplateService.findById(6);
                    let cTrack1 = new CommunicationTrack();
                    let password1 = null;
                    if (p.password == null) {
                        if (passwordMap.get(p.userId) == undefined) {
                            let user = await this.userService.findById(p.userId)
                            password1 = Math.random().toString(36).slice(-8);
                            user.password = md5(password1);
                            passwordMap.set(p.userId, password1)
                            await this.userService.createOrUpdate(user);
                        }
                    }
                    await this.userService.sendTeamRegisterPlayerInviteMail(res, p, mailObj1, res.userId, password1, registration.id, userObj.roleArray);
                    await this.sleep(1000);
                }
            }
        } catch (error) {
            throw error;
        }
    }

    private async mailForTeamRegistration(registrationId, userId, fileName, invoiceReciever, futureInstalments) {
        try {
            // const compOrganisation = await this.organisationService.findById(organisationId);
            // const competition = await this.competitionRegService.findById(competitionId);
            // const orgRegCreated = await this.orgRegistrationService.findById(orgRegistrationId);

            // let OrganisationName = compOrganisation.name
            let passwordMap = new Map();
            let result = await this.registrationService.findTeamRegistrationInfo(registrationId)
            if (isArrayPopulated(result)) {
                for (let res of result) {
                    if (isArrayPopulated(res.players)) {
                        let mailObj = await this.communicationTemplateService.findById(26); //~~Template 5
                        res.players.sort(function (a, b) {
                            var x = a.firstName;
                            var y = b.firstName;
                            if (x < y) {
                                return -1;
                            }
                            if (x > y) {
                                return 1;
                            }
                            return 0;
                        });
                        let password = null;
                        if (res.password == null) {
                            let user = await this.userService.findById(res.userId)
                            password = Math.random().toString(36).slice(-8);
                            user.password = md5(password);
                            await this.userService.createOrUpdate(user);
                            passwordMap.set(res.userId, password)
                            await this.updateFirebaseData(user, user.password);
                        }
                        await this.userService.sendTeamRegisterConfirmationMail(res, mailObj, userId, password, registrationId, fileName, invoiceReciever, futureInstalments)
                        // await this.sleep(1000);
                        let userMap = new Map();
                        let players = []
                        if (res.paymentOptionRefId != 5) {
                            for (let p of res.players) {
                                let userObj = {
                                    player: p,
                                    roleArray: []
                                }
                                let userTemp = userMap.get(p.userId)
                                if (userTemp == undefined) {
                                    if (p.divisionName != null) {
                                        userObj.roleArray.push(p.divisionName)
                                    }
                                    players.push(userObj);
                                    userMap.set(p.userId, userObj.roleArray)
                                } else {
                                    if (p.divisionName != null) {
                                        userTemp.push(p.divisionName)
                                    }
                                }
                            }
                            for (let userObj of players) {
                                let p = userObj.player;
                                let mailObj1 = await this.communicationTemplateService.findById(27); //~~Template 6
                                let password1 = null;
                                if (p.password == null) {
                                    if (passwordMap.get(p.userId) == undefined) {
                                        let user = await this.userService.findById(p.userId)
                                        password1 = Math.random().toString(36).slice(-8);
                                        user.password = md5(password1);
                                        passwordMap.set(p.userId, password1)
                                        await this.userService.createOrUpdate(user);
                                    }
                                }
                                await this.userService.sendTeamRegisterPlayerInviteMail(res, p, mailObj1, userId, password1, registrationId, userObj.roleArray);
                                await this.sleep(1000);
                            }
                        }
                    } else {
                        // unnamed team
                        let mailObj = await this.communicationTemplateService.findById(25); //~~Template 4
                        let password = null;
                        if (res.password == null) {
                            let user = await this.userService.findById(res.userId)
                            password = Math.random().toString(36).slice(-8);
                            user.password = md5(password);
                            await this.userService.createOrUpdate(user);
                            await this.updateFirebaseData(user, user.password);
                        }
                        await this.userService.sendTeamRegisterConfirmationMail(res, mailObj, userId, password, registrationId, fileName, invoiceReciever, futureInstalments)
                    }
                }
            }
        } catch (error) {
            logger.error(`Error Occurred in Team mail ` + error);
            throw error;
        }
    }

    public async mailToParticipant(registrationId: number, userId: number, fileName: string, invoiceReciever: number) {
        try {
            let passwordMap = new Map();
            let invoiceRecieverMap = new Map();
            let result = await this.registrationService.findParticipantRegistrationInfo(registrationId)
            if (isArrayPopulated(result[0])) {
                let particpants: ParticipantRegistrationInfoDto[] = result[0];
                let participant = result[0].find((x) => x);
                let password = null;
                if (participant.creator.isInActive == 1) {
                    let parentEmailString = getParentEmail(participant.creator.email);
                    let parentUser = await this.userService.findByEmail(parentEmailString);
                    if (parentUser.password == null) {
                        let creator = await this.userService.findById(parentUser.id);
                        password = Math.random().toString(36).slice(-8);
                        creator.password = md5(password);
                        await this.userService.createOrUpdate(creator);
                        await this.updateFirebaseData(creator, creator.password);
                    }
                } else if (participant.creator.password == null) {
                    let creator = await this.userService.findById(participant.creator.id);
                    password = Math.random().toString(36).slice(-8);
                    creator.password = md5(password);
                    await this.userService.createOrUpdate(creator);
                    await this.updateFirebaseData(creator, creator.password);
                }
                let template = await this.communicationTemplateService.findById(7);
                // if (result[0].length == 1) {
                //     if (participant.products.length == 1) template = await this.communicationTemplateService.findById(7);
                //     else if (participant.userId == participant.creatorId) {
                //         template = await this.communicationTemplateService.findById(8);
                //     } else {
                //         template = await this.communicationTemplateService.findById(9);
                //     }
                // } else {
                //     template = await this.communicationTemplateService.findById(9);
                // }
                await this.userService.sendIndividualMail(participant, template, password, userId, registrationId, fileName, invoiceReciever, particpants);

                for (let participant of particpants as Array<ParticipantRegistrationInfoDto>) {
                    if (participant.user.id != participant.creator.id) {
                        if (participant.user.isInActive == 0) {
                            let password = null;
                            if (participant.user.password == null) {
                                let user = await this.userService.findById(participant.user.id);
                                password = Math.random().toString(36).slice(-8);
                                user.password = md5(password);
                                await this.userService.createOrUpdate(user);
                                await this.updateFirebaseData(user, user.password);
                            }
                            template = await this.communicationTemplateService.findById(8);
                            await this.userService.sendIndividualMailNonRegisterer(
                                participant,
                                template,
                                password,
                                userId,
                                registrationId,
                                fileName,
                                invoiceReciever
                            );
                        } else if (participant.password == null) {
                            let user = await this.userService.findById(participant.userId);
                            user.password = md5(AppConstants.password);
                            await this.userService.createOrUpdate(user);
                            await this.updateFirebaseData(user, user.password);
                        }
                    }
                }
            }

            // for (let res of result[0]) {
            //     let password = null;
            //     if (res.password == null) {
            //         let user = await this.userService.findById(res.userId)
            //         password = Math.random().toString(36).slice(-8);
            //         user.password = md5(password);
            //         await this.userService.createOrUpdate(user);
            //         await this.updateFirebaseData(user, user.password);
            //     }
            //     let creator = 1
            //
            //     if (isArrayEmpty(result[1])) {
            //         for (let parent of result[1]) {
            //             if (parent.participantUserId == res.userId) {
            //                 let parentPass = null
            //                 if (parent.password == null) {
            //                     let user = await this.userService.findById(parent.userId)
            //                     parentPass = Math.random().toString(36).slice(-8);
            //                     user.password = md5(parentPass);
            //                     await this.userService.createOrUpdate(user);
            //                     await this.updateFirebaseData(user, user.password);
            //                 }
            //                 let mailObj = await this.communicationTemplateService.findById(8);
            //
            //                 logger.info(` ################# --- mail to parent`)
            //                 await this.userService.sendIndividualMail(res, mailObj, parentPass, userId, registrationId, creator, parent, fileName, invoiceReciever, invoiceRecieverMap, 0)
            //             }
            //         }
            //     }
            //
            //     if (res.registeringYourselfRefId == 1) {
            //         if (res.isInActive == 0) {
            //             let mailObj = await this.communicationTemplateService.findById(7);
            //
            //             logger.info(` ################# --- mail to register myself`)
            //             await this.userService.sendIndividualMail(res, mailObj, password, userId, registrationId, creator, null, fileName, invoiceReciever, invoiceRecieverMap, 0)
            //         }
            //     } else if (res.registeringYourselfRefId == 3) {
            //         // if (res.whoAreYouRegisteringRefId == 2) {
            //         if (res.userId != res.creatorId) {
            //             let creatorPassword = null;
            //             if (res.creatorPassword == null) {
            //                 let userDb = await this.userService.findById(res.creatorId)
            //                 creatorPassword = Math.random().toString(36).slice(-8);
            //                 userDb.password = md5(creatorPassword);
            //                 await this.userService.createOrUpdate(userDb);
            //                 await this.updateFirebaseData(userDb, userDb.password);
            //             }
            //             let mailObj = await this.communicationTemplateService.findById(9);
            //
            //             logger.info(` ################# --- mail to others - registerer`)
            //             await this.userService.sendIndividualMail(res, mailObj, creatorPassword, userId, registrationId, creator, null, fileName, invoiceReciever, invoiceRecieverMap, 1)
            //         }
            //         // }
            //         if (res.isInActive == 0) {
            //             creator = 2;
            //             let mailObj = await this.communicationTemplateService.findById(10);
            //
            //             logger.info(` ################# --- mail to others - registerered player`)
            //             await this.userService.sendIndividualMail(res, mailObj, password, userId, registrationId, creator, null, fileName, invoiceReciever, invoiceRecieverMap, 0)
            //         }
            //         // }
            //     }
            // }

            // return response.status(200).send("Success")
        } catch (error) {
            logger.error(`Error Occurred in mailToParticipant ` + error);
            throw error;
        }
    }

    public async mailToReferFriend(registrationId, friendArray, userId) {
        try {
            if (isArrayPopulated(friendArray)) {
                for (let res of friendArray) {
                    let mailObj = await this.communicationTemplateService.findById(14);
                    logger.info(` ################# --- mail to refer friend`)
                    await this.userService.sendMailToReferFriend(res, mailObj, userId, registrationId)
                }
            }

            // return response.status(200).send("Success")
        } catch (error) {
            logger.error(`Error Occurred in mailToParticipant ` + error);
            throw error;
        }
    }

    public async mailForDirectDebitPayment(registrationId, createdBy, userId, teamReg) {
        try {
            // let res = null
            let res1 = await this.registrationService.findMailReceiverType(registrationId)
            let res = res1.find(x => x);
            let userInfo = await this.userService.findById(createdBy)

            if (teamReg > 0) {
                let result = await this.registrationService.findTeamRegistrationInfo(registrationId);
                let mailObj = await this.communicationTemplateService.findById(10);
                let res2 = result.find(x => x);
                await this.userService.sendDirectDebitMailTeam(mailObj, userInfo, registrationId, userId, res2, 2)
            } else {
                //if (Number(res.individualReg) == 1) {
                let result = await this.registrationService.findParticipantRegistrationInfo(registrationId)

                let mailObj = await this.communicationTemplateService.findById(9);
                if (isArrayPopulated(result[0])) {
                    let participant = result[0].find(x => x);
                    await this.userService.sendDirectDebitMailIndividual(mailObj, userInfo, registrationId, userId, participant, 1)
                }
            }
        } catch (error) {
            throw error
        }
    }

    public async sleep(ms) {
        return new Promise((resolve) => {
            setTimeout(resolve, ms);
        });
    }

    public async individualMailForTeamReg(userRegId: number, userId: number, fileName: string) {
        try {
            let result = await this.registrationService.findIndividualTeamRegInfo(userRegId);
            let mailObj = await this.communicationTemplateService.findById(28); //~~Template 11

            logger.info(` ################# --- individual mail to team Reg`)
            await this.userService.sendIndividualMailForTeamReg(result, mailObj, userId, userRegId, fileName)

            let passwordMap = new Map();
            let resultSet = await this.registrationService.findTeamRegistrationInfo(result.registrationId)
            if (isArrayPopulated(resultSet)) {
                for (let res of resultSet) {
                    if (isArrayPopulated(res.players)) {
                        let mailObj = await this.communicationTemplateService.findById(20);
                        res.players.sort(function (a, b) {
                            var x = a.firstName;
                            var y = b.firstName;
                            if (x < y) {
                                return -1;
                            }
                            if (x > y) {
                                return 1;
                            }
                            return 0;
                        });
                        let password = null;
                        if (res.password == null) {
                            let user = await this.userService.findById(res.userId)
                            password = Math.random().toString(36).slice(-8);
                            user.password = md5(password);
                            await this.userService.createOrUpdate(user);
                            passwordMap.set(res.userId, password)
                            await this.updateFirebaseData(user, user.password);
                        }
                        // await this.userService.sendTeamRegisterConfirmationMail(res, mailObj, userId, password, result.registrationId, fileName, 0, [])
                        // await this.sleep(1000);
                    }
                }
            }
        } catch (error) {
            throw error;
        }
    }

    private async processInstalmentForWebHookIntentSucceed(transferGroup: any) {
        logger.info(`processInstalmentForWebHookIntentSucceed :: ${JSON.stringify(transferGroup)}`);
        let registrationUniqueKey = transferGroup[1];
        let invoiceId = transferGroup[2];
        let registration = await this.registrationService.findByRegistrationKey(registrationUniqueKey);
        let registrationId = registration.id;

        try {
            const getInvoiceData = await this.invoiceService.getPaymentStatusByInvoiceId(invoiceId);
            if (isArrayPopulated(getInvoiceData)) {
                const INVOICE_ID = getInvoiceData[0].id;
                const PAYMENT_TYPE = getInvoiceData[0].paymentType;
                const PAYMENT_SUBTYPE = getInvoiceData[0].subPaymentType;
                const sourceTransaction = getInvoiceData[0].stripeSourceTransaction;
                const paidBy = getInvoiceData[0].createdBy;
                const CURRENCY_TYPE: string = "aud";
                if (PAYMENT_TYPE === AppConstants.card || (PAYMENT_TYPE === AppConstants.cash && PAYMENT_SUBTYPE == AppConstants.cashCard)) {
                    await this.invoiceService.updatePaymentStatusByInvoiceId(invoiceId, InvoicePaymentStatus.Success);
                } else if (PAYMENT_TYPE === AppConstants.directDebit) {
                    logger.info(`Before Updating Instalment Direct Debit Transaction ${registrationUniqueKey}`);
                    await this.sleep(20000);
                    let registrationTrackData = await this.registrationTrackService.findByInvoiceId(registration.id, RegistrationStep.InstalmentTrackStep,
                        invoiceId);
                    let registrationProduct = registrationTrackData.jsonData;
                    await this.checkOrganisationStripeAccount(registrationProduct);
                    let transactionData = await this.transactionService.getTransactionByRegId(registrationId, INVOICE_ID);
                    const paymentIntent = await this.createDummyPaymentIntentObject(sourceTransaction);
                    await this.performInvoiceTransactionDDPayment(registrationProduct,
                        paymentIntent, CURRENCY_TYPE, null, PAYMENT_TYPE, transactionData, registration);
                    await this.transactionService.updateInstalmentTransactionDD(registrationId, INVOICE_ID, paidBy);
                    logger.info(`After Updating Instalment Direct Debit Transaction ${registrationUniqueKey}`);
                    await this.invoiceService.updatePaymentStatusByInvoiceId(invoiceId, InvoicePaymentStatus.Success);
                    let invoiceData = await this.getInvoiceData(registration, registrationProduct);
                    let comp = registrationProduct.compParticipants.find(x => x);
                    let fileName = await this.invoiceService.printTeamRegistrationInvoiceTemplate(invoiceData);
                    let futureInstalments = await this.transactionService.findFutureInstalments(comp)
                    let mailObj = await this.communicationTemplateService.findById(15)
                    let memberInfo = await this.userService.findById(comp.userId);
                    let userInfo = await this.userService.findById(paidBy);
                    await this.userService.sendInstalmentMail(fileName, comp, mailObj, futureInstalments, null, userInfo, memberInfo)
                }
            } else {
                this.updateErrorMessageAndPaymentTypeWithTransaction(registrationId, null, "cannot get invoice details, an error occurred", null, null, invoiceId);
            }
        } catch (error) {
            logger.error(`Exception occurred in processInstalmentForWebHookIntentSucceed ${error}`);
            this.updateErrorMessageAndPaymentTypeWithTransaction(registrationId, null, "cannot get invoice details, an error occurred", null, null, invoiceId);
        }
    }

    private async makingInstalmentTransfersForDirectDebit(registration, invoiceId: number, paymentIntent: any, PAYMENT_TYPE: any) {
        try {
            const CURRENCY_TYPE: string = "aud";
            let registrationTrackData = await this.registrationTrackService.findByInvoiceId(registration.id, RegistrationStep.InstalmentTrackStep, invoiceId);
            let registrationProduct = registrationTrackData.jsonData;

            if (isNotNullAndUndefined(registrationProduct) && isArrayPopulated(registrationProduct.compParticipants)) {
                let account = await this.checkOrganisationStripeAccount(registrationProduct);
                if ((!account.membershipStripeAccountIdError) &&
                    (!account.competitionStripeAccountIdError) &&
                    (!account.affiliateStripeAccountIdError)) {
                    let transferGroup = null;
                    let transArr = [];
                    let totalFee = feeIsNull(registrationProduct.total.targetValue);
                    logger.info("totalFee::" + totalFee);
                    if (isNotNullAndUndefined(paymentIntent) && totalFee > 0) {
                        let trans = await this.performInvoicePayment(registrationProduct,
                            paymentIntent, CURRENCY_TYPE, registration, invoiceId, transferGroup,
                            AppConstants.instalment, PAYMENT_TYPE, null);
                        transArr.push(...trans);
                    }

                    await this.createTransactions(transArr, registration, 0);
                    await this.invoiceService.updatePaymentStatusByInvoiceId(invoiceId, InvoicePaymentStatus.Success);
                } else {
                    let message: string = '';
                    if (account.membershipStripeAccountIdError && account.competitionStripeAccountIdError
                        && account.affiliateStripeAccountIdError) {
                        message = `Please contact ${account.membershipOrganisationName} & ${account.competitionOrganisationName} & ${account.affiliateOrganisationName} organisation regarding integration with Stripe`
                    } else if (account.membershipStripeAccountIdError && account.competitionStripeAccountIdError) {
                        message = `Please contact ${account.membershipOrganisationName} & ${account.competitionOrganisationName} organisation regarding integration with Stripe`
                    } else if (account.membershipStripeAccountIdError) {
                        message = `Please contact ${account.membershipOrganisationName} organisation regarding integration with Stripe`
                    } else {
                        message = `Please contact ${account.competitionOrganisationName} organisation regarding integration with Stripe`
                    }

                    await this.updateErrorMessageAndPaymentTypeWithTransaction(registration.id, null, message, null, null, invoiceId);
                }

                let invoiceData = await this.getInvoiceData(registration, registrationProduct);
                let fileName = await this.invoiceService.printTeamRegistrationInvoiceTemplate(invoiceData);

                let comp = registrationProduct.compParticipants.find(x => x);

                let futureInstalments = await this.transactionService.findFutureInstalments(comp)
                // Need to send Mail
                let mailObj = await this.communicationTemplateService.findById(15);
                let userInfo = await this.userService.findById(comp.createdBy);
                let memberInfo = await this.userService.findById(comp.userId);
                await this.userService.sendInstalmentMail(fileName, comp, mailObj, futureInstalments, null, userInfo, memberInfo)
            } else {
                await this.updateErrorMessageAndPaymentTypeWithTransaction(registration.id, null, "cannot get invoice details, an error occurred", null, null, invoiceId);
            }
        } catch (error) {
            logger.error(`Exception occurred in makingTransfersForDirectDebit ${error}`);
            await this.updateErrorMessageAndPaymentTypeWithTransaction(registration.id, null, error, null, null, invoiceId);
        }
    }

    private async processTeamPaymentForWebHookIntentSucceed(userRegId: any) {
        logger.info(`processTeamPaymentForWebHookIntentSucceed :: ${userRegId}`);

        let userRegistration = await this.userRegistrationService.findByRegistrationKey(userRegId);
        let registration = await this.registrationService.findById(userRegistration.registrationId);
        let registrationId = registration.id;
        try {
            const getInvoiceData = await this.invoiceService.getPaymentStatusTeamIndividual(registration.id, userRegistration.userRegId);

            if (isArrayPopulated(getInvoiceData)) {
                const INVOICE_ID = getInvoiceData[0].id;
                const PAYMENT_TYPE = getInvoiceData[0].paymentType;
                const PAYMENT_SUBTYPE = getInvoiceData[0].subPaymentType;
                const sourceTransaction = getInvoiceData[0].stripeSourceTransaction;
                const CURRENCY_TYPE: string = "aud";
                let transferGroup = AppConstants.teamIndividual + "#" + userRegistration.userRegUniqueKey;
                if (PAYMENT_TYPE === AppConstants.card || (PAYMENT_TYPE === AppConstants.cash && PAYMENT_SUBTYPE == AppConstants.cashCard)) {
                    await this.invoiceService.updateTeamPaymentStatusByRegistrationID(registrationId, userRegistration.userRegId);
                } else if (PAYMENT_TYPE === AppConstants.directDebit) {
                    logger.info(`Before Updating Team Invite Direct Debit Transaction ${userRegId}`);
                    await this.sleep(20000);
                    let registrationTrackData = await this.registrationTrackService.findByUserRegistrationId(registration.id, RegistrationStep.TeamInviteSuccessTrackStep, userRegistration.userRegId);
                    let registrationProduct = registrationTrackData.jsonData;
                    await this.checkOrganisationStripeAccount(registrationProduct);
                    const paymentIntent = await this.createDummyPaymentIntentObject(sourceTransaction);
                    let transactionData = await this.transactionService.getTransactionByRegId(registrationId, INVOICE_ID, userRegistration.userRegId);
                    await this.performInvoiceTransactionDDPayment(registrationProduct, paymentIntent, CURRENCY_TYPE, transferGroup, PAYMENT_TYPE, transactionData, registration);
                    await this.performShopPaymentDD(paymentIntent, registration, registrationProduct)
                    await this.transactionService.updateTeamInviteTransactionDD(PAYMENT_TYPE, registrationId, userRegistration.userRegId);
                    logger.info(`After Updating Team Invite Direct Debit Transaction ${userRegId}`);
                    await this.invoiceService.updateTeamPaymentStatusByRegistrationID(registrationId, userRegistration.userRegId);
                    await this.invoiceService.updatePaymentStatusByRegistrationID(registrationId);

                    // Send Invoice Template
                    let invoiceData = await this.getInvoiceData(registration, registrationProduct);
                    let fileName = await this.invoiceService.printTeamRegistrationInvoiceTemplate(invoiceData);
                    if (fileName != null) {
                        await this.individualMailForTeamReg(userRegistration.userRegId, userRegistration.userId, fileName)
                    }
                } else if (PAYMENT_TYPE === AppConstants.cash && PAYMENT_SUBTYPE === AppConstants.cashDirectDebit) {
                    logger.info(`Before Updating Team Invite Cash Direct Debit Transaction ${userRegId}`);
                    await this.sleep(20000);
                    let registrationTrackData = await this.registrationTrackService.findByUserRegistrationId(registration.id, RegistrationStep.TeamInviteSuccessTrackStep, userRegistration.userRegId);
                    let registrationProduct = registrationTrackData.jsonData;
                    await this.checkOrganisationStripeAccount(registrationProduct);
                    const paymentIntent = await this.createDummyPaymentIntentObject(sourceTransaction);
                    let transactionData = await this.transactionService.getTransactionByRegId(registrationId, INVOICE_ID, userRegistration.userRegId);
                    await this.performInvoiceTransactionDDPayment(registrationProduct, paymentIntent, CURRENCY_TYPE, transferGroup, PAYMENT_TYPE, transactionData, registration);
                    await this.transactionService.updateTeamInviteTransactionDD(PAYMENT_TYPE, registrationId, userRegistration.userRegId);
                    logger.info(`After Updating Team Invite Cash Direct Debit Transaction ${userRegId}`);
                    await this.invoiceService.updateTeamPaymentStatusByRegistrationID(registrationId, userRegistration.userRegId);
                }
            } else {
                this.updateErrorMessageAndPaymentTypeWithTransaction(registrationId, null, "cannot get invoice details, an error occurred", null, userRegistration.userRegId, null);
            }
        } catch (error) {
            logger.error(`Exception occurred in processTeamPaymentForWebHookIntentSucceed ${error}`);
            this.updateErrorMessageAndPaymentTypeWithTransaction(registrationId, null, "cannot get invoice details, an error occurred", null, userRegistration.userRegId, null);
        }
    }

    private async processTeamInvitePaymentForDD(userRegId: any) {
        logger.info(`processTeamInvitePaymentForDD :: ${userRegId}`);

        let userRegistration = await this.userRegistrationService.findByRegistrationKey(userRegId);
        let registration = await this.registrationService.findById(userRegistration.registrationId);
        let registrationId = registration.id;

        try {
            const getInvoiceData = await this.invoiceService.getPaymentStatusTeamIndividual(registration.id, userRegistration.userRegId);

            if (isArrayPopulated(getInvoiceData)) {
                const INVOICE_ID = getInvoiceData[0].id;
                const PAYMENT_TYPE = getInvoiceData[0].paymentType;
                const PAYMENT_SUBTYPE = getInvoiceData[0].subPaymentType;
                const sourceTransaction = getInvoiceData[0].stripeSourceTransaction;
                const dummyPaymentIntentObject = await this.createDummyPaymentIntentObject(sourceTransaction);
                logger.info(`processPaymentForWebHookIntentSucceed dummyPaymentIntentObject :: ${JSON.stringify(dummyPaymentIntentObject)}`);
                await this.makingTeamTransfersForDirectDebit(registration, INVOICE_ID, dummyPaymentIntentObject, userRegistration, PAYMENT_TYPE);
                //await this.invoiceService.updateTeamPaymentStatusByRegistrationID(registrationId, userRegistration.userRegId);
            } else {
                this.updateErrorMessageAndPaymentTypeWithTransaction(registrationId, null, "cannot get invoice details, an error occurred", null, userRegistration.userRegId, null);
            }
        } catch (error) {
            logger.error(`Exception occurred in processTeamInvitePaymentForDD ${error}`);
            this.updateErrorMessageAndPaymentTypeWithTransaction(registrationId, null, "cannot get invoice details, an error occurred", null, userRegistration.userRegId, null);
            throw error;
        }
    }

    private async makingTeamTransfersForDirectDebit(registration, invoiceId: number, paymentIntent: any, userRegistration, PAYMENT_TYPE) {
        try {
            const CURRENCY_TYPE: string = "aud";
            let registrationTrackData = await this.registrationTrackService.findByUserRegistrationId(registration.id, RegistrationStep.TeamInviteSuccessTrackStep, userRegistration.userRegId);
            let registrationProduct = registrationTrackData.jsonData;

            const paidBy = registrationProduct.yourInfo.id;

            if (isNotNullAndUndefined(registrationProduct) && isArrayPopulated(registrationProduct.compParticipants)) {
                let account = await this.checkOrganisationStripeAccount(registrationProduct);
                if ((!account.membershipStripeAccountIdError) &&
                    (!account.competitionStripeAccountIdError) &&
                    (!account.affiliateStripeAccountIdError)) {
                    if (feeIsNull(registrationProduct.total.targetValue) != 0) {
                        let transferGroup = AppConstants.teamIndividual + "#" + userRegistration.userRegUniqueKey;
                        let transArr = await this.performInvoicePaymentDD(
                            registrationProduct, paymentIntent, CURRENCY_TYPE, registration, invoiceId,
                            transferGroup, AppConstants.teamIndividual, PAYMENT_TYPE, paidBy
                        );

                        await this.createTransactions(transArr, registration, paidBy);
                        await this.createInstalmentTransactions(registration, userRegistration.userRegId, RegistrationStep.TeamInviteInstalmentTrackStep, invoiceId, paidBy);
                        await this.performShopPayment(paymentIntent, registration, registrationProduct, invoiceId, AppConstants.directDebit)
                        // this.performGovernmentVoucherRedeem(registrationProduct)
                        // await this.invoiceService.updateTeamPaymentStatusByRegistrationID(registration.id, userRegistration.userRegId);
                    } else {
                        await this.performTeamRegZeroTransaction(invoiceId, registrationProduct, paidBy);
                        await this.createInstalmentTransactions(registration, userRegistration.userRegId, RegistrationStep.TeamInviteInstalmentTrackStep, invoiceId, paidBy);
                    }
                } else {
                    let message: string = '';
                    if (account.membershipStripeAccountIdError && account.competitionStripeAccountIdError && account.affiliateStripeAccountIdError) {
                        message = `Please contact ${account.membershipOrganisationName} & ${account.competitionOrganisationName} & ${account.affiliateOrganisationName} organisation regarding integration with Stripe`
                    } else if (account.membershipStripeAccountIdError && account.competitionStripeAccountIdError) {
                        message = `Please contact ${account.membershipOrganisationName} & ${account.competitionOrganisationName} organisation regarding integration with Stripe`
                    } else if (account.membershipStripeAccountIdError) {
                        message = `Please contact ${account.membershipOrganisationName} organisation regarding integration with Stripe`
                    } else {
                        message = `Please contact ${account.competitionOrganisationName} organisation regarding integration with Stripe`
                    }

                    await this.updateErrorMessageAndPaymentTypeWithTransaction(registration.id, null, message, null, userRegistration.userRegId, null);
                }

                // Send payment processing email
                await this.mailForDirectDebitPayment(userRegistration.id, userRegistration.userId, userRegistration.createdBy, 0);
            } else {
                await this.updateErrorMessageAndPaymentTypeWithTransaction(registration.id, null, "cannot get invoice details, an error occurred", null, userRegistration.userRegId, null);
            }
        } catch (error) {
            logger.error(`Exception occurred in makingTeamTransfersForDirectDebit ${error}`);
            await this.updateErrorMessageAndPaymentTypeWithTransaction(registration.id, null, error, null, userRegistration.userRegId, null);
        }
    }

    private async updateErrorMessageAndPaymentTypeWithTransaction(
        registrationId: number, paymentType: string, error: string, stripeSourceTransaction: string, userRegId: number,
        invoiceId: number, transferGroupPrefix = undefined, subPaymentType = undefined, teamMemberRegId = undefined, cartId = undefined
    ) {
        try {
            let getInvoiceData = null;
            let INVOICE_ID = 0;
            if (userRegId != null) {
                getInvoiceData = await this.invoiceService.getPaymentStatusTeamIndividual(registrationId, userRegId);
                INVOICE_ID = getInvoiceData[0].id;
            } else if (transferGroupPrefix == AppConstants.singleGame) {
                getInvoiceData = await this.invoiceService.getPaymentStatusByInvoiceId(invoiceId);
                INVOICE_ID = getInvoiceData[0].id;
            } else if (invoiceId != null) {
                INVOICE_ID = invoiceId;
            } else if (teamMemberRegId) {
                getInvoiceData = await this.invoiceService.getPaymentStatusByteamMemberRegId(teamMemberRegId);
                INVOICE_ID = getInvoiceData[0].id;
            } else if (cartId) {
                getInvoiceData = await this.invoiceService.getPaymentStatusByCartId(cartId);
                INVOICE_ID = getInvoiceData[0].id;
            } else {
                getInvoiceData = await this.invoiceService.findByRegistrationId(registrationId);
                INVOICE_ID = getInvoiceData[0].id;
            }

            let paymentTypeName = null;
            if (isNotNullAndUndefined(paymentType)) {
                paymentTypeName = paymentType;
            }
            if (isArrayPopulated(getInvoiceData)) {
                const i = new Invoice();
                i.id = INVOICE_ID;
                i.registrationId = registrationId;
                i.userRegistrationId = userRegId;
                i.cartId = cartId;
                if (paymentType)
                    i.paymentType = paymentType;

                if (subPaymentType) {
                    i.stripeSubSourceTransaction = isNotNullAndUndefined(stripeSourceTransaction) ? stripeSourceTransaction : undefined;
                    i.subPaymentType = subPaymentType;
                } else {
                    i.stripeSourceTransaction = isNotNullAndUndefined(stripeSourceTransaction) ? stripeSourceTransaction : undefined;
                }

                i.errorMessage = isNotNullAndUndefined(error) ? error : undefined;
                await this.invoiceService.createOrUpdate(i);
            }
        } catch (error) {
            logger.error(`Exception occurred in updateErrorMessageAndPaymentTypeWithTransaction ${error}`);
            throw error;
        }
    }

    private async createDummyPaymentIntentObject(chargeId: string) {
        const paymentIntent = await stripe.paymentIntents.retrieve(
            chargeId
        );

        return paymentIntent;
    }

    private async getTransfersListing(listingBody, stripeAccountId) {
        let ListingObject = Object.assign({});
        if (listingBody.paging.starting_after) ListingObject.starting_after = listingBody.paging.starting_after;
        if (listingBody.paging.ending_before) ListingObject.ending_before = listingBody.paging.ending_before;
        if (listingBody.paging.limit) ListingObject.limit = listingBody.paging.limit;
        if (listingBody.created) ListingObject.created = listingBody.created;
        ListingObject["include[]"] = "total_count";

        if (listingBody.type === "transfer") {
            ListingObject.destination = stripeAccountId;
            const transferList = await stripe.transfers.list(ListingObject);
            const transferArray = transferList.data;
            const finalTransferObject = Object.assign({});
            finalTransferObject['hasmore'] = transferList.has_more;
            finalTransferObject['totalCount'] = transferList['total_count'];
            finalTransferObject['transfers'] = transferArray.map(e => {
                e['amount'] = e['amount'] / 100;
                delete e.object;
                delete e.destination;
                delete e.destination_payment;
                delete e.livemode;
                delete e.metadata;
                delete e.reversals;
                delete e.source_transaction;
                delete e.source_type;
                return e;
            });
            return finalTransferObject;
        } else if (listingBody.type === "payout") {
            const payoutList = await stripe.payouts.list(ListingObject, { stripeAccount: stripeAccountId });
            const payoutArray = payoutList.data;
            let mappedPayoutArray = payoutArray.map(e => {
                e['amount'] = e['amount'] / 100;
                delete e.object;
                delete e.destination;
                delete e.livemode;
                delete e.metadata;
                delete e.source_type;
                return e;
            });

            const finalPayoutResult = Object.assign({});
            finalPayoutResult['payouts'] = await Promise.all(mappedPayoutArray);
            finalPayoutResult['hasmore'] = payoutList.has_more;
            finalPayoutResult['totalCount'] = payoutList['total_count'];
            return finalPayoutResult;
        }
    }

    private async processPaymentForWebHookIntentSucceed(registrationUniqueKey: any, isRetry = false) {
        logger.info(`processPaymentForWebHookIntentSucceed :: ${registrationUniqueKey} isRetry :: ${isRetry}`);
        try {
            let registration = await this.registrationService.findByRegistrationKey(registrationUniqueKey);
            let registrationId = registration.id;

            const getInvoiceData = await this.invoiceService.findByRegistrationId(registrationId);
            if (isArrayPopulated(getInvoiceData)) {
                const INVOICE_ID = getInvoiceData[0].id;
                const PAYMENT_TYPE = getInvoiceData[0].paymentType;
                const PAYMENT_SUBTYPE = getInvoiceData[0].subPaymentType;
                const sourceTransaction = getInvoiceData[0].stripeSourceTransaction;
                const CURRENCY_TYPE: string = "aud";
                let transferGroup = AppConstants.registration + "#" + registration.registrationUniqueKey;

                if ((PAYMENT_TYPE === AppConstants.card || PAYMENT_TYPE === AppConstants.cash) && !isRetry) {
                    await this.invoiceService.updatePaymentStatusByRegistrationID(registrationId);
                } else if (PAYMENT_TYPE === AppConstants.directDebit || isRetry) {
                    logger.info(`Before Updating Direct Debit Transaction ${registrationUniqueKey}`);
                    if(!isRetry)
                        await this.sleep(20000);

                    let registrationTrackData = await this.registrationTrackService.findByRegistrationId(registration.id, RegistrationStep.RegistrationTrackStep);
                    let registrationProduct = registrationTrackData.jsonData;

                    let account = await this.checkOrganisationStripeAccount(registrationProduct);
                    if ((!account.membershipStripeAccountIdError) &&
                    (!account.competitionStripeAccountIdError) &&
                    (!account.affiliateStripeAccountIdError)) {
                        const paymentIntent = await this.createDummyPaymentIntentObject(sourceTransaction);
                        let transactionData = await this.transactionService.getTransactionByRegId(registrationId, INVOICE_ID);
                        await this.performInvoiceTransactionDDPayment(
                            registrationProduct, paymentIntent, CURRENCY_TYPE, transferGroup, PAYMENT_TYPE, transactionData, registration
                        );
                        await this.transactionService.updateTransactionDD(PAYMENT_TYPE, registrationId);
                        await this.performShopPaymentDD(paymentIntent, registration, registrationProduct)
                        logger.info(`After Updating Direct Debit Transaction ${registrationUniqueKey}`);
                        await this.invoiceService.updatePaymentStatusByRegistrationID(registrationId);
                        this.registrationMail(registration, registrationProduct, 0, INVOICE_ID)
                    }
                    else{
                        let message: string = '';
                        if (account.membershipStripeAccountIdError && account.competitionStripeAccountIdError
                            && account.affiliateStripeAccountIdError) {
                            message = `Please contact ${account.membershipOrganisationName} & ${account.competitionOrganisationName} & ${account.affiliateOrganisationName} organisation regarding integration with Stripe`
                        } else if (account.membershipStripeAccountIdError && account.competitionStripeAccountIdError) {
                            message = `Please contact ${account.membershipOrganisationName} & ${account.competitionOrganisationName} organisation regarding integration with Stripe`
                        } else if (account.membershipStripeAccountIdError) {
                            message = `Please contact ${account.membershipOrganisationName} organisation regarding integration with Stripe`
                        } else {
                            message = `Please contact ${account.competitionOrganisationName} organisation regarding integration with Stripe`
                        }
                        return { success: false, message };
                    }

                } else if (PAYMENT_TYPE === AppConstants.cash && PAYMENT_SUBTYPE === AppConstants.cashDirectDebit) {
                    logger.info(`Before Updating Cash Direct Debit Transaction ${registrationUniqueKey}`);
                    await this.sleep(20000);
                    let registrationTrackData = await this.registrationTrackService.findByRegistrationId(registration.id, RegistrationStep.RegistrationTrackStep);
                    let registrationProduct = registrationTrackData.jsonData;

                    let account = await this.checkOrganisationStripeAccount(registrationProduct);
                    if ((!account.membershipStripeAccountIdError) &&
                    (!account.competitionStripeAccountIdError) &&
                    (!account.affiliateStripeAccountIdError)) {
                        const paymentIntent = await this.createDummyPaymentIntentObject(sourceTransaction);
                        let transactionData = await this.transactionService.getTransactionByRegId(registrationId, registrationId);
                        await this.performInvoiceTransactionDDPayment(
                            registrationProduct, paymentIntent, CURRENCY_TYPE, transferGroup, PAYMENT_TYPE, transactionData, registration
                        );
                        await this.performShopPaymentDD(paymentIntent, registration, registrationProduct)
                        await this.transactionService.updateTransactionDD(PAYMENT_TYPE, registrationId);
                        logger.info(`After Updating Cash Direct Debit Transaction ${registrationUniqueKey}`);
                        await this.invoiceService.updatePaymentStatusByRegistrationID(registrationId);
                    }
                    else{
                        let message: string = '';
                        if (account.membershipStripeAccountIdError && account.competitionStripeAccountIdError
                            && account.affiliateStripeAccountIdError) {
                            message = `Please contact ${account.membershipOrganisationName} & ${account.competitionOrganisationName} & ${account.affiliateOrganisationName} organisation regarding integration with Stripe`
                        } else if (account.membershipStripeAccountIdError && account.competitionStripeAccountIdError) {
                            message = `Please contact ${account.membershipOrganisationName} & ${account.competitionOrganisationName} organisation regarding integration with Stripe`
                        } else if (account.membershipStripeAccountIdError) {
                            message = `Please contact ${account.membershipOrganisationName} organisation regarding integration with Stripe`
                        } else {
                            message = `Please contact ${account.competitionOrganisationName} organisation regarding integration with Stripe`
                        }
                        return { success: false, message };
                    }
                }

                return { success: true, message: "Successfull" };

            } else {
                this.updateErrorMessageAndPaymentTypeWithTransaction(registrationId, null, "cannot get invoice details, an error occurred", null, null, null);
                return { success: false, message: "Cannot get invoice details" };
            }
        } catch (error) {
            logger.error(`Exception occurred in processPaymentForWebHookIntentSucceed ${error}`);
            throw error;
        }
    }

    private async processTeamMemberPaymentForWebHookIntentSucceed(transferGroup: any) {
        logger.info(`processTeamMemberPaymentForWebHookIntentSucceed :: ${transferGroup[1]}`);
        try {
            let registration = await this.registrationService.findByRegistrationKey(transferGroup[1]);
            let registrationId = registration.id;
            let teamMemberRegId = transferGroup[2];
            const getInvoiceData = await this.invoiceService.getPaymentStatusByteamMemberRegId(teamMemberRegId);
            if (isArrayPopulated(getInvoiceData)) {
                const INVOICE_ID = getInvoiceData[0].id;
                const PAYMENT_TYPE = getInvoiceData[0].paymentType;
                const PAYMENT_SUBTYPE = getInvoiceData[0].subPaymentType;
                const sourceTransaction = getInvoiceData[0].stripeSourceTransaction;
                const CURRENCY_TYPE: string = "aud";
                let transferGroupVal = AppConstants.teamMemberRegistration + "#" + registration.registrationUniqueKey + "#" + teamMemberRegId;

                if (PAYMENT_TYPE === AppConstants.card || (PAYMENT_TYPE === AppConstants.cash && PAYMENT_SUBTYPE == AppConstants.cashCard)) {
                    await this.invoiceService.updatePaymentStatusByTeamMemberRegId(teamMemberRegId);
                } else if (PAYMENT_TYPE === AppConstants.directDebit) {
                    logger.info(`Before Updating Direct Debit Transaction ${transferGroup[1]}`);
                    await this.sleep(20000);
                    let registrationTrackData = await this.registrationTrackService.findByteamMemberRegId(registration.id, RegistrationStep.TeamMemberRegistrationTrackStep, teamMemberRegId);
                    let registrationProduct = registrationTrackData.jsonData;
                    await this.checkOrganisationStripeAccount(registrationProduct);
                    const paymentIntent = await this.createDummyPaymentIntentObject(sourceTransaction);
                    let transactionData = await this.transactionService.getTransactionByRegId(registrationId, INVOICE_ID, null, teamMemberRegId);
                    await this.performInvoiceTransactionDDPayment(registrationProduct, paymentIntent, CURRENCY_TYPE, transferGroupVal, PAYMENT_TYPE, transactionData, registration);

                    await this.transactionService.updateTransactionDD(PAYMENT_TYPE, registrationId);
                    await this.performShopPaymentDD(paymentIntent, registration, registrationProduct)
                    logger.info(`After Updating Direct Debit Transaction ${transferGroup[1]}`);
                    await this.invoiceService.updatePaymentStatusByTeamMemberRegId(teamMemberRegId);
                    if (teamMemberRegId == null)
                        await this.registrationMail(registration, registrationProduct, 0, INVOICE_ID)
                    else
                        await this.teamMemberRegMail(registration, teamMemberRegId)
                    // this.registrationMail(registration, registrationProduct, 0, INVOICE_ID)

                    // } else if (PAYMENT_TYPE === AppConstants.cash && PAYMENT_SUBTYPE === AppConstants.cashDirectDebit) {
                    //     logger.info(`Before Updating Cash Direct Debit Transaction ${transferGroup[1]}`);
                    //     await this.sleep(20000);
                    //     let registrationTrackData = await this.registrationTrackService.findByRegistrationId(registration.id, RegistrationStep.RegistrationTrackStep);
                    //     let registrationProduct = registrationTrackData.jsonData;
                    //
                    //     await this.checkOrganisationStripeAccount(registrationProduct);
                    //     const paymentIntent = await this.createDummyPaymentIntentObject(sourceTransaction);
                    //     let transactionData = await this.transactionService.getTransactionByRegId(registrationId, registrationId);
                    //     await this.performInvoiceTransactionDDPayment(registrationProduct, paymentIntent, CURRENCY_TYPE, transferGroup, PAYMENT_TYPE, transactionData);
                    //     await this.performShopPaymentDD(paymentIntent, registration, registrationProduct)
                    //     await this.transactionService.updateTransactionDD(PAYMENT_TYPE, registrationId);
                    //     logger.info(`After Updating Cash Direct Debit Transaction ${transferGroup[1]}`);
                    //     await this.invoiceService.updatePaymentStatusByRegistrationID(registrationId);
                }
            } else {
                this.updateErrorMessageAndPaymentTypeWithTransaction(registrationId, null, "cannot get invoice details, an error occurred", null, null, null);
            }
        } catch (error) {
            logger.error(`Exception occurred in processTeamMemberPaymentForWebHookIntentSucceed ${error}`);
            throw error;
        }
    }

    private async processShopPaymentForWebHookIntentSucceed(shopUniqueKey: any) {
        logger.info(`processShopPaymentForWebHookIntentSucceed :: ${shopUniqueKey}`);
        try {
            const cart = await this.cartService.findByShopUniqueKey(shopUniqueKey);
            const getInvoiceData = await this.invoiceService.getPaymentStatusByCartId(cart.id);

            if (isArrayPopulated(getInvoiceData)) {
                const PAYMENT_TYPE = getInvoiceData[0].paymentType;
                if (PAYMENT_TYPE === AppConstants.card) {
                    await this.invoiceService.updatePaymentStatusByInvoiceId(getInvoiceData[0].id, InvoicePaymentStatus.Success, cart.createdBy);
                }
            } else {
                await this.updateErrorMessageAndPaymentTypeWithTransaction(null, null, "cannot get invoice details, an error occurred", null, null, null, AppConstants.shop);
            }

        } catch (error) {
            logger.error(`Exception occurred in processShopPaymentForWebHookIntentSucceed ${error}`);
        }
    }

    private async processSingleGamePaymentForWebHookIntentSucceed(registrationUniqueKey: any, invoiceId: number) {
        logger.info(`processSingleGamePaymentForWebHookIntentSucceed :: ${registrationUniqueKey} :: ${invoiceId}`);
        try {
            let registration = await this.registrationService.findByRegistrationKey(registrationUniqueKey);
            let registrationId = registration.id;


            const getInvoiceData = await this.invoiceService.getPaymentStatusByInvoiceId(invoiceId);
            if (isArrayPopulated(getInvoiceData)) {
                const PAYMENT_TYPE = getInvoiceData[0].paymentType;
                if (PAYMENT_TYPE === AppConstants.card) {
                    await this.invoiceService.updatePaymentStatusByInvoiceId(invoiceId, InvoicePaymentStatus.Success);
                }
            } else {
                this.updateErrorMessageAndPaymentTypeWithTransaction(registrationId, null, "cannot get invoice details, an error occurred", null, null, invoiceId, AppConstants.singleGame);
            }
        } catch (error) {
            logger.error(`Exception occurred in processSingleGamePaymentForWebHookIntentSucceed ${error}`);
            throw error;
        }
    }

    private async processOnBehalfOfForWebHookIntentSucceed(transferGroup: any) {
        try{
            let transData = await this.transactionService.getTransactionByReferenceId(transferGroup[2]);
            if(transData && transData.statusRefId == TransactionStatus.Deregistered && transData.paymentIntentId != null && transData.feeAmount > 0) {
                let approvalRefund = await this.approvalRefundService.getApprovalRefundsByTransactionId(transData.id);
                let STRIPE_REFUND_FEE = feeIsNull(approvalRefund.refundAmount);
                let refundIntent = null;
                let guidKey = uuidv4();
                if(STRIPE_REFUND_FEE > 0) {
                    refundIntent = await this.transactionService.refundIntent(STRIPE_REFUND_FEE, 
                                    transData.paymentIntentId, transData, guidKey);

                    let trxn = await this.createRefundTransactionObject(transData, transData.divisionId, approvalRefund, refundIntent, guidKey);
                    console.log(`trxn ${JSON.stringify(trxn)}`)

                    await this.transactionService.createOrUpdate(trxn);
                }
                console.log(`refund ${JSON.stringify(refundIntent)}`);
            }
            else {
                this.updateRefundedTransaction(transferGroup[2]);
            }
        }
        catch(error) {
            logger.error(`Exception occurred in processOnBehalfOfForWebHookIntentSucceed ${error}`);
            throw error;
        }
    }

    private async processGovtVoucherForWebHookIntentSucceed(transferGroup: any) {
        try{
            let transData = await this.transactionService.getTransactionByReferenceId(transferGroup[2]);
            if(transData && transData.statusRefId == TransactionStatus.Deregistered && transData.paymentIntentId != null
                && transData.governmentVoucherStatusRefId == 3) {
                let approvalRefund = await this.approvalRefundService.getApprovalRefundsByTransactionId(transData.id);
                let userAmount = (feeIsNull(transData.feeAmount) + feeIsNull(transData.gstAmount))
                                    - (feeIsNull(transData.discountAmount) + feeIsNull(transData.familyDiscountAmount)
                                        + feeIsNull(transData.governmentVoucherAmount));

                let balanceAmount = feeIsNull(approvalRefund.refundAmount) - feeIsNull(userAmount);
                let STRIPE_REFUND_FEE = feeIsNull(balanceAmount);
                let refundIntent = null;
                let guidKey = uuidv4();
                if(STRIPE_REFUND_FEE > 0) {
                    refundIntent = await this.transactionService.refundIntent(STRIPE_REFUND_FEE, 
                                    transData.paymentIntentId, transData, guidKey);
                        
                    let trxn = await this.createRefundTransactionObject(transData, transData.divisionId, approvalRefund, refundIntent, guidKey);
                    console.log(`trxn ${JSON.stringify(trxn)}`);
                    this.transactionService.createOrUpdate(trxn);
                }
                console.log(`refund ${JSON.stringify(refundIntent)}`);
                this.transactionService.updateTransactionGovtStatusRefId(transferGroup[2]);
            }
            else {
                this.transactionService.updateTransactionGovtStatusRefId(transferGroup[2]);
            }
        }
        catch(error) {
            logger.error(`Exception occurred in processGovtVoucherForWebHookIntentSucceed ${error}`);
            throw error;
        }
    }

    private async processPaymentForRegistrationDD(registrationUniqueKey: any, teamMemberRegId: any) {
        logger.info(`processPaymentForRegistrationDD :: ${registrationUniqueKey}`);

        try {
            let registration = await this.registrationService.findByRegistrationKey(registrationUniqueKey);
            let registrationId = registration.id;
            let getInvData = null;
            if (teamMemberRegId) {
                getInvData = await this.invoiceService.getPaymentStatusByteamMemberRegId(teamMemberRegId);
            } else {
                getInvData = await this.invoiceService.findByRegistrationId(registrationId);
            }
            const getInvoiceData = getInvData;
            if (isArrayPopulated(getInvoiceData)) {
                const INVOICE_ID = getInvoiceData[0].id;
                const PAYMENT_TYPE = getInvoiceData[0].paymentType;
                const PAYMENT_SUBTYPE = getInvoiceData[0].subPaymentType;
                const sourceTransaction = getInvoiceData[0].stripeSourceTransaction;
                const dummyPaymentIntentObject = await this.createDummyPaymentIntentObject(sourceTransaction);
                logger.info(`processPaymentForWebHookIntentSucceed dummyPaymentIntentObject :: ${JSON.stringify(dummyPaymentIntentObject)}`);
                await this.makingTransfersForDirectDebit(registration, INVOICE_ID, dummyPaymentIntentObject, PAYMENT_TYPE, teamMemberRegId);
                // await this.invoiceService.updatePaymentStatusByRegistrationID(registrationId);
            } else {
                this.updateErrorMessageAndPaymentTypeWithTransaction(registrationId, null, "cannot get invoice details, an error occurred", null, null, null, teamMemberRegId);
            }
        } catch (error) {
            logger.error(`Exception occurred in processPaymentForRegistrationDD ${error}`);
            throw error;
        }
    }

    // fixme: teamMemberRegId can be not passed by the function that invoke this??
    private async makingTransfersForDirectDebit(registration, invoiceId: number, paymentIntent: any, PAYMENT_TYPE, teamMemberRegId?: any) {
        try {
            const CURRENCY_TYPE: string = "aud";
            let registrationTrackData = null;
            if (teamMemberRegId) {
                registrationTrackData = await this.registrationTrackService.findByteamMemberRegId(registration.id, RegistrationStep.TeamMemberRegistrationTrackStep, teamMemberRegId);
            } else {
                registrationTrackData = await this.registrationTrackService.findByRegistrationId(registration.id, RegistrationStep.RegistrationTrackStep);
            }
            let registrationProduct = registrationTrackData.jsonData;

            const paidBy = registrationProduct.yourInfo.id;

            if (isNotNullAndUndefined(registrationProduct) && isArrayPopulated(registrationProduct.compParticipants)) {
                let account = await this.checkOrganisationStripeAccount(registrationProduct);
                if ((!account.membershipStripeAccountIdError) &&
                    (!account.competitionStripeAccountIdError) &&
                    (!account.affiliateStripeAccountIdError)) {
                    let transferGroup = null;
                    if (teamMemberRegId) {
                        transferGroup = AppConstants.teamMemberRegistration + "#" + registration.registrationUniqueKey + "#" + teamMemberRegId;
                    } else {
                        transferGroup = AppConstants.registration + "#" + registration.registrationUniqueKey;
                    }
                    let transArr = [];
                    let totalFee = feeIsNull(registrationProduct.total.targetValue);
                    logger.info("totalFee::" + totalFee);
                    if (isNotNullAndUndefined(paymentIntent) && totalFee > 0) {
                        let trans = await this.performInvoicePaymentDD(registrationProduct,
                            paymentIntent, CURRENCY_TYPE, registration, invoiceId, transferGroup,
                            AppConstants.registration, PAYMENT_TYPE, paidBy);
                        transArr.push(...trans);
                    }

                    // let transSchoolArr = await this.performSchoolOrHardshipInvoicePayment(registrationProduct, registration, invoiceId);
                    // transArr.push(...transSchoolArr);
                    if (teamMemberRegId) {
                        await this.saveTeamMembersInfo(registration, teamMemberRegId);
                    } else {
                        await this.saveRegistrationInfo(registration, registrationProduct);
                    }

                    let personMap = await this.createTransactions(transArr, registration, paidBy);
                    await this.performHardshipUpdate(registrationProduct, registration);
                    // fixme: teamMemberRegId is not passed??
                    await this.createTeamTransactions(registration, invoiceId, teamMemberRegId);
                    await this.createInstalmentTransactions(registration, null, RegistrationStep.FutureInstalmentTrackStep, invoiceId, paidBy);
                    await this.performNegativeFeeTransactions(registration, invoiceId, paidBy, personMap);
                    await this.performHardhipTransaction(registrationProduct, registration, invoiceId, paidBy);
                    await this.performDiscountFeeTransactions(registration, invoiceId, paidBy);
                    await this.performShopPayment(paymentIntent, registration, registrationProduct, invoiceId, AppConstants.directDebit);
                    // this.performGovernmentVoucherRedeem(registrationProduct)
                    // await this.invoiceService.updatePaymentStatusByRegistrationID(registration.id);
                } else {
                    let message: string = '';
                    if (account.membershipStripeAccountIdError && account.competitionStripeAccountIdError && account.affiliateStripeAccountIdError) {
                        message = `Please contact ${account.membershipOrganisationName} & ${account.competitionOrganisationName} & ${account.affiliateOrganisationName} organisation regarding integration with Stripe`
                    } else if (account.membershipStripeAccountIdError && account.competitionStripeAccountIdError) {
                        message = `Please contact ${account.membershipOrganisationName} & ${account.competitionOrganisationName} organisation regarding integration with Stripe`
                    } else if (account.membershipStripeAccountIdError) {
                        message = `Please contact ${account.membershipOrganisationName} organisation regarding integration with Stripe`
                    } else {
                        message = `Please contact ${account.competitionOrganisationName} organisation regarding integration with Stripe`
                    }

                    await this.updateErrorMessageAndPaymentTypeWithTransaction(registration.id, null, message, null, null, null);
                }

                // Send Invoice Template
                let invoiceData = await this.getInvoiceData(registration, registrationProduct);

                let fileName = await this.invoiceService.printTeamRegistrationInvoiceTemplate(invoiceData);
                // Send Mail
                if (fileName != null) {
                    let res1 = await this.registrationService.findMailReceiverType(registration.id)
                    let res = res1.find(x => x);
                    let invoiceReciever = await this.invoiceRecieverType(registration.id)
                    let friendArray = await this.friendService.findByRegistrationId(registration.id)

                    let userId = res.userId;
                    await this.mailForDirectDebitPayment(registration.id, registration.createdBy, userId, Number(res.teamReg));

                    // if (Number(res.teamReg) > 0) {
                    //     await this.mailForTeamRegistration(registration.id, userId, fileName, invoiceReciever)
                    // }
                    // if (Number(res.individualReg) == 1) {
                    //     await this.mailToParticipant(registration.id, userId, fileName, invoiceReciever)
                    // }
                    if (isArrayPopulated(friendArray)) {
                        await this.mailToReferFriend(registration.id, friendArray, userId)
                    }
                }
            } else {
                await this.updateErrorMessageAndPaymentTypeWithTransaction(registration.id, null, "cannot get invoice details, an error occurred", null, null, null);
            }
        } catch (error) {
            logger.error(`Exception occurred in makingTransfersForDirectDebit ${error}`);
            await this.updateErrorMessageAndPaymentTypeWithTransaction(registration.id, null, error, null, null, null);
            throw error;
        }
    }

    private async updateRefundedTransaction(key) {
        try {
            logger.info("Inside the updateRefundedTransaction" + JSON.stringify(key));
            await this.sleep(20000);
            await this.transactionService.updateRefundedTransaction(key);
            // let transactionId = metaData.transactionId;
            // let transaction = new Transaction();
            // transaction.referenceId = key;
            // transaction.statusRefId = 2;
            // await this.transactionService.createOrUpdate(transaction);
        } catch (error) {
            logger.error(`Exception occurred in updateRefundedTransaction ${error}`);
        }
    }

    public async invoiceRecieverType(registrationId): Promise<number> {
        try {
            let invoiceRecieverRes = await this.registrationService.findInvoiceReceiver(registrationId);
            let invoiceReciever = 0;
            let regYourself = invoiceRecieverRes.find((x) => x.registeringYourselfRefId == 1);
            let teamYourself = invoiceRecieverRes.find((x) => x.registeringYourselfRefId == 4);

            if (isNotNullAndUndefined(regYourself)) {
                if (regYourself.age >= 18) {
                    invoiceReciever = 1;
                } else if (isNotNullAndUndefined(teamYourself)) {
                    invoiceReciever = 4;
                }
            } else if (isNotNullAndUndefined(teamYourself)) {
                invoiceReciever = 4;
            }
            return invoiceReciever;
        } catch (error) {
            throw error;
        }
    }

    private async performExpiryValidation(expiryArr, registration) {
        try {
            let feeMap = new Map();
            for (let item of expiryArr) {
                let expiryData = await this.userMembershipExpiryService.getExistingMembership(item.participantId, item.membershipProductMappingId);
                let validityList = await this.membershipProductFeesService.getMembeshipFeeValidityDetails(item.membershipProductMappingId, item.organisationId);

                let validityData = validityList ? validityList.find(x => x) : null;
                let validityDays = validityData ? validityData.validityDays : 0;
                let extendDate = validityData ? validityData.extendEndDate : null;

                let expiryDateToCheck = await this.getExpiryDate(validityDays, extendDate, new Date(), 1);

                if (isArrayPopulated(expiryData)) {
                    let compData = await this.competitionRegService.findById(item.competitionId);
                    let id = expiryData[0].id;
                    let existingExpiryDate = expiryData[0].expiryDate;
                    let amount = expiryData[0].amount;

                    if (moment(compData.endDate).isSameOrAfter(existingExpiryDate)) {
                        let expiryDateToCheck = await this.getExpiryDate(validityDays, extendDate, existingExpiryDate, 2);
                        let newExpiryDate = expiryDateToCheck ? expiryDateToCheck : moment(new Date());
                        let updatedExpiryDate = newExpiryDate.format("YYYY-MM-DD");
                        let newAmount = feeIsNull(amount) + feeIsNull(item.amount);
                        await this.insertIntoUserMembershipExpiry(existingExpiryDate, item, 0, id, registration, amount);
                        await this.insertIntoUserMembershipExpiry(updatedExpiryDate, item, 1, 0, registration, newAmount);
                    } else {
                        let newAmount = feeIsNull(amount) + feeIsNull(item.amount);
                        await this.insertIntoUserMembershipExpiry(existingExpiryDate, item, 1, id, registration, newAmount);
                    }
                } else {
                    // Insert Into User Mapping Expiry Data
                    // let expiryDate = moment().subtract(1,'days').add(1,'years');
                    let updatedExpiryDate = expiryDateToCheck ? expiryDateToCheck.format("YYYY-MM-DD") : moment(new Date()).format("YYYY-MM-DD");
                    await this.insertIntoUserMembershipExpiry(updatedExpiryDate, item, 1, 0, registration, item.amount);
                }
            }
        } catch (error) {
            logger.error(`Exception occurred in performExpiryValidation ${error}`);
            throw error;
        }
    }

    private async getExpiryDate(validityDays, extendDate, fromDate, flag) {
        try {
            let expiryDateToCheck = null;
            let expiryValidyDate = null;
            if (flag == 1) {
                expiryValidyDate = moment(fromDate).subtract(1, 'days').add(validityDays, 'days');
            } else {
                expiryValidyDate = moment(fromDate).add(validityDays, 'days');
            }

            if (extendDate) {
                if (validityDays == null || moment(extendDate).isAfter(expiryValidyDate)) {
                    expiryDateToCheck = moment(extendDate);
                } else {
                    expiryDateToCheck = expiryValidyDate;
                }
            } else {
                expiryDateToCheck = expiryValidyDate;
            }
            return expiryDateToCheck;
        } catch (error) {
            throw error;
        }
    }

    private async insertIntoUserMembershipExpiry(expiryDate, item, isActive, id, registration, amount) {
        try {
            let membership = new UserMembershipExpiry();
            membership.id = id;
            membership.expiryDate = expiryDate;
            membership.isActive = isActive;
            if (id != 0) {
                membership.updatedBy = registration.createdBy;
                membership.updatedOn = new Date();
            } else {
                membership.registrationId = registration.id;
                membership.createdBy = registration.createdBy;
            }

            membership.amount = amount;
            membership.membershipProductMappingId = item.membershipProductMappingId;
            membership.userId = item.participantId;
            await this.userMembershipExpiryService.createOrUpdate(membership);
        } catch (error) {
            logger.error(`Exception occurred in insertIntoUserMembershipExpiry ${error}`);
            throw error;
        }
    }

    private async performShopPayment(paymentIntent, registration, registrationProducts, INVOICE_ID, paymentType) {
        try {
            if (isArrayPopulated(registrationProducts.shopProducts)) {
                let userInfo = await this.userService.findById(registration.createdBy);
                let shopTotalFee = 0;
                let accountError = false;
                let paymentMethod = null;
                let paymentStatus = '1';
                if (paymentType == "card" || paymentType === AppConstants.cashCard) {
                    paymentMethod = "Credit Card";
                    paymentStatus = '2';
                } else if (paymentType == "direct_debit") {
                    paymentMethod = "Direct debit";
                }

                for (let prod of registrationProducts.shopProducts) {
                    shopTotalFee += feeIsNull(prod.totalAmt);
                    let mOrgData = await this.organisationService.findOrganisationByUniqueKey(prod.organisationId);
                    let mStripeAccountId = null;
                    if (isArrayPopulated(mOrgData)) {
                        mStripeAccountId = mOrgData[0].stripeAccountID;
                        if (isNullOrUndefined(mStripeAccountId)) {
                            prod["organisationAccountId"] = mStripeAccountId;
                            prod["orgId"] = mOrgData[0].id;
                            prod["orgName"] = mOrgData[0].name;
                        } else {
                            logger.error(`Organisation doesn't have Stripe Account ${prod.organisationId}`)
                            accountError = true;
                            break;
                        }
                    }
                }
                if (!accountError) {
                    let orderGrpObj = await this.orderGroupService.getOrderGroupObj(registration.createdBy, shopTotalFee);
                    let orderGrp = await this.orderGroupService.createOrUpdate(orderGrpObj);
                    let cartObj = await this.cartService.getCartObj(registration.createdBy);
                    let cart = await this.cartService.createOrUpdate(cartObj);

                    for (let prod of registrationProducts.shopProducts) {
                        logger.debug(`Product Fee ${prod.totalAmt}`);

                        let transferForShopFee
                        if (paymentType != AppConstants.directDebit) {
                            transferForShopFee = await this.shopStripePayment(prod, paymentIntent, AppConstants.registration, registration, userInfo);
                            logger.debug(`transferForShop Fee ${JSON.stringify(transferForShopFee)}`);
                        }

                        let orderObj = await this.orderService.getOrderObj(
                            paymentMethod, paymentStatus, registration, prod, orderGrp,
                            INVOICE_ID, registrationProducts, paymentIntent, transferForShopFee
                        )
                        let order = await this.orderService.createOrUpdate(orderObj);
                        logger.debug("order created" + order.id);

                        const sku = await this.skuService.findById(prod.skuId);
                        let sellProductObj = await this.sellProductService.getSellProductObj(cart, order, prod, sku, registration.createdBy);
                        let sellProduct = await this.sellProductService.createOrUpdate(sellProductObj);
                        logger.debug("sellProduct created" + sellProduct.id);

                        if (prod.inventoryTracking) {
                            const newQuantity = sku.quantity - sellProductObj.quantity;
                            await this.skuService.updateQuantity(prod.skuId, newQuantity < 0 ? 0 : newQuantity, registration.createdBy);

                            logger.debug("sku updating" + prod.skuId);
                        }
                    }
                }
            }
        } catch (error) {
            logger.error(`Exception occurred in performShopPayment ${error}`);
            throw error;
        }
    }

    private async performShopPaymentDD(paymentIntent, registration, registrationProducts) {
        try {
            if (isArrayPopulated(registrationProducts.shopProducts)) {
                let accountError = false;
                let userInfo = await this.userService.findById(registration.createdBy);
                for (let prod of registrationProducts.shopProducts) {
                    let mOrgData = await this.organisationService.findOrganisationByUniqueKey(prod.organisationId);
                    let mStripeAccountId = null;
                    if (isArrayPopulated(mOrgData)) {
                        mStripeAccountId = mOrgData[0].stripeAccountID;
                        if (isNullOrUndefined(mStripeAccountId)) {
                            prod["organisationAccountId"] = mStripeAccountId;
                            prod["orgId"] = mOrgData[0].id;
                            prod["orgName"] = mOrgData[0].name;
                        } else {
                            logger.error(`Organisation doesn't have Stripe Account ${prod.organisationId}`)
                            accountError = true;
                            break;
                        }
                    }
                }
                if (!accountError) {
                    for (let prod of registrationProducts.shopProducts) {
                        logger.debug(`Product Fee ${prod.totalAmt}`);
                        await this.shopStripePayment(prod, paymentIntent, AppConstants.registration, registration, userInfo);
                    }
                }
            }
        } catch (error) {
            logger.error(`Exception occurred in performShopPayment ${error}`);
            throw error;
        }
    }

    private async shopStripePayment(prod, paymentIntent, transferPrefix, registration, userInfo) {
        try {
            const orgName = prod.orgName;
            const productName = prod.productName;
            const CURRENCY_TYPE: string = "aud";
            const STRIPE_TOTAL_FEE = formatFeeForStripe1(prod.totalAmt);
            const orgAccountId = prod.organisationAccountId;
            // const transferGroup = transferPrefix + "#" + registration.registrationUniqueKey;
            const transferGroup = paymentIntent.transfer_group;

            let userName = userInfo ? userInfo.firstName + ' ' + userInfo.lastName : "";
            let transferForMembershipFee = null;
            if (STRIPE_TOTAL_FEE >= 1) {
                transferForMembershipFee = await stripe.transfers.create({
                    amount: STRIPE_TOTAL_FEE,
                    currency: CURRENCY_TYPE,
                    description: `${userName} - ${productName} - ${orgName}  - SHOP FEE`,
                    source_transaction: paymentIntent.charges.data.length > 0 ? paymentIntent.charges.data[0].id : paymentIntent.id,
                    destination: orgAccountId,
                    transfer_group: transferGroup
                });
            }

            return transferForMembershipFee;
        } catch (error) {
            logger.error(`Exception occurred in shopStripePayment ${error}`);
            throw error;
        }
    }

    @Authorized()
    @Post('/saveStripeForUser')
    async onBoardUser(
        @HeaderParam("authorization") currentUser: User,
        @Body() newStripeAccountBody: any,
        @Res() response: Response
    ): Promise<any> {
        try {
            const stripeResponse = await stripe.oauth.token({
                grant_type: 'authorization_code',
                code: newStripeAccountBody.code
            });

            const updateStripeKey = await this.userService.updateUserWithAccountId(newStripeAccountBody.userId, stripeResponse.stripe_user_id);

            return response.status(updateStripeKey ? 200 : 212).send({
                userStripeAccountId: stripeResponse.stripe_user_id,
                success: updateStripeKey ? true : false,
                message: updateStripeKey ? "Account ID successfully saved" : "Failed to save Account ID"
            });
        } catch (err) {
            response.status(400).send(`Failed in saving Account ID: ${err}`);
        }
    }

    @Authorized()
    @Get('/loginStripe')
    async createLoginLinkForUser(
        @QueryParam("userId", { required: true }) userId: number,
        @Res() response: Response
    ): Promise<any> {
        try {
            const foundUserId = await this.userService.findUserByUserId(userId);
            if (isArrayPopulated(foundUserId)) {
                const ACCOUNT_ID = foundUserId[0].stripeAccountId;
                const redirect_url = process.env.STRIPE_SECRET_KEY.includes("test")
                    ? `https://dashboard.stripe.com/${ACCOUNT_ID}/test/dashboard`
                    : `https://dashboard.stripe.com/${ACCOUNT_ID}/dashboard`;
                return (await stripe.accounts.createLoginLink(ACCOUNT_ID, { redirect_url })).url;
            } else {
                return response.send({
                    message: "cannot find the user with the provided ID"
                });
            }
        } catch (err) {
            response.status(400).send(`Error in creating login link: ${err}`);
        }
    }

    @Authorized()
    @Post('/umpireTransfer')
    async createStripeTransfersToUmpireAccount(
        @HeaderParam("authorization") currentUser: User,
        @Body() transfersBody: any,
        @Res() response: Response
    ): Promise<any> {
        try {
            const organisationKey = transfersBody.organisationUniqueKey;
            const currentOrgDetails = await this.organisationService.findOrganisationByUniqueKey(organisationKey);
            if (isArrayPopulated(currentOrgDetails)) {
                const stripeAccount = currentOrgDetails[0].stripeAccountID;
                const orgCustomerId = currentOrgDetails[0].stripeCustomerAccountId;
                const orgPmId = currentOrgDetails[0].stripeBecsMandateId
                const orgBalance = await stripe.balance.retrieve({ stripeAccount });

                const STATUS = transfersBody.statusId
                if (isArrayPopulated(transfersBody.transfers)) {
                    for (let i of transfersBody.transfers) {
                        if (i.stripeId !== null && i.stripeId !== undefined) {
                            await this.userService.updateMatchUmpirePaymentStatus(i.matchUmpireId, 'approved', currentUser.id);
                        }

                        if (STATUS === 1) { // submit button
                            const amount = 1;
                            const STRIPE_AMOUNT = amount * 100;
                            const transferGroup = (i.matchUmpireId).toString();
                            // await this.createStripeTransfers(STRIPE_AMOUNT, i.stripeId, transferGroup, stripeAccount, response);
                            await this.stripePayConnectWithBecs(STRIPE_AMOUNT, i.stripeId, orgCustomerId, orgPmId, response);
                        }
                    }
                } else {
                    return response.status(212).send(`Please pass transfers list to make transfers`);
                }
                return { success: true }
            } else {
                return response.status(212).send(`Error in finding organisation details`);
            }
        } catch (err) {
            return response.status(400).send(`Error in sending transfer to another stripeAccount: ${err}`);
        }
    }

    public async createStripeTransfers(amount: number, destination: string, transfer_group: string, source: string, response: Response) {
        try {
            const currency = "aud";
            const charge = await stripe.charges.create({ amount, currency, source });
            if (charge.status === 'succeeded') {
                const transfer = await stripe.transfers.create({
                    amount,
                    currency,
                    destination,
                    source_transaction: charge.id,
                    transfer_group
                });
            }
        } catch (err) {
            return response.status(400).send(`Error in sending transfer to another stripeAccount: ${err}`);
        }
    }

    public async stripePayConnectWithBecs(
        amount: number,
        connectId: string,
        customerId: string,
        paymentMethodId: string,
        response: Response
    ) {
        try {
            const currency = 'aud';
            await stripe.paymentIntents.create({
                amount: amount * 1000,
                currency,
                payment_method_types: ["au_becs_debit"],
                customer: customerId,
                payment_method: paymentMethodId,
                confirm: true,
                on_behalf_of: connectId,
                mandate_data: {
                    customer_acceptance: {
                        type: "online",
                    },
                },
                transfer_data: {
                    destination: connectId,
                },
            });
        } catch (err) {
            return response.status(400).send(`Error in becs to connect transfer to another: ${err}`);
        }
    }

    @Post('/updateMatchUmpirePayment')
    async updateMatchUmpirePaymentWithWebHooks(
        @Body() webhookBody: any,
        @Res() response: Response
    ): Promise<any> {
        try {
            switch (webhookBody.type) {
                case 'transfer.paid':
                    await this.userService.updateMatchUmpirePaymentStatus(webhookBody.data.object.transfer_group, 'paid');
                    break;
                default:
                    return response.status(400).end();
            }

            return response.json({ received: true });
        } catch (err) {
            response.status(400).send(`Webhook Error: ${err.message}`);
        }
    }

    private async performGovernmentVoucherRedeem(registrationData) {
        logger.info(`Inside the performGovernmentVoucherRedeem :: ${process.env.VOUCHER_ENABLED}`);

        if (Number(process.env.VOUCHER_ENABLED) == 1) {
            let pin = null;
            for (let item of registrationData.compParticipants) {
                const { organisationUniqueKey } = item
                const organisation = await this.organisationService.findOrganisationByUniqueKey(organisationUniqueKey);
                const { posTerminalId, postalCode, storeChannelCode } = organisation[0]

                pin = moment(item.dateOfBirth).format("DDMM")
                let selectedGovernmentVouchers = item.selectedOptions.selectedGovernmentVouchers;
                if (isArrayPopulated(selectedGovernmentVouchers)) {
                    for (let voucher of selectedGovernmentVouchers) {
                        if (voucher.isValid && voucher.governmentVoucherRefId == 1) {
                            let voucherRedeemRes = await this.redeemVoucher(voucher.voucherCode, voucher.redeemAmount, pin, {
                                posTerminalId,
                                postalCode,
                                storeChannelCode
                            });
                            if (voucherRedeemRes) {
                                // failed
                                return voucherRedeemRes;
                            }
                        }
                    }
                }
            }
        }
        return null; // success
    }

    private async redeemVoucher(voucherCode, amt, pin, { posTerminalId, postalCode, storeChannelCode }) {
        // strip all spaces from the voucher
        voucherCode = voucherCode.replace(/ /ig, '')
        try {
            let payload = {
                "pin": pin,
                "amount": amt,
                "voucherCode": voucherCode,
                "voucherType": AppConstants.VOUCHER_TYPE,
                "storeChannelCode": storeChannelCode,
                "posTerminalId": posTerminalId,
                "program": process.env.VOUCHER_PROGRAM,
                "programLocation": postalCode
            }
            let redeem = await AxiosHttpApi.redeem(payload);
            if (redeem && redeem.status === VoucherStatus.SUCCESS) {
                logger.info("Successfully Redeemed the voucher code " + voucherCode);
                // does not return anything
                return // success ! return nothing
            } else {
                throw Error('Unhandled error in redeeming voucher')
            }
        } catch (error) {
            if (error) {
                switch (error.status) {
                    case VoucherStatus.SUCCESS:
                        logger.info("Successfully Redeemed the voucher code " + voucherCode);
                        // does not return anything
                        return null // success ! return nothing
                    case VoucherStatus.FAIL:
                    case VoucherStatus.UNAVAILABLE:
                    case VoucherStatus.RATE_LIMIT:
                    default:
                        return {
                            balance: 0,
                            statusCode: error.status || VoucherStatus.UNKNOWN,
                            message: error.message,
                            isValid: 0
                        };
                }
            }


            logger.error(`Exception occurred in redeemVoucher ${error} :: ${voucherCode}`);
            let redeemJson = JSON.stringify(error);
            let redeemJsonObj = JSON.parse(redeemJson);
            //   redeemJsonObj.status = 9
            if (redeemJsonObj.status == 9) {
                return { balance: 0, statusCode: 9, message: AppConstants.activeKidServiceUnavailable, isValid: 0 };
            } else if (redeemJsonObj.status == 10) {
                return { balance: 0, statusCode: 10, message: AppConstants.tooManyRequests, isValid: 0 };
            }
            // let redeemJsonObj = JSON.parse(redeemJson);
            // if (redeemJsonObj.status == 7) {
            //     return { balance: 0, transactionCode: null, message: redeemJsonObj.message.message, isValid: 0 };
            // }
            //
            // return { balance: 0, transactionCode: null, message: "Invalid code", isValid: 0 };
        }
    }

    async paymentIntentFailed(webhookBody) {
        try {
            logger.info("Failed Web Hook Succeed::" + JSON.stringify(webhookBody));
            let transferGroupWithPrefix = webhookBody.data.object.transfer_group;
            let transferGroup = transferGroupWithPrefix.split("#");
            logger.info("Failed Web Hook transferGroup::" + JSON.stringify(transferGroup));
            let invoiceData;
            if (transferGroup[0] === AppConstants.registration) {
                const registrationUniqueKey = transferGroup[1];
                const registration = await this.registrationService.findByRegistrationKey(registrationUniqueKey);
                invoiceData = await this.invoiceService.findByRegistrationId(registration.id);
                await this.userMembershipExpiryService.updateExistingMembership(registration.id);
                await this.player1Service.updateLivescorePlayerStatusByRegistrationId(registration.id);
                await this.player1Service.updateStatusByRegistrationId(registration.id, 4);
                await this.nonPlayerService.updateStatusByRegistrationId(registration.id, 4);
            } else if (transferGroup[0] === AppConstants.singleGame) {
                const invoiceId = transferGroup[2];
                invoiceData = await this.invoiceService.getPaymentStatusByInvoiceId(invoiceId);
            } else if (transferGroup[0] === AppConstants.teamMemberRegistration) {
                let teamMemberRegId = transferGroup[2];
                invoiceData = await this.invoiceService.getPaymentStatusByteamMemberRegId(teamMemberRegId);
            } else if (transferGroup[0] === AppConstants.teamIndividual) {
                const userRegId = transferGroup[1];
                let userRegistration = await this.userRegistrationService.findByRegistrationKey(userRegId);
                let registration = await this.registrationService.findById(userRegistration.registrationId);
                invoiceData = await this.invoiceService.getPaymentStatusTeamIndividual(registration.id, userRegistration.userRegId);
            } else if (transferGroup[0] == AppConstants.instalment) {
                const invoiceId = transferGroup[2];
                invoiceData = await this.invoiceService.getPaymentStatusByInvoiceId(invoiceId);
            }

            console.log("paymentIntentFailed invoiceData" + JSON.stringify(invoiceData));
            if (isArrayPopulated(invoiceData)) {
                const invoiceId = invoiceData[0].id;
                await this.transactionService.deleteByInvoiceId(invoiceId);
                await this.transactionService.deleteByInvoiceRefId(invoiceId);
                await this.invoiceService.updatePaymentStatusByInvoiceId(invoiceId, InvoicePaymentStatus.Failed)
            }
        } catch (error) {
            logger.error(`Exception occurred in paymentIntentFailed` + error);
        }
    }

    async checkCardDefault(registrationProduct, paymentBody) {
        try {
            if (paymentBody.paymentType == AppConstants.card && registrationProduct.canCheckCard != 0) {
                let yourInfo = registrationProduct.yourInfo;
                let userDb = await this.userService.findByEmail(yourInfo.email)
                if (userDb) {
                    let stripeCustomerId = userDb.stripeCustomerAccountId;
                    if (!isNullOrEmpty(stripeCustomerId)) {
                        const token = await stripe.tokens.retrieve(
                            paymentBody.token.id
                        );

                        let cardFingerPrint = token.card.fingerprint;

                        let customer = await stripe.customers.retrieve(
                            stripeCustomerId
                        );

                        let customerObj = JSON.parse(JSON.stringify(customer));

                        let data = customerObj.sources.data;
                        if (data && data.length) {
                            if (customerObj.default_source) {
                                let defaultSourceCard = data.find(x => x.id == customerObj.default_source);
                                if (defaultSourceCard) {
                                    if (defaultSourceCard.fingerprint != cardFingerPrint) {
                                        return {
                                            message: AppConstants.cardValidationMsg,
                                            errorCode: "card_default_warning"
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
            return null;
        } catch (error) {
            logger.error(`Exception occurred in paymentIntentFailed` + error);
            throw error;
        }
    }

    @Authorized()
    @Post('/checkcustomer')
    async checkCustomer(
        @Body() paymentBody: any,
        @Res() response: Response
    ): Promise<any> {
        try {
            const STRIPE_TOTAL_FEE = formatFeeForStripe1(22);

            let obj = {
                'partialRefund': "PARTIALREFUND" + "#" + "abcdefghijklmnopqrstuvwxyz"
            }
            const refund = await stripe.refunds.create({
                amount: STRIPE_TOTAL_FEE,
                payment_intent: "pi_1INlaREnewRwSTgnlZUcdUEt",
                metadata: obj
            });
            return response.status(200).send(refund);


            // let customer = await stripe.customers.retrieve(
            //     stripeCustomerId
            // );
            //
            // let customerObj = JSON.parse(JSON.stringify(customer));
            //
            // let data = customerObj.sources.data;
            // if (data && data.length) {
            //     if (customerObj.default_source) {
            //         if (customerObj.default_source != cardId) {
            //             return response.status(212).send({
            //                 message: "The card will be default for all the registrations",
            //                 errorCode: 1
            //             })
            //         }
            //     }
            // }
            //
            // return response.status(200).send(customer);
        } catch (err) {
            response.status(400).send(`Something went wrong: ${err.message}`);
        }
    }

    @Authorized()
    @Post('/refundAPaymentIntent')
    async refundAPayment(
        @Body() paymentBody: any,
        @Res() response: Response
    ): Promise<any> {
        try {
            return Promise.all([
                stripe.refunds.create({
                    payment_intent: paymentBody.payment_intent,
                    amount: paymentBody.amount
                }),
                stripe.transfers.createReversal(
                    paymentBody.transfer_id, {
                    amount: paymentBody.amount
                })
            ])
        } catch (err) {
            response.status(400).send(`Something went wrong: ${err.message}`);
        }
    }
}

export interface PaymentRequest {
    registrationId: number;
    invoiceId: number;
    paymentType: ('card' | 'direct_debit');
    token?: {
        id: string
    }
}

export interface PaymentRequestNew {
    registrationId: string;
    //invoiceId: number;
    paymentType: ('card' | 'direct_debit');
    token?: {
        id: string
    };
    payload: string;
}

export interface InvoiceTransactionRequest {
    registrationId: number;
    invoiceId: number;
    transactionId: number;
    charity: CharityRequest;
}

export interface InvoiceStatusRequest {
    registrationId: number;
}

export interface CharityRequest {
    roundUpId: number;
    charitySelectedId: number;
    charityValue: number;
    competitionId: number;
    competitionOrganisationId: number;
    membershipMappingId: number;
}

export interface ListingRequest {
    type: ("transfer" | "payout" | "refunds"),
    organisationUniqueKey: string,
    paging: {
        starting_after?: string,
        ending_before?: string,
        limit: number
    }
}

export interface PayoutTransferListingRequest {
    type: ("payoutTransfer"),
    organisationUniqueKey: string,
    payoutId: string,
    paging: {
        starting_after?: string,
        ending_before?: string,
        limit: number
    }
}

export interface PaymentTransactionsListingRequest {
    organisationUniqueKey: string,
    paging: Paging,
    userId: number,
    registrationId: string,
    yearId?: number,
    competitionKey?: string,
    paymentFor?: string,
    dateFrom?: Date,
    dateTo?: Date,
    feeTypeRefId?: number,
    paymentOption?: number,
    paymentMethod?: string,
    membershipType?: string,
    paymentStatus?: number,
    discountMethod?: number
}

export interface RegistrationPaymentRequest {
    year?: number,
    dateFrom?: Date,
    dateTo?: Date,
}

export interface PayoutTransactionExportRequest {
    type: ("payoutTransfer"),
    organisationUniqueKey: string,
    payoutId: string,
}
