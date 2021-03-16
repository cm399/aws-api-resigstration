import Stripe from 'stripe';
import { getManager } from "typeorm";
import nodeMailer from "nodemailer";
import moment from "moment";

import { Transaction } from "../models/registrations/Transaction";
import {
    feeIsNull,
    formatFeeForStripe1,
    formatPersonName,
    getParentEmail,
    isArrayPopulated,
    isNotNullAndUndefined,
    objectIsNotEmpty
} from "../utils/Utils";
import AppConstants from "../validation/AppConstants";
import { logger } from "../logger";
import { RegistrationStep, TransactionStatus } from "../enums/enums";
import { Organisation } from "../models/security/Organisation";
import { Invoice } from "../models/registrations/Invoice";
import { CompetitionReg } from "../models/registrations/Competition";
import { CompetitionDivision } from "../models/registrations/CompetitionDivision";
import { CommunicationTrack } from "../models/common/CommunicationTrack";

let stripe = null;
const cron = require("node-cron");

export class PerMatchScheduler {
    public async perMatchScheduler() {
        try {
            stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2020-03-02' });
            await cron.schedule("*/5 * * * *", async () => {
                let perMatchData = await this.getPerMatchData();
                let matchData = await this.getPerMatchStructedData(perMatchData);
                if (isArrayPopulated(matchData)) {
                    for (let item of matchData) {
                        if (isArrayPopulated(item.compParticipants)) {
                            let account = await this.checkOrganisationStripeAccount(item);
                            if ((!account.membershipStripeAccountIdError) &&
                                (!account.competitionStripeAccountIdError) &&
                                (!account.affiliateStripeAccountIdError)) {
                                for (let comp of item.compParticipants) {
                                    if (comp.stripeSourceTransaction != null || comp.stripeSubSourceTransaction != null) {
                                        let totalValue = feeIsNull(item.total.targetValue)
                                        console.log("totalValue" + totalValue);
                                        if (totalValue > 0) {
                                            let invoice = await this.createInvoice(comp);
                                            console.log("invoice" + invoice.id);

                                            let paymentIntent = await this.getStripePaymentIntent(comp, totalValue, invoice, item);
                                            await this.perMatchDateToDBTrack(item, comp.registrationId, invoice.id, comp.createdBy)
                                            let isAffiliateFeeExists = 1;
                                            // if ((isNotNullAndUndefined(paymentIntent) && paymentIntent.status == AppConstants.succeeded) || comp.subPaymentType == AppConstants.cash) {
                                            let transArr = await this.performStripeTransaction(comp, paymentIntent, invoice.id, isAffiliateFeeExists);
                                            console.log("transArr" + JSON.stringify(transArr));
                                            await this.createTransaction(transArr, invoice.createdBy, item);

                                            if (comp.subPaymentType == AppConstants.card || isAffiliateFeeExists == 0) {
                                                await this.updateInvoiceStatus(invoice)
                                            }

                                            let mailObj = await this.findMailObj(23)
                                            await this.sendPerMatchMail(comp, mailObj, totalValue)
                                            //}
                                        }
                                    }
                                }
                            }
                        }

                    }
                }
            });
        } catch (error) {
            logger.error(`Exception occurred in PerMatchScheduler ${error}`);
        }
    }

    private async getPerMatchData() {
        try {
            const entityManager = getManager();
            let data = await entityManager.query(`Call wsa_registrations.usp_get_registration_per_match()`);
            return data[0];
        } catch (error) {
            throw error;
        }
    }

