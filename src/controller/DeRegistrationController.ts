import { Response } from "express";
import { Authorized, Body, Get, HeaderParam, JsonController, Post, QueryParam, Res } from "routing-controllers";
import Stripe from "stripe";

import { BaseController } from "./BaseController";
import { logger } from "../logger";
import { Approval } from "../models/registrations/Approval";
import { ApprovalRefund } from "../models/registrations/ApprovalRefund";
import { DeRegister } from "../models/registrations/DeRegister";
import { Transaction } from "../models/registrations/Transaction";
import { User } from "../models/security/User";
import {
    feeIsNull,
    formatFeeForStripe1,
    getApproveValue,
    getRegistrationField,
    isArrayPopulated,
    isNotNullAndUndefined,
    isNullOrUndefined,
    uuidv4
} from "../utils/Utils";
import AppConstants from "../validation/AppConstants";
import { RegistrationChangeType, TransactionStatus } from "../enums/enums";
import * as fastcsv from "fast-csv";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2020-03-02' });

@JsonController("/api")
export class DeRegistrationController extends BaseController {

    @Authorized()
    @Post("/deregister/details")
    public async GetDeRegistration(
        @Body() requestBody: any,
        @HeaderParam("authorization") currentUser: User,
        @Res() response: Response
    ) {
        try {
            if (isNullOrUndefined(requestBody)) {
                let registration = await this.registrationService.findByRegistrationKey(requestBody.registrationId);
                let competitionId = 0;
                let organisationId = 0;
                if (requestBody.competitionId) {
                    competitionId = await this.competitionRegService.findByUniquekey(requestBody.competitionId);
                }

                if (requestBody.organisationId) {
                    organisationId = await this.organisationService.findByUniquekey(requestBody.organisationId);
                }

                let result = await this.deRegisterService.getDeRegister(requestBody, registration.id, competitionId, organisationId);
                return response.status(200).send(result);
            } else {
                return response.status(212).send({ Message: "Please provide valid information" });
            }
        } catch (error) {
            logger.error(`Exception occurred in GetDeRegistration ${error}`);
            return response.status(500).send({
                message: process.env.NODE_ENV == AppConstants.development ? AppConstants.errMessage + error : AppConstants.errMessage
            });
        }
    }

    @Authorized()
    @Post("/deregister")
    public async SaveDeRegistration(
        @HeaderParam("authorization") currentUser: User,
        @Body() requestBody: any,
        @Res() response: Response
    ) {
        try {
            let teamMembersData = [];
            if (isNullOrUndefined(requestBody)) {
                let competitionId = 0;
                let organisationId = 0;
                let teamUniqueKey;
                if (requestBody.isTeam == 0) {
                    competitionId = await this.competitionRegService.findByUniquekey(requestBody.competitionId);
                    organisationId = await this.organisationService.findByUniquekey(requestBody.organisationId);
                }
                let registration = await this.registrationService.findByRegistrationKey(requestBody.registrationId);
                if (requestBody.teamId) {
                    const team = await this.teamService.findById(requestBody.teamId);
                    teamUniqueKey = team ? team.teamUniqueKey : null;
                }

                let arr = [];
                if (requestBody.isTeam == 0) {
                    arr.push(requestBody);
                } else {
                    let teamMembers = await this.deRegisterService.getRegistrationTeamMembers(requestBody.teamId,
                        registration.id, requestBody.userId);

                    console.log("teamMembers" + JSON.stringify(teamMembers));
                    if (isArrayPopulated(teamMembers)) {
                        for (let item of teamMembers) {
                            let obj = JSON.parse(JSON.stringify(requestBody));
                            obj["userId"] = item.userId;
                            obj["organisationId"] = item.organisationId;
                            obj["competitionId"] = item.competitionId;
                            obj["membershipMappingId"] = item.membershipMappingId;
                            obj["divisionId"] = item.divisionId;
                            competitionId = item.competitionId;
                            organisationId = item.organisationId;
                            arr.push(obj);
                            teamMembersData.push(item)
                        }
                    }
                }

                console.log("arr" + JSON.stringify(arr));

                for (let item of arr) {
                    let deRegister = new DeRegister();
                    // let existingDeRegister = await this.deRegisterService.getExistingDeRegister(competitionId, organisationId, item, registration.id);
                    let deRegisterId = 0;
                    // if (isArrayEmpty(existingDeRegister)) {
                    //     deRegisterId = existingDeRegister[0].id
                    // }
                    deRegister.id = deRegisterId;
                    deRegister.userId = item.userId;
                    deRegister.membershipMappingId = item.membershipMappingId;
                    deRegister.competitionId = competitionId;
                    deRegister.organisationId = organisationId;
                    deRegister.regChangeTypeRefId = item.regChangeTypeRefId;

                    deRegister.teamId = item.teamId;
                    deRegister.createdBy = currentUser.id;
                    deRegister.isAdmin = item.isAdmin;
                    deRegister.divisionId = item.divisionId;
                    deRegister.registrationId = isNullOrUndefined(registration) ? registration.id : 0;

                    deRegister.statusRefId = AppConstants.PENDING_DE_REGISTRATION;

                    let divisionId = (deRegister.divisionId ? deRegister.divisionId : 0);
                    let membershipProdDivisionId = 0;
                    if (divisionId != 0) {
                        let compDivObj = await this.competitionDivisionService.findById(divisionId);
                        console.log(`compDivObj ${compDivObj}`);
                        if (compDivObj) {
                            membershipProdDivisionId = compDivObj.competitionMembershipProductDivisionId;
                        }
                    }

                    console.log(`divisionId ${JSON.stringify(divisionId)}, ${JSON.stringify(membershipProdDivisionId)}`);

                    let transactionData = await this.deRegisterService.getDeRegisterTransactionData(deRegister, divisionId, membershipProdDivisionId);

                    console.log(`transactionData ${JSON.stringify(transactionData)}`);
                    if (isArrayPopulated(transactionData)) {
                        transactionData.map((item, index) => {
                            item["statusRefId"] = 0;
                            if (item.orgRefTypeId == 4) {
                                let obj = transactionData.find(x => x.orgId == item.orgId &&
                                    (x.orgRefTypeId == 2 || x.orgRefTypeId == 1));
                                if (obj) {
                                    item.orgRefTypeId = obj.orgRefTypeId;
                                }
                            } else {
                                item.orgRefTypeId = Number(item.orgRefTypeId);
                            }
                            item["regChangeTypeRefId"] = AppConstants.DE_REGISTER;
                        });
                    }

                    if (item.regChangeTypeRefId == AppConstants.DE_REGISTER) {
                        deRegister.reasonTypeRefId = item.reasonTypeRefId;
                        deRegister.deRegistrationOptionId = item.deRegistrationOptionId;
                        deRegister.otherInfo = item.deRegisterOther;
                        deRegister.statusTrackData = JSON.stringify(transactionData);
                        console.log(`deRegister.statusTrackData ${JSON.stringify(deRegister.statusTrackData)}`);
                    } else if (item.regChangeTypeRefId == AppConstants.TRANSFER) {
                        let competition = await this.competitionRegService.findCompByUniquekey(item.transfer.competitionId);
                        let organisationId = await this.organisationService.findByUniquekey(item.transfer.organisationId);
                        deRegister.reasonTypeRefId = item.transfer.reasonTypeRefId;
                        deRegister.otherInfo = item.transfer.transferOther;
                        deRegister.transferCompetitionId = competition.id;
                        deRegister.transferOrganisationId = organisationId;
                        let statusTrackArr = this.getTransferStatusTrackData(transactionData, organisationId, item, competition);
                        deRegister.statusTrackData = JSON.stringify(statusTrackArr);
                    }

                    await this.deRegisterService.createOrUpdate(deRegister);
                    if (teamUniqueKey) {
                        await this.teamService.updateLivescoresTeamStatusByTeamUniqueKey(teamUniqueKey);
                    }

                    if (teamMembersData && teamMembersData.length) {
                        for (let item of teamMembersData) {
                            if (item.divisionId && item.divisionId != 0) {
                                await this.deRegisterService.updateLivescorePlayerStatus(item.userId, item.userRegistrationId, item.divisionId, currentUser.id)
                                await this.deRegisterService.updatePlayerStatus(item.userId, item.userRegistrationId, item.divisionId, currentUser.id)
                            } else {
                                console.log('ITEM :' + JSON.stringify(item))
                                await this.deRegisterService.updateNonPlayerStatus(item.userId, item.userRegistrationId, item.membershipMappingId, currentUser.id, item.competitionId)
                            }

                        }
                    }

                }

                return response.status(200).send({ message: AppConstants.successfullyInserted });
            } else {
                return response.status(212).send({ Message: "Body cannot be null" });
            }
        } catch (error) {
            logger.error(`Exception occurred in SaveDeRegistration ${error}`);
            return response.status(500).send({
                message: process.env.NODE_ENV == AppConstants.development ? AppConstants.errMessage + error : AppConstants.errMessage
            });
        }
    }

