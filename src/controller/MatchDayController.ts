import { Response } from 'express';
import { Authorized, Body, HeaderParam, JsonController, Post, Res } from "routing-controllers";
import { User } from '../models/security/User';
import { logger } from "../logger";

import AppConstants from "../validation/AppConstants";
import { BaseController } from "./BaseController";
import { feeIsNull, formatFeeForStripe1, formatPersonName, formatValue, isArrayPopulated, isNotNullAndUndefined, isNullOrZero, objectIsNotEmpty, uuidv4 } from '../utils/Utils';
import { Transaction } from '../models/registrations/Transaction';
import { Invoice } from '../models/registrations/Invoice';
import Stripe from 'stripe';
import { PlainObjectToNewEntityTransformer } from 'typeorm/query-builder/transformer/PlainObjectToNewEntityTransformer';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2020-03-02' });

@JsonController('/api')
export class MatchDayController extends BaseController {

    @Authorized()
    @Post('/singlegame/list')
    async getSingleGameList(
        @Body() requestBody,
        @HeaderParam("authorization") currentUser: User,
        @Res() response: Response) {
        try {

            if (requestBody.organisationId && requestBody.competitionId) {
                const compId = await this.competitionRegService.findByUniquekey(requestBody.competitionId);
                const orgId = await this.organisationService.findByUniquekey(requestBody.organisationId);
                let result = await this.singleGameRedeemService.singleGameList(compId, orgId, requestBody);

                return response.status(200).send(result);
            }
            else {
                return response.status(212).send({ message: "OrganisationId and CompetitionId cannot be null" });
            }
        }
        catch (error) {
            logger.error(`Exception occurred in GetSingleGameList ${currentUser.id}` + error);
            return response.status(500).send({
                message: process.env.NODE_ENV == AppConstants.development ? AppConstants.errMessage + error : AppConstants.errMessage
            });
        }
    }

    @Authorized()
    @Post('/singlegame/redeempay')
    async singleGameRedeemPay(
        @Body() requestBody,
        @HeaderParam("authorization") currentUser: User,
        @Res() response: Response) {
        try {
            if (requestBody.organisationId && requestBody.competitionId) {
                const compId = await this.competitionRegService.findByUniquekey(requestBody.competitionId);
                const orgId = await this.organisationService.findByUniquekey(requestBody.organisationId);

                if (requestBody.processType == "redeem") {
                    let redeem = this.singleGameRedeemService.
                        getSingleGameRedeemObj(requestBody, currentUser.id, compId, orgId);
                    await this.singleGameRedeemService.createOrUpdate(redeem);
                }
                else {

                    let existingFees = await this.singleGameRedeemService.
                        getSingleGameTransactionData(compId, orgId, requestBody);
                    if (isArrayPopulated(existingFees)) {
                        let invoice = await this.createInvoice(AppConstants.cash, requestBody.registrationId,
                            requestBody.gamesToPay, currentUser.id, AppConstants.success);
                        requestBody["gamesToRedeem"] = 1;
                        let redeem = this.singleGameRedeemService.getSingleGameRedeemObj(requestBody, currentUser.id,
                            compId, orgId);
                        await this.singleGameRedeemService.createOrUpdate(redeem);
                        let isAffiliateFeeExists = existingFees.find(x => x.feeType == AppConstants.affiliate)
                        for (let i = 0; i < requestBody.gamesToPay; i++) {
                            for (let item of existingFees) {
                                let trans = new Transaction();
                                trans.id = 0;
                                trans.invoiceId = invoice.id;
                                trans.feeAmount = item.feeAmount;
                                trans.gstAmount = item.gstAmount;
                                trans.competitionId = compId;
                                trans.organisationId = item.organisationId;
                                trans.createdBy = currentUser.id;
                                trans.divisionId = requestBody.divisionId;
                                trans.feeType = item.feeType;
                                trans.membershipProductMappingId = requestBody.membershipProductMappingId;
                                trans.participantId = requestBody.userId;
                                trans.paidBy = currentUser.id;
                                trans.paymentFeeTypeRefId = item.paymentFeeTypeRefId;
                                trans.paymentOptionRefId = item.paymentOptionRefId;
                                trans.statusRefId = isAffiliateFeeExists ? AppConstants.NOT_PAID : AppConstants.PAID;
                                await this.transactionService.createOrUpdate(trans);
                            }
                        }
                    }
                }
                return response.status(200).send({ message: "Successfully Inserted" });
            }
            else {
                return response.status(212).send({ message: "OrganisationId and CompetitionId cannot be null" });
            }
        }
        catch (error) {
            logger.error(`Exception occurred in GetSingleGameList ${currentUser.id}` + error);
            return response.status(500).send({
                message: process.env.NODE_ENV == AppConstants.development ? AppConstants.errMessage + error : AppConstants.errMessage
            });
        }
    }