    private async getPerMatchStructedData(matchData) {
        let arr = [];
        try {
            if (matchData) {
                console.log('----- getPerMatchStructedData entry ' + matchData)
                let iMap = new Map();
                let mMap = new Map();
                for (let item of matchData) {
                    let key;
                    if (item.teamRegChargeTypeRefId == 2) {
                        key = item.teamId + '#' + item.matchId + '#' + item.registrationId;
                    } else if (item.teamRegChargeTypeRefId == 3) {
                        if (item.payingFor == 1)
                            key = item.teamId + '#' + item.matchId + '#' + item.registrationId;
                        else
                            key = item.teamId + '#' + item.matchId + '#' + item.registrationId + "#" + item.userId;
                    } else {
                        key = item.matchId + '#' + item.registrationId + "#" + item.userId;
                    }
                    let teamData = iMap.get(key);
                    let memData = mMap.get(key);
                    let totalValue = feeIsNull(item.teamSeasonalFees) + feeIsNull(item.teamSeasonalGST);

                    console.log(' !!!!!!!------- teamSeasonalFees ' + item.teamSeasonalFees + '-- teamSeasonalGST ' + item.teamSeasonalGST)
                    let feeObj = {
                        "transactionId": 0,
                        "name": item.orgName,
                        "emailId": item.orgEmail,
                        "phoneNo": item.orgPhoneNumber,
                        "feesToPay": feeIsNull(item.teamSeasonalFees),
                        "feesToPayGST": feeIsNull(item.teamSeasonalGST),
                        "organisationId": item.organisationUniqueKey,
                        "membershipMappingId": item.membershipProductMappingId
                    }
                    if (teamData == undefined) {
                        let transactionFee = 0;
                        let finalObj = {
                            "total": {
                                "gst": feeIsNull(item.teamSeasonalGST),
                                "subTotal": feeIsNull(item.teamSeasonalFees),
                                "total": totalValue,
                                "transactionFee": transactionFee,
                                "targetValue": totalValue + transactionFee,
                            },
                            "compParticipants": [],
                            "invoiceRefId": item.invoiceId
                        }

                        let compParticipantObj = {
                            "email": item.email,
                            "userId": item.userId,
                            "lastName": item.lastName,
                            "firstName": item.firstName,
                            "mobileNumber": item.mobileNumber,
                            "competitionId": item.competitionId,
                            "competitionName": item.competitionName,
                            "organisationId": item.organisationId,
                            "organisationName": item.orgName,
                            "divisionName": item.divisionName,
                            "divisionId": item.divisionId,
                            "teamId": item.teamId,
                            "teamName": item.teamName,
                            "membershipTypeName": item.membershipTypeName,
                            "membershipMappingId": item.membershipProductMappingId,
                            "stripeSourceTransaction": item.stripeSourceTransaction,
                            "stripeSubSourceTransaction": item.stripeSubSourceTransaction,
                            "paymentType": item.paymentType,
                            "subPaymentType": item.subPaymentType,
                            "registrationUniqueKey": item.registrationUniqueKey,
                            "registrationId": item.registrationId,
                            "createdBy": item.userId,
                            "competitionUniqueKey": item.competitionUniqueKey,
                            "membershipProducts": [],
                            "matchId": item.matchId
                        }

                        finalObj.compParticipants.push(compParticipantObj);
                        let feesObj = {
                            "feesToPay": totalValue,
                            "membershipMappingId": item.membershipProductMappingId,
                            "membershipTypeName": item.membershipTypeName,
                            "divisionId": item.divisionId,
                            "fees": {
                                "affiliateFee": null,
                                "competitionOrganisorFee": null
                            }
                        }

                        compParticipantObj.membershipProducts.push(feesObj);

                        if (item.affOrganisationId == item.organisationId) {
                            feesObj.fees.affiliateFee = feeObj;
                        } else {
                            feesObj.fees.competitionOrganisorFee = feeObj
                        }

                        iMap.set(key, finalObj);
                        mMap.set(key, feesObj);
                        arr.push(finalObj);
                    } else {
                        if (memData != undefined) {
                            memData.feesToPay = feeIsNull(memData.feesToPay) + totalValue;

                            if (item.affOrganisationId) {
                                if (memData.fees.affiliateFee) {
                                    memData.fees.affiliateFee.feesToPay = memData.fees.affiliateFee.feesToPay + feeIsNull(item.teamSeasonalFees),
                                        memData.fees.affiliateFee.feesToPayGST = memData.fees.affiliateFee.feesToPayGST + feeIsNull(item.teamSeasonalGST)
                                } else {
                                    memData.fees.affiliateFee = feeObj;
                                }
                            } else {
                                if (memData.fees.competitionOrganisorFee) {
                                    memData.fees.competitionOrganisorFee.feesToPay = memData.fees.competitionOrganisorFee.feesToPay + feeIsNull(item.teamSeasonalFees),
                                        memData.fees.competitionOrganisorFee.feesToPayGST = memData.fees.competitionOrganisorFee.feesToPayGST + feeIsNull(item.teamSeasonalGST)
                                } else {
                                    memData.fees.competitionOrganisorFee = feeObj
                                }
                            }

                            teamData.total.gst = feeIsNull(teamData.total.gst) + feeIsNull(item.teamSeasonalGST);
                            teamData.total.subTotal = feeIsNull(teamData.total.subTotal) + feeIsNull(item.teamSeasonalFees);
                            teamData.total.targetValue = feeIsNull(teamData.total.targetValue) + (totalValue);
                        }
                    }
                }
            }
        } catch (error) {
            logger.error(`Exception occurred in scheduler getTransactions ${error}`);
        }
        return arr;
    }