    @Authorized()
    @Post("/registrationchange/dashboard")
    public async getRegistrationChangeDashboard(
        @HeaderParam("authorization") currentUser: User,
        @QueryParam('sortBy') sortBy: string = undefined,
        @QueryParam('sortOrder') sortOrder: 'ASC' | 'DESC' = undefined,
        @Body() requestBody: any,
        @Res() response: Response
    ) {
        try {
            let organisationId = await this.organisationService.findByUniquekey(requestBody.organisationId);
            let registrationChanges = await this.deRegisterService.getRegistrationDashboard(organisationId, requestBody, sortBy, sortOrder);
            return response.status(200).send(registrationChanges);
        } catch (error) {
            logger.error(`Exception occurred in getRegistrationChangeDashboard ${error}`);
            return response.status(500).send({
                message: process.env.NODE_ENV == AppConstants.development ? AppConstants.errMessage + error : AppConstants.errMessage
            });
        }
    }

    @Authorized()
    @Post("/registrationchange/export")
    public async exportRegistrationChange(
        @HeaderParam('authorization') currentUser: User,
        @QueryParam('sortBy') sortBy: string = undefined,
        @QueryParam('sortOrder') sortOrder: 'ASC' | 'DESC' = undefined,
        @Body() requestBody: any,
        @Res() response: Response
    ) {
        try {
            const organisationId = await this.organisationService.findByUniquekey(requestBody.organisationId);
            const { registrationChanges } = await this.deRegisterService.getRegistrationDashboard(organisationId, requestBody, sortBy, sortOrder);

            let result = [];
            if (registrationChanges) {
                result = registrationChanges.map(registrationChange => ({
                    'Current Participant': registrationChange['userName'],
                    'Current Affiliate': registrationChange['affiliateName'],
                    'Current Competition Organiser': registrationChange['compOrganiserName'],
                    'Current Competition': registrationChange['competitionName'],
                    'Transfer Affiliate': getRegistrationField(registrationChange, 'transferAffOrgName', 'transferAffOrgName', 'tAffStatus', 'tAffApproved'),
                    'Transfer Competition Organiser': getRegistrationField(registrationChange, 'transferCompOrgName', 'tCompOrgApproved', 'tCompOrgStatus', 'tCompOrgApproved'),
                    'Transfer Competition': registrationChange['transferCompName'],
                    'Approvals Membership Type': registrationChange['membershipTypeName'],
                    'Approvals Paid': registrationChange['paid'],
                    'Approvals Type': registrationChange['regChangeType'],
                    'Approvals Affiliate': getApproveValue(registrationChange['affiliateApproved'], registrationChange['affiliateApprovedStatus']),
                    'Approvals Competition Organiser': getApproveValue(registrationChange['compOrganiserApproved'], registrationChange['compOrgApprovedStatus']),
                    'Approvals State': getApproveValue(registrationChange['stateApproved'], registrationChange['stateApprovedStatus']),
                }))
            } else {
                result.push({
                    'Current Participant': 'N/A',
                    'Current Affiliate': 'N/A',
                    'Current Competition Organiser': 'N/A',
                    'Current Competition': 'N/A',
                    'Transfer Affiliate': 'N/A',
                    'Transfer Competition Organiser': 'N/A',
                    'Transfer Competition': 'N/A',
                    'Approvals Membership Type': 'N/A',
                    'Approvals Paid': 'N/A',
                    'Approvals Type': 'N/A',
                    'Approvals Affiliate': 'N/A',
                    'Approvals Competition Organiser': 'N/A',
                    'Approvals State': 'N/A',
                });
            }

            response.setHeader('Content-disposition', 'attachment; filename=registration-change.csv');
            response.setHeader('content-type', 'text/csv');
            fastcsv.write(result, { headers: true })
                .on("finish", function () {
                })
                .pipe(response);
        } catch (error) {
            logger.error(`Exception occurred in exportRegistrationChange ${error}`);
            return response.status(500).send({
                message: process.env.NODE_ENV == AppConstants.development ? AppConstants.errMessage + error : AppConstants.errMessage
            });
        }
    }