    @Authorized()
    @Post('/playerstopay/list')
    async getPlayersToPayList(
        @Body() requestBody,
        @HeaderParam("authorization") currentUser: User,
        @Res() response: Response) {
        try {

            if (requestBody.organisationId) {
                const ORGANISATION_ID = await this.organisationService.findByUniquekey(requestBody.organisationId);
                const competition = await this.competitionRegService.findCompByUniquekey(requestBody.competitionId)
                if(competition) {
                    let result = await this.transactionService.playersToPayList(ORGANISATION_ID, competition.id, requestBody);

                    return response.status(200).send(result);
                }
               
                return response.status(200).send([]);
            }
            else {
                return response.status(212).send({ message: "OrganisationUniqueKey cannot be null" });
            }
        }
        catch (error) {
            logger.error(`Exception occurred in playersToPayList  ${currentUser.id}` + error);
            return response.status(500).send({
                message: process.env.NODE_ENV == AppConstants.development ? AppConstants.errMessage + error : AppConstants.errMessage
            });
        }
    }

    @Authorized()
    @Post('/playerstopay/pay')
    async retryPlayersToPay(
        @Body() requestBody,
        @HeaderParam("authorization") currentUser: User,
        @Res() response: Response) {
        try {
            let registration = await this.registrationService.findByRegistrationKey(requestBody.registrationUniqueKey)
            let competitionId = await this.competitionRegService.findByUniquekey(requestBody.competitionId)

            if (requestBody.processTypeName.toLowerCase() == AppConstants.instalment.toLowerCase()) {
                let failedInstallment = await this.transactionService.getInstalments(registration.id, requestBody.userId, requestBody.divisionId);
                if (isArrayPopulated(failedInstallment)) {

                    let arr = await this.getTransactions(failedInstallment);

                    if (isArrayPopulated(arr)) {
                        for (let item of arr) {
                            let compTemp = null; let totalFee = 0;
                            console.log('---  6')

                            if (isArrayPopulated(item.compParticipants)) {
                                let account = await this.checkOrganisationStripeAccount(item);
                                if ((!account.membershipStripeAccountIdError) &&
                                    (!account.competitionStripeAccountIdError) &&
                                    (!account.affiliateStripeAccountIdError)) {
                                    for (let comp of item.compParticipants) {
                                        compTemp = comp;
                                        if (comp.stripeSourceTransaction != null) {
                                            let totalValue = feeIsNull(item.total.targetValue)
                                            totalFee = totalValue
                                            if (totalValue > 0) {
                                                let invoice = await this.createInvoice(comp.paymentType, comp.registrationId, null, currentUser.id, AppConstants.pending);

                                                let paymentIntent = await this.getStripePaymentIntent(comp,
                                                    totalValue, invoice, item);
                                                await this.transactionService.instalmentDateToDBTrack(item, comp.registrationId, invoice.id, comp.createdBy)

                                                console.log(`After Instalment Intent`);
                                                if (isNotNullAndUndefined(paymentIntent) && (paymentIntent.status == AppConstants.succeeded || comp.paymentType == AppConstants.directDebit)) {
                                                    let transArr = await this.performStripeTransaction(comp, paymentIntent, invoice.id, totalValue, comp.paymentType, requestBody.processTypeName)
                                                    await this.createTransaction(transArr, invoice.createdBy);

                                                }
                                            }
                                        }
                                    }

                                }
                                else {
                                    logger.error(`Exception occurred in Instalment schedule1`);
                                    // Failure mail
                                    // let  mailObj = await this.findMailObj(16)
                                    // let futureInstalments = await this.findFutureInstalments(compTemp)
                                    // await this.sendInstalmentMail(null, item, mailObj, futureInstalments, totalFee, 0)
                                }
                            }

                        }
                    }
                }
                return response.status(200).send({ success: true, message: "Payment successful" });
            }

            else if(requestBody.processTypeName.toLowerCase() == AppConstants.perMatch.toLowerCase()){
                await this.retryPerMatchTransaction(registration.id, requestBody.userId, requestBody.divisionId, competitionId, requestBody.processTypeName)
                return response.status(200).send({ success: true, message: "Payment successful" });
            }
        }
        catch (error) {
            logger.error(`Exception occurred in playersToPayList  ${currentUser.id}` + error);
            return response.status(500).send({
                message: process.env.NODE_ENV == AppConstants.development ? AppConstants.errMessage + error : AppConstants.errMessage
            });
        }
    }