    private async createInvoice(item) {
        try {
            const entityManager = getManager();
            let invoiceReceipt = await this.getInvoiceReciptId();
            let receiptId = feeIsNull(invoiceReceipt.receiptId) + 1;
            let invoice = new Invoice();
            invoice.id = 0;
            invoice.paymentStatus = "pending";
            invoice.registrationId = item.registrationId;
            invoice.userRegistrationId = item.userRegistrationId;
            invoice.paymentType = item.paymentType;
            invoice.subPaymentType = item.subPaymentType;
            invoice.receiptId = receiptId.toString();
            invoice.createdBy = item.createdBy;
            //let invoiceRes = await this.invoiceService.createOrUpdate(invoice);
            let invoiceRes = await entityManager.save(invoice)
            return invoiceRes;
        } catch (error) {
            logger.error(`Exception occurred in createInvoice Instalment :: ${error}`);
        }
    }

    async getStripePaymentIntent(item, totalFee, invoice, mainItem) {
        let PAYMENT_INTENT_ID = '';

        try {
            const CURRENCY_TYPE: string = "aud";
            let totalTargetValue = 0;
            console.log("getStripePaymentIntent1::" + totalFee + " item.stripeSourceTransaction" + item.stripeSubSourceTransaction, "" + item.stripeSubSourceTransaction);
            const paymentIntent = await stripe.paymentIntents.retrieve(
                item.stripeSubSourceTransaction ? item.stripeSubSourceTransaction : item.stripeSourceTransaction
            );

            console.log("getStripePaymentIntent1::" + JSON.stringify(paymentIntent));

            let newPaymentIntent = null;
            let paymentIntentObject = Object.assign({});
            paymentIntentObject['customer'] = paymentIntent.customer;
            if (item.subPaymentType == "card") {
                paymentIntentObject['confirm'] = true;
                paymentIntentObject['setup_future_usage'] = "off_session";
                let transactionFee = await this.getTransactionFee(paymentIntent, item.subPaymentType, totalFee);
                mainItem.total.targetValue = feeIsNull(transactionFee) + feeIsNull(totalFee);
                mainItem.total.transactionFee = transactionFee;
                console.log('mainItem.total.targetValue = ' + mainItem.total.targetValue + ' transactionFee ' + transactionFee)
                totalTargetValue = formatFeeForStripe1(feeIsNull(transactionFee) + feeIsNull(totalFee));
                console.log(' TOTAL VALUE : ' + totalFee + ' totalTargetValue ' + totalTargetValue)
                paymentIntentObject['confirm'] = true;
                paymentIntentObject['amount'] = totalTargetValue;
                paymentIntentObject['currency'] = CURRENCY_TYPE;
                paymentIntentObject['metadata'] = paymentIntent.metadata;
                paymentIntentObject['description'] = "Registration Payment";
                paymentIntentObject['confirmation_method'] = "automatic";
                paymentIntentObject['payment_method_types'] = ['card', 'au_becs_debit'];

                logger.info(`***** paymentIntentObject+ ${JSON.stringify(paymentIntentObject)}`);

                newPaymentIntent = await stripe.paymentIntents.create(paymentIntentObject);
                logger.info(`***** paymentIntentObject+ ${JSON.stringify(newPaymentIntent)}`);
                PAYMENT_INTENT_ID = newPaymentIntent.id;
            }

            const updateTransaction = await this.updateErrorMessageAndPaymentTypeWithTransaction(item.registrationId, item.subPaymentType, null, PAYMENT_INTENT_ID, invoice);
            console.log('updateTransaction  :::: ', JSON.stringify(updateTransaction))

            return newPaymentIntent;
        } catch (error) {
            logger.error(`Error occurred in getStripePaymentIntent" ${error}`);
            await this.updateErrorMessageAndPaymentTypeWithTransaction(item.registrationId, item.paymentType, error.message, PAYMENT_INTENT_ID, invoice);

            // await this.updateFailedTransaction(item.membershipProducts)
            throw error;
        }
    }