    @Authorized()
    @Post("/registrationchange/review")
    public async getRegistrationChangeReview(
        @HeaderParam("authorization") currentUser: User,
        @Body() requestBody: any,
        @Res() response: Response
    ) {
        try {
            let organisationId = await this.organisationService.findByUniquekey(requestBody.organisationId);
            let registrationChanges = await this.deRegisterService.getRegistrationChangeReview(organisationId, requestBody);
            return response.status(200).send(registrationChanges);
        } catch (error) {
            logger.error(`Exception occurred in getRegistrationChangeReview ${error}`);
            return response.status(500).send({
                message: process.env.NODE_ENV == AppConstants.development ? AppConstants.errMessage + error : AppConstants.errMessage
            });
        }
    }

    @Authorized()
    @Post("/registrationchange/review/save")
    public async saveRegistrationChangeReview(
        @HeaderParam("authorization") currentUser: User,
        @Body() requestBody: any,
        @Res() response: Response
    ) {
        try {
            let organisationId = await this.organisationService.findByUniquekey(requestBody.organisationId);
            // let competitionId = await this.competitionRegService.findByUniquekey(requestBody.competitionId);

            let isFromOrg = requestBody.isFromOrg;
            let refundTypeRefId = requestBody.declineReasonRefId == null ? requestBody.refundTypeRefId : AppConstants.DECLINED;

            if (isFromOrg == 1) {
                if (requestBody.organisationTypeRefId == 2) {
                    if (isArrayPopulated(requestBody.invoices)) {
                        let feeMap = new Map();
                        let feeAmtMap = new Map();
                        let appArr = [];

                        for (let fee of requestBody.invoices) {
                            let key = fee.feeType;

                            let feeTemp = feeMap.get(key);

                            let appAmt = new ApprovalRefund();
                            appAmt.approvalId = 0;
                            appAmt.createdBy = currentUser.id;
                            appAmt.feeType = fee.feeType;
                            appAmt.invoiceId = fee.invoiceId;
                            appAmt.transactionId = fee.transactionId;
                            appAmt.refundAmount = feeIsNull(fee.refundAmount);

                            if (feeTemp == undefined) {
                                let orgRefTypeId = fee.feeType == "membership" ? 3 : (fee.feeType == "nomination" ? 4 : 2);
                                let approval = new Approval();
                                approval.id = 0;
                                approval.deRegisterId = requestBody.deRegisterId;
                                approval.declineReasonRefId = requestBody.declineReasonRefId;
                                approval.otherInfo = requestBody.otherInfo;
                                approval.payingOrgId = organisationId;
                                approval.refundTypeRefId = refundTypeRefId;
                                approval.orgRefTypeId = orgRefTypeId;
                                approval.createdBy = currentUser.id;
                                appArr.push(approval);
                                feeMap.set(key, approval);
                                let amtArr = [];
                                amtArr.push(appAmt);
                                feeAmtMap.set(approval.orgRefTypeId, amtArr)
                            } else {
                                let feeAmtTemp = feeAmtMap.get(feeTemp.orgRefTypeId);
                                feeAmtTemp.push(appAmt);
                            }
                        }

                        if (isArrayPopulated(appArr)) {
                            for (let item of appArr) {
                                let orgRefTypeId = item.orgRefTypeId;
                                item.orgRefTypeId = orgRefTypeId == 4 ? 2 : orgRefTypeId;
                                let res = await this.approvalService.createOrUpdate(item);
                                let refundArr = feeAmtMap.get(orgRefTypeId);
                                if (isArrayPopulated(refundArr)) {
                                    for (let a of refundArr) {
                                        a.approvalId = res.id;
                                        await this.approvalRefundService.createOrUpdate(a);
                                    }
                                }
                            }
                        }
                    }
                } else {
                    // if (requestBody.organisationId == requestBody.compOrgId) {
                    //     orgTypeRefId = 1;
                    // } else if (requestBody.organisationId == requestBody.affOrgId) {
                    //     orgTypeRefId = 2;
                    // }

                    let approval = new Approval();
                    approval.id = 0;
                    approval.deRegisterId = requestBody.deRegisterId;
                    approval.declineReasonRefId = requestBody.declineReasonRefId;
                    approval.otherInfo = requestBody.otherInfo;
                    approval.payingOrgId = organisationId;
                    // approval.refundAmount = requestBody.refundAmount;
                    approval.refundTypeRefId = refundTypeRefId
                    approval.createdBy = currentUser.id;
                    approval.orgRefTypeId = requestBody.orgRefTypeId;
                    let res = await this.approvalService.createOrUpdate(approval);

                    if (isArrayPopulated(requestBody.invoices)) {
                        for (let fee of requestBody.invoices) {
                            let appAmt = new ApprovalRefund();
                            appAmt.approvalId = res.id;
                            appAmt.createdBy = currentUser.id;
                            appAmt.feeType = fee.feeType;
                            appAmt.invoiceId = fee.invoiceId;
                            appAmt.transactionId = fee.transactionId;
                            appAmt.refundAmount = fee.refundAmount;
                            await this.approvalRefundService.createOrUpdate(appAmt);
                        }
                    }
                }
            } else {
                let approval = new Approval();
                approval.id = 0;
                approval.deRegisterId = requestBody.deRegisterId;
                approval.declineReasonRefId = requestBody.declineReasonRefId;
                approval.otherInfo = requestBody.otherInfo;
                approval.payingOrgId = organisationId;
                approval.refundTypeRefId = refundTypeRefId
                approval.createdBy = currentUser.id;
                approval.orgRefTypeId = requestBody.orgRefTypeId;
                await this.approvalService.createOrUpdate(approval);
            }

            let deRegister = await this.deRegisterService.findById(requestBody.deRegisterId);

            let statusTrackData = isNullOrUndefined(deRegister.statusTrackData) ? JSON.parse(JSON.stringify(deRegister.statusTrackData)) : [];

            if (deRegister.regChangeTypeRefId == AppConstants.DE_REGISTER) {
                statusTrackData.sort((a, b) => (Number(a.orgRefTypeId) > Number(b.orgRefTypeId)) ? 1 : -1);
                this.updateStatusTrackData(statusTrackData, organisationId, requestBody, refundTypeRefId);
            } else if (deRegister.regChangeTypeRefId == AppConstants.TRANSFER) {
                statusTrackData.sort((a, b) => (Number(a.orgRefTypeId) > Number(b.orgRefTypeId)) ? 1 : -1);
                let statusToTrack = statusTrackData.find(x => x.regChangeTypeRefId == 1 && x.statusRefId == 0);
                if (statusToTrack) {
                    this.updateStatusTrackData(statusTrackData, organisationId, requestBody, refundTypeRefId);
                }

                this.updateTransferStatusTrackData(statusTrackData, requestBody, statusToTrack);
            }

            deRegister.statusTrackData = JSON.stringify(statusTrackData);

            await this.deRegisterService.createOrUpdate(deRegister);

            let allStatusGiven = statusTrackData.find(x => x.statusRefId == 0);

            if (!isNullOrUndefined(allStatusGiven)) {
                let status = null;
                if (deRegister.regChangeTypeRefId == AppConstants.DE_REGISTER) {
                    if (statusTrackData[0].statusRefId == AppConstants.DECLINED) {
                        status = AppConstants.DECLINED;
                    }
                } else {
                    let declined = statusTrackData.find(x => x.statusRefId == AppConstants.DECLINED);
                    if (isNotNullAndUndefined(declined)) {
                        status = AppConstants.DECLINED;
                    }
                }

                if (status == AppConstants.DECLINED) {
                    await this.updateDeRegistrationStatus(currentUser.id, deRegister, AppConstants.DECLINED_DE_REGISTRATION);

                    if (deRegister.regChangeTypeRefId == AppConstants.TRANSFER) {
                        let organisation = await this.organisationService.findById(deRegister.organisationId);
                        let newOrganisation = await this.organisationService.findById(deRegister.transferOrganisationId);
                        let newCompetition = await this.competitionRegService.findById(deRegister.transferCompetitionId);
                        let userDb = await this.userService.findById(deRegister.userId);
                        let mailObj = await this.communicationTemplateService.findById(19);
                        await this.userService.sendTransferMail(userDb, mailObj, currentUser.id, organisation.name, newOrganisation, newCompetition, deRegister.id)
                    }
                } else {
                    let approvalRefundAmounts = await this.approvalRefundService.getApprovalRefunds(deRegister.id);
                    // let validateApproval = await this.validateApprovalRefundAmounts(approvalRefundAmounts);
                    // if(validateApproval.flag) {
                    //     return response.status(212).send(validateApproval.message);
                    // }
                    await this.performRefundOperation(approvalRefundAmounts, organisationId, deRegister, currentUser.id, refundTypeRefId);
                    await this.updateDeRegistrationStatus(currentUser.id, deRegister, AppConstants.DE_REGISTERED);
                    await this.deleteDeRegisterUserRecords(deRegister, currentUser.id, approvalRefundAmounts);
                }
            }

            return response.status(200).send({ message: "Successfully updated" });
        } catch (error) {
            logger.error(`Exception occurred in saveRegistrationChangeReview ${error}`);
            return response.status(500).send({
                message: process.env.NODE_ENV == AppConstants.development ? AppConstants.errMessage + error : AppConstants.errMessage
            });
        }
    }