    @Authorized()
    @Post('/playerstopay/cash')
    async retryPlayersToPayCash(
        @Body() requestBody,
        @HeaderParam("authorization") currentUser: User,
        @Res() response: Response) {
        try {
            let registration = await this.registrationService.findByRegistrationKey(requestBody.registrationUniqueKey);
            let jsonData = null;
            let invoice = null;
            let competitionId = await this.competitionRegService.findByUniquekey(requestBody.competitionId)
            if(requestBody.processTypeName.toLowerCase() == AppConstants.instalment.toLowerCase()){
                 invoice = await this.createInvoice(AppConstants.cash, registration.id, null,currentUser.id, AppConstants.success)
            }

                jsonData = await this.transactionService.getFailedTransactionsForCash(requestBody.processTypeName,registration.id, requestBody.userId, requestBody.divisionId, competitionId);
               let status = await this.validateBankAccounts(jsonData)
            if(status)
                await this.performCashPayment(jsonData, invoice, currentUser.id, requestBody.processTypeName, registration.registrationUniqueKey);
            else
                return response.status(212).send({ success: true, message: "Please complete your Stripe Withdrawal configuration in Payment Gateway screen to proceed." });

            return response.status(200).send({ success: true, message: "Payment successful" });
        }
        catch (error) {
            logger.error(`Exception occurred in playersToPay cash  ${currentUser.id}` + error);
            return response.status(500).send({
                message: process.env.NODE_ENV == AppConstants.development ? AppConstants.errMessage + error : AppConstants.errMessage
            });
        }
    }

    private async retryPerMatchTransaction(registrationId, userId, divisionId, competitionId, processTypeName){
        try{
            let transactions = await this.transactionService.getFailedPerMatch(registrationId, userId, divisionId, competitionId);
            let matchData = await this.getPerMatchStructedData(transactions);

            if(isArrayPopulated(matchData)){
                for(let item of matchData){
                    if(isArrayPopulated(item.compParticipants))
                    {
                        let account = await this.checkOrganisationStripeAccount(item);
                        if ((!account.membershipStripeAccountIdError) &&
                            (!account.competitionStripeAccountIdError) &&
                            (!account.affiliateStripeAccountIdError)) 
                        {
                            for(let comp of item.compParticipants){
                                if (comp.stripeSourceTransaction != null || comp.stripeSubSourceTransaction!= null) {
                                    console.log("&&&&&&&&&&&&&&" + comp.subPaymentType);
                                    let totalValue = feeIsNull(item.total.targetValue)
                                    console.log("totalValue" + totalValue);
                                    if (totalValue > 0) {
                                        let invoice = await this.createInvoice(comp.paymentType, registrationId, null, userId, AppConstants.success);
                                        console.log("invoice" + invoice.id);
                                        
                                        let paymentIntent = await this.getStripePaymentIntent(comp,
                                            totalValue, invoice, item);
                                            await this.transactionService.perMatchDateToDBTrack(item, comp.registrationId, invoice.id, comp.createdBy)

                                        if ((isNotNullAndUndefined(paymentIntent) && paymentIntent.status == AppConstants.succeeded) || comp.subPaymentType == AppConstants.cash) {
                                            let transArr = await this.performStripeTransaction(comp, paymentIntent, invoice.id, totalValue, comp.paymentType, processTypeName)
                                            console.log("transArr" + JSON.stringify(transArr));
                                            await this.createTransaction(transArr, invoice.createdBy);

                                        }
                                    }
                                }
                            }
                        }
                    }

                }
            }

        }
        catch(error){
            throw error;
        }
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
                }
                else {
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
                    "nominationFeeToPay": nomineeFee
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
                        "membershipProducts": []
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
                    }
                    else if (item.feeType == "competition") {
                        feesObj.fees.competitionOrganisorFee = feeObj
                    }
                    else if (item.feeType == "affiliate") {
                        feesObj.fees.affiliateFee = feeObj;
                    }