    private async checkOrganisationStripeAccount(item) {
        try {
            let obj = {
                membershipStripeAccountIdError: false,
                competitionStripeAccountIdError: false,
                affiliateStripeAccountIdError: false,
            }
            if (isArrayPopulated(item.compParticipants)) {
                console.log("COMPPARTICIPANTS IS NOT EMPTY ::")
                for (let j of item.compParticipants) {
                    if (isArrayPopulated(j.membershipProducts)) {
                        console.log("MEMBERSHIPpRODUCTS IS NOT EMPTY ::")
                        for (let k of j.membershipProducts) {
                            //  const membershipData = isNotNullAndUndefined(k.fees.membershipFee) ? k.fees.membershipFee : Object.assign({});
                            const compOrgData = isNotNullAndUndefined(k.fees.competitionOrganisorFee) ? k.fees.competitionOrganisorFee : Object.assign({});
                            const affiliateData = isNotNullAndUndefined(k.fees.affiliateFee) ? k.fees.affiliateFee : Object.assign({});

                            if (objectIsNotEmpty(compOrgData) || objectIsNotEmpty(affiliateData)) {
                                if (objectIsNotEmpty(compOrgData)) {
                                    console.log("compOrgData IS NOT EMPTY " + JSON.stringify(compOrgData));
                                    let cOrgData = await this.findOrganisationByUniqueKey(compOrgData.organisationId);
                                    let cStripeAccountId = null;
                                    if (!isArrayPopulated(cOrgData)) {
                                        console.log("cOrgData IS NOT EMPTY " + JSON.stringify(cOrgData));
                                        cStripeAccountId = cOrgData.stripeAccountID;
                                        compOrgData["organisationAccountId"] = cStripeAccountId;
                                    }

                                    if (cStripeAccountId === null) {
                                        console.log("cOrgData IS EMPTY ");
                                        obj.competitionStripeAccountIdError = true;
                                        break;
                                    }
                                }

                                if (objectIsNotEmpty(affiliateData)) {
                                    // console.log("affiliateData IS NOT EMPTY ");
                                    let aOrgData = await this.findOrganisationByUniqueKey(affiliateData.organisationId);
                                    let aStripeAccountId = null;
                                    if (!isArrayPopulated(aOrgData)) {
                                        console.log("aOrgData IS NOT EMPTY " + JSON.stringify(aOrgData));
                                        aStripeAccountId = aOrgData.stripeAccountID;
                                        affiliateData["organisationAccountId"] = aStripeAccountId;
                                    }
                                    if (aStripeAccountId === null) {
                                        // console.log("aOrgData IS EMPTY ");
                                        obj.affiliateStripeAccountIdError = true;
                                        break;
                                    }
                                }
                            }
                        }
                    }
                }
            }

            console.log(" stripeAccountId inside checkOrganisationStripeAccount ::::::::::: " + JSON.stringify(obj));
            return obj;
        } catch (error) {
            logger.error(`Exception occurred in checkOrganisationStripeAccount ${error}`);
        }
    }

    private async findOrganisationByUniqueKey(organisationId: string): Promise<Organisation> {
        try {
            console.log("findOrganisationByUniqueKey entry :: " + organisationId);
            const entityManager = getManager();

            let query = entityManager.createQueryBuilder(Organisation, 'organisation')
            query.where('organisation.organisationUniquekey= :organisationId and isDeleted = 0', { organisationId })
            return (await query.getOne());

        } catch (error) {
            logger.error((`Exception occurred in findOrganisationByUniqueKey ${error}`));
        }
    }

    public async getInvoiceReciptId(): Promise<any> {
        const entityManager = getManager();
        let query = await entityManager.query(`select IFNULL(receiptId, 100000) as receiptId from wsa_registrations.invoice order by id desc LIMIT 1`);
        return query.find(x => x);
    }