    @Authorized()
    @Post("/deregisterortransfer/cancel")
    public async cancelDeRegistration(
        @HeaderParam("authorization") currentUser: User,
        @Body() requestBody: any,
        @Res() response: Response
    ) {
        try {
            if (currentUser) {
                const deRegisterId = requestBody.deRegisterId;
                let deRegisterObj = await this.deRegisterService.findById(deRegisterId);
                if (deRegisterObj) {
                    let statusTrackData = isNullOrUndefined(deRegisterObj.statusTrackData) ? JSON.parse(JSON.stringify(deRegisterObj.statusTrackData)) : [];

                    if (deRegisterObj.statusRefId == 1) {
                        let statusTrackStatus = statusTrackData.find(x => x.statusRefId != 0);
                        if (statusTrackStatus) {
                            response.status(212).send({ message: AppConstants.cancelDeRegOrTrValidationMsg });
                        } else {
                            let deReg = new DeRegister();
                            deReg.id = deRegisterObj.id;
                            deReg.isDeleted = 1;
                            deReg.updatedBy = currentUser.id;
                            deReg.updatedOn = new Date();

                            this.deRegisterService.createOrUpdate(deReg);
                            let msg = null;
                            if (deRegisterObj.regChangeTypeRefId == RegistrationChangeType.DeRegister) {
                                msg = AppConstants.deRegistrationCancelledMsg;
                            } else {
                                msg = AppConstants.transferCancelledMsg;
                            }
                            response.status(200).send({ message: msg });
                        }
                    } else {
                        response.status(212).send({ message: AppConstants.cancelDeRegOrTrValidationMsg });
                    }
                } else {
                    response.status(212).send('Cannot found the deRegister Id');
                }
            }
        } catch (error) {
            logger.error(`Exception occurred in cancelDeRegistration ${error}`);
            return response.status(500).send({
                message: process.env.NODE_ENV == AppConstants.development ? AppConstants.errMessage + error : AppConstants.errMessage
            });
        }
    }