                    iMap.set(key, finalObj);
                    mMap.set(key, feesObj);
                    arr.push(finalObj);
                }
                else {
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
                            }
                            else {
                                memData.fees.competitionOrganisorFee = feeObj
                            }

                        }
                        else if (item.feeType == "affiliate") {
                            if (memData.fees.affiliateFee) {
                                memData.fees.affiliateFee.feesToPay = memData.fees.affiliateFee.feesToPay + feeIsNull(fee),
                                    memData.fees.affiliateFee.feesToPayGST = memData.fees.affiliateFee.feesToPayGST + feeIsNull(gst)
                            }
                            else {
                                memData.fees.affiliateFee = feeObj
                            }
                        }

                        instalmentData.total.gst = feeIsNull(instalmentData.total.gst) + gst;
                        instalmentData.total.subTotal = feeIsNull(instalmentData.total.subTotal) +
                            (fee - discountAmount - familyDiscountAmount);
                        instalmentData.total.targetValue = feeIsNull(instalmentData.total.targetValue) +
                            (gst + fee - discountAmount - familyDiscountAmount);

                    }
                }
            }

            console.log("ARRAY FORMED :: " + JSON.stringify(arr));

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

    private async getPerMatchStructedData(matchData){
        let arr = [];
        try {
           if(matchData)
           {
               console.log('----- getPerMatchStructedData entry '+ JSON.stringify(matchData))
              let iMap = new Map();
              let mMap = new Map();
              for(let item of matchData){

                //console.log('----- item  ' + JSON.stringify(item))
                let key;
                if(item.teamRegChargeTypeRefId == 2){
                   key = item.teamId + '#' + item.matchId + '#' + item.registrationId;
                }
                else if(item.teamRegChargeTypeRefId == 3){
                    if(item.payingFor == 1)
                        key = item.teamId + '#' + item.matchId + '#' + item.registrationId;
                    else
                        key = item.teamId + '#' + item.matchId + '#' + item.registrationId + "#" + item.userId;
                }
                else {
                    key =  item.matchId + '#' + item.registrationId + "#" + item.userId;
                 }
                let teamData = iMap.get(key);
                let memData = mMap.get(key);
                let totalValue = feeIsNull(item.teamSeasonalFees) + feeIsNull(item.teamSeasonalGST);

                console.log(' !!!!!!!------- teamSeasonalFees ' +item.teamSeasonalFees + '-- teamSeasonalGST '+ item.teamSeasonalGST)
                let feeObj = {
                    "name": item.orgName,
                    "emailId": item.orgEmail,
                    "phoneNo": item.orgPhoneNumber,
                    "feesToPay": feeIsNull(item.teamSeasonalFees),
                    "feesToPayGST": feeIsNull(item.teamSeasonalGST),
                    "organisationId": item.organisationUniqueKey,
                    "membershipMappingId": item.membershipProductMappingId
                }
                if(teamData == undefined){
                   
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
                        "stripeSubSourceTransaction":item.stripeSubSourceTransaction,
                        "paymentType": item.paymentType,
                        "subPaymentType": item.subPaymentType,
                        "selectedOptions": {
                            "paymentOptionRefId": item.paymentOptionRefId,
                            "isHardshipCodeApplied": 0
                        },
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
                        "transactions": [],
                        "fees": {
                            "affiliateFee": null,
                            "competitionOrganisorFee": null
                        }
                    }
                    feesObj.transactions.push(item.id);

                    compParticipantObj.membershipProducts.push(feesObj);
                   
                    if (item.affOrganisationId == item.organisationId) {
                        feesObj.fees.affiliateFee = feeObj;
                    }
                    else {
                        feesObj.fees.competitionOrganisorFee = feeObj
                    }

                    iMap.set(key, finalObj);
                    mMap.set(key, feesObj);
                    arr.push(finalObj);
                }
                else{
                    if (memData != undefined) {
                        memData.feesToPay = feeIsNull(memData.feesToPay) + totalValue;
                        memData.transactions.push(item.id);
                      
                        if (item.affOrganisationId) {
                            if(memData.fees.affiliateFee){
                                memData.fees.affiliateFee.feesToPay = memData.fees.affiliateFee.feesToPay + feeIsNull(item.teamSeasonalFees),
                                memData.fees.affiliateFee.feesToPayGST = memData.fees.affiliateFee.feesToPayGST + feeIsNull(item.teamSeasonalGST)
                            }
                            else{
                                memData.fees.affiliateFee = feeObj;
                            }
                        }
                        else {
                            if(memData.fees.competitionOrganisorFee){
                                memData.fees.competitionOrganisorFee.feesToPay = memData.fees.competitionOrganisorFee.feesToPay + feeIsNull(item.teamSeasonalFees),
                                memData.fees.competitionOrganisorFee.feesToPayGST = memData.fees.competitionOrganisorFee.feesToPayGST + feeIsNull(item.teamSeasonalGST)
                            }
                            else{
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
        console.log(' -- Array --------    '+ JSON.stringify(arr))
        return arr;
    }

    private async createInvoice(paymentType, registrationId, matches, userId, paymentStatus) {
        try {
            let invoice = new Invoice();
            let invoiceReceipt = await this.invoiceService.getInvoiceReciptId();
            let receiptId = feeIsNull(invoiceReceipt.receiptId) + 1;
            invoice.id = 0;
            invoice.registrationId = registrationId;
            invoice.paymentType = paymentType;
            invoice.paymentStatus = paymentStatus;
            invoice.matches = matches;
            invoice.receiptId = receiptId.toString();
            invoice.createdBy = userId;
            let result = await this.invoiceService.createOrUpdate(invoice);

            return result;
        } catch (error) {
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

    private async getStripePaymentIntent(item, totalFee, invoice, mainItem) {
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

            const updateTransaction = await this.updateErrorMessageAndPaymentTypeWithTransaction(item.registrationId, item.paymentType, null, PAYMENT_INTENT_ID,
                item.userRegId, invoice);
            console.log('updateTransaction  :::: ', JSON.stringify(updateTransaction))

            return newPaymentIntent;
        } catch (error) {
            logger.error(`Error occurred in getStripePaymentIntent" ${error}`);

            await this.updateErrorMessageAndPaymentTypeWithTransaction(item.registrationId, item.paymentType, error.message, PAYMENT_INTENT_ID,
                item.userRegId, invoice);

            // await this.updateFailedTransaction(item.membershipProducts)

            // throw error;
        }
    }

    private async updateErrorMessageAndPaymentTypeWithTransaction(registrationId: number, paymentType: string, error: string, stripeSourceTransaction: string,
        userRegId: number, invoice) {
        let getInvoiceData = null;
        try {
            if (invoice) {
                //const entityManager = getManager();
                const INVOICE_ID = invoice.id;
                const i = new Invoice();
                i.id = INVOICE_ID;
                i.registrationId = registrationId;
                i.userRegistrationId = userRegId;
                i.paymentType = isNotNullAndUndefined(paymentType) ? paymentType : undefined;
                i.stripeSourceTransaction = isNotNullAndUndefined(stripeSourceTransaction) ? stripeSourceTransaction : undefined;
                i.errorMessage = isNotNullAndUndefined(error) ? error : undefined;
                // await this.invoiceService.createOrUpdate(i);
                await this.invoiceService.createOrUpdate(i);

            }
        }
        catch (error) {
            logger.error(`Exception occurred in updateErrorMessageAndPaymentTypeWithTransaction ${error}`);
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

                // if (card.country != "AU") {
                //     if (card.brand == "American Express") {
                //         transactionFee = (totalFee * 2.7 / 100) + 0.30;
                //     }
                //     else {
                //         transactionFee = (totalFee * 3.0 / 100) + 0.30;
                //     }
                // }
                // else {
                //     transactionFee = (totalFee * 2.25 / 100) + 0.30;
                // }
            }
            else {
                transactionFee = (totalFee * 1.5 / 100) + 0.30;
                if (transactionFee > 3.50) {
                    transactionFee = 3.50;
                }
            }
            return transactionFee;
        }
        catch (error) {
            logger.error(`Exception occurred in getTransactionFee ${error}`);
            //throw error;
        }
    }

    private async performStripeTransaction(item, paymentIntent, invoiceId, totalFee, paymentType, processType) {
        try {
            console.log("Perform Stripe Transaction Entry ");
            const CURRENCY_TYPE: string = "aud";
            let transArr = [];
            let statusRefId = this.getTransactionStatusDD(paymentType);

            if (isArrayPopulated(item.membershipProducts)) {

                let paymentOptionRefId = item.selectedOptions.paymentOptionRefId;
                let paymentFeeTypeRefId = this.getPaymentFeeTypeRefId(paymentOptionRefId);

                for (let mem of item.membershipProducts) {

                    const membershipData = isNotNullAndUndefined(mem.fees.membershipFee) ? mem.fees.membershipFee : Object.assign({});
                    const compOrgData = isNotNullAndUndefined(mem.fees.competitionOrganisorFee) ? mem.fees.competitionOrganisorFee : Object.assign({});
                    const affiliateData = isNotNullAndUndefined(mem.fees.affiliateFee) ? mem.fees.affiliateFee : Object.assign({});

                    const competitionOrganiserOrganisationName_: string = compOrgData['name'];
                    const playerName_: string = formatPersonName(item.firstName, null, item.lastName);
                    const competitionId_ = await this.competitionRegService.findCompByUniquekey(item.competitionUniqueKey);

                    const membershipProductTypeName_ = mem.membershipTypeName;
                    const membershipMappingId_ = mem.membershipMappingId;
                    let compDivisionDb = await this.competitionDivisionService.findBycmpd(mem.divisionId)
                    let divisionId_ = compDivisionDb != undefined ? compDivisionDb.id : 0;

                    if(processType.toLowerCase() == AppConstants.perMatch.toLowerCase()){
                        divisionId_ = item.divisionId;
                     }
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

                        let membershipOrganisation_ = await this.organisationService.findOrgByUniquekey(membershipData.organisationId);

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
                                    description: `${playerName_} - ${membershipProductTypeName_} - ${membershipProductOrganisationName_} - MEMBERSHIP FEE`,
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
                        const cOrganisation_ = await this.organisationService.findOrgByUniquekey(compOrgData.organisationId);
                        const cOrganisationId_: number = cOrganisation_.id;
                        console.log('going to pay a total of ' + competitionTotalAmount_ + ' to ' + competitionOrganiserOrganisationName_ + ' as Competition Fee')

                        // transfer to association for organiser fees
                        if (STRIPE_COMPETITION_TOTAL_FEE >= 1) {
                            let transferForCompetitionOrganiser = null;
                            if (paymentType != AppConstants.directDebit) {
                                transferForCompetitionOrganiser = await stripe.transfers.create({
                                    amount: STRIPE_COMPETITION_TOTAL_FEE,
                                    currency: CURRENCY_TYPE,
                                    description: `${playerName_} - ${membershipProductTypeName_} - ${competitionOrganiserOrganisationName_} - COMPETITION FEE`,
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
                                            description: `${playerName_} - ${membershipProductTypeName_} - ${competitionOrganiserOrganisationName_} - NOMINATION FEE`,
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

                        let aOrganisation_ = await this.organisationService.findOrgByUniquekey(affiliateData.organisationId);
                        let aOrganisationId_: number = aOrganisation_.id;
                        let aOrganisationAccountId_: string = affiliateData.organisationAccountId;
                        const affiliateOrganisationName_: string = affiliateData.name;

                        console.log('going to pay a total of ' + affiliateTotalAmount_ + + ' to ' + affiliateOrganisationName_ + ' as Affiliate Fee')

                        // transfer for affiliateFees
                        if (STRIPE_AFFILIATE_TOTAL_AMOUNT >= 1) {
                            let transferForAffiliateFee = null;
                            if (paymentType != AppConstants.directDebit) {
                                transferForAffiliateFee = await stripe.transfers.create({
                                    amount: STRIPE_AFFILIATE_TOTAL_AMOUNT,
                                    description: `${playerName_}  - ${affiliateOrganisationName_} - AFFILIATE FEE`,
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
                                            description: `${playerName_} - ${membershipProductTypeName_} - ${affiliateOrganisationName_} - NOMINATION FEE`,
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
                }
            }
            return transArr;
        } catch (error) {
            //Failure mail
            // let mailObj = await this.findMailObj(16)
            // let futureInstalments = await this.findFutureInstalments(item)
            // await this.sendInstalmentMail(null, item, mailObj, futureInstalments, totalFee, 0)
            logger.error(`Exception occurred in performStripeTransaction ${error}`);
        }
    }

    public async updateTransaction(invoiceId, transactions, paymentOptionRefId, paymentFeeTypeRefId, divisionId, transferForMembershipFee,
        statusRefId) {
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
        }
        catch (error) {
            console.log('  error in updateTransaction  ' + error)
            //throw error;
        }
    }

    private getPaymentFeeTypeRefId(paymentOptionRefId) {
        if (paymentOptionRefId <= 2) {
            return AppConstants.CASUAL_FEE;
        }
        else {
            return AppConstants.SEASONAL_FEE;
        }
    }

    private getTransactionStatusDD(paymentType) {
        let statusRefId = AppConstants.PAID;
        if (paymentType == AppConstants.directDebit) {
            statusRefId = AppConstants.PROCESSING;
        }

        return statusRefId;
    }

    private async createTransaction(transArr, paidBy) {
        try {

            if (isArrayPopulated(transArr)) {
                for (let item of transArr) {
                   // item["paidBy"] = paidBy;
                    await this.transactionService.createOrUpdate(item);
                }
            }
        } catch (error) {
            logger.error(`Exception occurred in createTransaction ${error}`);
        }
    }

    private async performCashPayment(jsonData, invoice, userId, processType, registrationUniqueKey){
        try{
            console.log(jsonData)
            if(isNotNullAndUndefined(jsonData)){
                let transactions = jsonData;
                console.log(" negativeFeeTransactions ::" + JSON.stringify(transactions));
                if(isArrayPopulated(transactions)){                   
                    for(let item of transactions){
                        
                        let compDivisionDb = await this.competitionDivisionService.findBycmpd(item.divisionId)
                        let divisionId_ = compDivisionDb != undefined ? compDivisionDb.id : 0;
                        let transferGroup = null;
                        if(processType.toLowerCase() == AppConstants.perMatch.toLowerCase() || item.statusRefId == AppConstants.PAID){
                            divisionId_ = item.divisionId;
                         }
                       
                        if(item.sourceOrgId != item.organisationId){
                            let onBehalfOf = null;
                            if(processType.toLowerCase() == AppConstants.instalment.toLowerCase()){
                                onBehalfOf = await this.onBehalfOfData(item, AppConstants.INSTALMENTFEE);
                                transferGroup = AppConstants.INSTALMENTFEE + "#" + registrationUniqueKey;
                            }
                            else if(processType.toLowerCase() == AppConstants.schoolInvoice.toLowerCase()){
                                onBehalfOf = await this.onBehalfOfData(item, AppConstants.SCHOOLINVOICE);
                                transferGroup = AppConstants.SCHOOLINVOICE + "#" + registrationUniqueKey;
                            }
                            else if(processType.toLowerCase() == AppConstants.governmentVoucher.toLowerCase()){
                                onBehalfOf = await this.onBehalfOfData(item, AppConstants.GOVERNMENTVOUCHER);
                                transferGroup = AppConstants.GOVERNMENTVOUCHER + "#" + registrationUniqueKey;
                            }
                            else if(processType.toLowerCase() == AppConstants.perMatch.toLowerCase()){
                                onBehalfOf = await this.onBehalfOfData(item, AppConstants.PERMATCH);
                                transferGroup =  AppConstants.PERMATCH + "#" + registrationUniqueKey;
                            }
                            
                            console.log("performNegativeFeeTransactions onBehalfOf" + JSON.stringify(onBehalfOf));
                            if(onBehalfOf.sourceOrgId!= null  && onBehalfOf.targetOrgId!= null){
                                let amount = 0;
                                if(processType.toLowerCase() == AppConstants.governmentVoucher.toLowerCase())
                                    amount = feeIsNull(item.governmentVoucherAmount);
                                else
                                    amount = feeIsNull(item.feeAmount) + feeIsNull(item.gstAmount) - feeIsNull(item.discountAmount) - feeIsNull(item.familyDiscountAmount);

                                console.log("Negative Fee to Pay :: " + amount + "becsMandateId:" + onBehalfOf.becsMandateId + "sourceOrgCustId:" + onBehalfOf.sourceOrgCustId);
    
                                //if(onBehalfOf.becsMandateId!= null  && onBehalfOf.sourceOrgCustId!= null && onBehalfOf.targetOrgAccId!= null){
                                    const STRIPE_TOTAL_FEE = formatFeeForStripe1(amount);
                                    console.log("performTransactionOnBehalfOf :: STRIPE_TOTAL_FEE" + STRIPE_TOTAL_FEE);
    
                                    let guidKey = uuidv4();
                                    transferGroup = transferGroup + "#" + guidKey + "#" + 'GOVT VOUCHER';
                                    let trans = null;
                                    if(onBehalfOf.becsMandateId!= null  && onBehalfOf.sourceOrgCustId!= null && onBehalfOf.targetOrgAccId!= null && STRIPE_TOTAL_FEE >= 1){
                                        trans = await this.transferOnBehalfOf(STRIPE_TOTAL_FEE, onBehalfOf.sourceOrgCustId, onBehalfOf.becsMandateId,
                                                onBehalfOf.targetOrgAccId, onBehalfOf.description, transferGroup);
                                    }
                                       
                                    //if(!isNullOrZero(item.feeAmount) || !isNullOrZero(item.gstAmount)){
                                        let trxn = this.onBehalfOfTransaction(item,invoice, divisionId_, userId, trans, guidKey);
                                        await this.transactionService.createOrUpdate(trxn);

                                        if(processType.toLowerCase() == AppConstants.governmentVoucher.toLowerCase()){
                                            await this.createOnBehalfOfTransaction(item, userId)
                                        }
                                        //this.negativeExpiryCheck(item, participantId_, personMap, expiryError);
                                   // }
    
                                    
                                //}
                            }
                            else if(onBehalfOf.sourceOrgId == null  && onBehalfOf.targetOrgId!= null){
                                console.log("****************Else************onBehalfOf")
                             
                                //if(!isNullOrZero(item.feeAmount) || !isNullOrZero(item.gstAmount)){
                                    let trxn = this.onBehalfOfTransaction(item, invoice, divisionId_, userId, null, null);
                                    await this.transactionService.createOrUpdate(trxn);
                                    //this.negativeExpiryCheck(item, participantId_, personMap, expiryError);
                               // }
    
                            }
                        }
                        else{
                            //if(!isNullOrZero(item.feeAmount) || !isNullOrZero(item.gstAmount)){
                                let trxn = this.onBehalfOfTransaction(item, invoice, divisionId_, userId, null, null);
                                await this.transactionService.createOrUpdate(trxn);
                                //this.negativeExpiryCheck(item, participantId_, personMap, expiryError);
                           // }
                           
                        }
                    }
                }
            }
        }
        catch(error){
            throw PlainObjectToNewEntityTransformer;
        }
    }

    private async onBehalfOfData(item, feeDesc){
        try{
            let obj = {
                sourceOrgId: item.sourceOrgId,
                targetOrgId: item.organisationId,
                description: null,
                sourceOrgCustId: null,
                becsMandateId: null,
                targetOrgAccId: null
            }

            if(obj.sourceOrgId!= null  && obj.targetOrgId!= null){
                let sourceOrg = await this.organisationService.findById(obj.sourceOrgId);
                let targetOrg = await this.organisationService.findById(obj.targetOrgId);
                const orgName = targetOrg.name;
                const playerName = formatPersonName(item.playerFirstName, item.playerMiddleName, item.playerLastName);
                const registeringPerson = formatPersonName(item.registeringPersonFirstName, item.registeringPersonMiddleName,item.registeringPersonLastName)
                const membershipProductTypeName_ = item.membershipTypeName;

                if(item.isTeamRegistration && item.participantId != item.paidBy) {
                    obj.description = `${registeringPerson} -  ${membershipProductTypeName_} - ${playerName} - ${orgName} - ${feeDesc}`;
                }
                else {
                    obj.description = `${playerName} - ${membershipProductTypeName_} - ${orgName} - ${feeDesc}`;
                }
                console.log("Negative Fee Desc" + obj.description);
                obj.sourceOrgCustId = sourceOrg ?  sourceOrg.stripeCustomerAccountId : null;
                obj.becsMandateId = sourceOrg ?  sourceOrg.stripeBecsMandateId : null;
                obj.targetOrgAccId = targetOrg ? targetOrg.stripeAccountID : null;
                console.log("Negative Fee to Pay :: becsMandateId:" + obj.becsMandateId + "sourceOrgCustId:" + obj.sourceOrgCustId);

            }

            return obj;
        }
        catch(error){
            logger.error(`Exception occurred in onBehalfOfHandling ${error} `);
            throw error;
        }
    }

private async validateBankAccounts(transactions){
    try{
        if(isArrayPopulated(transactions)){
            for(let item of transactions){
                if(item.sourceOrgId != item.organisationId){
                    let onBehalfOf = await this.onBehalfOfData(item, 'INSTALMENT FEE');
                    if(onBehalfOf.becsMandateId!= null  && onBehalfOf.sourceOrgCustId!= null && onBehalfOf.targetOrgAccId!= null ){
                    }
                    else{
                        return 0
                    }
                }
            }
        }
        return 1
    }
    catch(error){
        throw error
    }
}

    public async transferOnBehalfOf(STRIPE_TOTAL_FEE, sourceOrgCustId, becsMandateId, targetOrgAccId,
        description, transferGroup){
        try {
            let paymentIntent =  await stripe.paymentIntents.create({
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

              console.log("Negative Payment Intent" + JSON.stringify(paymentIntent));

              return paymentIntent;

        } catch (error) {
            logger.error(`Exception occurred in transferOnBehalfOf ${error} `);
            throw error;
        }
    }

    private  onBehalfOfTransaction(item, invoice, divisionId_, userId, paymentIntent = undefined, referenceId){
        try {
            
            const trxn = new Transaction();
            trxn.id = item.id;
            if(invoice)
                trxn.invoiceId =  invoice.id;
            if(item.governmentVoucherStatusRefId == 1) {
                // trxn.governmentVoucherStatusRefId = AppConstants.PAID;
                trxn.governmentVoucherStatusRefId = 3;
            }
            trxn.divisionId = divisionId_;
            trxn.paymentIntentId = (paymentIntent ? paymentIntent.id : null)
            trxn.referenceId = referenceId;
            console.log("trxn.paymentIntentId" + trxn.paymentIntentId);
            trxn.statusRefId = AppConstants.PAID;
            trxn.updatedBy = userId
            trxn.updatedOn = new Date();

            return trxn;

        } catch (error) {
            throw error;
        }
    }

    private async createOnBehalfOfTransaction(item, userId){
        try {
            const trxn = new Transaction();
            trxn.id = 0;
            trxn.invoiceId = item.invoiceId;
            trxn.participantId = item.participantId;
            trxn.createdBy = userId;
            trxn.feeAmount = 0;
            trxn.gstAmount = 0;
            trxn.discountAmount = 0;
            trxn.feeType = item.feeType;
            trxn.feeTypeRefId = item.feeTypeRefId;
            trxn.membershipProductMappingId = item.membershipProductMappingId;
            trxn.competitionId = item.competitionId;
            trxn.organisationId = item.sourceOrgId;
            trxn.divisionId = item.divisionId;
            trxn.governmentVoucherAmount = -Math.abs(item.governmentVoucherAmount);
            trxn.governmentVoucherStatusRefId = AppConstants.PAID;
            trxn.paidBy = item.paidBy;
            trxn.paymentOptionRefId = item.paymentOptionRefId,
            trxn.paymentFeeTypeRefId = this.getPaymentFeeTypeRefId(item.paymentOptionRefId),
            trxn.statusRefId = AppConstants.PAID;
            trxn.transactionTypeRefId = 7;
            await this.transactionService.createOrUpdate(trxn);
            
        } catch (error) {
            throw error;
        }
    }
}