    private async getTransactionFee(paymentIntent, paymentType, totalFee) {
        try {
            let transactionFee = 0
            if (paymentType == "card") {
                const card = await stripe.customers.retrieveSource(
                    paymentIntent.customer.toString(),
                    paymentIntent.source.toString()
                );

                if (card.country != "AU") {
                    if (card.brand == "American Express") {
                        transactionFee = (totalFee * 2.7 / 100) + 0.30;
                    } else {
                        transactionFee = (totalFee * 3.0 / 100) + 0.30;
                    }
                } else {
                    transactionFee = (totalFee * 2.25 / 100) + 0.30;
                }
            } else {
                transactionFee = (totalFee * 1.5 / 100) + 0.30;
                if (transactionFee > 3.50) {
                    transactionFee = 3.50;
                }
            }
            return transactionFee;
        } catch (error) {
            logger.error(`Exception occurred in getTransactionFee ${error}`);
            throw error;
        }
    }

    private async updateErrorMessageAndPaymentTypeWithTransaction(registrationId: number, paymentType: string, error: string, stripeSourceTransaction: string, invoice) {
        if (invoice) {
            const entityManager = getManager();
            const INVOICE_ID = invoice.id;
            const i = new Invoice();
            i.id = INVOICE_ID;
            i.registrationId = registrationId;
            i.paymentType = isNotNullAndUndefined(paymentType) ? paymentType : undefined;
            i.stripeSourceTransaction = isNotNullAndUndefined(stripeSourceTransaction) ? stripeSourceTransaction : undefined;
            i.errorMessage = isNotNullAndUndefined(error) ? error : undefined;
            await entityManager.save(i);
        }
    }

    private async perMatchDateToDBTrack(item, registrationId, invoiceId, createdBy) {
        try {
            const stepId = RegistrationStep.PerMatchFeeTrackStep;
            const entityManager = getManager();
            let trackData = await entityManager.query(
                `select * from  wsa_registrations.registrationTrack  where registrationId = ? and stepsId = ? and isDeleted = 0 and invoiceId = ?`,
                [registrationId, stepId, invoiceId]
            );
            if (isArrayPopulated(trackData)) {
                await entityManager.query(
                    `Update wsa_registrations.registrationTrack set jsonData = ? where registrationId = ? and stepsId = ? and invoiceId = ?`,
                    [JSON.stringify(item), registrationId, stepId, invoiceId]
                );
            } else {
                await entityManager.query(
                    `insert into wsa_registrations.registrationTrack(registrationId, stepsId,jsonData,createdBy, invoiceId) values(?,?,?,?,?)`,
                    [registrationId, stepId, JSON.stringify(item), createdBy, invoiceId]
                );
            }
        } catch (error) {
            logger.error(`Exception occurred in perMatchDateToDBTrack ${error}`);
            throw error;
        }
    }

