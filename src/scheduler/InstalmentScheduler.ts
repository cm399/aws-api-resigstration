import {
    isArrayPopulated,
    isNotNullAndUndefined,
    feeIsNull,
    isNullOrEmpty,
    formatFeeForStripe1,
    objectIsNotEmpty,
    formatPersonName,
    isNullOrUndefined,
    uuidv4,
    formatValue,
    isNullOrZero,
    isNegativeNumber,
    getParentEmail
} from "../utils/Utils";
import { BaseController } from "../controller/BaseController";
import { logger } from "../logger";
import Stripe from 'stripe';
import { Transaction } from "../models/registrations/Transaction";
import { Invoice } from "../models/registrations/Invoice";
import { getManager, EntityManager } from "typeorm";
import { Organisation } from "../models/security/Organisation";
import { json } from "body-parser";
import AppConstants from "../validation/AppConstants";
//import moment from 'moment';
import moment from 'moment-timezone'
import nodeMailer from "nodemailer";
import { CommunicationTrack } from "../models/common/CommunicationTrack";
import { CompetitionReg } from "../models/registrations/Competition";
import path from 'path'
import { OrganisationLogo } from "../models/security/OrganisationLogo";
import pdf from 'html-pdf'
import hummus from 'hummus';
import memoryStreams from 'memory-streams';
import fs from 'fs';
import { CompetitionDivision } from "../models/registrations/CompetitionDivision";
import { RegistrationStep, TransactionStatus } from "../enums/enums";

let stripe = null;

const cron = require("node-cron");

export class InstalmentScheduler extends BaseController {

    public async instalmentsSchedule() {
        try {
            stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2020-03-02' });
            await cron.schedule(
                "*/5 * * * * ",
                async () => {
                    let instalments = [];
                    await this.sleep();
                    instalments = await this.getInstalments();
                    await this.sleep();
                    instalments = await this.getInstalments();
                    console.log("::::::::::: Cron Job started to execute ::::::::::: 1");
                    if (isArrayPopulated(instalments)) {
                        let arr = await this.getTransactions(instalments);
                        await this.updateTransactionStatus(instalments);
                        if (isArrayPopulated(arr)) {
                            for (let item of arr) {
                                let compTemp = null;
                                let totalFee = 0;
                                try {
                                    if (isArrayPopulated(item.compParticipants)) {
                                        let account = await this.checkOrganisationStripeAccount(item);
                                        if ((!account.membershipStripeAccountIdError) &&
                                            (!account.competitionStripeAccountIdError) &&
                                            (!account.affiliateStripeAccountIdError)) {
                                            this.prepareNegativeTransaction(item);
                                            for (let comp of item.compParticipants) {
                                                compTemp = comp;
                                                if (comp.stripeSourceTransaction != null) {
                                                    let totalValue = feeIsNull(item.total.targetValue)
                                                    totalFee = totalValue
                                                    if (totalValue > 0) {
                                                        let invoice = await this.createInvoice(comp);
                                                        let paymentIntent = await this.getStripePaymentIntent(comp, totalValue, invoice, item);
                                                        await this.instalmentDateToDBTrack(item, comp.registrationId, invoice.id, comp.createdBy)
                                                        // if (comp.paymentType == AppConstants.directDebit) {
                                                        //     await this.instalmentDateToDBTrack(item, comp.registrationId, invoice.id, comp.createdBy)
                                                        // } else {
                                                            await this.updateInvoicePaymentIntent(invoice,paymentIntent);
                                                        console.log(`After Instalment Intent`);
                                                        if (isNotNullAndUndefined(paymentIntent) && (paymentIntent.status == AppConstants.succeeded || comp.paymentType == AppConstants.directDebit)) {
                                                            let transArr = await this.performStripeTransaction(comp, paymentIntent, invoice.id, totalValue, comp.paymentType);
                                                            await this.createTransaction(transArr, invoice.createdBy);
                                                            let registration = await this.getRegistration(comp.registrationId)
                                                            let invoiceData = await this.getInvoiceData(registration, item);
                                                            let fileName = await this.printTeamRegistrationInvoiceTemplate(invoiceData);
                                                            let futureInstalments = await this.findFutureInstalments(comp)
                                                            let currentInstalment = await this.findCurrentInstalments(comp)
                                                            let mailObj = null;
                                                            if (comp.paymentType != AppConstants.directDebit)
                                                                mailObj = await this.findMailObj(15)
                                                            else {
                                                                mailObj = await this.findMailObj(21)
                                                                fileName = null;
                                                            }

                                                            await this.sendInstalmentMail(fileName, comp, mailObj, futureInstalments, currentInstalment, 1)

                                                            if (comp.paymentType != AppConstants.directDebit) {
                                                                await this.updateInvoiceStatus(invoice)
                                                            }

                                                            console.log(`Successful Instalment`);
                                                            // }
                                                        }
                                                    }
                                                }
                                            }
                                        } else {
                                            logger.error(`Exception occurred in Instalment schedule1`);
                                            // Failure mail
                                            let mailObj = await this.findMailObj(16)
                                            let futureInstalments = await this.findFutureInstalments(compTemp)
                                            await this.sendInstalmentMail(null, item, mailObj, futureInstalments, totalFee, 0)
                                        }
                                    }
                                } catch (error) {
                                    logger.error(`Exception occurred in Instalment schedule ${error}`);
                                    // Failure mail
                                    let mailObj = await this.findMailObj(16)
                                    let futureInstalments = await this.findFutureInstalments(compTemp)
                                    await this.sendInstalmentMail(null, item, mailObj, futureInstalments, totalFee, 0)
                                }
                            }
                        }
                    }
                },
                {
                    timeZone: 'Australia/Sydney'
                }
            )
        } catch (error) {
            logger.error(`Exception occurred in Instalment schedule1 ${error}`);

            //Failure mail
            // let  mailObj = await this.findMailObj(16)
            // await this.sendInstalmentMail(invoice, item, mailObj , futureInstalments, totalFee)
        }
    }

    public async sleep() {
        let ms = (Math.floor(Math.random() * 60) + 1) * 1000;
        return new Promise((resolve) => {
            setTimeout(resolve, ms);
        });
    }

    private async getTransactions(instalments) {
        try {
            console.log("getTransactions entry");
            let iMap = new Map();
            let mMap = new Map();
            let arr = [];
            let nomineesInstalmentList = instalments.filter(x => x.feeType == "nomination");
            for (let item of instalments) {
                let key = ''
                if (item.teamId == null) {
                    key = item.registrationId + "#" + item.invoiceRefId + "#" + 'p' + '#' + item.participantId + "#" + item.competitionId + "#" + item.membershipProductMappingId;
                    if (item.divisionId != null)
                        key += '#' + item.divisionId;
                } else {
                    key = item.registrationId + "#" + item.invoiceRefId + "#" + 't' + '#' + item.teamId + "#" + item.competitionId + "#" + item.membershipProductMappingId;
                }

                let instalmentData = iMap.get(key);
                let memData = mMap.get(key);
                let gst = feeIsNull(item.gstAmount);
                let fee = feeIsNull(item.feeAmount);
                let discountAmount = feeIsNull(item.discountAmount);
                let familyDiscountAmount = feeIsNull(item.familyDiscountAmount);
                let nomineesObj = nomineesInstalmentList.find(x => x.competitionId == item.competitionId && x.organisationId == item.organisationId
                    && x.invoiceRefId == item.invoiceRefId && x.membershipProductMappingId == item.membershipProductMappingId && (x.divisionId != null ? x.divisionId == item.divisionId : 1))

                let nomineeGst = 0;
                let nomineeFee = 0;
                if (nomineesObj != undefined) {
                    nomineeGst = feeIsNull(nomineesObj.gstAmount);
                    nomineeFee = feeIsNull(nomineesObj.feeAmount);
                }

                let feeObj = {
                    "name": item.orgName,
                    "emailId": item.orgEmail,
                    "phoneNo": item.orgPhoneNumber,
                    "feesToPay": fee,
                    "feesToPayGST": gst,
                    "organisationId": item.organisationUniqueKey,
                    "discountsToDeduct": discountAmount,
                    "membershipMappingId": item.membershipProductMappingId,
                    "childDiscountsToDeduct": familyDiscountAmount,
                    "nominationTransId": nomineesObj == undefined ? null : nomineesObj.id,
                    "nominationGSTToPay": nomineeGst,
                    "nominationFeeToPay": nomineeFee,
                    "orgId": item.organisationId
                }

                if (instalmentData == undefined) {
                    let totalValue = gst + fee - discountAmount - familyDiscountAmount;
                    let transactionFee = 0;
                    let transactionsArray = []
                    let finalObj = {
                        "total": {
                            "gst": gst,
                            "shipping": 0,
                            "subTotal": fee - discountAmount - familyDiscountAmount,
                            "total": totalValue,
                            "transactionFee": transactionFee,
                            "targetValue": totalValue + transactionFee,
                            "charityValue": 0
                        },
                        "compParticipants": [],
                    }

                    let compParticipantObj = {
                        "email": item.email,
                        "userId": item.participantId,
                        "lastName": item.lastName,
                        "firstName": item.firstName,
                        "mobileNumber": item.mobileNumber,
                        "competitionId": item.competitionId,
                        "competitionUniqueKey": item.competitionUniqueKey,
                        "competitionName": item.compName,
                        "startDate": item.startdate,
                        "organisationId": item.organisationId,
                        "organisationName": item.orgName,
                        "divisionName": item.divisionName,
                        "divisionId": item.divisionId,
                        "teamName": item.teamName,
                        "membershipTypeName": item.membershipTypeName,
                        "membershipMappingId": item.membershipProductMappingId,
                        "stripeSourceTransaction": item.stripeSourceTransaction,
                        "paymentType": item.paymentType,
                        "selectedOptions": {
                            "paymentOptionRefId": item.paymentOptionRefId,
                            "isHardshipCodeApplied": 0
                        },
                        "userRegistrationId": item.userRegistrationId,
                        "registrationUniqueKey": item.registrationUniqueKey,
                        "createdBy": item.createdBy,
                        "paidBy": item.paidBy,
                        "registrationId": item.registrationId,
                        "membershipProducts": [],
                        "negativeTransactions": []
                    }
                    finalObj.compParticipants.push(compParticipantObj);
                    let feesObj = {
                        "feesToPay": fee + gst,
                        "discountsToDeduct": discountAmount,
                        "childDiscountsToDeduct": familyDiscountAmount,
                        "membershipMappingId": item.membershipProductMappingId,
                        "membershipTypeName": item.membershipTypeName,
                        "transactions": [],
                        "divisionId": item.divisionId,
                        "fees": {
                            "affiliateFee": null,
                            "membershipFee": null,
                            "competitionOrganisorFee": null
                        }
                    }
                    feesObj.transactions.push(item.id);

                    compParticipantObj.membershipProducts.push(feesObj);

                    if (item.feeType == "membership") {
                        feesObj.fees.membershipFee = feeObj
                    } else if (item.feeType == "competition") {
                        feesObj.fees.competitionOrganisorFee = feeObj
                    } else if (item.feeType == "affiliate") {
                        feesObj.fees.affiliateFee = feeObj;
                    }

                    iMap.set(key, finalObj);
                    mMap.set(key, feesObj);
                    arr.push(finalObj);
                } else {
                    if (memData != undefined) {
                        memData.feesToPay = feeIsNull(memData.feesToPay) + fee + gst;
                        memData.transactions.push(item.id);
                        memData.discountsToDeduct = feeIsNull(memData.discountsToDeduct) + discountAmount;
                        memData.childDiscountsToDeduct = feeIsNull(memData.childDiscountsToDeduct) + familyDiscountAmount;
                        // if (item.feeType == "membership") {
                        //     memData.fees.membershipFee = feeObj
                        // }
                        // else
                        if (item.feeType == "competition") {
                            if (memData.fees.competitionOrganisorFee) {
                                memData.fees.competitionOrganisorFee.feesToPay = memData.fees.competitionOrganisorFee.feesToPay + feeIsNull(fee),
                                    memData.fees.competitionOrganisorFee.feesToPayGST = memData.fees.competitionOrganisorFee.feesToPayGST + feeIsNull(gst)
                            } else {
                                memData.fees.competitionOrganisorFee = feeObj
                            }
                        } else if (item.feeType == "affiliate") {
                            if (memData.fees.affiliateFee) {
                                memData.fees.affiliateFee.feesToPay = memData.fees.affiliateFee.feesToPay + feeIsNull(fee),
                                    memData.fees.affiliateFee.feesToPayGST = memData.fees.affiliateFee.feesToPayGST + feeIsNull(gst)
                            } else {
                                memData.fees.affiliateFee = feeObj
                            }
                        }

                        instalmentData.total.gst = feeIsNull(instalmentData.total.gst) + gst;
                        instalmentData.total.subTotal = feeIsNull(instalmentData.total.subTotal) + (fee - discountAmount - familyDiscountAmount);
                        instalmentData.total.targetValue = feeIsNull(instalmentData.total.targetValue) + (gst + fee - discountAmount - familyDiscountAmount);
                    }
                }
            }

            if (isArrayPopulated(arr)) {
                for (let a of arr) {
                    a.total.targetValue = formatValue(a.total.targetValue);
                }
            }
            return arr;
        } catch (error) {
            logger.error(`Exception occurred in getTransactions ${error}`);
        }
    }