    @Authorized()
    @Post("/transfer/competitions")
    public async getTransferCompetitions(
        @HeaderParam("authorization") currentUser: User,
        @Body() requestBody: any,
        @Res() response: Response
    ) {
        try {
            // let organisationId = await this.organisationService.findByUniquekey(requestBody.organisationId);
            let competitionId = await this.competitionRegService.findByUniquekey(requestBody.competitionId);
            let result = await this.deRegisterService.getTransferCompetitions(requestBody, competitionId);

            return response.status(200).send(result);
        } catch (error) {
            logger.error(`Exception occurred in getTransferCompetitions ${error}`);
            return response.status(500).send({
                message: process.env.NODE_ENV == AppConstants.development ? AppConstants.errMessage + error : AppConstants.errMessage
            });
        }
    }

    private async performRefundOperation(approvalRefundAmounts, organisationId, deRegister: DeRegister, createdBy, deRegisterStatus) {
        try {
            if (isArrayPopulated(approvalRefundAmounts)) {
                let invoiceMap = new Map();
                let invoiceArr = [];
                for (let item of approvalRefundAmounts) {
                    let invoiceData = await this.invoiceService.findById(item.invoiceId);
                    let key = invoiceData.id;
                    let updateObj = {
                        invoiceId: key,
                        userId: item.userId
                    }
                    if (invoiceMap.get(key) == undefined) {
                        invoiceMap.set(key, updateObj);
                        invoiceArr.push(updateObj);
                    }
                    if (isNullOrUndefined(invoiceData)) {

                        let transData = await this.transactionService.findById(item.transactionId);

                        let userAmount = 0;
                        let balanceAmount = 0;
                        if (transData.governmentVoucherStatusRefId == 2 || transData.governmentVoucherStatusRefId == 3) {
                            userAmount = (feeIsNull(transData.feeAmount) + feeIsNull(transData.gstAmount))
                                - (feeIsNull(transData.discountAmount) + feeIsNull(transData.familyDiscountAmount)
                                    + feeIsNull(transData.governmentVoucherAmount));

                            balanceAmount = feeIsNull(item.refundAmount) - feeIsNull(userAmount);
                        }

                        const STRIPE_TOTAL_FEE = feeIsNull(item.refundAmount);
                        const STRIPE_USER_FEE = feeIsNull(userAmount);
                        const STRIPE_BALANCE_FEE = feeIsNull(balanceAmount);

                        let guidKey = uuidv4();
                        let refundIntent = null;

                        if (transData && transData.transactionTypeRefId == 2) {

                            if (transData.governmentVoucherStatusRefId == 2 || transData.governmentVoucherStatusRefId == 3) {
                                if (transData.stripeTransactionId != null && STRIPE_USER_FEE > 0) {
                                    this.performTransferReversal(transData, STRIPE_USER_FEE, guidKey);

                                    if (invoiceData.stripeSourceTransaction != null) {
                                        refundIntent = await this.refundIntent(STRIPE_USER_FEE, invoiceData.stripeSourceTransaction, transData, guidKey);
                                        console.log(`refundIntent ${JSON.stringify(refundIntent)}`);
                                        let trxn = await this.transactionService.createTransactionObject(item, deRegister, transData, createdBy, refundIntent, guidKey)
                                        this.transactionService.createOrUpdate(trxn);
                                    }
                                }
                                if (transData.governmentVoucherStatusRefId == 2 && transData.paymentIntentId != null && STRIPE_BALANCE_FEE > 0) {
                                    refundIntent = await this.refundIntent(STRIPE_BALANCE_FEE, transData.paymentIntentId, transData, guidKey);
                                    console.log(`refundIntent ${JSON.stringify(refundIntent)}`);
                                    let trxn = await this.transactionService.createTransactionObject(item, deRegister, transData, createdBy, refundIntent, guidKey)
                                    this.transactionService.createOrUpdate(trxn);
                                }
                            }
                            else if (STRIPE_TOTAL_FEE > 0 && transData.stripeTransactionId != null) {
                                this.transactionService.performTransferReversal(transData, STRIPE_TOTAL_FEE, guidKey);

                                if (invoiceData.stripeSourceTransaction != null && invoiceData.paymentStatus == 'success') {
                                    refundIntent = await this.transactionService.refundIntent(STRIPE_TOTAL_FEE, invoiceData.stripeSourceTransaction, transData, guidKey);
                                    console.log(`refundIntent ${JSON.stringify(refundIntent)}`);
                                    let trxn = await this.transactionService.createTransactionObject(item, deRegister, transData, createdBy, refundIntent, guidKey)
                                    this.transactionService.createOrUpdate(trxn);
                                }
                            }
                        }
                        else if (STRIPE_TOTAL_FEE > 0 && transData && transData.paymentIntentId != null) {
                            refundIntent = await this.refundIntent(STRIPE_TOTAL_FEE, transData.paymentIntentId, transData, guidKey);
                            console.log(`refundIntent ${JSON.stringify(refundIntent)}`);
                            let trxn = await this.transactionService.createTransactionObject(item, deRegister, transData, createdBy, refundIntent, guidKey)
                            this.transactionService.createOrUpdate(trxn);
                        }



                        this.transactionService.updateTransactionStatus(item.transactionId, TransactionStatus.Deregistered)



                        // if(balance > 0 && transData && transData.transactionTypeRefId == 2) {
                        //     if(invoiceData.stripeSourceTransaction && userAmount > 0) {
                        //         const STRIPE_TOTAL_USER_FEE = formatFeeForStripe1(userAmount);

                        //         refundIntent = await this.refundIntent(STRIPE_TOTAL_USER_FEE,
                        //             invoiceData.stripeSourceTransaction, transData, guidKey);

                        //         this.performTransferReversal(transData, STRIPE_TOTAL_USER_FEE, guidKey);
                        //     }

                        //     if(transData.governmentVoucherStatusRefId == 2 && transData.paymentIntentId != null) {
                        //         const STRIPE_TOTAL_ORG_FEE = formatFeeForStripe1(balance);
                        //         refundIntent = await this.refundIntent(STRIPE_TOTAL_ORG_FEE,
                        //             transData.paymentIntentId, transData, guidKey);
                        //     }
                        // }
                        // else if(STRIPE_TOTAL_FEE > 0 && invoiceData.stripeSourceTransaction && transData.transactionTypeRefId == 2) {
                        //     refundIntent = await this.refundIntent(STRIPE_TOTAL_FEE,
                        //         invoiceData.stripeSourceTransaction, transData, guidKey);

                        //     this.performTransferReversal(transData, STRIPE_TOTAL_FEE, guidKey);
                        // }
                        // else if (STRIPE_TOTAL_FEE > 0 && transData && transData.paymentIntentId != null) {
                        //     refundIntent = await this.refundIntent(STRIPE_TOTAL_FEE, transData.paymentIntentId, transData, guidKey);
                        // }

                        // const trxn = new Transaction();
                        // trxn.id = 0;
                        // trxn.invoiceId = item.invoiceId;
                        // trxn.participantId = deRegister.userId;
                        // trxn.createdBy = createdBy;
                        // trxn.feeAmount = -item.refundAmount;
                        // trxn.feeType = item.feeType;
                        // trxn.feeTypeRefId = transData != null ? transData.feeTypeRefId : 0;
                        // trxn.statusRefId = (refundIntent ? (refundIntent.status === "succeeded" ? AppConstants.PAID : AppConstants.NOT_PAID) : AppConstants.PAID);
                        // trxn.membershipProductMappingId = deRegister.membershipMappingId;
                        // trxn.competitionId = deRegister.competitionId;
                        // trxn.organisationId = item.payingOrgId;
                        // trxn.paymentOptionRefId = transData != null ? transData.paymentOptionRefId : 0;
                        // trxn.paymentFeeTypeRefId = transData != null ? transData.paymentFeeTypeRefId : 0;
                        // trxn.stripeTransactionId = refundIntent ? refundIntent.id : null;
                        // trxn.transactionTypeRefId = AppConstants.TRANSACTION_TYPE_REFUND
                        // trxn.divisionId = deRegister.divisionId;
                        // trxn.referenceId = guidKey;
                        // await this.transactionService.createOrUpdate(trxn);
                    }
                }
                invoiceArr.map((inv, index) => {
                    this.transactionService.updateTransactionStatusByInvoiceId(inv, TransactionStatus.Deregistered);
                });

                if (deRegister.regChangeTypeRefId == AppConstants.DE_REGISTER) {
                    await this.mailForDeRegistraton(deRegister, createdBy)
                } else {
                    // Transfer Mail
                    let organisation = await this.organisationService.findById(deRegister.organisationId);
                    let newOrganisation = await this.organisationService.findById(deRegister.transferOrganisationId);
                    let newCompetition = await this.competitionRegService.findById(deRegister.transferCompetitionId);

                    // let compOrg = await this.organisationService.findById(competition.organisationId);
                    let userDb = await this.userService.findById(deRegister.userId);
                    let mailObj = null
                    if (deRegisterStatus == 1) {
                        mailObj = await this.communicationTemplateService.findById(18)
                    } else if (deRegisterStatus == 3) {
                        mailObj = await this.communicationTemplateService.findById(19)
                    }

                    await this.userService.sendTransferMail(userDb, mailObj, createdBy, organisation.name, newOrganisation, newCompetition, deRegister.id)
                }
            }
        } catch (error) {
            logger.error(`Exception occurred in performRefundOperation ${error}`);
            throw error;
        }
    }