    private async performStripeTransaction(item, paymentIntent, invoiceId, isAffiliateFeeExists) {
        try {
            console.log("Perform Stripe Transaction Entry ");
            const CURRENCY_TYPE: string = "aud";
            let transArr = [];
            let statusRefId = AppConstants.PAID;
            let paymentType = item.subPaymentType;
            if (paymentType == AppConstants.cash) {
                statusRefId = AppConstants.NOT_PAID;
            }
            if (!(isNotNullAndUndefined(paymentIntent))) {
                statusRefId = TransactionStatus.Failed;
            }
            if (isArrayPopulated(item.membershipProducts)) {
                let paymentOptionRefId = AppConstants.PAY_AS_YOU_GO;
                let paymentFeeTypeRefId = AppConstants.CASUAL_FEE;
                let registeringOrgName = item['organisationName'];

                for (let mem of item.membershipProducts) {
                    const compOrgData = isNotNullAndUndefined(mem.fees.competitionOrganisorFee) ? mem.fees.competitionOrganisorFee : Object.assign({});
                    const affiliateData = isNotNullAndUndefined(mem.fees.affiliateFee) ? mem.fees.affiliateFee : Object.assign({});
                    // if (paymentType == AppConstants.card) {
                    if (!objectIsNotEmpty(affiliateData)) {
                        statusRefId = AppConstants.PAID;
                        isAffiliateFeeExists = 0;
                    }
                    // }
                    const competitionOrganiserOrganisationName_: string = compOrgData['name'];
                    const playerName_: string = formatPersonName(item.firstName, null, item.lastName);
                    const competitionId_ = await this.findByCompUniquekey(item.competitionUniqueKey);
                    const matchId = item.matchId;

                    const membershipProductTypeName_ = mem.membershipTypeName;
                    const membershipMappingId_ = mem.membershipMappingId;
                    let compDivisionDb = await this.findDivisionByCmpd(mem.divisionId)
                    const divisionId_ = compDivisionDb != undefined ? compDivisionDb.id : 0;

                    if (objectIsNotEmpty(compOrgData)) {
                        const competitionTotalAmount_: number = feeIsNull(compOrgData.feesToPay) + feeIsNull(compOrgData.feesToPayGST);
                        const competitionFeeAmount_: number = feeIsNull(compOrgData.feesToPay);
                        const competitionGstAmount_: number = feeIsNull(compOrgData.feesToPayGST);
                        const STRIPE_COMPETITION_TOTAL_FEE = formatFeeForStripe1(competitionTotalAmount_);

                        const cOrganisationAccountId_: string = compOrgData.organisationAccountId;
                        const cOrganisation_: Organisation = await this.findOrganisationByUniqueKey(compOrgData.organisationId);
                        const cOrganisationId_: number = cOrganisation_.id;
                        console.log('going to pay a total of ' + competitionTotalAmount_ + ' to ' + competitionOrganiserOrganisationName_ + ' as Competition Fee')

                        // transfer to association for organiser fees
                        if (STRIPE_COMPETITION_TOTAL_FEE >= 1) {
                            let transferForCompetitionOrganiser = null;
                            if (paymentType == AppConstants.card && (isNotNullAndUndefined(paymentIntent))) {
                                transferForCompetitionOrganiser = await stripe.transfers.create({
                                    amount: STRIPE_COMPETITION_TOTAL_FEE,
                                    currency: CURRENCY_TYPE,
                                    description: `${playerName_} - ${membershipProductTypeName_} - ${competitionOrganiserOrganisationName_} - ${registeringOrgName} - COMPETITION FEE`,
                                    destination: cOrganisationAccountId_,
                                    source_transaction: paymentIntent.charges.data.length > 0 ? paymentIntent.charges.data[0].id : paymentIntent.id,
                                    //transfer_group: transferGroup
                                });
                            }

                            let trxn = await this.updateTransaction(invoiceId, item, competitionFeeAmount_, competitionGstAmount_,
                                AppConstants.competition, membershipMappingId_, competitionId_, cOrganisationId_, paymentOptionRefId,
                                paymentFeeTypeRefId, divisionId_, transferForCompetitionOrganiser, statusRefId, matchId)

                            transArr.push(trxn);
                        }
                    }

                    if (objectIsNotEmpty(affiliateData)) {
                        let affiliateTotalAmount_: number = feeIsNull(affiliateData.feesToPay) + feeIsNull(affiliateData.feesToPayGST);
                        let affiliateFeeAmount_: number = feeIsNull(affiliateData.feesToPay);
                        let affiliateGstAmount_: number = feeIsNull(affiliateData.feesToPayGST);
                        const STRIPE_AFFILIATE_TOTAL_AMOUNT = formatFeeForStripe1(affiliateTotalAmount_);

                        let aOrganisation_: Organisation = await this.findOrganisationByUniqueKey(affiliateData.organisationId);
                        let aOrganisationId_: number = aOrganisation_.id;
                        let aOrganisationAccountId_: string = affiliateData.organisationAccountId;
                        const affiliateOrganisationName_: string = affiliateData.name;

                        console.log('going to pay a total of ' + affiliateTotalAmount_ + +' to ' + affiliateOrganisationName_ + ' as Affiliate Fee')

                        // transfer for affiliateFees
                        if (STRIPE_AFFILIATE_TOTAL_AMOUNT >= 1) {
                            let transferForAffiliateFee = null;
                            if (paymentType == AppConstants.card && (isNotNullAndUndefined(paymentIntent))) {
                                transferForAffiliateFee = await stripe.transfers.create({
                                    amount: STRIPE_AFFILIATE_TOTAL_AMOUNT,
                                    description: `${playerName_} - ${membershipProductTypeName_} - ${affiliateOrganisationName_} - ${registeringOrgName} - AFFILIATE FEE`,
                                    currency: CURRENCY_TYPE,
                                    destination: aOrganisationAccountId_,
                                    source_transaction: paymentIntent.charges.data.length > 0 ? paymentIntent.charges.data[0].id : paymentIntent.id,
                                    // transfer_group: transferGroup
                                });
                            }

                            let trxn = await this.updateTransaction(invoiceId, item, affiliateFeeAmount_, affiliateGstAmount_,
                                AppConstants.affiliate, membershipMappingId_, competitionId_, aOrganisationId_, paymentOptionRefId,
                                paymentFeeTypeRefId, divisionId_, transferForAffiliateFee, statusRefId, matchId)

                            transArr.push(trxn);
                        }
                    }
                }
            }
            return transArr;
        } catch (error) {
            logger.error(`Exception occurred in performStripeTransaction ${error}`);
        }
    }