    private prepareNegativeTransaction(item) {
        try {
            console.log("prepareNegativeTransaction");
            for (let comp of item.compParticipants) {
                for (let mem of comp.membershipProducts) {
                    const compOrgData = isNotNullAndUndefined(mem.fees.competitionOrganisorFee) ? mem.fees.competitionOrganisorFee : Object.assign({});
                    const affiliateData = isNotNullAndUndefined(mem.fees.affiliateFee) ? mem.fees.affiliateFee : Object.assign({});
                    const compOrgDataJson = JSON.stringify(compOrgData);
                    console.log("prepareNegativeTransaction1");
                    if (objectIsNotEmpty(affiliateData)) {
                        let aFeeToPay = affiliateData.feesToPay;
                        let aFeeToPayGst = affiliateData.feesToPayGST;
                        let aNomFee = affiliateData.nominationFeeToPay;
                        let aNomGst = affiliateData.nominationGSTToPay;

                        console.log("prepareNegativeTransaction2" + aFeeToPay + "aFeeToPayGst::" + aFeeToPayGst);

                        let totalAffNegativeVal = this.calculateTotalSourceNegativeVal(affiliateData);
                        let obj = {
                            totalNegativeValPaid: 0
                        }

                        if (isNegativeNumber(aFeeToPay) || isNegativeNumber(aFeeToPayGst) ||
                            isNegativeNumber(aNomFee) || isNegativeNumber(aNomGst)) {
                            let fee = this.calculateNegativeFee(affiliateData, "feesToPay", compOrgData, compOrgDataJson, obj);
                            let gst = this.calculateNegativeFee(affiliateData, "feesToPayGST", compOrgData, compOrgDataJson, obj);
                            let nomFee = this.calculateNegativeFee(affiliateData, "nominationFeeToPay", compOrgData, compOrgDataJson, obj);
                            let nomGst = this.calculateNegativeFee(affiliateData, "feenominationGSTToPaysToPayGST", compOrgData, compOrgDataJson, obj);

                            console.log("prepareNegativeTransaction3::" + fee + "gst::" + gst);

                            if (isNegativeNumber(aFeeToPay)) {
                                aFeeToPay = fee;
                            } else {
                                aFeeToPay = 0;
                            }

                            if (isNegativeNumber(aFeeToPayGst)) {
                                aFeeToPayGst = gst;
                            } else {
                                aFeeToPayGst = 0;
                            }

                            if (isNegativeNumber(aNomFee)) {
                                aNomFee = nomFee;
                            } else {
                                aNomFee = 0;
                            }

                            if (isNegativeNumber(aNomGst)) {
                                aNomGst = nomGst;
                            } else {
                                aNomGst = 0;
                            }

                            let transaction = this.createNegativeTransaction(mem, AppConstants.affiliate, aFeeToPay, aFeeToPayGst, aNomFee, aNomGst, compOrgData.orgId, item, affiliateData.orgId);
                            console.log("Neg::: transaction" + JSON.stringify(transaction));
                            comp.negativeTransactions.push(transaction);
                        }
                    }
                }
            }
        } catch (error) {
            logger.error(`Exception occurred in updateNegativeTransaction ${error}`);
        }
    }

    private calculateTotalSourceNegativeVal(fee) {
        let total = 0;
        total += isNegativeNumber(fee.feesToPay) ? fee.feesToPay : 0;
        total += isNegativeNumber(fee.feesToPayGST) ? fee.feesToPayGST : 0;
        total += isNegativeNumber(fee.nominationFeeToPay) ? fee.nominationFeeToPay : 0;
        total += isNegativeNumber(fee.nominationGSTToPay) ? fee.nominationGSTToPay : 0;

        return total;
    }

    private calculateNegativeFee(feeObj1, key, feeObj2, feeObj3, obj) {
        try {
            let totalFeesToPay = 0;
            let negativeFees = feeIsNull(feeObj1[key]);
            if (isNegativeNumber(negativeFees)) {
                if (objectIsNotEmpty(feeObj2)) {
                    let appliedFee = feeObj2[key] + negativeFees;
                    if (isNegativeNumber(appliedFee)) {
                        obj.totalNegativeValPaid += feeIsNull(feeObj2[key]);
                        negativeFees = feeObj2[key];
                        feeObj2[key] = 0;
                        feeObj1[key] = negativeFees;
                    } else {
                        obj.totalNegativeValPaid += feeIsNull(negativeFees);
                        feeObj2[key] = feeIsNull(appliedFee);
                        feeObj1[key] = negativeFees;
                    }
                }
            }

            return isNegativeNumber(negativeFees) ? negativeFees * -1 : negativeFees;
        } catch (error) {
            logger.error(`Exception occurred in calculateNegativeFee ${error}`);
            throw error;
        }
    }

    private createNegativeTransaction(mem, feeType, feeAmt, gstAmt, nominationFee, nominationGST, organisationId, item, sourceOrgId) {
        try {
            let trxn = {
                firstName: mem.firstName,
                lastName: mem.lastName,
                mobileNumber: mem.mobileNumber,
                email: mem.email,
                feeAmount: feeAmt,
                gstAmount: gstAmt,
                discountAmount: 0,
                feeType: feeType,
                membershipProductMappingId: mem.membershipMappingId,
                competitionId: item.competitionId,
                organisationId: organisationId,
                divisionId: mem.divisionId,
                nominationFeeToPay: nominationFee,
                nominationGSTToPay: nominationGST,
                sourceOrgId: sourceOrgId,
                membershipTypeName: mem.membershipTypeName
            }

            return trxn;
        } catch (error) {
            logger.error(`Exception occurred in createNegativeTransaction ${error}`);
        }
    }

    private async performOnBehalfOfTransaction(item, mem) {
        try {
            if (isArrayPopulated(item.negativeTransactions)) {
                console.log("Inside the performOnBehalfOfTransaction" + JSON.stringify(item.negativeTransactions));
                for (let neg of item.negativeTransactions) {
                    let onBehalfOf = await this.onBehalfOfData(item, mem, neg.sourceOrgId, neg.organisationId);
                    console.log("onBehalfOf::" + JSON.stringify(onBehalfOf));
                    let amount = feeIsNull(neg.feeAmount) + feeIsNull(neg.gstAmount);
                    const STRIPE_TOTAL_FEE = formatFeeForStripe1(amount);
                    console.log("performTransactionOnBehalfOf :: STRIPE_TOTAL_FEE" + STRIPE_TOTAL_FEE);

                    if (onBehalfOf.becsMandateId != null && onBehalfOf.sourceOrgCustId != null && onBehalfOf.targetOrgAccId != null && STRIPE_TOTAL_FEE >= 1) {
                        await this.transferOnBehalfOf(STRIPE_TOTAL_FEE, onBehalfOf.sourceOrgCustId, onBehalfOf.becsMandateId, onBehalfOf.targetOrgAccId, onBehalfOf.description);
                    }
                }
            }
        } catch (error) {
            logger.error(`Exception occurred in performOnBehalfOfTransaction ${error} `);
        }
    }

    private async onBehalfOfData(item, mem, sourceOrgId, targetOrgId) {
        try {
            console.log("sourceOrgId" + sourceOrgId + "targetOrgId::" + targetOrgId);
            let obj = {
                sourceOrgId: sourceOrgId,
                targetOrgId: targetOrgId,
                description: null,
                sourceOrgCustId: null,
                becsMandateId: null,
                targetOrgAccId: null
            }

            if (obj.sourceOrgId != null && obj.targetOrgId != null) {
                let sourceOrg = await this.findOrganisationById(obj.sourceOrgId);
                let targetOrg = await this.findOrganisationById(obj.targetOrgId);
                const orgName = targetOrg.name;
                const playerName = formatPersonName(item.firstName, null, item.lastName);
                const membershipProductTypeName_ = mem.membershipTypeName;
                obj.description = `${playerName} - ${membershipProductTypeName_} - ${orgName} - NEGATIVE FEE`;
                console.log("Negative Fee Desc" + obj.description);
                obj.sourceOrgCustId = sourceOrg ? sourceOrg.stripeCustomerAccountId : null;
                obj.becsMandateId = sourceOrg ? sourceOrg.stripeBecsMandateId : null;
                obj.targetOrgAccId = targetOrg ? targetOrg.stripeAccountID : null;
                console.log("Negative Fee to Pay :: becsMandateId:" + obj.becsMandateId + "sourceOrgCustId:" + obj.sourceOrgCustId);
            }

            return obj;
        } catch (error) {
            logger.error(`Exception occurred in onBehalfOfHandling ${error} `);
        }
    }