    private async validateApprovalRefundAmounts(approvalRefundAmounts) {
        try {
            if (isArrayPopulated(approvalRefundAmounts)) {
                for (let app of approvalRefundAmounts) {
                    let transData = await this.transactionService.findById(app.transactionId);
                    if (transData.transactionTypeRefId == 2) {
                        let userAmount = (feeIsNull(transData.feeAmount) + feeIsNull(transData.gstAmount))
                            - (feeIsNull(transData.discountAmount) + feeIsNull(transData.familyDiscountAmount)
                                + feeIsNull(transData.governmentVoucherAmount));
                        if (transData.stripeTransactionId == null && userAmount > 0 && transData.statusRefId == 2) {
                            return { flag: 1, message: 'StripeTransactionId is empty' };
                        }
                        else if (transData.governmentVoucherStatusRefId == 2 && transData.paymentIntentId == null && app.payingOrgId != app.organisationId) {
                            return { flag: 1, message: AppConstants.EmptyPaymentIntent };
                        }
                    }
                    else if (transData.governmentVoucherStatusRefId == 2 && transData.paymentIntentId == null && app.payingOrgId != app.organisationId) {
                        return { flag: 1, message: AppConstants.EmptyPaymentIntent };
                    }
                    else if (((transData.transactionTypeRefId == 4) || (transData.transactionTypeRefId == 5) ||
                        (transData.transactionTypeRefId == 6)) && (transData.paymentIntentId == null) && app.payingOrgId != app.organisationId) {
                        return { flag: 1, message: AppConstants.EmptyPaymentIntent };
                    }
                }
            }
            return { flag: 0, message: null };
        }
        catch (error) {
            throw error;
        }
    }

    private async refundIntent(refundAmount, chargeId, transaction, guidKey) {
        try {
            let obj = {
                transactionId: transaction ? transaction.id : 0,
                partialRefund: "PARTIALREFUND" + "#" + guidKey
            }
            const refund = await stripe.refunds.create({
                amount: refundAmount,
                payment_intent: chargeId,
                metadata: obj
            });
            return refund;
        } catch (error) {
            logger.error(`Exception occurred in refundIntent ${error}`);
        }
    }

    private async performTransferReversal(transaction, totalFee, guidKey) {
        try {
            logger.debug(`Inside the performTransferReversal ${transaction.stripeTransactionId} ::${totalFee}`)

            let obj = {
                transferReversal: "TRANSFERREVERSAL" + "#" + guidKey
            }

            if (transaction.stripeTransactionId) {
                const reversal = await stripe.transfers.createReversal(
                    transaction.stripeTransactionId,
                    {
                        amount: totalFee,
                        metadata: obj
                    },
                );
            }
        } catch (error) {
            logger.error(`Exception occurred in performTransferReversal ${error}`);
        }
    }