    private async findByCompUniquekey(competitionUniquekey: string): Promise<number> {
        const entityManager = getManager();
        let query = entityManager.createQueryBuilder(CompetitionReg, 'competition')
        query.where('competition.competitionUniqueKey= :competitionUniquekey and isDeleted = 0', { competitionUniquekey })
        return (await query.getOne()).id;
    }

    private async findDivisionByCmpd(competitionMembershipProductDivisionId): Promise<CompetitionDivision> {
        try {
            const entityManager = getManager();
            let query = await entityManager.createQueryBuilder(CompetitionDivision, 'cd')
                .where('cd.competitionMembershipProductDivisionId = :competitionMembershipProductDivisionId and cd.isDeleted = 0', { competitionMembershipProductDivisionId: competitionMembershipProductDivisionId })
                .getOne();

            return query;
        } catch (error) {
            logger.error(`Exception occurred in findDivisionByCmpd ${error}`);
        }
    }

    private async updateTransaction(
        invoiceId, item, feeAmount, gstAmount, feeType, membershipProductMappingId, competitionId, organisationId,
        paymentOptionRefId, paymentFeeTypeRefId, divisionId, transferForMembershipFee, statusRefId, matchId
    ) {
        try {
            const trxn = new Transaction();
            trxn.id = 0;
            trxn.invoiceId = invoiceId;
            trxn.participantId = item.userId;
            trxn.createdBy = item.createdBy;
            trxn.feeAmount = feeAmount;
            trxn.gstAmount = gstAmount;
            trxn.feeType = feeType;
            trxn.membershipProductMappingId = membershipProductMappingId;
            trxn.competitionId = competitionId;
            trxn.organisationId = organisationId;
            trxn.paymentOptionRefId = paymentOptionRefId
            trxn.paymentFeeTypeRefId = paymentFeeTypeRefId;
            trxn.divisionId = divisionId;
            trxn.statusRefId = statusRefId
            trxn.stripeTransactionId = transferForMembershipFee ? transferForMembershipFee.id : null;
            trxn.referenceId = matchId;
            return trxn;
        } catch (error) {
            logger.error(`Exception occurred in updateTransaction ${error}`);
            //throw error;
        }
    }

    private async createTransaction(transArr, paidBy, item) {
        try {
            if (isArrayPopulated(transArr)) {
                const entityManager = getManager();
                for (let tr of transArr) {
                    tr["paidBy"] = paidBy;
                    tr["invoiceRefId"] = item.invoiceRefId;
                    await entityManager.save(tr);
                }
            }
        } catch (error) {
            logger.error(`Exception occurred in createTransaction ${error}`);
        }
    }

    private async updateInvoiceStatus(inv: Invoice) {
        try {
            const entityManager = getManager();
            inv.paymentStatus = 'success';
            inv.updatedBy = inv.createdBy;
            inv.updatedOn = new Date();
            await entityManager.save(inv);
        } catch (error) {
            throw error;
        }
    }

    private async findMailObj(id) {
        try {
            const entityManager = getManager();
            let mailObj = await entityManager.query(`select * from wsa_common.communicationTemplate where id = ? `, [id]);

            return mailObj[0];
        } catch (error) {
            throw error;
        }
    }

    private async getUserById(userId) {
        try {
            const entityManager = getManager();
            let user = await entityManager.query(` select * from wsa_users.user u where u.id = ? and u.isDeleted = 0  `, [userId]);

            return user[0];
        } catch (error) {
            throw error;
        }
    }