    public async transferOnBehalfOf(STRIPE_TOTAL_FEE, sourceOrgCustId, becsMandateId, targetOrgAccId, description) {
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
            });

            console.log("Negative Payment Intent" + JSON.stringify(paymentIntent));

            return paymentIntent;

        } catch (error) {
            logger.error(`Exception occurred in transferOnBehalfOf ${error} `);
            throw error;
        }
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
            invoice.receiptId = receiptId.toString();
            invoice.createdBy = item.createdBy;
            //let invoiceRes = await this.invoiceService.createOrUpdate(invoice);
            let invoiceRes = await entityManager.save(invoice)
            return invoiceRes;
        } catch (error) {
            logger.error(`Exception occurred in createInvoice Instalment :: ${error}`);
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
                            const membershipData = isNotNullAndUndefined(k.fees.membershipFee) ? k.fees.membershipFee : Object.assign({});
                            const compOrgData = isNotNullAndUndefined(k.fees.competitionOrganisorFee) ? k.fees.competitionOrganisorFee : Object.assign({});
                            const affiliateData = isNotNullAndUndefined(k.fees.affiliateFee) ? k.fees.affiliateFee : Object.assign({});

                            if (objectIsNotEmpty(membershipData) || objectIsNotEmpty(compOrgData) || objectIsNotEmpty(affiliateData)) {
                                if (objectIsNotEmpty(membershipData)) {
                                    console.log("membershipData IS NOT EMPTY ");
                                    let mOrgData = await this.findOrganisationByUniqueKey(membershipData.organisationId);
                                    //console.log("ORGANISATION ID PRESENT :: "+JSON.stringify(mOrgData));
                                    let mStripeAccountId = null;
                                    if (!isArrayPopulated(mOrgData)) {
                                        //  console.log("mOrgData IS NOT EMPTY ");
                                        mStripeAccountId = mOrgData.stripeAccountID;
                                        membershipData["organisationAccountId"] = mStripeAccountId;
                                    }
                                    if (mStripeAccountId === null) {
                                        // console.log("mOrgData IS EMPTY ");
                                        obj.membershipStripeAccountIdError = true;
                                        break;
                                    }
                                }

                                if (objectIsNotEmpty(compOrgData)) {
                                    // console.log("compOrgData IS NOT EMPTY ");
                                    let cOrgData = await this.findOrganisationByUniqueKey(compOrgData.organisationId);
                                    let cStripeAccountId = null;
                                    if (!isArrayPopulated(cOrgData)) {
                                        // console.log("cOrgData IS NOT EMPTY ");
                                        cStripeAccountId = cOrgData.stripeAccountID;
                                        compOrgData["organisationAccountId"] = cStripeAccountId;
                                    }

                                    if (cStripeAccountId === null) {
                                        // console.log("cOrgData IS EMPTY ");
                                        obj.competitionStripeAccountIdError = true;
                                        break;
                                    }
                                }

                                if (objectIsNotEmpty(affiliateData)) {
                                    // console.log("affiliateData IS NOT EMPTY ");
                                    let aOrgData = await this.findOrganisationByUniqueKey(affiliateData.organisationId);
                                    let aStripeAccountId = null;
                                    if (!isArrayPopulated(aOrgData)) {
                                        // console.log("aOrgData IS NOT EMPTY ");
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

    private async updateTransactionStatus(instalments: any) {
        try {
            if (isArrayPopulated(instalments)) {
                for (let item of instalments) {
                    const entityManager = getManager();
                    let trans = new Transaction();
                    trans.id = item.id;
                    trans.statusRefId = AppConstants.PROCESSING;
                    trans.updatedOn = new Date();
                    await entityManager.save(trans);
                }
            }
        } catch (error) {
            logger.error(`Exception occurred in updateTransactionStatus ${error}`);
            //throw error;
        }
    }

    private async performStripeTransaction(item, paymentIntent, invoiceId, totalFee, paymentType) {
        try {
            console.log("Perform Stripe Transaction Entry ");
            const CURRENCY_TYPE: string = "aud";
            let transArr = [];
            let statusRefId = this.getTransactionStatusDD(paymentType);

            if (isArrayPopulated(item.membershipProducts)) {
                let paymentOptionRefId = item.selectedOptions.paymentOptionRefId;
                let paymentFeeTypeRefId = this.getPaymentFeeTypeRefId(paymentOptionRefId);
                let registeringOrgName = item['organisationName'];

                for (let mem of item.membershipProducts) {
                    const membershipData = isNotNullAndUndefined(mem.fees.membershipFee) ? mem.fees.membershipFee : Object.assign({});
                    const compOrgData = isNotNullAndUndefined(mem.fees.competitionOrganisorFee) ? mem.fees.competitionOrganisorFee : Object.assign({});
                    const affiliateData = isNotNullAndUndefined(mem.fees.affiliateFee) ? mem.fees.affiliateFee : Object.assign({});

                    const competitionOrganiserOrganisationName_: string = compOrgData['name'];
                    const playerName_: string = formatPersonName(item.firstName, null, item.lastName);
                    const competitionId_ = await this.findByCompUniquekey(item.competitionUniqueKey);

                    const membershipProductTypeName_ = mem.membershipTypeName;
                    const membershipMappingId_ = mem.membershipMappingId;
                    let compDivisionDb = await this.findDivisionByCmpd(mem.divisionId)
                    const divisionId_ = compDivisionDb != undefined ? compDivisionDb.id : 0;

                    if (objectIsNotEmpty(membershipData)) {
                        const membershipProductOrganisationName_: string = `${membershipData['name']}`;
                        const membershipProductTypeTotalAmount_ = feeIsNull(membershipData.feesToPay) +
                            feeIsNull(membershipData.feesToPayGST) -
                            feeIsNull(membershipData.discountsToDeduct) -
                            feeIsNull(membershipData.childDiscountsToDeduct);
                        const membershipProductTypeFeeAmount_ = feeIsNull(membershipData.feesToPay);
                        const membershipProductTypeGstAmount_ = feeIsNull(membershipData.feesToPayGST);
                        const membershipProductTypeDiscountAmount_ = feeIsNull(membershipData.discountsToDeduct);
                        const membershipProductFamilyDiscountAmount_ = feeIsNull(membershipData.childDiscountsToDeduct);
                        const STRIPE_MEMBERSHIP_TOTAL_FEE = formatFeeForStripe1(membershipProductTypeTotalAmount_);

                        const membershipOrganisationAccountId_ = membershipData.organisationAccountId;

                        let membershipOrganisation_: Organisation = await this.findOrganisationByUniqueKey(membershipData.organisationId);

                        let membershipOrganisationId_: number = membershipOrganisation_.id
                        // transfer for membershipFees
                        console.log('going to pay a total of ' + membershipProductTypeTotalAmount_ + ' to ' + membershipProductOrganisationName_ + ' as membershipFee')

                        console.log("paymentIntent.id::" + paymentIntent.id + "@@@" + paymentIntent.charges.data.length);
                        if (STRIPE_MEMBERSHIP_TOTAL_FEE >= 1) {
                            let transferForMembershipFee = null;
                            if (paymentType != AppConstants.directDebit) {
                                transferForMembershipFee = await stripe.transfers.create({
                                    amount: STRIPE_MEMBERSHIP_TOTAL_FEE,
                                    currency: CURRENCY_TYPE,
                                    description: `${playerName_} - ${membershipProductTypeName_} - ${membershipProductOrganisationName_} - ${registeringOrgName} - MEMBERSHIP FEE`,
                                    source_transaction: paymentIntent.charges.data.length > 0 ? paymentIntent.charges.data[0].id : paymentIntent.id,
                                    destination: membershipOrganisationAccountId_,
                                    //transfer_group: transferGroup
                                });
                            }

                            console.log('transferForMembershipFee :::: ', transferForMembershipFee);

                            let trxns = await this.updateTransaction(invoiceId, mem.transactions, paymentOptionRefId,
                                paymentFeeTypeRefId, divisionId_, transferForMembershipFee, statusRefId)

                            transArr = [...transArr, ...trxns]
                            //await this.transactionService.createOrUpdate(trxnMembership);
                        }
                    }

                    if (objectIsNotEmpty(compOrgData)) {
                        const competitionTotalAmount_: number = feeIsNull(compOrgData.feesToPay) +
                            feeIsNull(compOrgData.feesToPayGST) -
                            feeIsNull(compOrgData.discountsToDeduct) -
                            feeIsNull(compOrgData.childDiscountsToDeduct);
                        const competitionFeeAmount_: number = feeIsNull(compOrgData.feesToPay);
                        const competitionGstAmount_: number = feeIsNull(compOrgData.feesToPayGST);
                        const competitionDiscountAmount_: number = feeIsNull(compOrgData.discountsToDeduct);
                        const competitionFamilyDiscountAmount_: number = feeIsNull(compOrgData.childDiscountsToDeduct);
                        const competitionNominationFeeAmount_: number = feeIsNull(compOrgData.nominationFeeToPay);
                        const competitionNominationGstAmount_: number = feeIsNull(compOrgData.nominationGSTToPay);
                        const STRIPE_COMPETITION_TOTAL_FEE = formatFeeForStripe1(competitionTotalAmount_);

                        const cOrganisationAccountId_: string = compOrgData.organisationAccountId;
                        const cOrganisation_: Organisation = await this.findOrganisationByUniqueKey(compOrgData.organisationId);
                        const cOrganisationId_: number = cOrganisation_.id;
                        console.log('going to pay a total of ' + competitionTotalAmount_ + ' to ' + competitionOrganiserOrganisationName_ + ' as Competition Fee')

                        // transfer to association for organiser fees
                        if (STRIPE_COMPETITION_TOTAL_FEE >= 1) {
                            let transferForCompetitionOrganiser = null;
                            if (paymentType != AppConstants.directDebit) {
                                transferForCompetitionOrganiser = await stripe.transfers.create({
                                    amount: STRIPE_COMPETITION_TOTAL_FEE,
                                    currency: CURRENCY_TYPE,
                                    description: `${playerName_} - ${membershipProductTypeName_} - ${competitionOrganiserOrganisationName_} - ${registeringOrgName} - COMPETITION FEE`,
                                    destination: cOrganisationAccountId_,
                                    source_transaction: paymentIntent.charges.data.length > 0 ? paymentIntent.charges.data[0].id : paymentIntent.id,
                                    //transfer_group: transferGroup
                                });
                            }

                            // console.log('transferForCompetitionOrganiser :::: ', transferForCompetitionOrganiser)

                            let trxn = await this.updateTransaction(invoiceId, mem.transactions, paymentOptionRefId,
                                paymentFeeTypeRefId, divisionId_, transferForCompetitionOrganiser, statusRefId)

                            transArr.push(trxn);
                            if (!isNullOrZero(competitionNominationFeeAmount_) || !isNullOrZero(competitionNominationGstAmount_)) {
                                const nominationTotalAmount_: number = competitionNominationFeeAmount_ +
                                    competitionNominationGstAmount_;
                                const STRIPE_NOMINATION_TOTAL_FEE = formatFeeForStripe1(nominationTotalAmount_);
                                if (STRIPE_NOMINATION_TOTAL_FEE >= 1) {
                                    let transferForCompetitionOrganiser = null;
                                    if (paymentType != AppConstants.directDebit) {
                                        transferForCompetitionOrganiser = await stripe.transfers.create({
                                            amount: STRIPE_NOMINATION_TOTAL_FEE,
                                            currency: CURRENCY_TYPE,
                                            description: `${playerName_} - ${membershipProductTypeName_} - ${competitionOrganiserOrganisationName_} - ${registeringOrgName} - NOMINATION FEE`,
                                            destination: cOrganisationAccountId_,
                                            source_transaction: paymentIntent.charges.data.length > 0 ? paymentIntent.charges.data[0].id : paymentIntent.id,
                                            // transfer_group: transferGroup
                                        });
                                    }
                                    let trxn = await this.updateTransaction(invoiceId, compOrgData.nominationTransId, paymentOptionRefId, paymentFeeTypeRefId, divisionId_, transferForCompetitionOrganiser, statusRefId)
                                    transArr.push(trxn);
                                    console.log('transferForCompetitionOrganiser Nomination :::: ', transferForCompetitionOrganiser)
                                }
                            }
                        }
                    }

                    if (objectIsNotEmpty(affiliateData)) {
                        let affiliateTotalAmount_: number = feeIsNull(affiliateData.feesToPay) +
                            feeIsNull(affiliateData.feesToPayGST) -
                            feeIsNull(affiliateData.discountsToDeduct) -
                            feeIsNull(affiliateData.childDiscountsToDeduct);
                        let affiliateFeeAmount_: number = feeIsNull(affiliateData.feesToPay);
                        let affiliateGstAmount_: number = feeIsNull(affiliateData.feesToPayGST);
                        let affiliateDiscountAmount_: number = feeIsNull(affiliateData.discountsToDeduct);
                        let affiliateFamilyDiscountAmount_: number = feeIsNull(affiliateData.childDiscountsToDeduct);
                        const affiliateNominationFeeAmount_: number = feeIsNull(affiliateData.nominationFeeToPay);
                        const affiliateNominationGstAmount_: number = feeIsNull(affiliateData.nominationGSTToPay);
                        const STRIPE_AFFILIATE_TOTAL_AMOUNT = formatFeeForStripe1(affiliateTotalAmount_);

                        let aOrganisation_: Organisation = await this.findOrganisationByUniqueKey(affiliateData.organisationId);
                        let aOrganisationId_: number = aOrganisation_.id;
                        let aOrganisationAccountId_: string = affiliateData.organisationAccountId;
                        const affiliateOrganisationName_: string = affiliateData.name;

                        console.log('going to pay a total of ' + affiliateTotalAmount_ + +' to ' + affiliateOrganisationName_ + ' as Affiliate Fee')

                        // transfer for affiliateFees
                        if (STRIPE_AFFILIATE_TOTAL_AMOUNT >= 1) {
                            let transferForAffiliateFee = null;
                            if (paymentType != AppConstants.directDebit) {
                                transferForAffiliateFee = await stripe.transfers.create({
                                    amount: STRIPE_AFFILIATE_TOTAL_AMOUNT,
                                    description: `${playerName_}  - ${membershipProductTypeName_}  - ${affiliateOrganisationName_} - ${registeringOrgName} - AFFILIATE FEE`,
                                    currency: CURRENCY_TYPE,
                                    destination: aOrganisationAccountId_,
                                    source_transaction: paymentIntent.charges.data.length > 0 ? paymentIntent.charges.data[0].id : paymentIntent.id,
                                    // transfer_group: transferGroup
                                });
                            }

                            // console.log('transferForAffiliateFee :::: ', transferForAffiliateFee)
                            let trxns = await this.updateTransaction(invoiceId, mem.transactions, paymentOptionRefId,
                                paymentFeeTypeRefId, divisionId_, transferForAffiliateFee, statusRefId)

                            transArr = [...transArr, ...trxns]

                            if (!isNullOrZero(affiliateNominationFeeAmount_) || !isNullOrZero(affiliateNominationGstAmount_)) {
                                const nominationTotalAmount_: number = affiliateNominationFeeAmount_ +
                                    affiliateNominationGstAmount_;
                                const STRIPE_NOMINATION_TOTAL_FEE = formatFeeForStripe1(nominationTotalAmount_);
                                if (STRIPE_NOMINATION_TOTAL_FEE >= 1) {
                                    let transferForAffiliateFee = null;
                                    if (paymentType != AppConstants.directDebit) {
                                        transferForAffiliateFee = await stripe.transfers.create({
                                            amount: STRIPE_NOMINATION_TOTAL_FEE,
                                            currency: CURRENCY_TYPE,
                                            description: `${playerName_} - ${membershipProductTypeName_} - ${affiliateOrganisationName_} - ${registeringOrgName} - NOMINATION FEE`,
                                            destination: aOrganisationAccountId_,
                                            source_transaction: paymentIntent.charges.data.length > 0 ? paymentIntent.charges.data[0].id : paymentIntent.id,
                                            //transfer_group: transferGroup
                                        });
                                    }

                                    console.log('transferForAffiliateFee Nomination :::: ', transferForAffiliateFee)
                                    let trxn = await this.updateTransaction(invoiceId, affiliateData.nominationTransId, paymentOptionRefId,
                                        paymentFeeTypeRefId, divisionId_, transferForAffiliateFee, statusRefId)

                                    transArr.push(trxn);
                                }
                            }
                        }

                    }

                    // Negative Transaction
                    this.performOnBehalfOfTransaction(item, mem);
                }
            }
            return transArr;
        } catch (error) {
            //Failure mail
            let mailObj = await this.findMailObj(16)
            let futureInstalments = await this.findFutureInstalments(item)
            await this.sendInstalmentMail(null, item, mailObj, futureInstalments, totalFee, 0)
            logger.error(`Exception occurred in performStripeTransaction ${error}`);
        }
    }

    private getTransactionStatusDD(paymentType) {
        let statusRefId = AppConstants.PAID;
        if (paymentType == AppConstants.directDebit) {
            statusRefId = AppConstants.PROCESSING;
        }

        return statusRefId;
    }

    private getTotalFee(tran) {
        try {
            let totalFee = feeIsNull(tran.feeAmount) + feeIsNull(tran.gstAmount) - feeIsNull(tran.discountAmount) - feeIsNull(tran.familyDiscountAmount);

            return totalFee;
        } catch (error) {
            logger.error(`Exception occurred in getTotalFee ${error}`);
        }
    }

    private getPaymentFeeTypeRefId(paymentOptionRefId) {
        if (paymentOptionRefId <= 2) {
            return AppConstants.CASUAL_FEE;
        } else {
            return AppConstants.SEASONAL_FEE;
        }
    }

    // private async deleteInstalmentTransaction(instalmentArr, createdBy) {
    //     try {
    //         const entityManager = getManager();
    //         if (isArrayEmpty(instalmentArr)) {
    //             for (let tran of instalmentArr) {
    //                 let it = new InstalmentTransaction();
    //                 it.id = tran.instalmentId;
    //                 it.isDeleted = 1;
    //                 it.updatedBy = createdBy;
    //                 it.updatedOn = new Date();
    //                 await entityManager.save(it);
    //             }
    //         }
    //
    //         //  await this.instalmentTransactionService.createOrUpdate(it)
    //     } catch (error) {
    //         throw error;
    //     }
    // }

    private async updateInvoicePaymentIntent(inv: Invoice,paymentIntent){
        try{
            const entityManager = getManager();
            inv.stripeSourceTransaction = paymentIntent ? paymentIntent.id : null;
            // await this.invoiceService.createOrUpdate(inv)
            await entityManager.save(inv);
        }
        catch(error){
            logger.error(`Exception occurred in updateInvoicePaymentIntent ${error}`);
        }
    }

    private async updateInvoiceStatus(inv: Invoice) {
        try {
            const entityManager = getManager();
            inv.paymentStatus = 'success';
            inv.updatedBy = inv.createdBy;
            inv.updatedOn = new Date();
            // await this.invoiceService.createOrUpdate(inv)
            await entityManager.save(inv);
        } catch (error) {
            logger.error(`Exception occurred in updateInvoiceStatus ${error}`);
        }
    }

    private async createTransaction(transArr, paidBy) {
        try {
            const entityManager = getManager();
            if (isArrayPopulated(transArr)) {
                const entityManager = getManager();
                for (let item of transArr) {
                    item["paidBy"] = paidBy;
                    await entityManager.save(item);
                }
            }
        } catch (error) {
            logger.error(`Exception occurred in createTransaction ${error}`);
        }
    }

    async getStripePaymentIntent(item, totalFee, invoice, mainItem) {
        let PAYMENT_INTENT_ID = '';
        try {
            const CURRENCY_TYPE: string = "aud";
            let totalTargetValue = 0;
            console.log("getStripePaymentIntent1::" + totalFee + " item.stripeSourceTransaction" + item.stripeSourceTransaction);
            //let registration = await this.getRegistrationById(item.registrationId)
            const paymentIntent = await stripe.paymentIntents.retrieve(
                item.stripeSourceTransaction
                //chargeId
            );

            console.log("getStripePaymentIntent1::" + JSON.stringify(paymentIntent));

            let paymentIntentObject = Object.assign({});
            paymentIntentObject['customer'] = paymentIntent.customer;
            if (item.paymentType == "card") {
                paymentIntentObject['confirm'] = true;
                paymentIntentObject['setup_future_usage'] = "off_session";
                let transactionFee = await this.getTransactionFee(paymentIntent, item.paymentType, totalFee);
                mainItem.total.targetValue = feeIsNull(transactionFee) + feeIsNull(totalFee);
                mainItem.total.transactionFee = transactionFee;
                totalTargetValue = formatFeeForStripe1(feeIsNull(transactionFee) + feeIsNull(totalFee));
            }

            if (item.paymentType == "direct_debit") {
                paymentIntentObject["payment_method"] = paymentIntent.payment_method;
                paymentIntentObject['transfer_group'] = AppConstants.instalment + "#" + item.registrationUniqueKey + "#" + invoice.id;
                let transactionFee = await this.getTransactionFee(paymentIntent, item.paymentType, totalFee);
                mainItem.total.targetValue = feeIsNull(transactionFee) + feeIsNull(totalFee);
                mainItem.total.transactionFee = transactionFee;
                totalTargetValue = formatFeeForStripe1(feeIsNull(transactionFee) + feeIsNull(totalFee));
            }

            paymentIntentObject['confirm'] = true;
            paymentIntentObject['amount'] = totalTargetValue;
            paymentIntentObject['currency'] = CURRENCY_TYPE;
            paymentIntentObject['metadata'] = paymentIntent.metadata;
            paymentIntentObject['description'] = "Registration Payment";
            paymentIntentObject['confirmation_method'] = "automatic";
            paymentIntentObject['payment_method_types'] = ['card', 'au_becs_debit'];

            let newPaymentIntent = await stripe.paymentIntents.create(paymentIntentObject);
            logger.info(`***** paymentIntentObject+ ${JSON.stringify(newPaymentIntent)}`);
            PAYMENT_INTENT_ID = newPaymentIntent.id;

            const updateTransaction = await this.updateErrorMessageAndPaymentTypeWithTransaction(item.registrationId, item.paymentType, null, PAYMENT_INTENT_ID, item.userRegId, invoice);
            console.log('updateTransaction  :::: ', JSON.stringify(updateTransaction))

            return newPaymentIntent;
        } catch (error) {
            logger.error(`Error occurred in getStripePaymentIntent" ${error}`);

            await this.updateErrorMessageAndPaymentTypeWithTransaction(item.registrationId, item.paymentType, error.message, PAYMENT_INTENT_ID, item.userRegId, invoice);

            await this.updateFailedTransaction(item.membershipProducts)

            // throw error;
        }
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
            //throw error;
        }
    }

    private async updateErrorMessageAndPaymentTypeWithTransaction(
        registrationId: number, paymentType: string, error: string, stripeSourceTransaction: string, userRegId: number, invoice
    ) {
        let getInvoiceData = null;
        try {
            if (invoice) {
                const entityManager = getManager();
                const INVOICE_ID = invoice.id;
                const i = new Invoice();
                i.id = INVOICE_ID;
                i.registrationId = registrationId;
                i.userRegistrationId = userRegId;
                i.paymentType = isNotNullAndUndefined(paymentType) ? paymentType : undefined;
                i.stripeSourceTransaction = isNotNullAndUndefined(stripeSourceTransaction) ? stripeSourceTransaction : undefined;
                i.errorMessage = isNotNullAndUndefined(error) ? error : undefined;
                // await this.invoiceService.createOrUpdate(i);
                await entityManager.save(i);
            }
        } catch (error) {
            logger.error(`Exception occurred in updateErrorMessageAndPaymentTypeWithTransaction ${error}`);
        }
    }

    private async getInstalments() {
        try {
            const entityManager = getManager();
            // console.log("getInstalments entry");
            let instalments = await entityManager.query(`
            select DISTINCT 
                it.*, i.stripeSourceTransaction, i.paymentStatus, i.paymentType, i.registrationId, t.id as teamId, t.name as teamName,
                i.userRegistrationId,i.createdBy, u.firstName , u.lastName, u.email, u.mobileNumber, 
                o.name as orgName, c.name as compName, u.stripeCustomerAccountId, re.registrationUniqueKey , 
                cmp.id as competitionMembershipProductid, cmpd.divisionName, mpt.name as membershipTypeName, c.startDate,
                o.organisationUniqueKey, o.email as orgEmail, o.phoneNo as orgPhoneNumber, c.competitionUniqueKey
            from wsa_registrations.transactions it
            inner join wsa_registrations.invoice i 
                on i.id = it.invoiceRefId and i.isDeleted = 0
            inner join wsa_registrations.registration re 
                on re.id = i.registrationId and re.isDeleted = 0
            inner join wsa_registrations.orgRegistrationParticipant orgp 
                on orgp.registrationId = re.id and orgp.isDeleted = 0 
            inner join wsa_users.user u 
                on u.id = it.paidBy and u.isDeleted = 0
            inner join wsa_registrations.userRegistration ur 
                on ur.userId = it.participantId and ur.isDeleted = 0 and orgp.userRegistrationId = ur.id 
            left join wsa_competitions.team t 
                on ur.teamId = t.id and t.isDeleted = 0
            inner join wsa_users.organisation o 
                on o.id = it.organisationId and o.isDeleted = 0
            inner join wsa_registrations.competition c 
                on c.id = it.competitionId and c.isDeleted = 0
            inner join wsa_registrations.competitionMembershipProduct cmp 
                on cmp.competitionId = c.id and cmp.isDeleted = 0
            inner join wsa_registrations.competitionMembershipProductType cmpt 
                on cmpt.competitionMembershipProductId = cmp.id and cmpt.membershipProductTypeMappingId = it.membershipProductMappingId
            inner join membershipProductTypeMapping mptm
                on cmpt.membershipProductTypeMappingId = mptm.id and mptm.isDeleted = 0
            inner join membershipProduct mp
                on mp.id = mptm.membershipProductId and mptm.isDeleted = 0          
            inner join membershipProductType mpt
                on mpt.id = mptm.membershipProductTypeId and mpt.isDeleted = 0
            left join wsa_registrations.competitionMembershipProductDivision cmpd 
                on cmpd.isDeleted = 0 and it.divisionId =  cmpd.id and cmp.id = cmpd.competitionMembershipProductId 
            where it.statusRefId = 1 and it.instalmentDate is not null and it.feeAmount != 0 and  i.paymentStatus = 'success' and
            DATE_FORMAT(it.instalmentDate, '%Y-%m-%d') <= DATE_FORMAT(CONVERT_TZ(now(), 'UTC', 'Australia/NSW'), '%Y-%m-%d')  and it.isDeleted = 0`);
            return instalments;
        } catch (error) {
            logger.error((`Exception occurred in getInstalments ${error}`));
        }
    }

    private async findOrganisationByUniqueKey(organisationId: string): Promise<Organisation> {
        try {
            console.log("findOrganisationByUniqueKey entry :: " + organisationId);
            const entityManager = getManager();

            let query = entityManager.createQueryBuilder(Organisation, 'organisation')
            query.where('organisation.organisationUniquekey= :organisationId and isDeleted = 0', { organisationId })
            return (await query.getOne());
            // return await entityManager.createQueryBuilder().select().from(Organisation, 'o')
            //     .andWhere("o.organisationUniqueKey = :organisationKey", { organisationId })
            //     .andWhere("o.isDeleted = 0")
            //     .execute();
        } catch (error) {
            logger.error((`Exception occurred in findOrganisationByUniqueKey ${error}`));
        }
    }

    private async findOrganisationById(organisationId: number): Promise<Organisation> {
        try {
            console.log("findOrganisationByUniqueKey entry :: " + organisationId);
            const entityManager = getManager();

            let query = entityManager.createQueryBuilder(Organisation, 'organisation')
            query.where('organisation.id= :organisationId and isDeleted = 0', { organisationId })
            return (await query.getOne());
        } catch (error) {
            logger.error((`Exception occurred in findOrganisationByUniqueKey ${error}`));
        }
    }

    private async findOrganisationLogo(organisationId: number): Promise<OrganisationLogo> {
        try {
            console.log("findOrganisation Logo entry :: " + organisationId);
            const entityManager = getManager();

            let query = entityManager.createQueryBuilder(OrganisationLogo, 'ol')
            query.where('ol.organisationId= :organisationId and isDeleted = 0', { organisationId })
            return (await query.getOne());
            // return await entityManager.createQueryBuilder().select().from(Organisation, 'o')
            //     .andWhere("o.organisationUniqueKey = :organisationKey", { organisationId })
            //     .andWhere("o.isDeleted = 0")
            //     .execute();
        } catch (error) {
            logger.error((`Exception occurred in findOrganisationByUniqueKey ${error}`));
        }
    }

    private async getUserById(userId) {
        try {
            const entityManager = getManager();
            console.log("getInstalments entry");
            let user = await entityManager.query(` select * from wsa_users.user u where u.id = ? and u.isDeleted = 0  `, [userId]);

            return user[0];
        } catch (error) {
            logger.error((`Exception occurred in getUserById ${error}`));
            //throw error;
        }
    }

    private async getRegistration(registrationId) {
        try {
            const entityManager = getManager();
            console.log("geRegistration ");
            let registration = await entityManager.query(
                ` select * from wsa_registrations.registration r where r.id = ? and r.isDeleted = 0  `,
                [registrationId]
            );

            return registration[0];
        } catch (error) {
            logger.error((`Exception occurred in getRegistration ${error}`));
            // throw error;
        }
    }

    private async findByCompUniquekey(competitionUniquekey: string): Promise<number> {
        const entityManager = getManager();
        let query = entityManager.createQueryBuilder(CompetitionReg, 'competition')
        query.where('competition.competitionUniqueKey= :competitionUniquekey and isDeleted = 0', { competitionUniquekey })
        return (await query.getOne()).id;
    }

    private async instalmentDateToDBTrack(item, registrationId, invoiceId, createdBy) {
        try {
            // console.log("************ Instalment Future Date Arr " + JSON.stringify(transArr));
            const stepId = RegistrationStep.InstalmentTrackStep;
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
            logger.error(`Exception occurred in instalmentDateToDBTrack ${error}`);
            //throw error;
        }
    }

    private async getInvoiceData(registration, regTrackReviewData) {
        let invoiceData = null;
        try {
            //let regTrackReviewData = await this.registrationTrackService.findByRegistrationId(registration.id, 3);
            if (isNotNullAndUndefined(regTrackReviewData)) {
                let billTo = await this.getUserById(registration.createdBy);
                invoiceData = regTrackReviewData;
                let stateOrgId = null;
                let organisationLogoUrl = null;
                for (let item of invoiceData.compParticipants) {
                    for (let mem of item.membershipProducts) {
                        stateOrgId = mem.fees.membershipFee ? mem.fees.membershipFee.organisationId : null;
                        break;
                    }
                }

                if (stateOrgId != null) {
                    let organisation = await this.findOrganisationByUniqueKey(stateOrgId);
                    let organisationLogo = await this.findOrganisationLogo(organisation.id);
                    if (isNotNullAndUndefined(organisationLogo)) {
                        organisationLogoUrl = organisationLogo.logoUrl;
                    }
                }
                invoiceData["billTo"] = billTo;
                invoiceData["organisationLogo"] = organisationLogoUrl;
            }
        } catch (error) {
            logger.error(`Exception occurred in getInvoiceData ` + error);
            // throw error;
        }
        return invoiceData;
    }

    public async printTeamRegistrationInvoiceTemplate(invoiceData: any): Promise<any> {
        try {
            console.log('------invoice pdf creation :: entry :: ')
            let pdfBuf: Buffer;
            const createPDF = (html, options): Promise<Buffer> => new Promise(((resolve, reject) => {
                pdf.create(html, options).toBuffer((err, buffer) => {
                    if (err !== null) {
                        reject(err);
                    } else {
                        resolve(buffer);
                    }
                });
            }));
            let htmlTmpl = '';
            let fileName = null;
            if (isNotNullAndUndefined(invoiceData)) {
                htmlTmpl = getTeamRegistrationInvoiceTemplate(invoiceData);
                console.log("htmlTmpl::");

                const options = { format: 'A4' };

                await createPDF(htmlTmpl, options).then((newBuffer) => {
                    if (pdfBuf) {
                        pdfBuf = this.combinePDFBuffers(pdfBuf, newBuffer);
                    } else {
                        pdfBuf = newBuffer;
                    }
                });
                fileName = uuidv4() + '.pdf';
                fs.writeFileSync("output/" + fileName, pdfBuf);
            }

            return fileName;

        } catch (error) {
            logger.error(` ERROR occurred in invoice service ` + error)
            //throw error;
        }
    }

    private combinePDFBuffers = (firstBuffer: Buffer, secondBuffer: Buffer): Buffer => {
        const outStream = new memoryStreams.WritableStream();

        try {
            const firstPDFStream = new hummus.PDFRStreamForBuffer(firstBuffer);
            const secondPDFStream = new hummus.PDFRStreamForBuffer(secondBuffer);

            const pdfWriter = hummus.createWriterToModify(firstPDFStream, new hummus.PDFStreamForResponse(outStream));
            pdfWriter.appendPDFPagesFromPDF(secondPDFStream);
            pdfWriter.end();
            const newBuffer = outStream.toBuffer();
            outStream.end();

            return newBuffer;
        } catch (e) {
            outStream.end();
        }
    };

    private async updateFailedTransaction(membershipProducts) {
        try {
            if (isArrayPopulated(membershipProducts)) {
                const entityManager = getManager();
                for (let mem of membershipProducts) {
                    if (isArrayPopulated(mem.transactions)) {
                        for (let transactionId of mem.transactions) {
                            const trxn = new Transaction();
                            trxn.id = transactionId;
                            trxn.statusRefId = TransactionStatus.Failed;
                            await entityManager.save(trxn);
                        }
                    }
                }
            }
        } catch (error) {
            logger.error(`Error occurred in update transaction for instalment failed" ${error}`);
        }
    }

    public async sendInstalmentMail(fileName, item, templateObj, futureInstalments, currentInstalment, status) {
        try {
            console.log('  Inside Mail  ')
            let url = '#';
            let subject = templateObj.emailSubject;
            let memberInfo = await this.getUserById(item.userId)
            let userInfo = await this.getUserById(item.createdBy);
            let today = new Date();
            let responseDate = moment(today).tz("Australia/Sydney").format('DD/MM/YYYY');
            templateObj.emailBody = templateObj.emailBody.replace(AppConstants.name, userInfo.firstName + ' ' + userInfo.lastName);
            templateObj.emailBody = templateObj.emailBody.replace(AppConstants.member, memberInfo.firstName + ' ' + memberInfo.lastName);
            if (item.teamName == null) {
                templateObj.emailBody = templateObj.emailBody.replace(AppConstants.forTeamTeamName, '');
            }
            templateObj.emailBody = templateObj.emailBody.replace(AppConstants.teamName, item.teamName);
            templateObj.emailBody = templateObj.emailBody.replace(AppConstants.affiliateName, item.organisationName);
            templateObj.emailBody = templateObj.emailBody.replace(AppConstants.competionName, item.competitionName);
            templateObj.emailBody = templateObj.emailBody.replace(AppConstants.division, item.divisionName);
            templateObj.emailBody = templateObj.emailBody.replace(AppConstants.or, '');
            templateObj.emailBody = templateObj.emailBody.replace(AppConstants.playerCouchUmpire, item.membershipTypeName);
            templateObj.emailBody = templateObj.emailBody.replace(AppConstants.startDate, item.startDate);

            let str = '';
            if (status == 1) {
                if (isArrayPopulated(currentInstalment)) {
                    for (let ci of currentInstalment) {
                        str += '<li>';
                        str += AppConstants.date;
                        str += ' for ';
                        str += AppConstants.name;
                        str += ' - $';
                        str += AppConstants.amount;
                        str += ' - ' + AppConstants.paid;
                        str += '</li>';
                        str = str.replace(AppConstants.date, ci.date);
                        str = str.replace(AppConstants.name, ci.name);
                        str = str.replace(AppConstants.amount, ci.amount.toFixed(2));
                    }
                }
            } else {
                str += '<li>';
                str += AppConstants.date;
                str += ' - $';
                str += AppConstants.amount;
                str += '</li>';
                str = str.replace(AppConstants.date, responseDate);
                str = str.replace(AppConstants.amount, currentInstalment.toFixed(2));
            }
            if (isArrayPopulated(futureInstalments)) {
                for (let fi of futureInstalments) {
                    str += '<li>';
                    str += AppConstants.date;
                    str += ' for ';
                    str += AppConstants.name;
                    str += ' - $';
                    str += AppConstants.amount;
                    str += ' - ' + AppConstants.owing;
                    str += '</li>';

                    str = str.replace(AppConstants.date, fi.date);
                    str = str.replace(AppConstants.name, fi.name);
                    str = str.replace(AppConstants.amount, fi.amount.toFixed(2));
                }
                templateObj.emailBody = templateObj.emailBody.replace(AppConstants.finalPayment, '');
            } else {
                templateObj.emailBody = templateObj.emailBody.replace(AppConstants.yourPaymentIsDue, '');
            }
            templateObj.emailBody = templateObj.emailBody.replace(AppConstants.dateAndAmount, str);

            templateObj.emailBody = templateObj.emailBody.replace(AppConstants.affiliateName, item.organisationName);
            templateObj.emailBody = templateObj.emailBody.replace(AppConstants.affiliateName, item.organisationName);

            templateObj.emailBody = templateObj.emailBody.replace(AppConstants.url, url);

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
                // cTrack.contactNumber = userInfo.mobileNumber
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
                        logger.error(`TeamRegistration - sendInviteMail : ${err},  ${userInfo.email}`);
                        this.insertIntoCommunicationTrack(cTrack);
                        // Here i commented the below code as the caller is not handling the promise reject
                        // return Promise.reject(err);
                    } else {
                        cTrack.statusRefId = 1;
                        logger.info(`TeamRegistration - sendInviteMail : Mail sent successfully,  ${userInfo.email}`);
                        this.insertIntoCommunicationTrack(cTrack);
                    }
                    transporter.close();
                    return Promise.resolve();
                });

                // return cTrack
            } catch (error) {
                console.log('  error 1 Mail  ' + error)
                // cTrack.statusRefId = 2;
                // return cTrack;
            }

        } catch (error) {
            console.log('  error 2 Mail  ' + error)
            // throw error;
        }
    }

    private async findMailObj(id) {
        try {
            const entityManager = getManager();
            let mailObj = await entityManager.query(`select * from wsa_common.communicationTemplate where id = ? `, [id]);

            return mailObj[0];
        } catch (error) {
            console.log('  findMailObj  ' + error)
            // throw error;
        }
    }

    private async findFutureInstalments(item) {
        try {
            const entityManager = getManager();
            let query = null;
            if (item.divisionId != null) {
                query = await entityManager.query(
                    `select it.participantId, u.firstName, u.lastName, DATE_FORMAT(it.instalmentDate, '%d/%m/%Y') as instalmentDate,  
                    JSON_ARRAYAGG(JSON_OBJECT('feeAmount', it.feeAmount, 'gstAmount', it.gstAmount, 'discountAmount', it.discountAmount, 'familyDiscountAmount', it.familyDiscountAmount)) as fees
                        from wsa_registrations.transactions it 
                        inner join wsa_users.user u on u.id = it.participantId and u.isDeleted = 0
                        where it.paidBy = ? and it.competitionId = ? and it.divisionId = ? 
                        and it.membershipProductMappingId = ? and it.instalmentDate is not null and it.isDeleted = 0 and
                        DATE_FORMAT(CONVERT_TZ(now(), 'UTC', 'Australia/NSW'), '%Y-%m-%d') < DATE_FORMAT(it.instalmentDate, '%Y-%m-%d') group by it.instalmentDate, it.participantId order by it.instalmentDate`,
                    [item.paidBy, item.competitionId, item.divisionId, item.membershipMappingId]
                );
            } else {
                query = await entityManager.query(
                    `select  it.participantId, u.firstName, u.lastName, DATE_FORMAT(it.instalmentDate, '%d/%m/%Y') as instalmentDate,  
                    JSON_ARRAYAGG(JSON_OBJECT('feeAmount', it.feeAmount, 'gstAmount', it.gstAmount, 'discountAmount', it.discountAmount, 'familyDiscountAmount', it.familyDiscountAmount)) as fees
                        from wsa_registrations.transactions it 
                        inner join wsa_users.user u on u.id = it.participantId and u.isDeleted = 0
                        where it.paidBy = ? and it.competitionId = ? 
                        and it.membershipProductMappingId = ? and it.instalmentDate is not null and it.isDeleted = 0 and
                        DATE_FORMAT(CONVERT_TZ(now(), 'UTC', 'Australia/NSW'), '%Y-%m-%d') < DATE_FORMAT(it.instalmentDate, '%Y-%m-%d') group by it.instalmentDate, it.participantId order by it.instalmentDate`,
                    [item.paidBy, item.competitionId, item.membershipMappingId]
                );
            }

            let resArr = [];
            if (isArrayPopulated(query)) {
                for (let q of query) {
                    let sumTotal = 0
                    if (isArrayPopulated(q.fees)) {
                        for (let f of q.fees) {
                            let totalFee = this.getTotalFee(f);
                            sumTotal += totalFee
                        }
                    }
                    let obj = {
                        date: q.instalmentDate,
                        amount: sumTotal,
                        name: q.firstName + ' ' + q.lastName
                    }
                    resArr.push(obj)
                }
            }
            return resArr
        } catch (error) {
            console.log('  findFutureInstalments  ' + error)
            // throw error;
        }
    }

    private async findCurrentInstalments(item) {
        try {
            const entityManager = getManager();
            let query = null;
            if (item.divisionId != null) {
                query = await entityManager.query(
                    `select  it.participantId, u.firstName, u.lastName, DATE_FORMAT(it.instalmentDate, '%d/%m/%Y') as instalmentDate,  
                    JSON_ARRAYAGG(JSON_OBJECT('feeAmount', it.feeAmount, 'gstAmount', it.gstAmount, 'discountAmount', it.discountAmount, 'familyDiscountAmount', it.familyDiscountAmount)) as fees
                        from wsa_registrations.transactions it 
                        inner join wsa_users.user u on u.id = it.participantId and u.isDeleted = 0
                        where it.paidBy = ? and it.competitionId = ? and it.divisionId = ? 
                        and it.membershipProductMappingId = ? and it.instalmentDate is not null and it.isDeleted = 0 and
                        DATE_FORMAT(CONVERT_TZ(now(), 'UTC', 'Australia/NSW'), '%Y-%m-%d') = DATE_FORMAT(it.instalmentDate, '%Y-%m-%d') group by it.instalmentDate, it.participantId order by it.instalmentDate`,
                    [item.paidBy, item.competitionId, item.divisionId, item.membershipMappingId]
                );
            } else {
                query = await entityManager.query(
                    `select  it.participantId, u.firstName, u.lastName, DATE_FORMAT(it.instalmentDate, '%d/%m/%Y') as instalmentDate,  
                    JSON_ARRAYAGG(JSON_OBJECT('feeAmount', it.feeAmount, 'gstAmount', it.gstAmount, 'discountAmount', it.discountAmount, 'familyDiscountAmount', it.familyDiscountAmount)) as fees
                        from wsa_registrations.transactions it 
                        inner join wsa_users.user u on u.id = it.participantId and u.isDeleted = 0
                        where it.paidBy = ? and it.competitionId = ? 
                        and it.membershipProductMappingId = ? and it.instalmentDate is not null and it.isDeleted = 0 and
                        DATE_FORMAT(CONVERT_TZ(now(), 'UTC', 'Australia/NSW'), '%Y-%m-%d') = DATE_FORMAT(it.instalmentDate, '%Y-%m-%d') group by it.instalmentDate, it.participantId order by it.instalmentDate`,
                    [item.paidBy, item.competitionId, item.membershipMappingId]
                );
            }

            let resArr = [];
            if (isArrayPopulated(query)) {
                for (let q of query) {
                    let sumTotal = 0
                    if (isArrayPopulated(q.fees)) {
                        for (let f of q.fees) {
                            let totalFee = this.getTotalFee(f);
                            sumTotal += totalFee
                        }
                    }
                    let obj = {
                        date: q.instalmentDate,
                        amount: sumTotal,
                        name: q.firstName + ' ' + q.lastName
                    }
                    resArr.push(obj)
                }
            }
            return resArr
        } catch (error) {
            console.log('  error ini findCurrentInstalments  ' + error)
            //throw error;
        }
    }

    public async insertIntoCommunicationTrack(ctrack: CommunicationTrack) {
        const entityManager = getManager();
        await entityManager.query(
            `insert into wsa_common.communicationTrack(id, emailId,content,subject,contactNumber,userId,entityId,communicationType,statusRefId,deliveryChannelRefId,createdBy) values(?,?,?,?,?,?,?,?,?,?,?)`,
            [ctrack.id, ctrack.emailId, ctrack.content, ctrack.subject, ctrack.contactNumber, ctrack.userId, ctrack.entityId, ctrack.communicationType, ctrack.statusRefId, ctrack.deliveryChannelRefId, ctrack.createdBy]
        );
    }

    private async findDivisionByCmpd(competitionMembershipProductDivisionId): Promise<CompetitionDivision> {
        try {
            const entityManager = getManager();
            let query = await entityManager.createQueryBuilder(CompetitionDivision, 'cd')
                .where(
                    'cd.competitionMembershipProductDivisionId = :competitionMembershipProductDivisionId and cd.isDeleted = 0',
                    { competitionMembershipProductDivisionId: competitionMembershipProductDivisionId }
                )
                .getOne();

            return query;
        } catch (error) {
            logger.error(`Exception occurred in findDivisionByCmpd ${error}`);
        }
    }

    public async updateTransaction(invoiceId, transactions, paymentOptionRefId, paymentFeeTypeRefId, divisionId, transferForMembershipFee, statusRefId) {
        try {
            let trxns = [];
            if (isArrayPopulated(transactions)) {
                for (let transactionId of transactions) {
                    const trxn = new Transaction();
                    trxn.id = transactionId;
                    trxn.invoiceId = invoiceId;
                    trxn.paymentFeeTypeRefId = paymentFeeTypeRefId;
                    trxn.statusRefId = statusRefId;
                    trxn.divisionId = divisionId;
                    trxn.paymentOptionRefId = paymentOptionRefId;
                    trxn.stripeTransactionId = transferForMembershipFee ? transferForMembershipFee.id : null;
                    trxns.push(trxn)
                }
            }

            return trxns;
        } catch (error) {
            console.log('  error in updateTransaction  ' + error)
            // throw error;
        }
    }

    public async getInvoiceReciptId(): Promise<any> {
        const entityManager = getManager();
        let query = await entityManager.query(`select IFNULL(receiptId, 100000) as receiptId from wsa_registrations.invoice order by id desc LIMIT 1`);
        return query.find(x => x);
    }
}