    private async updateDeRegistrationStatus(userId, deRegister: DeRegister, statusRefId) {
        try {
            deRegister.updatedBy = userId;
            deRegister.updatedOn = new Date();
            deRegister.statusRefId = statusRefId;

            await this.deRegisterService.createOrUpdate(deRegister);

            // let getApprovalData = await this.approvalService.getApprovalData(requestBody.deRegisterId);
            // if (isNullOrUndefined(requestBody.approvals)) {
            //     let stateApproved = requestBody.approvals.stateApproved;
            //     let compOrganiserApproved = requestBody.approvals.compOrganiserApproved;
            //     let affiliateApproved = requestBody.approvals.affiliateApproved;
            //     let stateStatus = true;
            //     let compStatus = true;
            //     let affStatus = true;
            //     if (stateApproved != "N/A") {
            //         if (stateApproved == "P") {
            //             stateStatus = false;
            //         } else {
            //             let stateData = getApprovalData.find(x => x.orgRefTypeId == 3);
            //             if (!isNullOrUndefined(stateData)) {
            //                 stateStatus = false;
            //             }
            //         }
            //     }
            //     if (compOrganiserApproved != "N/A") {
            //         if (compOrganiserApproved == "P") {
            //             compStatus = false;
            //         } else {
            //             let compData = getApprovalData.find(x => x.orgRefTypeId == 1);
            //             if (!isNullOrUndefined(compData)) {
            //                 compStatus = false;
            //             }
            //         }
            //     }
            //     if (affiliateApproved != "N/A") {
            //         if (affiliateApproved == "P") {
            //             affStatus = false;
            //         } else {
            //             let compData = getApprovalData.find(x => x.orgRefTypeId == 2);
            //             if (!isNullOrUndefined(compData)) {
            //                 affStatus = false;
            //             }
            //         }
            //     }
            //     if (affStatus && stateStatus && compStatus) {
            //         let deRegister = new DeRegister();
            //         deRegister.id = requestBody.deRegisterId;
            //         deRegister.updatedBy = userId;
            //         deRegister.updatedOn = new Date();
            //         deRegister.statusRefId = AppConstants.DE_REGISTERED;
            //         await this.deRegisterService.createOrUpdate(deRegister);
            //     }
            // }
        } catch (error) {
            logger.error(`Exception occurred in updateDeRegistrationStatus ${error}`);
            throw error;
        }
    }

    private async deleteDeRegisterUserRecords(deRegister: DeRegister, updatedBy, invoices) {
        try {
            let userRegistration = await this.userRegistrationService.findByUserId(deRegister.userId, deRegister.registrationId);
            let userRegistrationId = 0;
            if (isArrayPopulated(userRegistration)) {
                userRegistrationId = userRegistration[0].id;
            }

            // await this.deRegisterService.deletePlayer(deRegister.userId, userRegistrationId, deRegister.divisionId, updatedBy);
            // await this.deRegisterService.deleteNonPlayer(deRegister.userId, userRegistrationId, deRegister.membershipMappingId, updatedBy, deRegister.competitionId);
            // await this.deRegisterService.deleteUserRegistration(userRegistrationId, updatedBy, deRegister.competitionId, deRegister.userId);
            this.deRegisterService.updateLivescorePlayerStatus(deRegister.userId, userRegistrationId, deRegister.divisionId, updatedBy)
            this.deRegisterService.updatePlayerStatus(deRegister.userId, userRegistrationId, deRegister.divisionId, updatedBy);
            this.deRegisterService.updateNonPlayerStatus(deRegister.userId, userRegistrationId, deRegister.membershipMappingId, updatedBy, deRegister.competitionId);

            for (let item of invoices) {
                let divisionId = (deRegister.divisionId ? deRegister.divisionId : 0);
                // await this.deRegisterService.deleteTransaction(
                //     item.invoiceId, deRegister.userId, deRegister.competitionId,
                //     deRegister.membershipMappingId, item.feeType, updatedBy,
                //     (deRegister.divisionId ? deRegister.divisionId : 0)
                // );
                let membershipProdDivisionId = 0;
                if (divisionId != 0) {
                    let compDivObj = await this.competitionDivisionService.findById(divisionId);
                    if (compDivObj) {
                        membershipProdDivisionId = compDivObj.competitionMembershipProductDivisionId;
                    }
                }

                await this.deRegisterService.deleteInstalmetnTransaction(
                    item.invoiceId, deRegister.userId, deRegister.competitionId,
                    deRegister.membershipMappingId, item.feeType, updatedBy,
                    membershipProdDivisionId
                );
            }
        } catch (error) {
            logger.error(`Exception occurred in deleteDeRegisterUserRecords ${error}`);
            throw error;
        }
    }

    private updateStatusTrackData(statusTrack, organisationId, requestBody, refundTypeRefId) {
        try {
            let statusTrackData = statusTrack.filter(x => x.regChangeTypeRefId == 1);
            let statusTransferTrackData = statusTrack.filter(x => x.regChangeTypeRefId == 2);
            let statusId = requestBody.declineReasonRefId == null ? AppConstants.APPROVED : AppConstants.DECLINED;

            if (isArrayPopulated(statusTrackData)) {
                let declined = (statusTrackData[0].statusRefId == AppConstants.DECLINED ? statusTrackData[0] : null);
                let approved = ((statusTrackData[0].statusRefId == AppConstants.APPROVED || statusTrackData[0].statusRefId == AppConstants.PARTIAL_APPROVED) ? statusTrackData[0] : null);

                let index = 0;
                for (let item of statusTrackData) {
                    if (!isNullOrUndefined(declined) && !isNullOrUndefined(approved)) {
                        if (statusId == AppConstants.DECLINED) {
                            if (item.orgId == organisationId) {
                                item.statusRefId = AppConstants.DECLINED;
                            } else {
                                item.statusRefId = -1;
                            }
                        } else {
                            if (item.orgId == organisationId) {
                                item.statusRefId = requestBody.declineReasonRefId == null ? refundTypeRefId : AppConstants.DECLINED;
                            }
                        }
                    } else {
                        if (item.orgId == organisationId) {
                            item.statusRefId = requestBody.declineReasonRefId == null ? refundTypeRefId : AppConstants.DECLINED;
                        }
                    }
                    index++;
                }

                if (isArrayPopulated(statusTransferTrackData)) {
                    if (statusId == AppConstants.DECLINED) {
                        for (let item of statusTransferTrackData) {
                            item.statusRefId = -1;
                        }
                    }
                }
            }
        } catch (error) {
            throw error;
        }
    }