    public async sendPerMatchMail(item, templateObj, amount) {
        try {
            let url = '#';
            let subject = templateObj.emailSubject;
            let userInfo = await this.getUserById(item.userId)
            // let today = new Date();
            // let responseDate = moment(today).tz("Australia/Sydney").format('DD/MM/YYYY');
            templateObj.emailBody = templateObj.emailBody.replace(AppConstants.name, userInfo.firstName + ' ' + userInfo.lastName);
            if (item.teamName != null) {
                templateObj.emailBody = templateObj.emailBody.replace(AppConstants.teamName, item.teamName);
            }
            templateObj.emailBody = templateObj.emailBody.replace(AppConstants.amount, '$' + amount);
            templateObj.emailBody = templateObj.emailBody.replace(AppConstants.affiliateName, item.organisationName);
            templateObj.emailBody = templateObj.emailBody.replace(AppConstants.competionName, item.competitionName);

            templateObj.emailBody = templateObj.emailBody.replace(AppConstants.affiliateName, item.organisationName);
            templateObj.emailBody = templateObj.emailBody.replace(AppConstants.affiliateName, item.organisationName);

            const transporter = nodeMailer.createTransport({
                host: "smtp.gmail.com",
                port: 587,
                secure: false, // true for 465, false for other ports
                auth: {
                    user: process.env.MAIL_USERNAME, // generated ethereal user
                    pass: process.env.MAIL_PASSWORD // generated ethereal password
                },
                tls: {
                    // do not fail on invalid certs
                    rejectUnauthorized: false
                }
            });

            const targetEmail = userInfo.isInActive == 1 ? getParentEmail(userInfo.email) : userInfo.email;
            const mailOptions = {
                from: {
                    name: process.env.MAIL_FROM_NAME,
                    address: process.env.MAIL_FROM_ADDRESS
                },
                to: targetEmail,
                replyTo: "donotreply@worldsportaction.com",
                subject: subject,
                html: templateObj.emailBody
            };
            // if (fileName != null)
            //     mailOptions['attachments'] = [
            //         {
            //             filename: 'invoice.pdf', // <= Here: made sure file name match
            //             path: path.join(__dirname, '../../output/' + fileName), // <= Here
            //             contentType: 'application/pdf'
            //         }
            //     ]

            if (Number(process.env.SOURCE_MAIL) == 1) {
                mailOptions.html = ' To: ' + mailOptions.to + '<br><br>' + mailOptions.html
                mailOptions.to = process.env.TEMP_DEV_EMAIL
            }

            // let cTrack = new CommunicationTrack();
            console.log("email body:: " + templateObj.emailBody)
            // logger.info(`before - sendMail : mailOptions ${mailOptions}`);
            let cTrack = new CommunicationTrack()

            try {
                cTrack.id = 0;

                cTrack.communicationType = 7;
                //cTrack.contactNumber = userInfo.mobileNumber
                cTrack.entityId = item.invoiceId;
                cTrack.deliveryChannelRefId = 1;
                cTrack.emailId = userInfo.email;
                cTrack.userId = userInfo.id;
                cTrack.subject = subject;
                cTrack.content = templateObj.emailBody;
                cTrack.createdBy = userInfo.id;

                await transporter.sendMail(mailOptions, (err, info) => {
                    if (err) {
                        cTrack.statusRefId = 2;
                        logger.error(`At Match - send Mail : ${err},  ${userInfo.email}`);
                        // this.insertIntoCommunicationTrack(cTrack);
                        // Here i commented the below code as the caller is not handling the promise reject
                        // return Promise.reject(err);
                    } else {
                        cTrack.statusRefId = 1;
                        logger.info(`At Match - send Mail : Mail sent successfully,  ${userInfo.email}`);
                        // this.insertIntoCommunicationTrack(cTrack);
                    }
                    transporter.close();
                    return Promise.resolve();
                });

                //return cTrack
            } catch (error) {
                console.log('  error 1 Mail  ' + error)
                //cTrack.statusRefId = 2;
                // return cTrack;
            }
        } catch (error) {
            console.log('  error 2 Mail  ' + error)
            throw error;
        }
    }
}