const getTeamRegistrationInvoiceTemplate = (invoiceData) => {
    let userDetail = invoiceData != null ? invoiceData.billTo : null;
    let getAffiliteDetailData = getAffiliteDetailArray(invoiceData);
    let organisationLogo = invoiceData != null ? invoiceData.organisationLogo : null;
    let data = invoiceData != null ? invoiceData.compParticipants : []
    let total = invoiceData != null ? invoiceData.total : null;
    let isSchoolRegistrationApplied = 0;
    data.map((item) => {
        if (item.selectedOptions.isSchoolRegCodeApplied == 1) {
            isSchoolRegistrationApplied = 1;
        }
    })

    return `
        <!doctype html>
        <html>
            <head>
                <meta charset="utf-8">
                <style>
                @media print {  
                    body {
                        width: 100%;
                    }
                    .full-body {
                        width: 100%;
                        max-width: 800px;
                        padding: 16px;
                        background-color: #FFFFFF;
                        box-sizing: border-box;
                    }
                    .header {
                        display: -webkit-box;
                        display: -webkit-flex;
                        -webkit-flex-wrap: wrap;
                        display: flex;
                    }
                    table {
                        width:100%
                    }
                    .row {
                        width: 100%;
                        height: 10px;
                        display: -webkit-box;
                        display: -webkit-flex;
                        -webkit-flex-wrap: wrap;
                        display: flex;
                        flex-wrap: wrap;
                        flex-direction: row;
                    }
                    .cell {
                        width: 13%;
                        text-align: center;
                    }
                    .largeCell {
                        width: 35%;
                        text-align: center;
                    }
                    .input-heading-row {
                        font-size: 14px;
                        color: #4c4c6d;
                        font-weight: 500;
                    }
                    .input-heading-col {
                        font-size: 13px;
                        color: #4c4c6d;
                        font-weight: 500;
                    }
                    .mt-3 {
                        margin-top: 30px;
                    }
                    .bill-no {
                        margin-top: 15px;
                    }
                    .outer-header {
                        padding-left: 20px;
                    }
                    .bottom-divider {
                        border-bottom: 1px solid rgba(0, 0, 0, 0.65);
                        padding-bottom: 15px;
                    }
                    .total-border {
                        width: 250px;
                        border-bottom: 1px solid rgba(0, 0, 0, 0.65);
                        margin-left: auto;
                        padding-top: 16px;
                    }
                    .total {
                        justify-content:flex-end;
                        -webkit-justify-content:flex-end;
                    }
                    .subtotal-container {
                        flex-direction:column;
                        -webkit-flex-direction:column;
                        margin-top: 50px;
                    }
                    .mt-2 {
                        margin-top: 20px;
                    }
                    .mt-1 {
                        margin-top: 10px;
                    }
                    .pl-2 {
                        padding-left: 20px;
                    }
                    .pr-3 {
                        padding-right: 30px;
                    }
                    .pb-1 {
                        padding-bottom: 10px;
                    }
                    .inv-txt {
                        color: red;
                        font-size: 15px;
                    }
                }
                </style>
            </head>
            <body>
                <div class="full-body">
                    <div class="outer-header">
                        <table>
                            <tr>
                                <td>
                                    <div>
                                        <img src=${organisationLogo ? organisationLogo : ""} height="120" width="120" />
                                    </div>
                                </td>
                                <td>
                                    ${getAffiliteDetailData.length > 0 ? getAffiliteDetailData.map((item, index) => (
                                        `<div class="pb-1">
                                            <div class="input-heading-row">${item.organisationName}</div>
                                            <div class="input-heading-row">
                                                E: <span class="input-heading-col">${item.organiationEmailId != null ? item.organiationEmailId : "N/A"}</span>
                                            </div>
                                            <div class="input-heading-row">
                                                Ph: <span class="input-heading-col">${item.organiationPhoneNo ? item.organiationPhoneNo : "N/A"}</span>
                                            </div>
                                        </div>`
                                    )).join('') : ''}
                                </td>
                            </tr>
                        </table>
                        <div class="mt-3">
                            <div class="input-heading-row">Receipt No.1234556   <span class="inv-txt">${isSchoolRegistrationApplied == 1 ? '(To be invoiced via school)' : ""} </span></div>
                            <div class="bill-no input-heading-row">Bill To: 
                                ${(userDetail && userDetail.firstName)
                                    ? `<span class="input-heading-col">
                                            ${userDetail.firstName + ' ' + (userDetail.middleName != null ? userDetail.middleName : '') + ' ' + userDetail.lastName}
                                        </span>`
                                    : ''}
                            </div>
                            ${(userDetail && userDetail.street1)
                                ? `<div class="input-heading-col">${userDetail.street1}</div>`
                                : ''}
                            ${(userDetail && userDetail.street2)
                                ? `<div class="input-heading-col">${userDetail.street2}</div>`
                                : ''}
                            ${(userDetail)
                                ? `<div class="input-heading-col">
                                        ${userDetail.suburb + ", " + userDetail.state + ", " + userDetail.postalCode}
                                    </div>`
                                : ''}
                        </div>
                    </div>
                    <div class="row mt-3 bottom-divider input-heading-row">
                        <div class="largeCell">Description</div>
                        <div class="cell">Quality</div>
                        <div class="cell">Unit Price </div>
                        <div class="cell">Discount</div>
                        <div class="cell">GST</div>
                        <div class="cell">Amount AUD</div>
                    </div>
                    ${data && data.length > 0 ? data.map((item, index) => (
                        `<div>
                            ${(item.membershipProducts || []).map((mem, memIndex) => (
                                `<div>
                                    <div class="header mt-3 bottom-divider input-heading-row">
                                        ${item.firstName != null
                                            ? `<div>
                                                    ${item.divisionName != null
                                                        ? (item.isTeamRegistration != undefined && item.isTeamRegistration == 1 ? 'Team Registration' : 'Registration')
                                                            + " - " + (mem.membershipTypeName != null ? mem.membershipTypeName : '')
                                                            + " " + item.firstName + " " + item.lastName
                                                            + ", " + item.competitionName + " - " + item.divisionName
                                                        : (item.isTeamRegistration != undefined && item.isTeamRegistration == 1 ? 'Team Registration' : 'Registration')
                                                            + " - " + (mem.membershipTypeName != null ? mem.membershipTypeName : '')
                                                            + " " + item.firstName + " " + item.lastName
                                                            + ", " + item.competitionName
                                                    }
                                                </div>`
                                            : ''}
                                    </div>
                                    ${mem.fees.membershipFee != null
                                        ? `<div class="header mt-3 bottom-divider input-heading-col">
                                                <div class="largeCell">
                                                    ${(mem.fees.membershipFee.name != null ? mem.fees.membershipFee.name : '') + " - "
                                                        + (mem.membershipProductName != null ? mem.membershipProductName : '') + " - Membership Fees - "
                                                        + (mem.membershipTypeName != null ? mem.membershipTypeName : '')}
                                                </div>
                                                <div class="cell">1.00</div>
                                                <div class="cell">${(Number(mem.fees.membershipFee.feesToPay)).toFixed(2)}</div>
                                                <div class="cell">
                                                    ${(parseFloat((mem.fees.membershipFee.discountsToDeduct).toFixed(2))
                                                        + parseFloat((mem.fees.membershipFee.childDiscountsToDeduct != null ? mem.fees.membershipFee.childDiscountsToDeduct : 0).toFixed(2))).toFixed(2)}
                                                </div>
                                                <div class="cell">${(Number(mem.fees.membershipFee.feesToPayGST)).toFixed(2)}</div>
                                                <div class="cell">
                                                    ${(parseFloat((mem.fees.membershipFee.feesToPay).toFixed(2))
                                                        + parseFloat((mem.fees.membershipFee.feesToPayGST).toFixed(2))
                                                        - parseFloat((mem.fees.membershipFee.discountsToDeduct).toFixed(2))
                                                        - parseFloat((mem.fees.membershipFee.childDiscountsToDeduct != null ? mem.fees.membershipFee.childDiscountsToDeduct : 0).toFixed(2))).toFixed(2)}
                                                </div>
                                            </div>`
                                        : ''}
                                    ${mem.fees.competitionOrganisorFee != null
                                        ? `<div class="header mt-3 bottom-divider input-heading-col">
                                                <div class="largeCell">${mem.fees.competitionOrganisorFee.name + " - Competition Fees"}</div>
                                                <div class="cell">1.00</div>
                                                <div class="cell">${(Number(mem.fees.competitionOrganisorFee.feesToPay)).toFixed(2)}</div>
                                                <div class="cell">
                                                    ${(parseFloat((mem.fees.competitionOrganisorFee.discountsToDeduct).toFixed(2))
                                                        + parseFloat((mem.fees.competitionOrganisorFee.childDiscountsToDeduct != null ? mem.fees.competitionOrganisorFee.childDiscountsToDeduct : 0).toFixed(2))).toFixed(2)}
                                                </div>
                                                <div class="cell">${(Number(mem.fees.competitionOrganisorFee.feesToPayGST)).toFixed(2)}</div>
                                                <div class="cell">
                                                    ${(parseFloat((mem.fees.competitionOrganisorFee.feesToPay).toFixed(2))
                                                        + parseFloat((mem.fees.competitionOrganisorFee.feesToPayGST).toFixed(2))
                                                        - parseFloat((mem.fees.competitionOrganisorFee.discountsToDeduct).toFixed(2))
                                                        - parseFloat((mem.fees.competitionOrganisorFee.childDiscountsToDeduct != null ? mem.fees.competitionOrganisorFee.childDiscountsToDeduct : 0).toFixed(2))).toFixed(2)}
                                                </div>
                                            </div>`
                                        : ''}
                                    ${mem.fees.competitionOrganisorFee != null && mem.fees.competitionOrganisorFee.nominationFeeToPay != null
                                        ? `<div class="header mt-3 bottom-divider input-heading-col">
                                                <div class="largeCell">${mem.fees.competitionOrganisorFee.name + " - Nomination Fees"}</div>
                                                <div class="cell">1.00</div>
                                                <div class="cell">${(Number(mem.fees.competitionOrganisorFee.nominationFeeToPay)).toFixed(2)}</div>
                                                <div class="cell">
                                                    ${(parseFloat((mem.fees.competitionOrganisorFee.discountsToDeduct).toFixed(2))
                                                        + parseFloat((mem.fees.competitionOrganisorFee.childDiscountsToDeduct != null ? mem.fees.competitionOrganisorFee.childDiscountsToDeduct : 0).toFixed(2))).toFixed(2)}
                                                </div>
                                                <div class="cell">${(Number(mem.fees.competitionOrganisorFee.nominationGSTToPay)).toFixed(2)}</div>
                                                <div class="cell">
                                                    ${(parseFloat((mem.fees.competitionOrganisorFee.nominationFeeToPay).toFixed(2))
                                                        + parseFloat((mem.fees.competitionOrganisorFee.nominationGSTToPay).toFixed(2))
                                                        - parseFloat((mem.fees.competitionOrganisorFee.discountsToDeduct).toFixed(2))
                                                        - parseFloat((mem.fees.competitionOrganisorFee.childDiscountsToDeduct != null ? mem.fees.competitionOrganisorFee.childDiscountsToDeduct : 0).toFixed(2))).toFixed(2)}
                                                </div>
                                            </div>`
                                        : ''}
                                    ${mem.fees.affiliateFee != null
                                        ? `<div class="header mt-3 bottom-divider input-heading-col">
                                                <div class="largeCell">${mem.fees.affiliateFee.name + " - Competition Fees"}</div>
                                                <div class="cell">1.00</div>
                                                <div class="cell">${(Number(mem.fees.affiliateFee.feesToPay)).toFixed(2)}</div>
                                                <div class="cell">
                                                    ${(parseFloat((mem.fees.affiliateFee.discountsToDeduct).toFixed(2))
                                                        + parseFloat((mem.fees.affiliateFee.childDiscountsToDeduct != null ? mem.fees.affiliateFee.childDiscountsToDeduct : 0).toFixed(2))).toFixed(2)}
                                                </div>
                                                <div class="cell">${(Number(mem.fees.affiliateFee.feesToPayGST)).toFixed(2)}</div>
                                                <div class="cell">
                                                    ${(parseFloat((mem.fees.affiliateFee.feesToPay).toFixed(2))
                                                        + parseFloat((mem.fees.affiliateFee.feesToPayGST).toFixed(2))
                                                        - parseFloat((mem.fees.affiliateFee.discountsToDeduct).toFixed(2))
                                                        - parseFloat((mem.fees.affiliateFee.childDiscountsToDeduct != null ? mem.fees.affiliateFee.childDiscountsToDeduct : 0).toFixed(2))).toFixed(2)}
                                                </div>
                                            </div>`
                                        : ''}
                                    ${mem.fees.affiliateFee != null && mem.fees.affiliateFee.nominationFeeToPay != null
                                        ? `<div class="header mt-3 bottom-divider input-heading-col">
                                                <div class="largeCell">${mem.fees.affiliateFee.name + " - Nomination Fees"}</div>
                                                <div class="cell">1.00</div>
                                                <div class="cell">${(Number(mem.fees.affiliateFee.nominationFeeToPay)).toFixed(2)}</div>
                                                <div class="cell">
                                                    ${(parseFloat((mem.fees.affiliateFee.discountsToDeduct).toFixed(2))
                                                        + parseFloat((mem.fees.affiliateFee.childDiscountsToDeduct != null ? mem.fees.affiliateFee.childDiscountsToDeduct : 0).toFixed(2))).toFixed(2)}
                                                </div>
                                                <div class="cell">${(Number(mem.fees.affiliateFee.nominationGSTToPay)).toFixed(2)}</div>
                                                <div class="cell">
                                                    ${(parseFloat((mem.fees.affiliateFee.nominationFeeToPay).toFixed(2))
                                                        + parseFloat((mem.fees.affiliateFee.nominationGSTToPay).toFixed(2))
                                                        - parseFloat((mem.fees.affiliateFee.discountsToDeduct).toFixed(2))
                                                        - parseFloat((mem.fees.affiliateFee.childDiscountsToDeduct != null ? mem.fees.affiliateFee.childDiscountsToDeduct : 0).toFixed(2))).toFixed(2)}
                                                </div>
                                            </div>`
                                        : ''}
                                    <div>
                                        <div class="header mt-3 total">
                                            <div class="cell input-heading-row">Total</div>
                                            <div class="cell input-heading-col">${"$" + (Number(mem.feesToPay) - Number(mem.discountsToDeduct) - Number(mem.childDiscountsToDeduct != null ? mem.childDiscountsToDeduct : 0)).toFixed(2)}</div>
                                        </div>
                                    </div>
                                </div>`
                            )).join('')}
                        </div>`
                    )).join('') : ''}
    
                    <div class="header total subtotal-container">
                        <div class="header total">
                            <div class="cell input-heading-row">Subtotal</div>
                            <div class="cell input-heading-col">
                                ${total != null ? total.subTotal : '0.00'}
                            </div>
                        </div>
                        <div class="header total mt-1">
                            <div class="cell input-heading-row">GST</div>
                            <div class="cell input-heading-col">${total != null ? total.gst : '0.00'}</div>
                        </div>
                        <div class="header total mt-1">
                            <div class="cell input-heading-row">Charity</div>
                            <div class="cell input-heading-col">${total != null ? total.charityValue : '0.00'}</div>
                        </div>
                        <div class="total-border"></div>
                        <div class="header total mt-2">
                            <div class="input-heading-row">Total </div>
                            <div class="pl-2 pr-3 input-heading-col"> ${total != null ? total.total : '0.00'}</div>
                        </div>
                        <div class="header total mt-2">
                            <div class="input-heading-row">Transaction Fee</div>
                            <div class="pl-2 pr-3 input-heading-col"> ${total != null ? total.transactionFee : '0.00'}</div>
                            <div class="total-border"></div>
                            <div class="header total mt-2">
                                <div class="input-heading-row">Amount Paid </div>
                                <div class="pl-2 pr-3 input-heading-col"> AUD ${total != null ? total.targetValue : '0.00'}</div>
                            </div>
                        </div>
                    </div>
                </div>
            </body>
        </html>  
    `;
};