    private updateTransferStatusTrackData(statusTrack, requestBody, statusToTrack) {
        try {
            let statusId = requestBody.declineReasonRefId == null ? AppConstants.APPROVED : AppConstants.DECLINED;
            let statusToTrackData = statusTrack.filter(x => x.regChangeTypeRefId == 2);
            if (!isNotNullAndUndefined(statusToTrack)) {
                let checkStatus = statusToTrackData.find(x => x.statusRefId == 0);
                if (isNullOrUndefined(checkStatus)) {
                    for (let item of statusToTrackData) {
                        item.statusRefId = statusId;
                    }
                }
            }
        } catch (error) {
            throw error;
        }
    }

    private getTransferStatusTrackData(transactionData, organisationId, requestBody, competition) {
        try {
            let statusTrackArr = [];
            let transData = transactionData.filter(x => x.feeType != "membership");

            let obj = {
                orgId: organisationId,
                feeType: null,
                statusRefId: 0,
                orgRefTypeId: 0,
                regChangeTypeRefId: AppConstants.TRANSFER,
                organisationUniqueKey: requestBody.transfer.organisationId
            }

            if (requestBody.transfer.competitionId == requestBody.competitionId) {
                if (organisationId != competition.organisationId) {
                    obj.orgRefTypeId = 12;
                    statusTrackArr.push(obj);
                    if (isArrayPopulated(transData)) {
                        transData = transData.filter(x => x.feeType != "competition");
                    }
                }
            } else if (requestBody.transfer.competitionId != requestBody.competitionId) {
                if (organisationId == competition.organisationId) {
                    obj.orgRefTypeId = 11;
                } else {
                    obj.orgRefTypeId = 12;
                }
                statusTrackArr.push(obj);
            }

            if (isArrayPopulated(transData)) {
                statusTrackArr.push(...transData);
            }

            return statusTrackArr;
        } catch (error) {
            throw error;
        }
    }

    @Authorized()
    @Get("/mailforderegister")
    public async mailForDeRegistration(
        @QueryParam("deRegisterId") deRegisterId: number,
        @HeaderParam("authorization") currentUser: User,
        @Res() response: Response
    ) {
        try {
            let deRegister = await this.deRegisterService.findById(deRegisterId)
            await this.mailForDeRegistraton(deRegister, currentUser.id);
            return response.status(200).send('Success');
        } catch (error) {
            logger.error(`Exception occurred in mail to deReister ${error}`);
            return response.status(500).send({
                message: process.env.NODE_ENV == AppConstants.development ? AppConstants.errMessage + error : AppConstants.errMessage
            });
        }
    }

    @Authorized()
    @Get("/mailfortransfer")
    public async mailForTransfer(
        @QueryParam("deRegisterId") deRegisterId: number,
        @QueryParam("deRegisterStatus") deRegisterStatus: number,
        @HeaderParam("authorization") currentUser: User,
        @Res() response: Response
    ) {
        try {
            let deRegister = await this.deRegisterService.findById(deRegisterId)
            // Transfer Mail
            let organisation = await this.organisationService.findById(deRegister.organisationId);
            let newOrganisation = await this.organisationService.findById(deRegister.transferOrganisationId);
            let newCompetition = await this.competitionRegService.findById(deRegister.transferCompetitionId);
            // let compOrg = await this.organisationService.findById(competition.organisationId);
            let userDb = await this.userService.findById(deRegister.userId);
            let mailObj = null
            if (deRegisterStatus == 1)
                mailObj = await this.communicationTemplateService.findById(18)
            else if (deRegisterStatus == 3)
                mailObj = await this.communicationTemplateService.findById(19)
            await this.mailForDeRegistraton(deRegister, currentUser.id);
            await this.userService.sendTransferMail(userDb, mailObj, currentUser.id, organisation.name, newOrganisation, newOrganisation, deRegister.id)

            return response.status(200).send('Success');
        } catch (error) {
            logger.error(`Exception occurred in mail to transfer ${error}`);
            return response.status(500).send({
                message: process.env.NODE_ENV == AppConstants.development ? AppConstants.errMessage + error : AppConstants.errMessage
            });
        }
    }

    private async mailForDeRegistraton(deRegister: DeRegister, createdBy) {
        try {
            let result = await this.approvalRefundService.getDataForEmail(deRegister.id);
            let amount = 0;
            let approvalMap = new Map();
            let orgList = []
            let isDecline = 0

            if (isArrayPopulated(result)) {
                for (let res of result) {
                    amount += Number(res.refundAmount);
                    if (approvalMap.get(res.payingOrgId) == undefined) {
                        let orgObj = {
                            orgName: res.organisationName,
                            status: res.declineReasonRefId,
                            reason: res.reason
                        }
                        if (orgObj.status != null && orgObj.status != 0) {
                            isDecline = 1
                        }
                        orgList.push(orgObj);
                        approvalMap.set(res.payingOrgId, res)
                    }
                }
            }
            // DeRegister Mail
            let organisation = await this.organisationService.findById(deRegister.organisationId);
            let competition = await this.competitionRegService.findById(deRegister.competitionId)
            let compOrg = await this.organisationService.findById(competition.organisationId);
            let userDb = await this.userService.findById(deRegister.userId);
            let mailObj = await this.communicationTemplateService.findById(17)
            await this.userService.sendDeRegisterMail(userDb, mailObj, createdBy, orgList, organisation, compOrg.name, amount, deRegister.id, isDecline)
        } catch (error) {
            logger.error(`Exception occurred in mail to deReister ${error}`);
            throw error;
        }
    }
}