function getAffiliteDetailArray(allData) {
    try {
        let getAffiliteDetailArray = []
        let orgMap = new Map();
        allData.compParticipants.map((item) => {
            item.membershipProducts.map((mem) => {
                if (isNullOrUndefined(mem.fees.membershipFee)) {
                    let key = mem.fees.membershipFee.organisationId;
                    if (orgMap.get(key) == undefined) {
                        let obj = {
                            organisationId: mem.fees.membershipFee.organisationId,
                            organisationName: mem.fees.membershipFee.name,
                            organiationEmailId: mem.fees.membershipFee.emailId,
                            organiationPhoneNo: mem.fees.membershipFee.phoneNo
                        }
                        getAffiliteDetailArray.push(obj);
                        orgMap.set(key, obj);
                    }
                }
                if (isNullOrUndefined(mem.fees.affiliateFee)) {
                    let key = mem.fees.affiliateFee.organisationId;
                    if (orgMap.get(key) == undefined) {
                        let obj = {
                            organisationId: mem.fees.affiliateFee.organisationId,
                            organisationName: mem.fees.affiliateFee.name,
                            organiationEmailId: mem.fees.affiliateFee.emailId,
                            organiationPhoneNo: mem.fees.affiliateFee.phoneNo
                        }
                        getAffiliteDetailArray.push(obj);
                        orgMap.set(key, obj);
                    }
                }
                if (isNullOrUndefined(mem.fees.competitionOrganisorFee)) {
                    let key = mem.fees.competitionOrganisorFee.organisationId;
                    if (orgMap.get(key) == undefined) {
                        let obj = {
                            organisationId: mem.fees.competitionOrganisorFee.organisationId,
                            organisationName: mem.fees.competitionOrganisorFee.name,
                            organiationEmailId: mem.fees.competitionOrganisorFee.emailId,
                            organiationPhoneNo: mem.fees.competitionOrganisorFee.phoneNo
                        }
                        getAffiliteDetailArray.push(obj);
                        orgMap.set(key, obj);
                    }
                }
            });
        });
        return getAffiliteDetailArray
    } catch (error) {
        console.log('  Error in getAffiliteDetailArray  ' + error)
    }
}

export default getTeamRegistrationInvoiceTemplate;
