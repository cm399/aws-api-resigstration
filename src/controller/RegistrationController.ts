import { Response } from 'express';
import * as fastcsv from 'fast-csv';
import moment from "moment";
import { Authorized, Body, Delete, Get, HeaderParam, JsonController, Post, QueryParam, Res, UploadedFiles } from "routing-controllers";
import AxiosHttpApi, {VoucherStatus} from "../http/governmentVoucher/AxiosApi";
import { logger } from "../logger";
import { OrgRegistrationParticipantDraft } from "../models/registrations/OrgRegistrationParticipantDraft";
import { Registration } from "../models/registrations/Registration";
import { RegistrationTrack } from "../models/registrations/RegistrationTrack";
import { TransactionAudit } from "../models/registrations/TransactionAudit";
import { UserRegistration } from "../models/registrations/UserRegistration";
import { UserRegistrationDraft } from "../models/registrations/UserRegistrationDraft";
import { UserRoleEntity } from "../models/security/UserRoleEntity";
import { User } from "../models/security/User";
import {
    feeIsNull,
    fileExt,
    fileUploadOptions,
    getAge,
    isNotNullAndUndefined,
    isNullOrEmpty,
    isNullOrUndefined,
    isNullOrZero,
    isPhoto,
    isStringNullOrEmpty, lenientObjectCompare,
    lenientStrCompare,
    md5,
    timestamp,
    uuidv4
} from "../utils/Utils";
import AppConstants from "../validation/AppConstants";
import { validateReqFilter } from "../validation/Validation";
import { BaseController } from "./BaseController";
import {RegisteringYourself} from "../enums/enums";

@JsonController('/api')
export class RegistrationController extends BaseController {


    @Authorized()
    @Post("/registration/save")
    async registration(
        @QueryParam('userId') userId: number,
        @HeaderParam("authorization") currentUser: User,
        @UploadedFiles("participantPhoto", { options: fileUploadOptions }) files: Express.Multer.File[],
        @Body() requestSource,
        @Res() response: Response) {
        try {
            if (currentUser.id) {

                if (requestSource != null) {
                    let requestBody = JSON.parse(requestSource.registrationDetail);
                    // Validation
                    let errorMsg = await this.validateCompetitionRestriction(requestBody,0);
                    if (errorMsg && errorMsg.length) {
                        return response.status(200).send({
                            id: null, message: "Single Competition Error",
                            errorCode: 1,
                            errorMsg: errorMsg
                        });
                    }
                    console.log('***%%%****')
                    let errorArray = await this.validateUserDetailsOrUpdateEmail(requestBody,0)
                    console.log('***%%%------%%%%%****')
                    console.log('----- Error final arr :: ' + JSON.stringify(errorArray))
                    if (errorArray && errorArray.length) {
                        let msg = await this.replaceErrorMsg(errorArray)
                        return response.status(200).send({
                            id: null, message: "User Details Invalid",
                            errorCode: 2,
                            errorMsg: msg
                        });
                    }
                    let picURL = [];
                    if (files && files.length > 0) {

                        let containsWrongFormat;

                        /// Checking if we have any wrong format files in the list
                        for (const file of files) {
                            if (isPhoto(file.mimetype)) {
                                containsWrongFormat = false;
                            } else {
                                containsWrongFormat = true;
                                break;
                            }
                        }
                        /// If any wrong format file in the list then fail the upload
                        if (containsWrongFormat) {
                            return response.status(400).send({
                                success: false,
                                name: 'upload_error',
                                message: `Please upload an image in any of these formats: JPG, PNG.`
                            });
                        }

                        for (const file of files) {
                            let filename = `/registration/u${userId}_${timestamp()}.${fileExt(file.originalname)}`;
                            let upload = await this.firebaseService.upload(filename, file);
                            if (upload) {
                                let url = upload['url'];
                                picURL.push(url);
                            }
                        }

                    }

                    // let validateArray = await this.registrationService.registrationRestrictionValidate(competitionId, organisationId, requestBody)

                    let registrationRes = null;
                    let iAmRegisteringMyself = 0;
                    let userInfo
                    // let userInfo = await this.saveYoursInfo(requestBody.yourInfo);
                    // if (userInfo.userId != 0) {
                    //     userId = userInfo.userId;
                    // }

                    //Registration
                    let registration = new Registration();
                    registration.registrationUniqueKey =
                        isNullOrZero(requestBody.registrationId) ? uuidv4() : requestBody.registrationUniqueKey;
                    registration.id = requestBody.registrationId;
                    if (isNullOrZero(requestBody.registrationId)) {
                        registration.createdBy = userId;
                    }
                    else {
                        registration.createdBy = userId;
                        registration.updatedBy = userId;
                        registration.updatedOn = new Date();
                    }

                    registrationRes = await this.registrationService.createOrUpdate(registration);

                    requestBody.registrationId = registrationRes.id;
                    requestBody.registrationUniqueKey = registration.registrationUniqueKey;

                    // Delete existing data
                    await this.userRegistrationDraftService.deleteUserRegistationDraft(registrationRes.id, userId);
                    // await this.orgRegistrationParticipantDraftService.deleteOrgRegParticipantDraft(registrationRes.id, userId);

                    let i = 0;

                    let userArray = [];
                    let teamRegisteringUser = null;
                    let isTeamRegAvailable = false;
                    let isParticipantAvailable = false;
                    let parentOrGuardianMap = new Map();
                    for (let userReg of requestBody.userRegistrations) {
                        let competitionId = await this.competitionRegService.findByUniquekey(userReg.competitionUniqueKey);
                        let organisationId = await this.organisationService.findByUniquekey(userReg.organisationUniqueKey);
                        let orgRegistrationId = await this.orgRegistrationService.findOrgRegId(competitionId, organisationId);
                        //  console.log("-------regYourself " + userReg.registeringYourself)
                        if (userReg.registeringYourself == RegisteringYourself.SELF) {
                            iAmRegisteringMyself = 1;
                        }

                        if (userReg.registeringYourself == RegisteringYourself.TEAM) {
                            isTeamRegAvailable = true;
                            let noOfPlayers = 0;
                            let payingForCount = 0;
                            let isRegisteredAsPlayer = 0;
                            let competitionMembershipProductTypeIdCoach = 0;

                            if (userReg.team.personRoleRefId == 2) {
                                let productType = userReg.membershipProducts.find(x => x.name == "Coach");
                                if (productType != undefined) {
                                    competitionMembershipProductTypeIdCoach = productType.competitionMembershipProductTypeId;
                                }
                            }

                            //player
                            if (userReg.team.personRoleRefId == 4) {
                                if (userReg.competitionMembershipProductTypeId != undefined) {
                                    noOfPlayers += 1;
                                    payingForCount += 1;
                                }
                            }

                            //named players
                            if (userReg.team.allowTeamRegistrationTypeRefId == 1) {

                                if (userReg.team.personRoleRefId != 4) {
                                    if (userReg.team.registeringAsAPlayer == 1) {
                                        noOfPlayers += 1;
                                        isRegisteredAsPlayer = 1;
                                        payingForCount += 1;
                                    }
                                }
                                let playerUserRegArr = [];
                                if (userReg.team.players && userReg.team.players.length) {
                                    let playersList = userReg.team.players.filter(x => x.isDisabled == false);
                                    if (playersList && playersList.length) {
                                        for (let p of playersList) {
                                            if (p.isPlayer == 1) {
                                                noOfPlayers += 1;
                                                payingForCount += (userReg.team.registrationTypeId == 2 ? 1 : p.payingFor);
                                            }
                                            let participantUserDB = await this.userService.findUserByUniqueFields(
                                                p.email.toLowerCase(), p.firstName, p.lastName,
                                                p.mobileNumber
                                            )
                                            let userRegister = new UserRegistrationDraft();
                                            userRegister.id = userReg.userRegistrationId;
                                            userRegister.registrationId = registrationRes.id;
                                            userRegister.userId = isNotNullAndUndefined(participantUserDB) ? participantUserDB.id : 0;
                                            userRegister.firstName = p.firstName;
                                            userRegister.lastName = p.lastName;
                                            userRegister.mobileNumber = p.mobileNumber;
                                            userRegister.email = p.email;
                                            userRegister.teamName = userReg.team.teamName;
                                            userRegister.competitionMembershipProductTypeId = p.competitionMembershipProductTypeId;
                                            userRegister.userRegUniqueKey = uuidv4();
                                            userRegister.createdBy = userId;
                                            userRegister.payingFor = (userReg.team.registrationTypeId == 2 ? 1 : p.payingFor);
                                            userRegister.isPlayer = p.isPlayer;

                                            let userRegistrationRes = await this.userRegistrationDraftService.createOrUpdate(userRegister);

                                            let orpt = new OrgRegistrationParticipantDraft();
                                            orpt.id = 0;
                                            orpt.orgRegistrationId = orgRegistrationId;
                                            orpt.registrationId = registrationRes.id;
                                            orpt.userRegistrationId = userRegistrationRes.id;
                                            orpt.teamRegistrationTypeRefId = userReg.team.registrationTypeId;
                                            orpt.competitionMembershipProductTypeId = p.competitionMembershipProductTypeId;
                                            orpt.createdBy = userId;
                                            await this.orgRegistrationParticipantDraftService.createOrUpdate(orpt);
                                        }
                                    }
                                }
                            }

                            let userRegister = new UserRegistrationDraft();
                            userRegister.id = userReg.userRegistrationId;
                            userRegister.registrationId = registrationRes.id;
                            userRegister.userId = userInfo.userId;
                            userRegister.firstName = userInfo.firstName;
                            userRegister.lastName = userInfo.lastName;
                            userRegister.mobileNumber = userInfo.mobileNumber;
                            userRegister.email = userInfo.email;
                            userRegister.dateOfBirth = userInfo.dateOfBirth;
                            userRegister.teamName = userReg.team.teamName;
                            userRegister.competitionMembershipProductTypeId = userReg.competitionMembershipProductTypeId;
                            userRegister.personRoleRefId = userReg.team.personRoleRefId
                            userRegister.registeringYourselfRefId = userReg.registeringYourself;
                            //userRegister.whoAreYouRegisteringRefId = userReg.whoAreYouRegistering;
                            userRegister.isRegisteredAsPlayer = isRegisteredAsPlayer;
                            userRegister.noOfPlayers = noOfPlayers;
                            userRegister.payingForCount = payingForCount;
                            userRegister.payingFor = 1;
                            userRegister.userRegUniqueKey = uuidv4();
                            userRegister.createdBy = userId;
                            userRegister.isPlayer = 1;

                            let UserRegistrationRes = await this.userRegistrationDraftService.createOrUpdate(userRegister);

                            let orpt = new OrgRegistrationParticipantDraft();
                            orpt.id = 0;
                            orpt.orgRegistrationId = orgRegistrationId;
                            orpt.registrationId = registrationRes.id;
                            orpt.userRegistrationId = UserRegistrationRes.id;
                            orpt.teamRegistrationTypeRefId = userReg.team.registrationTypeId;
                            orpt.competitionMembershipProductTypeId = userReg.competitionMembershipProductTypeId;
                            orpt.competitionMembershipProductDivisionId = userReg.competitionMembershipProductDivisionId;
                            orpt.competitionMembershipProductTypeIdCoach = competitionMembershipProductTypeIdCoach;
                            orpt.createdBy = userId;
                            await this.orgRegistrationParticipantDraftService.createOrUpdate(orpt);
                        }
                        else {
                            isParticipantAvailable = true;
                            let participantEmail = '';
                            // logger.info(`@@@@@--BEFORE CHECK`)
                            // logger.info(`@@@@@--referParentEmail `,userReg.referParentEmail)
                            if (userReg.referParentEmail) {
                                if (userReg.tempParents && userReg.tempParents.length) {
                                    //  logger.info(`@@@@@-- temp parents`,JSON.stringify(userReg.tempParents[0]))
                                    let tempParentId = userReg.tempParents[0];
                                    let parentEmail = parentOrGuardianMap.get(tempParentId);
                                    participantEmail = parentEmail.toLowerCase() + '.' + userReg.firstName.toLowerCase();

                                } else {
                                    // logger.info(`@@@@@-- parentGuardian`,JSON.stringify(userReg.parentOrGuardian[0]))
                                    let parent = userReg.parentOrGuardian[0]
                                    participantEmail = parent.email.toLowerCase() + '.' + userReg.firstName.toLowerCase();
                                    parentOrGuardianMap.set(parent.tempParentId, parent.email.toLowerCase())
                                }
                            }
                            else {
                                //logger.info(`@@@@@--  ELSE to child email`)
                                participantEmail = userReg.email.toLowerCase();
                            }
                            let participantOtherUserId = 0;
                            if (isNullOrZero(userReg.userId)) {
                                let participantUserDB = await this.userService.findUserByUniqueFields(
                                    participantEmail, userReg.firstName, userReg.lastName,
                                    userReg.mobileNumber
                                )
                                if (participantUserDB != null && participantUserDB != undefined) {
                                    participantOtherUserId = participantUserDB.id;
                                }
                            }
                            else {
                                participantOtherUserId = userReg.userId;
                            }
                            let participantUserId = (iAmRegisteringMyself == 1 && i == 0) ? userInfo.id :
                                participantOtherUserId;



                            let userRegister = new UserRegistrationDraft();
                            userRegister.id = 0;
                            userRegister.userId = participantUserId;
                            userRegister.registrationId = registrationRes.id;
                            userRegister.registeringYourselfRefId = userReg.registeringYourself;
                            // userRegister.whoAreYouRegisteringRefId = userReg.whoAreYouRegistering;
                            userRegister.userRegUniqueKey = uuidv4();
                            userRegister.firstName = userReg.firstName;
                            userRegister.lastName = userReg.lastName;
                            userRegister.mobileNumber = userReg.mobileNumber;
                            userRegister.email = participantEmail;
                            userRegister.dateOfBirth = userReg.dateOfBirth;
                            userRegister.photoUrl = picURL[i];
                            userRegister.createdBy = userId;
                            userReg.photoUrl = picURL[i];

                            let userRegistrationRes = await this.userRegistrationDraftService.createOrUpdate(userRegister);

                            let orpt = new OrgRegistrationParticipantDraft();
                            orpt.id = 0;
                            orpt.orgRegistrationId = orgRegistrationId;
                            orpt.registrationId = registrationRes.id;
                            orpt.userRegistrationId = userRegistrationRes.id;
                            orpt.competitionMembershipProductTypeId = userReg.competitionMembershipProductTypeId;
                            orpt.competitionMembershipProductDivisionId = userReg.competitionMembershipProductDivisionId;
                            orpt.createdBy = userId;
                            await this.orgRegistrationParticipantDraftService.createOrUpdate(orpt);

                            if (userReg.products && userReg.products.length) {
                                for (let product of userReg.products) {
                                    let orgId = await this.organisationService.findByUniquekey(product.organisationUniqueKey);
                                    let compId = await this.competitionRegService.findByUniquekey(product.competitionUniqueKey);
                                    let orgRegId = await this.orgRegistrationService.findOrgRegId(compId, orgId);

                                    let orpt = new OrgRegistrationParticipantDraft();
                                    orpt.id = 0;
                                    orpt.orgRegistrationId = orgRegId;
                                    orpt.registrationId = registrationRes.id;
                                    orpt.userRegistrationId = userRegistrationRes.id;
                                    orpt.competitionMembershipProductTypeId = product.competitionMembershipProductTypeId;
                                    orpt.competitionMembershipProductDivisionId = product.competitionMembershipProductDivisionId;
                                    orpt.createdBy = userId;
                                    await this.orgRegistrationParticipantDraftService.createOrUpdate(orpt);
                                }
                            }

                            i++;
                        }
                    }

                    // RegistrationTrack
                    let registrationTrack = new RegistrationTrack();
                    let registrationTrackDB = await this.registrationTrackService.findByRegistrationId(registrationRes.id, 1);
                    if (registrationTrackDB != null && registrationTrackDB != undefined) {
                        registrationTrack.id = registrationTrackDB.id;
                        registrationTrack.updatedBy = userId;
                        registrationTrack.updatedOn = new Date();
                    }
                    else {
                        registrationTrack.id = 0;
                        registrationTrack.createdBy = userId;
                    }

                    registrationTrack.registrationId = registrationRes.id;
                    registrationTrack.stepsId = 1;
                    registrationTrack.jsonData = JSON.stringify(requestBody)
                    await this.registrationTrackService.createOrUpdate(registrationTrack);

                    return response.status(200).send({
                        id: registrationRes.registrationUniqueKey, message: "Successfully Registered",
                        errorMsg: null
                    });

                } else {
                    return response.status(204).send({
                        errorCode: 3,
                        message: 'Empty Body'
                    });
                }
            }
            else {
                return response.status(401).send({
                    errorCode: 2,
                    message: 'You are trying to access another user\'s data'
                });
            }

        } catch (error) {
            logger.error(`Error Occurred in userRegistration Save draft ${currentUser.id}` + error);
            return response.status(500).send({
                message: process.env.NODE_ENV == AppConstants.development ? AppConstants.errMessage + error : AppConstants.errMessage
            });
        }
    }

    @Authorized()
    @Get('/registration/participant')
    async getParticipantById(
        @QueryParam('participantId') participantId: string,
        @QueryParam('registrationId') registrationId: string,
        @HeaderParam("authorization") currentUser: User,
        @Res() response: Response) {
        try {
            let userRegList: UserRegistrationDraft[] = [];
            let participantData = Object.assign({});
            if (participantId) {
                let userRegData = await this.userRegistrationDraftService.getParticipantData(participantId);
                participantData = userRegData.participantData;
                userRegList = await this.userRegistrationDraftService.findByRegistrationId(userRegData.registrationId);
            }
            else if (registrationId) {
                let registration = await this.registrationService.findByRegistrationKey(registrationId);
                userRegList = await this.userRegistrationDraftService.findByRegistrationId(registration.id);
            }
            else {
                return response.status(212).send({ message: "Participant is not valid" });
            }

            let parents = [];
            let registeredParents = []
            if (userRegList && userRegList.length) {
                for (let userRegister of userRegList) {
                    if (participantId == null || userRegister.userRegUniqueKey != participantId) {
                        let userAge = (Math.floor((Date.now() - new Date(userRegister.dateOfBirth).getTime()) / 3.15576e+10))

                        if (userRegister.registeringYourselfRefId == RegisteringYourself.SELF && userAge >= 18) {
                            let data = JSON.parse(JSON.stringify(userRegister.participantData));
                            console.log('++ data ++ ' + JSON.stringify(data))
                            let registeredParentsObj = {
                                firstName: userRegister.firstName,
                                lastName: userRegister.lastName,
                                email: userRegister.email,
                                genderRefId: userRegister.genderRefId,
                                mobileNumber: userRegister.mobileNumber,
                                street1: data.street1,
                                street2: data.street2,
                                suburb: data.suburb,
                                stateRefId: data.stateRefId,
                                countryRefId: data.countryRefId
                            }
                            registeredParents.push(registeredParentsObj)
                        }
                        if (userRegister.parentData) {
                            let parentData = JSON.parse(JSON.stringify(userRegister.parentData));
                            if (parentData) {
                                parents.push(...parentData);
                            }
                        }
                    }

                }
            }

            // console.log("participantData" + JSON.stringify(participantData));

            participantData["parents"] = parents;
            participantData["registeredParents"] = registeredParents;
            return response.status(200).send(participantData);
        }
        catch (error) {
            logger.error(`Exception occurred in getParticipantById participantId:${participantId} registrationId:${participantId} for user:${currentUser.id}` + error);
            return response.status(500).send({
                message: process.env.NODE_ENV == AppConstants.development ? AppConstants.errMessage + error : AppConstants.errMessage
            });
        }
    }

    @Authorized()
    @Post('/registration/participant')
    async saveParticipant(
        @HeaderParam("authorization") currentUser: User,
        @UploadedFiles("participantPhoto", { options: fileUploadOptions }) files: Express.Multer.File[],
        @Body() requestSource,
        @Res() response: Response) {
        try {
            if (requestSource != null) {
                let requestBody = JSON.parse(requestSource.participantDetail);
                let userId = 0;
                // Validation
                let errorMsg = await this.validateCompetitionRestriction(requestBody,0);
                if (errorMsg && errorMsg.length) {
                    return response.status(200).send({
                        id: null, message: "Single Competition Error",
                        errorCode: 1,
                        errorMsg: errorMsg
                    });
                }
                // #@#@# check
                // let errorArray = await this.validateUserDetailsOrUpdateEmail(requestBody, 0)
                // if (errorArray && errorArray.length) {
                //     let msg = await this.replaceErrorMsg(errorArray);
                //     return response.status(200).send({
                //         id: null, message: "User Details Invalid",
                //         errorCode: 2,
                //         errorMsg: msg
                //     });
                // }

                 //return 1;
                let picURL = [];
                if (files && files.length > 0) {

                    let containsWrongFormat;

                    /// Checking if we have any wrong format files in the list
                    for (const file of files) {
                        if (isPhoto(file.mimetype)) {
                            containsWrongFormat = false;
                        } else {
                            containsWrongFormat = true;
                            break;
                        }
                    }
                    /// If any wrong format file in the list then fail the upload
                    if (containsWrongFormat) {
                        return response.status(400).send({
                            success: false,
                            name: 'upload_error',
                            message: `Please upload an image in any of these formats: JPG, PNG.`
                        });
                    }

                    for (const file of files) {
                        let filename = `/registration/${userId}_${timestamp()}.${fileExt(file.originalname)}`;
                        let upload = await this.firebaseService.upload(filename, file);
                        if (upload) {
                            let url = upload['url'];
                            picURL.push(url);
                        }
                    }

                }

                let registrationRes = null;
                let userRegDraftRes = null;
                let yourInfoUserId = await this.saveYoursInfo(requestBody);
                if (yourInfoUserId != 0) {
                    userId = yourInfoUserId;
                }

                //Registration
                let registration = new Registration();
                let userRegData = [];
                if (isNullOrEmpty(requestBody.registrationId)) {
                    registration.registrationUniqueKey = uuidv4();
                    registration.id = 0;
                    registration.createdBy = userId;
                }
                else {
                    registration = await this.registrationService.findByRegistrationKey(requestBody.registrationId);
                    userRegData = await this.userRegistrationDraftService.findByRegistrationId(registration.id);
                    registration.createdBy = userId;
                    registration.updatedBy = userId;
                    registration.updatedOn = new Date();
                }

                registrationRes = await this.registrationService.createOrUpdate(registration);

                requestBody.registrationId = registrationRes.registrationUniqueKey;

                // Delete existing data
                if (!isNullOrEmpty(requestBody.participantId)) {
                    userRegDraftRes = await this.userRegistrationDraftService.findByUniqueKey(requestBody.participantId);
                    if (userRegDraftRes.registeringYourselfRefId == RegisteringYourself.TEAM)
                        await this.userRegistrationDraftService.deleteUserRegDraft(userId, userRegDraftRes.parentId)
                    else
                        await this.orgRegistrationParticipantDraftService.deleteOrgRegParticipantDraft(registrationRes.id, userId, userRegDraftRes.id);
                }

                if (requestBody.registeringYourself == RegisteringYourself.TEAM) /// Team Registration Handling
                {
                    let competitionId = await this.competitionRegService.findByUniquekey(requestBody.competitionId);
                    let organisationId = await this.organisationService.findByUniquekey(requestBody.organisationId);
                    let orgRegistrationId = await this.orgRegistrationService.findOrgRegId(competitionId, organisationId);
                    let noOfPlayers = 0;
                    let totalMembers = 0;
                    let payingForCount = 0;
                    let isRegisteredAsPlayer = 0;
                    let competitionMembershipProductTypeIdCoach = 0;

                    if (requestBody.personRoleRefId == 2) {
                        let productType = requestBody.membershipProducts.find(x => x.name == "Coach");
                        if (productType != undefined) {
                            totalMembers += 1;
                            competitionMembershipProductTypeIdCoach = productType.competitionMembershipProductTypeId;
                        }
                    }

                    //player
                    if (requestBody.personRoleRefId == 4) {
                        if (requestBody.competitionMembershipProductTypeId != undefined) {
                            noOfPlayers += 1;
                            payingForCount += 1;
                            totalMembers += 1;
                        }
                    }
                    let parentUserRegKey = uuidv4();
                    let orgParticipantIdList = [];
                    //named players
                    if (requestBody.allowTeamRegistrationTypeRefId == 1) {

                        if (requestBody.personRoleRefId != 4) {
                            if (requestBody.registeringAsAPlayer == 1) {
                                totalMembers += 1;
                                noOfPlayers += 1;
                                isRegisteredAsPlayer = 1;
                                payingForCount += 1;
                            }
                        }
                        let playerUserRegArr = [];
                        if (requestBody.teamMembers && requestBody.teamMembers.length) {
                            let playersList = requestBody.teamMembers;
                            if (playersList && playersList.length) {
                                for (let p of playersList) {
                                    let playerType = p.membershipProductTypes.find(x => x.isPlayer == 1 && x.isChecked == 1);
                                    if (playerType) {
                                        noOfPlayers += 1;
                                        payingForCount += p.payingFor;
                                    }
                                    let participantUserDB = await this.userService.findUserByUniqueFields(
                                        p.email.toLowerCase(), p.firstName, p.lastName,
                                        p.mobileNumber
                                    )
                                    let userRegister = new UserRegistrationDraft();
                                    userRegister.id = 0;
                                    userRegister.registrationId = registrationRes.id;
                                    userRegister.userId = isNotNullAndUndefined(participantUserDB) ? participantUserDB.id : 0;
                                    userRegister.firstName = p.firstName;
                                    userRegister.lastName = p.lastName;
                                    userRegister.mobileNumber = p.mobileNumber;
                                    userRegister.email = p.email;
                                    userRegister.dateOfBirth = p.dateOfBirth;
                                    userRegister.teamName = requestBody.teamName;
                                    userRegister.competitionMembershipProductTypeId = p.competitionMembershipProductTypeId;
                                    userRegister.userRegUniqueKey = uuidv4();
                                    userRegister.createdBy = userId;
                                    userRegister.payingFor = p.payingFor;
                                    //userRegister.isPlayer = playerType ? playerType.isPlayer : null;
                                    userRegister.parentData = JSON.stringify(p.parentOrGuardian);
                                    userRegister.parentId = parentUserRegKey
                                    let userRegistrationRes = await this.userRegistrationDraftService.createOrUpdate(userRegister);
                                    let selectedProducts = p.membershipProductTypes.filter(x => x.isChecked == 1);
                                    if (selectedProducts && selectedProducts.length) {
                                        for (let prod of selectedProducts) {
                                            let orpt = new OrgRegistrationParticipantDraft();
                                            orpt.id = 0;
                                            orpt.orgRegistrationId = orgRegistrationId;
                                            orpt.registrationId = registrationRes.id;
                                            orpt.userRegistrationId = userRegistrationRes.id;
                                            orpt.teamRegistrationTypeRefId = requestBody.allowTeamRegistrationTypeRefId;
                                            orpt.parentId = parentUserRegKey;
                                            orpt.competitionMembershipProductTypeId = prod.competitionMembershipProductTypeId;
                                            orpt.membershipProductTypeName = prod.productTypeName;
                                            orpt.createdBy = userId;
                                            orpt.isPlayer = prod.isPlayer;
                                            let orgRegPartRes = await this.orgRegistrationParticipantDraftService.createOrUpdate(orpt);
                                            orgParticipantIdList.push(orgRegPartRes.id);
                                            totalMembers += 1;
                                        }
                                    }
                                }
                            }
                        }
                    }

                    let userRegister = new UserRegistrationDraft();
                    userRegister.id = requestBody.userRegistrationId;
                    userRegister.registrationId = registrationRes.id;
                    userRegister.userId = requestBody.userId;
                    userRegister.firstName = requestBody.firstName;
                    userRegister.lastName = requestBody.lastName;
                    userRegister.mobileNumber = requestBody.mobileNumber;
                    userRegister.email = requestBody.email;
                    userRegister.dateOfBirth = requestBody.dateOfBirth;
                    userRegister.teamName = requestBody.teamName;
                    userRegister.competitionMembershipProductTypeId = requestBody.competitionMembershipProductTypeId;
                    userRegister.personRoleRefId = requestBody.personRoleRefId
                    userRegister.registeringYourselfRefId = requestBody.registeringYourself;
                    //userRegister.whoAreYouRegisteringRefId = userReg.whoAreYouRegistering;
                    userRegister.isRegisteredAsPlayer = isRegisteredAsPlayer;
                    userRegister.noOfPlayers = noOfPlayers;
                    userRegister.payingForCount = payingForCount;
                    userRegister.payingFor = 1;
                    userRegister.userRegUniqueKey = parentUserRegKey;
                    userRegister.totalMembers = totalMembers;
                    userRegister.createdBy = userId;
                    userRegister.isPlayer = 1;
                    userRegister.parentId = parentUserRegKey;
                    userRegister.parentData = JSON.stringify(requestBody.parentOrGuardian);
                    userRegister.participantData = JSON.stringify(requestBody);
                    let UserRegistrationRes = await this.userRegistrationDraftService.createOrUpdate(userRegister);


                    let orpt = new OrgRegistrationParticipantDraft();
                    orpt.id = 0;
                    orpt.orgRegistrationId = orgRegistrationId;
                    orpt.registrationId = registrationRes.id;
                    orpt.userRegistrationId = UserRegistrationRes.id;
                    orpt.teamRegistrationTypeRefId = requestBody.allowTeamRegistrationTypeRefId;
                    orpt.competitionMembershipProductTypeId = requestBody.competitionMembershipProductTypeId;
                    orpt.competitionMembershipProductDivisionId = requestBody.competitionMembershipProductDivisionId;
                    orpt.competitionMembershipProductTypeIdCoach = competitionMembershipProductTypeIdCoach;
                    orpt.membershipProductTypeName = requestBody.membershipProducts.find(x => x.competitionMembershipProductTypeId == requestBody.competitionMembershipProductTypeId).name;
                    orpt.createdBy = userId;
                    orpt.parentId = parentUserRegKey;
                    let orgRegParticipantRes = await this.orgRegistrationParticipantDraftService.createOrUpdate(orpt);



                }
                else {

                    console.log("pic url::" + picURL[0]);
                    console.log("photo url::" + requestBody.photoUrl);
                    let userRegister = new UserRegistrationDraft();
                    userRegister.id = userRegDraftRes != null ? userRegDraftRes.id : 0;
                    userRegister.userId = userRegister.userId ? userRegister.userId : 0;
                    userRegister.registrationId = registrationRes.id;
                    userRegister.registeringYourselfRefId = requestBody.registeringYourself;
                    userRegister.userRegUniqueKey = userRegDraftRes != null ? userRegDraftRes.userRegUniqueKey : uuidv4();
                    userRegister.firstName = requestBody.firstName;
                    userRegister.lastName = requestBody.lastName;
                    userRegister.mobileNumber = requestBody.mobileNumber;
                    if (requestBody.referParentEmail) {
                        userRegister.email = requestBody.parentOrGuardian[0].email.toLowerCase() + "." + requestBody.firstName.toLowerCase();
                    } else {
                        userRegister.email =  requestBody.email.toLowerCase() ;//participantEmail;
                    }
                    logger.debug(`$$$ saving email ${userRegister.email} for ${userRegister.firstName} ${requestBody.referParentEmail}`);
                    userRegister.dateOfBirth = requestBody.dateOfBirth;
                    userRegister.genderRefId = requestBody.genderRefId;
                    userRegister.photoUrl = picURL[0] ? picURL[0] : requestBody.photoUrl;
                    userRegister.createdBy = userId;
                    requestBody.photoUrl = userRegister.photoUrl;
                    userRegister.participantData = JSON.stringify(requestBody);
                    userRegister.parentData = JSON.stringify(requestBody.parentOrGuardian);

                    let userRegistrationRes = await this.userRegistrationDraftService.createOrUpdate(userRegister);

                    if (requestBody.competitions && requestBody.competitions.length) {
                        for (let item of requestBody.competitions) {
                            let competitionId = await this.competitionRegService.findByUniquekey(item.competitionId);
                            let organisationId = await this.organisationService.findByUniquekey(item.organisationId);
                            let orgRegistrationId = await this.orgRegistrationService.findOrgRegId(competitionId, organisationId);

                            if (item.products && item.products.length) {
                                for (let prod of item.products) {
                                    let divisions = [];
                                    if (item.divisions && item.divisions.length) {
                                        divisions = item.divisions.filter(x => x.competitionMembershipProductTypeId ==
                                            prod.competitionMembershipProductTypeId);
                                        if (divisions && divisions.length) {
                                            for (let division of divisions) {
                                                let orpt = this.getOrgRegistrationPartObj(orgRegistrationId, registrationRes.id,
                                                    userRegistrationRes.id, prod.competitionMembershipProductTypeId,
                                                    division.competitionMembershipProductDivisionId, userId, item)
                                                await this.orgRegistrationParticipantDraftService.createOrUpdate(orpt);
                                            }
                                        }
                                        else {
                                            let orpt = this.getOrgRegistrationPartObj(orgRegistrationId, registrationRes.id,
                                                userRegistrationRes.id, prod.competitionMembershipProductTypeId,
                                                null, userId, item)
                                            await this.orgRegistrationParticipantDraftService.createOrUpdate(orpt);
                                        }
                                    }
                                    else {
                                        let orpt = this.getOrgRegistrationPartObj(orgRegistrationId, registrationRes.id,
                                            userRegistrationRes.id, prod.competitionMembershipProductTypeId,
                                            null, userId, item)
                                        await this.orgRegistrationParticipantDraftService.createOrUpdate(orpt);
                                    }
                                }
                            }
                        }
                    }
                }

                return response.status(200).send({
                    id: registrationRes.registrationUniqueKey, message: "Successfully Registered",
                    errorMsg: null
                });

            } else {
                return response.status(204).send({
                    errorCode: 3,
                    message: 'Empty Body'
                });
            }
        }
        catch (error) {
            const req = JSON.stringify(requestSource);
            logger.error(`Exception occurred in saveParticipant requestSource: ${req} for user: ${currentUser.id}` + error);
            return response.status(500).send({
                message: process.env.NODE_ENV == AppConstants.development ? AppConstants.errMessage + error : AppConstants.errMessage
            });
        }
    }

    @Authorized()
    @Get('/registration')
    async registrationById(
        @QueryParam('registrationId') registrationId: string = undefined,
        @QueryParam('userRegId') userRegId: string = undefined,
        @HeaderParam("authorization") currentUser: User,
        @Res() response: Response) {
        try {
            let registration = null;
            let userRegData = null;
            if (userRegId) {
                userRegData = await this.userRegistrationService.findByRegistrationKey(userRegId);
            }
            else {
                registration = await this.registrationService.findByRegistrationKey(registrationId);
            }
            if (registration || userRegData) {
                let registrationData = null;
                if (userRegData) {
                    registrationData = await this.registrationTrackService.findByUserRegistrationId(userRegData.registrationId,
                        11, userRegData.userRegId);
                }
                else {
                    registrationData = await this.registrationTrackService.findByRegistrationId(registration.id, 2);
                }

                if (registrationData != null && registrationData != undefined) {
                    let data = registrationData.jsonData;
                    if (data.yourInfo != null && data.yourInfo.firstName != null) {
                        if (!isNotNullAndUndefined(data.billingAddress)) {
                            data.billingAddress = this.getAddressObj(data.yourInfo);
                        }
                        if (!isNotNullAndUndefined(data.deliveryAddress)) {
                            data.deliveryAddress = this.getAddressObj(data.yourInfo);
                        }
                    }

                    return response.status(200).send(data);
                }
                else {
                    return response.status(200).send({ message: "No data found" });
                }

            }
            else {
                return response.status(212).send({ message: "RegistrationKey is not valid" });
            }

        }
        catch (error) {
            logger.error(`Exception occurred in registrationById ${currentUser.id}` + error);
            return response.status(500).send({
                message: process.env.NODE_ENV == AppConstants.development ? AppConstants.errMessage + error : AppConstants.errMessage
            });
        }
    }

    @Authorized()
    @Get('/registration/review')
    async registrationReview(
        @QueryParam('registrationId') registrationId: string,
        @HeaderParam("authorization") currentUser: User,
        @Res() response: Response) {
        try {
            let registration = await this.registrationService.findByRegistrationKey(registrationId);
            if (registration != undefined) {
                let regTrackReviewData = await this.registrationTrackService.findByRegistrationId(registration.id, 2);

                let result = await this.registrationTrackService.getRegistrationReview(registration.id, regTrackReviewData);
                if (!result.volunteerInfo && result.volunteerInfo.length) {
                    result.volunteerInfo = await this.orgRegistrationParticipantDraftService.getVolunteerInfo();
                    if (result.volunteerInfo && result.volunteerInfo.length) {
                        result.volunteerInfo.map((item) => {
                            item["isActive"] = false;
                        })
                    }
                }
                result.yourInfo = await this.getYourInfoObj(registration, result.yourInfo);
                if (result.yourInfo.firstName != null) {
                    if (!isNotNullAndUndefined(result.billingAddress)) {
                        result.billingAddress = this.getAddressObj(result.yourInfo);
                    }

                    if (!isNotNullAndUndefined(result.deliveryAddress)) {
                        result.deliveryAddress = this.getAddressObj(result.yourInfo);
                    }
                }

                return response.status(200).send(result)
            }
            else {
                return response.status(212).send({ message: "RegistrationKey is not valid" });
            }

        }
        catch (error) {
            logger.error(`Exception occurred in registration review  ${currentUser.id}` + error);
            return response.status(500).send({
                message: process.env.NODE_ENV == AppConstants.development ? AppConstants.errMessage + error : AppConstants.errMessage
            });
        }
    }

    @Authorized()
    @Post('/registration/review')
    async registrationReviewSave(
        @QueryParam('registrationId') registrationId: string,
        @HeaderParam("authorization") currentUser: User,
        @Body() requestBody,
        @Res() response: Response) {
        try {
            let registration = await this.registrationService.findByRegistrationKey(registrationId);
            if (registration != undefined) {

                const { shopProducts } = requestBody;
                if (this.invalidShopProductsData(shopProducts)) {
                    const error = "Can't save invalid products data";
                    logger.error(`Exception occurred in registration review save  ${currentUser.id}` + error);
                    return response.status(500).send({
                        message: process.env.NODE_ENV == AppConstants.development ? AppConstants.errMessage + ' ' +  error : AppConstants.errMessage
                    });
                }

                if (requestBody.key == "discount") {
                    let compParticipant = requestBody.compParticipants[requestBody.index];
                    let feeTypeRefId = compParticipant.registeringYourselfRefId == RegisteringYourself.TEAM ? 3 : 2;
                    if (isNotNullAndUndefined(compParticipant)) {
                        //compParticipant.selectedOptions.selectedDiscounts = [];
                        let disMap = new Map();
                        let discountCodes = compParticipant.selectedOptions.discountCodes;
                        compParticipant.selectedOptions.isHardshipCodeApplied = 0;
                        (discountCodes || []).map((x) => {
                            x.isValid = 0;
                            x["isHardshipCode"] = 0;
                        });
                        let arr = [];
                        for (let mem of compParticipant.membershipProducts) {

                            if (discountCodes && discountCodes.length) {

                                for (let dis of discountCodes) {

                                    if (compParticipant.selectedOptions.paymentOptionRefId != 1) {
                                        let hardship = await this.orgRegistrationHardshipCodeService.
                                            findByCode(compParticipant.orgRegistrationId, dis.discountCode, feeTypeRefId);

                                        if (hardship && hardship.length) {
                                            compParticipant.selectedOptions.isHardshipCodeApplied = 1;
                                            dis["isValid"] = 1;
                                            dis["isHardshipCode"] = 1;
                                        }
                                    }

                                    let compRes = await this.competitionTypeDiscountService.getDiscountByCode(mem.competitionMembershipProductTypeId,
                                        dis.discountCode);
                                    let memRes = await this.membershipProductTypeDiscountService.getDiscountByCode(mem.membershipMappingId, dis.discountCode);

                                    if (compRes && compRes.length) {
                                        (compRes || []).map((x) => {
                                            let key = mem.competitionMembershipProductTypeId + "#" + dis.discountCode;
                                            if (disMap.get(key) == undefined) {
                                                let obj = {
                                                    competitionMembershipProductTypeId: mem.competitionMembershipProductTypeId,
                                                    membershipMappingId: null,
                                                    discountCode: dis.discountCode,
                                                    typeId: 2
                                                }
                                                arr.push(obj);
                                                //compParticipant.selectedOptions.selectedDiscounts.push(obj);
                                                disMap.set(key, obj);
                                            }
                                        });

                                        dis["isValid"] = 1;
                                    }

                                    console.log("memRes" + JSON.stringify(memRes));
                                    if (memRes && memRes.length) {
                                        (memRes || []).map((x) => {
                                            let key = mem.membershipMappingId + "#" + dis.discountCode;
                                            if (disMap.get(key) == undefined) {
                                                let obj = {
                                                    competitionMembershipProductTypeId: null,
                                                    membershipMappingId: mem.membershipMappingId,
                                                    discountCode: dis.discountCode,
                                                    typeId: 2
                                                }

                                                arr.push(obj);
                                                //compParticipant.selectedOptions.selectedDiscounts.push(obj);
                                                disMap.set(key, obj);
                                            }
                                        })
                                        dis["isValid"] = 1;
                                    }
                                }
                            }
                        }

                        if (compParticipant.selectedOptions.discountCodes && compParticipant.selectedOptions.discountCodes.length) {
                            console.log(")))))" + JSON.stringify(compParticipant.selectedOptions.discountCodes) + "::" +
                                compParticipant.selectedOptions.isHardshipCodeApplied);
                            let isValid = true;
                            if (compParticipant.selectedOptions.isHardshipCodeApplied == 1) {
                                compParticipant.selectedOptions.selectedDiscounts = [];
                                arr = [];
                            }
                            else {
                                for (let dis of compParticipant.selectedOptions.discountCodes) {
                                    if (dis.isValid == 0 || dis.isValid == null) {
                                        isValid = false;
                                        break;
                                    }
                                }
                            }

                            console.log("isValid::" + isValid);
                            if (!isValid) {
                                return response.status(200).send({ response: requestBody, message: "Invalid Code", errorCode: 1 });
                            }
                            else {
                                compParticipant.selectedOptions.selectedDiscounts = [];
                                compParticipant.selectedOptions.selectedDiscounts.push(...arr);
                            }
                        }
                        else {
                            compParticipant.selectedOptions.selectedDiscounts = [];
                        }
                    }
                }
                else if (requestBody.key == "school") {
                    let compParticipant = requestBody.compParticipants[requestBody.index];
                    let code = compParticipant.selectedOptions.selectedSchoolRegCode;
                    compParticipant.selectedOptions.isSchoolRegCodeApplied = 0;
                    compParticipant.selectedOptions["invalidSchoolRegCode"] = 1;
                    if (!isNullOrEmpty(code)) {
                        let competition = await this.competitionRegService
                            .findCompetitionFeeDetailsByUniqueKey(compParticipant.competitionUniqueKey);
                        // todo:
                        // @ts-ignore
                        if (competition && competition.length) {
                            let schoolRegCode = null;
                            if (compParticipant.isTeamRegistration == 1) {
                                schoolRegCode = competition[0].teamSeasonalSchoolRegCode;
                            }
                            else {
                                schoolRegCode = competition[0].seasonalSchoolRegCode;
                            }

                            if (schoolRegCode && schoolRegCode == code) {
                                compParticipant.selectedOptions.isSchoolRegCodeApplied = 1;
                                compParticipant.selectedOptions["invalidSchoolRegCode"] = 0
                            }
                        }

                        if (isNullOrZero(compParticipant.selectedOptions.isSchoolRegCodeApplied)) {
                            return response.status(200).send({ response: requestBody, message: "Invalid Code", errorCode: 1 });
                        }
                    }
                    else {
                        compParticipant.selectedOptions.selectedSchoolRegCode = null;
                    }
                }
                else if (requestBody.key == "voucher") {
                    let compParticipant = requestBody.compParticipants[requestBody.index];
                    let otherParticipants = [];
                    let voucherMap = new Map();
                    let pin = moment(compParticipant.dateOfBirth).format("DDMM")
                    requestBody.compParticipants.map((item, index) => {
                        if (index != requestBody.index) {
                            otherParticipants.push(item);
                        }
                    })

                    let arr = [];
                    if (isNotNullAndUndefined(compParticipant)) {
                        let vouchers = compParticipant.selectedOptions.vouchers;
                        let paymentOptionRefId = compParticipant.selectedOptions.paymentOptionRefId;
                        (vouchers || []).forEach((x) => {
                            x.isValid = 0;
                            x.message = null;
                        });

                        // check whether organisation is registered / configured for organisationPosId before checking vouchers
                        const { organisationUniqueKey } = compParticipant
                        const organisation = await this.organisationService.findOrganisationByUniqueKey(organisationUniqueKey);
                        const { posTerminalId, storeChannelCode, postalCode } = organisation[0]


                        for (let voucher of vouchers) {
                            if (paymentOptionRefId == AppConstants.WEEKLY_INSTALMENT) {
                                voucher.isValid = 0;
                                voucher.message = AppConstants.instalmentVoucherMsg;
                                voucher.balance = 0;
                            } else {
                                if (voucher.governmentVoucherRefId == 1) {

                                    if (!posTerminalId) {
                                        (vouchers || []).forEach((x) => {
                                            x.isValid = 0;
                                            x.message = AppConstants.voucherPosIdNotConfigured;
                                        });
                                    } else if (!postalCode) {
                                        (vouchers || []).forEach((x) => {
                                            x.isValid = 0;
                                            x.message = AppConstants.voucherPostalCodeNotConfigured;
                                        });
                                    } else if (!storeChannelCode) {
                                        (vouchers || []).forEach((x) => {
                                            x.isValid = 0;
                                            x.message = AppConstants.voucherStoreChannelCodeNotConfigured;
                                        });
                                    } else {
                                        let validationCheck = null;
                                        validationCheck = this.duplicateVoucherCheck(voucher.voucherCode, otherParticipants, voucherMap);
                                        console.log("validationCheck" + validationCheck)
                                         if (!isNotNullAndUndefined(validationCheck)) {
                                            validationCheck = await this.checkVoucherBalance(voucher.voucherCode, pin);
                                        }
                                        console.log("validationCheck1" + JSON.stringify(validationCheck));
                                        voucher.isValid = validationCheck.isValid;
                                        voucher.message = validationCheck.message;
                                        voucher.balance = validationCheck.balance;
                                        voucher.message = voucher.message.replace('Invalid Pin.', AppConstants.invalidPinVoucher)
                                    }
                                } else {
                                    voucher.isValid = 1;
                                    voucher.message = "Valid";
                                    voucher.balance = 150;
                                }
                            }

                            if (voucher.isValid) {
                                arr.push(voucher);
                            }
                        }



                        if (compParticipant.selectedOptions.vouchers && compParticipant.selectedOptions.vouchers.length) {
                            console.log(")))))" + JSON.stringify(compParticipant.selectedOptions.vouchers));
                            let isValid = true;
                            let message = null;
                            let errorCode = 0;
                            for (let gov of compParticipant.selectedOptions.vouchers) {
                                if (gov.isValid == 0 || gov.isValid == null) {
                                    isValid = false; message = gov.message; errorCode = gov.status
                                    break;
                                }
                            }
                            console.log("isValid Voucher::" + isValid);
                            if (!isValid) {
                                compParticipant.selectedOptions.selectedGovernmentVouchers = [];
                                let registrationTrackDB = await this.registrationTrackService.findByRegistrationId(registration.id, 2);
                                let obj = { jsonData: requestBody }
                                let result = await this.registrationTrackService.getRegistrationReview(registration.id, obj);
                                await this.insertIntoRegistrationTrack(registration, result, registrationTrackDB);
                                return response.status(200).send({ response: result, message: message, errorCode: errorCode });
                            }
                            else {
                                compParticipant.selectedOptions.selectedGovernmentVouchers = [];
                                compParticipant.selectedOptions.selectedGovernmentVouchers.push(...arr);
                            }
                        }
                        else {
                            compParticipant.selectedOptions.selectedGovernmentVouchers = [];
                        }
                    }
                }
                else if (requestBody.key == "paymentOptionRefId") {
                    let compParticipant = requestBody.compParticipants[requestBody.index];

                    if (compParticipant.selectedOptions.paymentOptionRefId == 1) {
                        if (compParticipant.selectedOptions.isHardshipCodeApplied == 1) {
                            if (compParticipant.selectedOptions.discountCodes && compParticipant.selectedOptions.discountCodes.length) {
                                compParticipant.selectedOptions.discountCodes = [];
                            }
                        }
                        compParticipant.selectedOptions.isHardshipCodeApplied = 0;
                    }

                    if (compParticipant.selectedOptions.vouchers && compParticipant.selectedOptions.vouchers.length) {
                        let vouchers = compParticipant.selectedOptions.vouchers.filter(x => x.isValid == 1);
                        compParticipant.selectedOptions.vouchers = [];
                        compParticipant.selectedOptions.vouchers = vouchers ? vouchers : [];
                    }

                    if (compParticipant.selectedOptions.paymentOptionRefId == AppConstants.WEEKLY_INSTALMENT) {
                        let vouchers = compParticipant.selectedOptions.vouchers;
                        for (let voucher of vouchers) {
                            voucher.isValid = 0;
                            voucher.message = AppConstants.instalmentVoucherMsg;
                            voucher.balance = 0;
                        }
                        compParticipant.selectedOptions.selectedGovernmentVouchers = [];
                    }
                }
                else if (requestBody.key == "charity") {

                }

                let registrationTrackDB = await this.registrationTrackService.findByRegistrationId(registration.id, 2);
                if (requestBody.key != "shop") {
                    let obj = { jsonData: requestBody }
                    let result = await this.registrationTrackService.getRegistrationReview(registration.id, obj);
                    await this.insertIntoRegistrationTrack(registration, result, registrationTrackDB);
                    return response.status(200).send({ response: result, message: "Success Updated", errorCode: 0 });
                }
                else {
                    await this.insertIntoRegistrationTrack(registration, requestBody, registrationTrackDB);
                    return response.status(200).send({ response: requestBody, message: "Success Updated", errorCode: 0 });
                }
            }
            else {
                return response.status(212).send({ message: "RegistrationKey is not valid" });
            }
        }
        catch (error) {
            logger.error(`Exception occurred in registration review save  ${currentUser.id}` + error);
            return response.status(500).send({
                message: process.env.NODE_ENV == AppConstants.development ? AppConstants.errMessage + error : AppConstants.errMessage
            });
        }
    }

    private async insertIntoRegistrationTrack(registration, jsonBody, registrationTrackDB) {
        try {
            let registrationTrack = new RegistrationTrack();

            if (registrationTrackDB != null && registrationTrackDB != undefined) {
                registrationTrack.id = registrationTrackDB.id;
                registrationTrack.updatedBy = registration.createdBy;
                registrationTrack.updatedOn = new Date();
            }
            else {
                registrationTrack.id = 0;
                registrationTrack.createdBy = registration.createdBy;
            }

            registrationTrack.registrationId = registration.id;
            registrationTrack.stepsId = 2;
            registrationTrack.jsonData = JSON.stringify(jsonBody);
            await this.registrationTrackService.createOrUpdate(registrationTrack);
        } catch (error) {
            logger.error(`Exception occurred in insertIntoRegistrationTrack` + error);
        }
    }

    @Authorized()
    @Delete('/registration/product/delete')
    async deleteRegistrationProduct(
        @QueryParam('registrationId') registrationId: string,
        @QueryParam('orgRegParticipantId') orgRegParticipantId: number,
        @QueryParam('teamName') teamName: string,
        @HeaderParam("authorization") currentUser: User,
        @Res() response: Response) {
        try {
            let registration = await this.registrationService.findByRegistrationKey(registrationId);
            if (registration != undefined) {

                let orgRegParticipantDraftData = await this.orgRegistrationParticipantDraftService.findById(orgRegParticipantId);
                if (orgRegParticipantDraftData) {
                    let userRegDraftData = await this.userRegistrationDraftService.findById(orgRegParticipantDraftData.userRegistrationId);

                    if (userRegDraftData) {
                        if (userRegDraftData.participantData) {
                            let participantData = JSON.parse(JSON.stringify(userRegDraftData.participantData));
                            if (participantData.competitions && participantData.competitions.length) {
                                for (let comp of participantData.competitions) {

                                    if (comp.divisions && comp.divisions.length) {
                                        if (orgRegParticipantDraftData.competitionMembershipProductDivisionId) {
                                            // console.log("::" + orgRegParticipantDraftData.competitionMembershipProductDivisionId)
                                            // console.log("::" + orgRegParticipantDraftData.competitionMembershipProductTypeId)
                                            let divisions = comp.divisions.filter(x =>
                                                x.competitionMembershipProductDivisionId !=
                                                orgRegParticipantDraftData.competitionMembershipProductDivisionId);
                                            //  console.log("divisions" + JSON.stringify(divisions));
                                            comp.divisions = [];
                                            comp.divisions.push(...divisions);
                                        }
                                    }

                                    if (comp.products && comp.products.length) {
                                        let divisions = null;
                                        if (comp.divisions && comp.divisions.length) {
                                            divisions = comp.divisions.filter(x => x.competitionMembershipProductTypeId ==
                                                orgRegParticipantDraftData.competitionMembershipProductTypeId);
                                        }
                                        if (!divisions) {
                                            let products = comp.products.filter(x => x.competitionMembershipProductTypeId !=
                                                orgRegParticipantDraftData.competitionMembershipProductTypeId);
                                            comp.products = [];
                                            comp.products.push(...products);
                                        }
                                    }
                                }
                            }

                            userRegDraftData.participantData = JSON.stringify(participantData);
                            userRegDraftData.parentData = JSON.stringify(userRegDraftData.parentData)
                            userRegDraftData.updatedBy = registration.createdBy;
                            userRegDraftData.updatedOn = new Date();
                            await this.userRegistrationDraftService.createOrUpdate(userRegDraftData)

                        }
                        else {

                            let userRegList = await this.userRegistrationDraftService.findByRegistrationId(registration.id);
                            let registererUserRegDraftData = userRegList.find(x => x.personRoleRefId != null && x.teamName == teamName);
                            if (registererUserRegDraftData) {
                                if (registererUserRegDraftData.participantData) {
                                    let participantData = JSON.parse(JSON.stringify(registererUserRegDraftData.participantData));
                                    let teamMembers = participantData.teamMembers.filter(x => x.email != userRegDraftData.email);
                                    participantData.teamMembers = [];
                                    participantData.teamMembers = teamMembers;
                                    if (orgRegParticipantDraftData.isPlayer == 1) {
                                        registererUserRegDraftData.noOfPlayers = registererUserRegDraftData.noOfPlayers - 1;
                                    }
                                    if (userRegDraftData.payingFor == 1) {
                                        registererUserRegDraftData.payingForCount = registererUserRegDraftData.payingForCount - 1;
                                    }
                                    registererUserRegDraftData.totalMembers = registererUserRegDraftData.totalMembers - 1;
                                    registererUserRegDraftData.participantData = JSON.stringify(participantData);
                                    registererUserRegDraftData.updatedBy = registration.createdBy;
                                    registererUserRegDraftData.updatedOn = new Date();
                                    await this.userRegistrationDraftService.createOrUpdate(registererUserRegDraftData);
                                }
                            }

                            userRegDraftData.isDeleted = 1
                            userRegDraftData.updatedBy = registration.createdBy;
                            userRegDraftData.updatedOn = new Date();
                            await this.userRegistrationDraftService.createOrUpdate(userRegDraftData);
                        }
                    }
                }

                let orgRegParticipantDraft = new OrgRegistrationParticipantDraft();
                orgRegParticipantDraft.id = orgRegParticipantId;
                orgRegParticipantDraft.isDeleted = 1;
                orgRegParticipantDraft.updatedBy = currentUser.id;
                orgRegParticipantDraft.updatedOn = new Date();
                await this.orgRegistrationParticipantDraftService.createOrUpdate(orgRegParticipantDraft);


                let regTrackReviewData = await this.registrationTrackService.findByRegistrationId(registration.id, 2);
                let result = await this.registrationTrackService.getRegistrationReview(registration.id, regTrackReviewData);
                return response.status(200).send(result);
            }
            else {
                return response.status(212).send({ message: "RegistrationKey is not valid" });
            }
        }
        catch (error) {
            logger.error(`Exception occurred in registration review save  ${currentUser.id}` + error);
            return response.status(500).send({
                message: process.env.NODE_ENV == AppConstants.development ? AppConstants.errMessage + error : AppConstants.errMessage
            });
        }
    }

    @Authorized()
    @Delete('/registration/participant/delete')
    async deleteRegistrationParticipant(
        @QueryParam('registrationId') registrationId: string,
        @QueryParam('participantId') participantId: string,
        @QueryParam('competitionUniqueKey') competitionUniqueKey: string,
        @QueryParam('organisationUniqueKey') organisationUniqueKey: string,
        @QueryParam('teamName') teamName: string,
        @HeaderParam("authorization") currentUser: User,
        @Res() response: Response) {
        try {
            let registration = await this.registrationService.findByRegistrationKey(registrationId);
            if (registration != undefined) {
                let competitionId = await this.competitionRegService.findByUniquekey(competitionUniqueKey);
                let organisationId = await this.organisationService.findByUniquekey(organisationUniqueKey);
                let orgRegistrationId = await this.orgRegistrationService.findOrgRegId(competitionId, organisationId)
                let userRegData = await this.userRegistrationDraftService.getParticipantData(participantId);
                if (teamName) {
                    await this.orgRegistrationParticipantDraftService.deleteByTeamName(registration.id, currentUser.id, teamName)
                }
                else {
                    await this.orgRegistrationParticipantDraftService.deleteByCompetition(registration.id, currentUser.id, userRegData.id, orgRegistrationId)
                    let participantData = JSON.parse(JSON.stringify(userRegData.participantData));
                    if (participantData) {
                        let competitions = participantData.competitions.filter(x => x.competitionId != competitionUniqueKey && x.organisationId != organisationUniqueKey);
                        participantData.competitions = [];
                        participantData.competitions.push(...competitions);
                    }

                    let userRegisterDraft = new UserRegistrationDraft()
                    userRegisterDraft.id = userRegData.id;
                    userRegisterDraft.updatedBy = currentUser.id;
                    userRegisterDraft.updatedOn = new Date();
                    userRegisterDraft.participantData = JSON.stringify(participantData);
                    await this.userRegistrationDraftService.createOrUpdate(userRegisterDraft)

                    let otherCompParticipants = await this.orgRegistrationParticipantDraftService.findByUserRegistration(registration.id, userRegData.id)
                    if (!(otherCompParticipants && otherCompParticipants.length)) {
                        let userRegDraft = new UserRegistrationDraft();
                        userRegDraft.id = userRegData.id;
                        userRegDraft.isDeleted = 1;
                        userRegDraft.updatedBy = currentUser.id;
                        userRegDraft.updatedOn = new Date();
                        await this.userRegistrationDraftService.createOrUpdate(userRegDraft);
                    }
                }


                let regTrackReviewData = await this.registrationTrackService.findByRegistrationId(registration.id, 2);
                let result = await this.registrationTrackService.getRegistrationReview(registration.id, regTrackReviewData);
                return response.status(200).send(result);
            }
            else {
                return response.status(212).send({ message: "RegistrationKey is not valid" });
            }
        }
        catch (error) {
            logger.error(`Exception occurred in registration review save  ${currentUser.id}` + error);
            return response.status(500).send({
                message: process.env.NODE_ENV == AppConstants.development ? AppConstants.errMessage + error : AppConstants.errMessage
            });
        }
    }

    @Authorized()
    @Get('/registration/participant/users')
    async getRegistrationYourInfoList(
        @QueryParam('registrationId') registrationId: string,
        @HeaderParam("authorization") currentUser: User,
        @Res() response: Response) {
        try {
            let registration = await this.registrationService.findByRegistrationKey(registrationId);
            let usersArr = [];

            if (registration != undefined) {

                if (isNullOrZero(registration.createdBy)) {
                    let userRegData = await this.userRegistrationDraftService.findByRegistrationId(registration.id);
                    let registeringOtersExists = userRegData.find(x => x.registeringYourselfRefId == RegisteringYourself.OTHER);
                    if (registeringOtersExists)
                        if (userRegData && userRegData.length) {
                            for (let item of userRegData) {
                                //if(item.registeringYourselfRefId != 1){
                                let participantData = item.participantData ? JSON.parse(JSON.stringify(item.participantData)) : null;
                                if (isNotNullAndUndefined(participantData)) {
                                    let user = this.getUserInfoObj(participantData);
                                    if (participantData.referParentEmail == false)
                                        usersArr.push(user);
                                    if (participantData.parentOrGuardian && participantData.parentOrGuardian.length) {
                                        for (let parent of participantData.parentOrGuardian) {
                                            let user = this.getUserInfoObj(parent);
                                            usersArr.push(user);
                                        }
                                    }
                                }
                                //}
                            }
                        }
                }

                return response.status(200).send(usersArr);
            }
            else {
                return response.status(212).send({ message: "RegistrationKey is not valid" });
            }
        }
        catch (error) {
            logger.error(`Exception occurred in getRegistrationYourInfoList  ${currentUser.id}` + error);
            return response.status(500).send({
                message: process.env.NODE_ENV == AppConstants.development ? AppConstants.errMessage + error : AppConstants.errMessage
            });
        }
    }

    @Authorized()
    @Get('/registration/participant/address')
    async getRegistrationParticipantAddress(
        @QueryParam('registrationId') registrationId: string = undefined,
        @QueryParam('userRegId') userRegId: string = undefined,
        @HeaderParam("authorization") currentUser: User,
        @Res() response: Response) {
        try {

            let addressArr = [];

            if (userRegId) {
                let userRegData = await this.userRegistrationService.findByRegistrationKey(userRegId);
                let user = await this.userService.findById(userRegData.userId);
                let parents = await this.userService.getUserParents(userRegData.userId);
                let userAddress = this.getAddressObj(user);
                addressArr.push(userAddress);
                if (parents && parents.length) {
                    for (let item of parents) {
                        let parentAddress = this.getAddressObj(item);
                        addressArr.push(parentAddress)
                    }
                }

                return response.status(200).send(addressArr);
            }
            else if (registrationId != undefined) {
                let registration = await this.registrationService.findByRegistrationKey(registrationId);
                let userRegData = await this.userRegistrationDraftService.findByRegistrationId(registration.id);
                if (userRegData && userRegData.length) {
                    for (let item of userRegData) {
                        let participantData = item.participantData ? JSON.parse(JSON.stringify(item.participantData)) : null;
                        if (isNotNullAndUndefined(participantData)) {
                            let address = this.getAddressObj(participantData);
                            addressArr.push(address);
                            if (participantData.parentOrGuardian && participantData.parentOrGuardian.length) {
                                for (let parent of participantData.parentOrGuardian) {
                                    let address = this.getAddressObj(parent);
                                    addressArr.push(address);
                                }
                            }
                        }
                    }
                }

                return response.status(200).send(addressArr);
            }
            else {
                return response.status(212).send({ message: "RegistrationKey is not valid" });
            }
        }
        catch (error) {
            logger.error(`Exception occurred in getRegistrationParticipantAddress  ${currentUser.id}` + error);
            return response.status(500).send({
                message: process.env.NODE_ENV == AppConstants.development ? AppConstants.errMessage + error : AppConstants.errMessage
            });
        }
    }

    @Authorized()
    @Get('/registration/teamparticipant')
    async getTeamParticipantById(
        @QueryParam('participantId') participantId: string,
        @HeaderParam("authorization") currentUser: User,
        @Res() response: Response) {
        try {
            let teamParticipantData = null;
            if (participantId) {
                let userRegData = await this.userRegistrationService.getParticipantData(participantId);
                if (userRegData && userRegData.length) {
                    let data = userRegData.find(x => x);
                    teamParticipantData = data.participantData;
                    teamParticipantData.divisions = [];
                    (teamParticipantData.teamMembers || []).map((item) => {
                        item.membershipProductTypes = [];

                    })
                }

                teamParticipantData.existingUserId = 0;
                teamParticipantData.organisationId = null;
                teamParticipantData.competitionId = null;
                teamParticipantData.registrationId = null;
                teamParticipantData.allowTeamRegistrationTypeRefId = null;
                teamParticipantData.competitionMembershipProductId = null;
                teamParticipantData.registrationRestrictionTypeRefId = null;
                teamParticipantData.competitionMembershipProductTypeId = null;
                teamParticipantData.competitionMembershipProductDivisionId = null;
                teamParticipantData.membershipProductList = [];
                teamParticipantData["existingTeamParticipantId"] = participantId;
            }

            return response.status(200).send(teamParticipantData);
        }
        catch (error) {
            logger.error(`Exception occurred in getTeamParticipantById ${currentUser.id}` + error);
            return response.status(500).send({
                message: process.env.NODE_ENV == AppConstants.development ? AppConstants.errMessage + error : AppConstants.errMessage
            });
        }
    }

    @Authorized()
    @Get('/teaminvite/review')
    async teamRegistrationReview(
        @QueryParam('userRegId') userRegId: string,
        @HeaderParam("authorization") currentUser: User,
        @Res() response: Response) {
        try {
            let userRegistration = await this.userRegistrationService.findByRegistrationKey(userRegId);
            if (isNotNullAndUndefined(userRegistration)) {
                let regTrackReviewData = await this.registrationTrackService.findByUserRegistrationId(userRegistration.registrationId, 11,
                    userRegistration.userRegId);

                let result = await this.userRegistrationService.getUserRegistrationReview(userRegistration.userRegId, regTrackReviewData);

                result.yourInfo = await this.getTeamInviteYourInfoObj(userRegistration.userId, result.yourInfo);
                if (result.yourInfo.firstName != null) {
                    if (!isNotNullAndUndefined(result.billingAddress)) {
                        result.billingAddress = this.getAddressObj(result.yourInfo);
                    }

                    if (!isNotNullAndUndefined(result.deliveryAddress)) {
                        result.deliveryAddress = this.getAddressObj(result.yourInfo);
                    }
                }

                return response.status(200).send(result)
            }
            else {
                return response.status(212).send({ message: "UserRegistrationKey is not valid" });
            }

        }
        catch (error) {
            logger.error(`Exception occurred in registration review  ${currentUser.id}` + error);
            return response.status(500).send({
                message: process.env.NODE_ENV == AppConstants.development ? AppConstants.errMessage + error : AppConstants.errMessage
            });
        }
    }

    @Authorized()
    @Post('/teaminvite/review')
    async teamRegistrationReviewSave(
        @QueryParam('userRegId') userRegId: string,
        @HeaderParam("authorization") currentUser: User,
        @Body() requestBody,
        @Res() response: Response) {
        try {
            let userRegistration = await this.userRegistrationService.findByRegistrationKey(userRegId);
            if (userRegistration != undefined) {

                const { shopProducts } = requestBody;
                if (this.invalidShopProductsData(shopProducts)) {
                    const error = "Can't save invalid products data";
                    logger.error(`Exception occurred in registration review save  ${currentUser.id}` + error);
                    return response.status(500).send({
                        message: process.env.NODE_ENV == AppConstants.development ? AppConstants.errMessage + ' ' +  error : AppConstants.errMessage
                    });
                }

                if (requestBody.key == "voucher") {
                    let compParticipant = requestBody.compParticipants[requestBody.index];
                    let otherParticipants = [];
                    let voucherMap = new Map();
                    let pin = moment(compParticipant.dateOfBirth).format("DDMM")
                    requestBody.compParticipants.map((item, index) => {
                        if (index != requestBody.index) {
                            otherParticipants.push(item);
                        }
                    })

                    let arr = [];
                    if (isNotNullAndUndefined(compParticipant)) {
                        let vouchers = compParticipant.selectedOptions.vouchers;
                        (vouchers || []).forEach((x) => {
                            x.isValid = 0;
                            x.message = null;
                        });

                        // check whether organisation is registered / configured for organisationPosId before checking vouchers
                        const { organisationUniqueKey } = compParticipant
                        const organisation = await this.organisationService.findOrganisationByUniqueKey(organisationUniqueKey);
                        const { posTerminalId, storeChannelCode, postalCode } = organisation[0]

                        if (!posTerminalId) {
                            (vouchers || []).forEach((x) => {
                                x.isValid = 0;
                                x.message = AppConstants.voucherPosIdNotConfigured;
                            });
                        } else if (!postalCode) {
                            (vouchers || []).forEach((x) => {
                                x.isValid = 0;
                                x.message = AppConstants.voucherPostalCodeNotConfigured;
                            });
                        } else if (!storeChannelCode) {
                            (vouchers || []).forEach((x) => {
                                x.isValid = 0;
                                x.message = AppConstants.voucherStoreChannelCodeNotConfigured;
                            });
                        } else {
                            for (let voucher of vouchers) {
                                let validationCheck = null;
                                validationCheck = this.duplicateVoucherCheck(voucher.voucherCode, otherParticipants, voucherMap);
                                console.log("validationCheck" + validationCheck)
                                if (!isNotNullAndUndefined(validationCheck)) {
                                    validationCheck = await this.checkVoucherBalance(voucher.voucherCode, pin);
                                }
                                console.log("validationCheck1" + JSON.stringify(validationCheck));
                                voucher.isValid = validationCheck.isValid;
                                voucher.message = validationCheck.message;
                                voucher.balance = validationCheck.balance;
                                voucher.message = voucher.message.replace('Invalid Pin.', AppConstants.invalidPinVoucher)
                                if (voucher.isValid) {
                                    arr.push(voucher);
                                }
                            }
                        }
                        if (compParticipant.selectedOptions.vouchers && compParticipant.selectedOptions.vouchers.length) {
                            console.log(")))))" + JSON.stringify(compParticipant.selectedOptions.vouchers));
                            let isValid = true;
                            for (let gov of compParticipant.selectedOptions.vouchers) {
                                if (gov.isValid == 0 || gov.isValid == null) {
                                    isValid = false;
                                    break;
                                }
                            }
                            console.log("isValid Voucher::" + isValid);
                            if (!isValid) {
                                let registrationTrackDB = await this.registrationTrackService.findByUserRegistrationId(userRegistration.registrationId, 11,
                                    userRegistration.userRegId);
                                let obj = { jsonData: requestBody }
                                let result = await this.userRegistrationService.getUserRegistrationReview(userRegistration.userRegId, obj);
                                await this.getRegistrationTrack(userRegistration, result, registrationTrackDB);
                                return response.status(200).send({ response: requestBody, message: "Invalid Code", errorCode: 1 });
                            }
                            else {
                                compParticipant.selectedOptions.selectedGovernmentVouchers = [];
                                compParticipant.selectedOptions.selectedGovernmentVouchers.push(...arr);
                            }
                        }
                        else {
                            compParticipant.selectedOptions.selectedGovernmentVouchers = [];
                        }
                    }
                }
                else if (requestBody.key == "paymentOptionRefId") {
                    let compParticipant = requestBody.compParticipants[requestBody.index];
                    if (compParticipant.selectedOptions.paymentOptionRefId == 1) {
                        if (compParticipant.selectedOptions.isHardshipCodeApplied == 1) {
                            if (compParticipant.selectedOptions.discountCodes && compParticipant.selectedOptions.discountCodes.length) {
                                compParticipant.selectedOptions.discountCodes = [];
                            }
                        }
                        compParticipant.selectedOptions.isHardshipCodeApplied = 0;
                    }
                }

                // RegistrationTrack
                let registrationTrackDB = await this.registrationTrackService.findByUserRegistrationId(userRegistration.registrationId, 11,
                    userRegistration.userRegId);
                if (requestBody.key != "shop") {
                    let obj = { jsonData: requestBody }
                    let result = await this.userRegistrationService.getUserRegistrationReview(userRegistration.userRegId, obj);
                    await this.getRegistrationTrack(userRegistration, result, registrationTrackDB);
                    return response.status(200).send({ response: result, message: "Success Updated", errorCode: 0 });
                }
                else {
                    await this.getRegistrationTrack(userRegistration, requestBody, registrationTrackDB);
                    return response.status(200).send({ response: requestBody, message: "Success Updated", errorCode: 0 });
                }
            }
            else {
                return response.status(212).send({ message: "RegistrationKey is not valid" });
            }
        }
        catch (error) {
            logger.error(`Exception occurred in registration review save  ${currentUser.id}` + error);
            return response.status(500).send({
                message: process.env.NODE_ENV == AppConstants.development ? AppConstants.errMessage + error : AppConstants.errMessage
            });
        }
    }

    private async getRegistrationTrack(userRegistration, jsonBody, registrationTrackDB) {
        try {
            let registrationTrack = new RegistrationTrack();

            if (registrationTrackDB != null && registrationTrackDB != undefined) {
                registrationTrack.id = registrationTrackDB.id;
                registrationTrack.updatedBy = userRegistration.regCreatedBy;
                registrationTrack.updatedOn = new Date();
            }
            else {
                registrationTrack.id = 0;
                registrationTrack.createdBy = userRegistration.regCreatedBy;
            }

            registrationTrack.registrationId = userRegistration.registrationId;
            registrationTrack.userRegistrationId = userRegistration.userRegId;
            registrationTrack.stepsId = 11;
            registrationTrack.jsonData = JSON.stringify(jsonBody)
            let res = await this.registrationTrackService.createOrUpdate(registrationTrack);

            return res;
        }
        catch (error) {
            logger.error(`Exception occurred in getRegistrationTrack` + error);
        }
    }


    @Authorized()
    @Get('/teamregistration/review/products')
    async teamRegistrationReviewProducts(
        @QueryParam('userRegId') userRegId: string,
        @HeaderParam("authorization") currentUser: User,
        @Res() response: Response) {
        try {
            let userRegistration = await this.userRegistrationService.findByRegistrationKey(userRegId);
            if (userRegistration != undefined) {
                let regTrackReviewData = await this.registrationTrackService.findByUserRegistrationId(userRegistration.registrationId, 11,
                    userRegistration.userRegId);

                let result = await this.userRegistrationService.getUserRegistrationReviewProducts(regTrackReviewData);
                return response.status(200).send(result)
            }
            else {
                return response.status(212).send({ message: "RegistrationKey is not valid" });
            }

        }
        catch (error) {
            logger.error(`Exception occurred in registration review  ${currentUser.id}` + error);
            return response.status(500).send({
                message: process.env.NODE_ENV == AppConstants.development ? AppConstants.errMessage + error : AppConstants.errMessage
            });
        }
    }

    @Authorized()
    @Get('/mailForTeamRegistration')
    async mailTeamRegistration(
        @QueryParam('registrationId') registrationId: number,
        @HeaderParam("authorization") currentUser: User,
        @Res() response: Response) {
        try {
            //  await this.mailForTeamRegistration(registrationId, currentUser.id)
            return response.status(200).send("Success")
        }
        catch (error) {
            return response.status(500).send({
                message: process.env.NODE_ENV == AppConstants.development ? AppConstants.errMessage + error : AppConstants.errMessage
            });
        }
    }

    @Authorized()
    @Get('/mailParticipantRegistration')
    async mailParticipantRegistration(
        @QueryParam('registrationId') registrationId: number,
        @HeaderParam("authorization") currentUser: User,
        @Res() response: Response) {
        try {
            // await this.mailToParticipant(registrationId, currentUser.id)
            return response.status(200).send("Success")
        }
        catch (error) {
            return response.status(500).send({
                message: process.env.NODE_ENV == AppConstants.development ? AppConstants.errMessage + error : AppConstants.errMessage
            });
        }
    }

    @Authorized()
    @Post('/registration/registrationsettings')
    async registrationsettings(
        // @QueryParam('userId') userId: number,
        @HeaderParam("authorization") currentUser: User,
        @Body() requestBody: any,
        @Res() response: Response) {
        try {
            if (currentUser) {
                if (requestBody != null) {
                    let validateComp = validateReqFilter(requestBody.competitionUniqueKey, 'competitionUniqueKey');
                    if (validateComp != null) {
                        return response.status(212).send(validateComp);
                    }
                    let validateOrg = validateReqFilter(requestBody.organisationUniqueKey, 'organisationUniqueKey');
                    if (validateOrg != null) {
                        return response.status(212).send(validateOrg);
                    }
                    let res = await this.registrationService.registrationsettings(requestBody.competitionUniqueKey, requestBody.organisationUniqueKey);
                    return response.status(200).send(res);
                }
                else {
                    return response.status(212).send({
                        errorCode: 4,
                        message: 'Empty Body'
                    });
                }

            }
            else {
                return response.status(212).send({
                    errorCode: 3,
                    message: 'UserId is Mandatory'
                })
            }
        }
        catch (error) {
            logger.error(`Error Occurred in  registrationsettings ` + error);
            return response.status(500).send({
                message: process.env.NODE_ENV == AppConstants.development ? AppConstants.errMessage + error : AppConstants.errMessage
            });
        }
    }

    @Authorized()
    @Post('/registration/membershipproducts')
    async membershipProducts(
        // @QueryParam('userId') userId: number,
        @HeaderParam("authorization") currentUser: User,
        @Body() requestBody: any,
        @Res() response: Response) {
        try {
            if (currentUser) {
                if (requestBody != null) {
                    // let validateComp = validateReqFilter(requestBody.competitionUniqueKey, 'competitionUniqueKey');
                    // if (validateComp != null) {
                    //     return response.status(212).send(validateComp);
                    // }
                    // let validateOrg = validateReqFilter(requestBody.organisationUniqueKey, 'organisationUniqueKey');
                    // if (validateOrg != null) {
                    //     return response.status(212).send(validateOrg);
                    // }

                    let res = await this.registrationService.membershipProducts(requestBody.competitionUniqueKey, requestBody.organisationUniqueKey, requestBody.currentDate);
                    if (res != null)
                        return response.status(200).send(res);
                    else {
                        return response.status(212).send({
                            errorCode: 7,
                            message: 'The organisation is not registered with the competition'
                        });
                    }
                }
                else {
                    return response.status(212).send({
                        errorCode: 4,
                        message: 'Empty Body'
                    });
                }

            }
            else {
                return response.status(212).send({
                    errorCode: 3,
                    message: 'UserId is Mandatory'
                })
            }
        }
        catch (error) {
            logger.error(`Error Occurred in membershipproducts ` + error);
            return response.status(500).send({
                message: process.env.NODE_ENV == AppConstants.development ? AppConstants.errMessage + error : AppConstants.errMessage
            });
        }
    }

    @Authorized()
    @Post('/registration/userinfo')
    async userInfo(
        // @QueryParam('userId') userId: number,
        @HeaderParam("authorization") currentUser: User,
        @Body() requestBody: any,
        @Res() response: Response) {
        try {
            if (currentUser) {
                if (requestBody != null) {
                    //  let competitionId = await this.competitionRegService.findByUniquekey(requestBody.competitionUniqueKey);
                    //  let organisationId = await this.organisationService.findByUniquekey(requestBody.organisationUniqueKey);

                    let res = await this.registrationService.userInfo(requestBody);
                    return response.status(200).send(res);
                }
                else {
                    return response.status(212).send({
                        errorCode: 4,
                        message: 'Empty Body'
                    });
                }

            }
            else {
                return response.status(212).send({
                    errorCode: 3,
                    message: 'UserId is Mandatory'
                })
            }
        }
        catch (error) {
            logger.error(`Error Occurred in membershipproducts ` + error);
            return response.status(500).send({
                message: process.env.NODE_ENV == AppConstants.development ? AppConstants.errMessage + error : AppConstants.errMessage
            });
        }
    }

    @Authorized()
    @Get('/registration/expiry/check')
    async competitionExpiryCheck(
        @HeaderParam("authorization") currentUser: User,
        @QueryParam('competitionId') competitionId: string,
        @QueryParam('organisationId') organisationId: string,
        @QueryParam('currentDate') currentDate: string,
        @Res() response: Response) {
        try {
            if (competitionId != null && organisationId != null) {
                let compId = await this.competitionRegService.findByUniquekey(competitionId);
                let orgId = await this.organisationService.findByUniquekey(organisationId);

                let res = await this.registrationService.registrationExpiryCheck(orgId, compId, currentDate);
                let data = null;
                if (res && res.length) {
                    data = res.find(x => x);
                }
                return response.status(200).send(data);
            }
            else {
                return response.status(212).send({
                    errorCode: 4,
                    message: 'Compeition and Organisation id is required'
                });
            }
        }
        catch (error) {
            logger.error(`Error Occurred in competitionExpiryCheck ` + error);
            return response.status(500).send({
                message: process.env.NODE_ENV == AppConstants.development ? AppConstants.errMessage + error : AppConstants.errMessage
            });
        }
    }

    @Authorized()
    @Get('/home/registrations')
    async registrationCount(
        @QueryParam('yearRefId') yearRefId: number,
        @QueryParam('organisationUniqueKey') organisationUniqueKey: string,
        @HeaderParam("authorization") currentUser: User,
        @Res() response: Response
    ) {
        try {
            if (currentUser.id) {
                let res = await this.registrationService.registrationCount(yearRefId, organisationUniqueKey)
                return response.status(200).send(res)
            }
        }
        catch (error) {
            return response.status(500).send({ message: process.env.NODE_ENV == AppConstants.development ? AppConstants.errMessage + error : AppConstants.errMessage })
        }
    }

    @Authorized()
    @Post('/registration/dashboard')
    async registrationDashboard(
        @HeaderParam("authorization") currentUser: User,
        @Body() requestBody,
        @QueryParam('sortBy') sortBy: string = undefined,
        @QueryParam('sortOrder') sortOrder: 'ASC' | 'DESC' = undefined,
        @Res() response: Response
    ) {
        try {
            if (currentUser.id) {
                let organisationId = await this.organisationService.findByUniquekey(requestBody.organisationUniqueKey);
                let res = await this.registrationService.registrationDashboard(requestBody, organisationId, sortBy, sortOrder)
                return response.status(200).send(res)
            }
        }
        catch (error) {
            return response.status(500).send({ message: process.env.NODE_ENV == AppConstants.development ? AppConstants.errMessage + error : AppConstants.errMessage })
        }
    }


    @Authorized()
    @Post('/registration/export')
    async exportRegistrationDashboard(
        //@QueryParam('organisationUniqueKey') organisationUniqueKey: string,
        @HeaderParam("authorization") currentUser: User,
        @Body() requestBody: any,
        @Res() response: Response) {
        try {
            if (currentUser) {

                if (requestBody != null) {
                    let validateComp = validateReqFilter(requestBody.competitionUniqueKey, 'competitionUniqueKey');
                    if (validateComp != null) {
                        return response.status(212).send(validateComp);
                    }
                    let validateOrg = validateReqFilter(requestBody.organisationUniqueKey, 'organisationUniqueKey');
                    if (validateOrg != null) {
                        return response.status(212).send(validateOrg);
                    }
                    if (requestBody != null) {
                        let organisationId = await this.organisationService.findByUniquekey(requestBody.organisationUniqueKey);
                        let res = await this.registrationService.registrationDashboard(requestBody, organisationId);
                        let responsingCSV = [{
                            "First Name": "",
                            "Last Name": "",
                            "Email": "",
                            "Registration Date": "",
                            "Registration Time": "",
                            "Affiliate": "",
                            "Registration Divisions": "",
                            "DOB": "",
                            "Paid By": "",
                            "Paid Fee(incl. GSt)": "",
                            "Pending Fee(incl. GST)": "",
                            "Due per Match": "",
                            "Due per instalment": "",
                            "Status": "",
                        }]; // default value (blank with headers)
                        if (res["registrations"].length) {
                            responsingCSV = res["registrations"].map((item) => {
                                const paidBy = (item.paidByUsers || []).map(currentPay => item.userId === currentPay.paidByUserId ? 'Self' : currentPay.paidBy).join(' ')

                                let dateDOB = ''
                                let dateRegistration = ''
                                let timeRegistration = ''
                                if (item.dateOfBirth) {
                                    let monthDOB = item.dateOfBirth.getMonth() + 1
                                    let dayDOB = item.dateOfBirth.getDate()
                                    dateDOB = item.dateOfBirth && `${dayDOB < 10 ? `0${dayDOB}` : dayDOB}/${monthDOB < 10 ? `0${monthDOB}` : monthDOB}/${item.dateOfBirth.getFullYear()}`
                                }
                                if (item.registrationDate) {
                                    // fixme: is below really needed ?
                                    let hoursRegistration = item.registrationDate.getHours()
                                    let minutesRegistration = item.registrationDate.getMinutes()
                                    let secondsRegistration = item.registrationDate.getSeconds()
                                    timeRegistration = `${hoursRegistration < 10 ? `0${hoursRegistration}` : hoursRegistration}:${minutesRegistration < 10 ? `0${minutesRegistration}` : minutesRegistration}:${secondsRegistration < 10 ? `0${secondsRegistration}` : secondsRegistration}`
                                    let monthRegistration = item.registrationDate.getMonth() + 1
                                    let dayRegistration = item.registrationDate.getDate()
                                    dateRegistration = `${dayRegistration < 10 ? `0${dayRegistration}` : dayRegistration}/${monthRegistration < 10 ? `0${monthRegistration}` : monthRegistration}/${item.registrationDate.getFullYear()}`
                                }


                                // replace email with parents;
                                if (item.email && 1 == item.isInActive && item.email.lastIndexOf('.') > 0) {
                                    let parentEmailString = item.email.substr(0,item.email.lastIndexOf('.'));
                                    item.email = parentEmailString.toLowerCase();
                                }
                                delete item.isInActive;

                                return {
                                    "First Name": item.firstName,
                                    "Last Name": item.lastName,
                                    "Email": item.email,
                                    "Registration Date": dateRegistration,
                                    "Registration Time": timeRegistration,
                                    "Affiliate": item.affiliate,
                                    "Registration Divisions": item.divisionName,
                                    "DOB": dateDOB,
                                    "Paid By": paidBy,
                                    "Paid Fee(incl. GSt)": item.paidFee,
                                    "Pending Fee(incl. GST)": item.pendingFee,
                                    "Due per Match": item.duePerMatch,
                                    "Due per instalment": item.duePerInstalment,
                                    "Status": item.paymentStatus,
                                }
                            })
                        }
                        //return response.status(200).send(responsingCSV)
                        response.setHeader('Content-disposition', 'attachment; filename=registrations.csv');
                        response.setHeader('content-type', 'text/csv');
                        fastcsv
                            .write((responsingCSV), { headers: true })
                            .on("finish", function () {
                            })
                            .pipe(response);
                    }
                }
                else {
                    return response.status(212).send({
                        errorCode: 4,
                        message: 'Empty Body'
                    });
                }

            }
            else {
                return response.status(212).send({
                    errorCode: 3,
                    message: 'UserId is Mandatory'
                })
            }
        }
        catch (error) {
            logger.error(`Error Occurred in team registration export ` + error);
            return response.status(500).send({
                message: process.env.NODE_ENV == AppConstants.development ? AppConstants.errMessage + error : AppConstants.errMessage
            });
        }
    }

    @Authorized()
    @Post('/registration/transaction/update')
    async transactionUpdate(
        @HeaderParam("authorization") currentUser: User,
        @Body() requestBody,
        @Res() response: Response
    ) {
        try {
            if (currentUser.id) {
                let feeType = requestBody.feeType;
                let pendingFee = requestBody.pendingFee;

                let transactionId = requestBody.transactionId;
                let amount: number = requestBody.amount;

                let transaction = await this.transactionService.findById(transactionId);

                let pendingTransactions = await this.transactionService.findByInvoiceRefId(transaction.invoiceRefId, transaction.participantId);
                let pendingAffiliateTrans = pendingTransactions.filter(x => x.feeType == 'affiliate');
                let pendingCompTrans = pendingTransactions.filter(x => x.feeType == 'competition');
                let affiliateReceivedAmount = amount / pendingAffiliateTrans.length;

                if (pendingAffiliateTrans && pendingAffiliateTrans.length) {
                    for (let affTrans of pendingAffiliateTrans) {
                        affTrans.statusRefId = AppConstants.PAID;
                        affTrans.amountReceived = affiliateReceivedAmount;
                        affTrans.updatedBy = currentUser.id;
                        affTrans.updatedOn = new Date();
                        await this.transactionService.createOrUpdate(affTrans);

                        let transAudit = new TransactionAudit();
                        transAudit.id = 0;
                        transAudit.amount = affiliateReceivedAmount;
                        transAudit.transactionId = affTrans.id;
                        transAudit.createdBy = currentUser.id;
                        await this.transactionAuditService.createOrUpdate(transAudit);
                    }
                }
                if (pendingCompTrans && pendingCompTrans.length) {
                    for (let compTrans of pendingCompTrans) {
                        compTrans.statusRefId = AppConstants.CASH_HANDLE;
                        compTrans.updatedBy = currentUser.id;
                        compTrans.updatedOn = new Date();
                        await this.transactionService.createOrUpdate(compTrans);
                    }
                }
                // let trans = new Transaction();
                // trans.id = transactionId;
                // let amountReceived = transaction.amountReceived;

                // let totalAmount = feeIsNull(amountReceived) + feeIsNull(amount);
                // trans.amountReceived = totalAmount;
                // console.log("totalAmount::" + totalAmount + "amountReceived::" + amountReceived);
                // if(totalAmount == pendingFee){
                //     trans.statusRefId = 2;
                //     if(feeType == "affiliate"){
                //     // if feetype is affiliate, find the competition fee type and update the status as 5
                //         let competitonTransaction = await this.transactionService.getTransactionData(transaction, "competition");
                //         console.log("competitonTransaction" + JSON.stringify(competitonTransaction));
                //         if(competitonTransaction && competitonTransaction.length){
                //             let compTransaction = competitonTransaction.find(x=>x);
                //             let compTrans = new Transaction()
                //             compTrans.id = compTransaction.id;
                //             compTrans.statusRefId = 5;
                //             compTrans.updatedBy = currentUser.id;
                //             compTrans.updatedOn = new Date();
                //             await this.transactionService.createOrUpdate(compTrans);
                //         }
                //     }
                // }

                // trans.updatedBy = currentUser.id;
                // trans.updatedOn = new Date();
                // await this.transactionService.createOrUpdate(trans);

                return response.status(200).send({ message: "Successfully Updated" });
            }
        }
        catch (error) {
            logger.error(`Exception occurre in transactionUpdate ${error}`);
            return response.status(500).send({ message: process.env.NODE_ENV == AppConstants.development ? AppConstants.errMessage + error : AppConstants.errMessage })
        }
    }

    @Authorized()
    @Post('/teamregistration/invite/update')
    async teamRegistrationInviteUpdate(
        @HeaderParam("authorization") currentUser: User,
        @Body() requestBody,
        @Res() response: Response
    ) {
        try {
            if (currentUser.id) {
                if (requestBody.parentOrGaurdianDetails && requestBody.parentOrGaurdianDetails.length) {

                    for (let pg of requestBody.parentOrGaurdianDetails) {
                        let userPG = new User();
                        userPG.id = pg.userId;
                        userPG.firstName = pg.firstName;
                        userPG.lastName = pg.lastName;
                        userPG.mobileNumber = pg.mobileNumber;
                        userPG.email = pg.email.toLowerCase();
                        userPG.street1 = pg.street1;
                        userPG.street2 = pg.street2;
                        userPG.suburb = pg.suburb;
                        userPG.stateRefId = pg.stateRefId;
                        userPG.postalCode = pg.postalCode;
                        let password = Math.random().toString(36).slice(-8);
                        if (pg.userId == 0 || pg.userId == "" || pg.userId == null || pg.userId == undefined) {
                            userPG.createdBy = currentUser.id;
                            userPG.password = md5(AppConstants.password);
                        }
                        else {
                            userPG.updatedBy = currentUser.id;
                            userPG.updatedOn = new Date();
                        }

                        let parentOrGuardianUser = await this.userService.createOrUpdate(userPG);
                        if (pg.userId == 0 || pg.userId == null || pg.userId == "") {
                            await this.updateFirebaseData(parentOrGuardianUser, userPG.password);
                        }
                        let userFromDb = await this.userService.findById(pg.userId);
                        if (userFromDb != undefined) {
                            if (userFromDb.email !== userPG.email) {
                                await this.updateFirebaseData(parentOrGuardianUser, userFromDb.password);
                            }
                        }

                        let ureparentDb = await this.ureService.findExisting(userPG.id, requestBody.userId, 4, 9)
                        let ureparent = new UserRoleEntity();
                        if (ureparentDb) {
                            ureparent.id = ureparentDb.id;
                            ureparent.updatedBy = currentUser.id;
                            ureparent.updatedAt = new Date();
                        }
                        else {
                            ureparent.id = 0;
                            ureparent.createdBy = currentUser.id;
                        }
                        ureparent.roleId = 9;
                        ureparent.userId = parentOrGuardianUser.id
                        ureparent.entityId = requestBody.userId;
                        ureparent.entityTypeId = 4;
                        await this.ureService.createOrUpdate(ureparent);
                    }

                }

                if (requestBody != null) {
                    let participantEmail = '';
                    //let parentOrGuardianMap = new Map();
                    if (requestBody.referParentEmail) {
                        let parent = requestBody.parentOrGaurdianDetails[0];
                        participantEmail = parent.email.toLowerCase() + '.' + requestBody.firstName.toLowerCase();
                        //parentOrGuardianMap.set(parent.tempParentId, parent.email.toLowerCase())
                    }
                    else {
                        participantEmail = requestBody.email.toLowerCase();
                    }

                    let user = new User();
                    user.id = requestBody.userId;
                    user.firstName = requestBody.firstName;
                    user.lastName = requestBody.lastName;
                    user.mobileNumber = requestBody.mobileNumber;
                    user.email = participantEmail.toLowerCase();
                    user.dateOfBirth = requestBody.dateOfBirth;
                    user.street1 = requestBody.street1;
                    user.street2 = requestBody.street2;
                    user.suburb = requestBody.suburb;
                    user.stateRefId = requestBody.stateRefId;
                    user.postalCode = requestBody.postalCode;
                    user.updatedBy = currentUser.id;
                    user.updatedOn = new Date();
                    user.emergencyFirstName = requestBody.emergencyFirstName;
                    user.emergencyLastName = requestBody.emergencyLastName;
                    user.emergencyContactNumber = requestBody.emergencyContactNumber;
                    user.emergencyContactRelationshipId = requestBody.emergencyContactRelationshipId;
                    user.childrenCheckNumber = requestBody.childrenCheckNumber;
                    user.childrenCheckExpiryDate = requestBody.childrenCheckExpiryDate;
                    user.accreditationLevelUmpireRefId = requestBody.accreditationLevelUmpireRefId;
                    user.accreditationUmpireExpiryDate = requestBody.accreditationUmpireExpiryDate;
                    user.associationLevelInfo = requestBody.associationLevelInfo;
                    user.accreditationLevelCoachRefId = requestBody.accreditationLevelCoachRefId;
                    user.accreditationCoachExpiryDate = requestBody.accreditationCoachExpiryDate;
                    user.isPrerequestTrainingComplete = requestBody.isPrerequestTrainingComplete;
                    user.isInActive = requestBody.referParentEmail ? 1 : 0;

                    let userDb = await this.userService.createOrUpdate(user);

                    let userFromDb = await this.userService.findById(requestBody.userId);
                    if (userFromDb != undefined) {
                        if (userFromDb.email !== user.email) {
                            await this.updateFirebaseData(userDb, userFromDb.password);
                        }
                    }
                }
                //let userReg = requestBody.userRegistrationSetting;

                let userRegister = new UserRegistration();
                userRegister.id = requestBody.userRegistrationId;
                userRegister.existingMedicalCondition = requestBody.existingMedicalCondition;
                userRegister.regularMedication = requestBody.regularMedication;
                userRegister.heardByRefId = requestBody.heardByRefId;
                userRegister.heardByOther = requestBody.heardByOther;
                userRegister.favouriteTeamRefId = requestBody.favouriteTeamRefId;
                userRegister.favouriteFireBird = requestBody.favouriteFireBird;
                userRegister.isConsentPhotosGiven = requestBody.isConsentPhotosGiven;
                userRegister.isDisability = requestBody.isDisability;
                userRegister.disabilityCareNumber = requestBody.disabilityCareNumber;
                userRegister.disabilityTypeRefId = requestBody.disabilityTypeRefId;
                userRegister.countryRefId = requestBody.countryRefId;
                // userRegister.userRegUniqueKey = uuidv4();
                userRegister.identifyRefId = requestBody.identifyRefId;
                userRegister.injuryInfo = requestBody.injuryInfo;
                userRegister.allergyInfo = requestBody.allergyInfo;
                userRegister.yearsPlayed = requestBody.yearsPlayed;
                userRegister.schoolId = requestBody.schoolId;
                userRegister.schoolGradeInfo = requestBody.schoolGradeInfo;
                userRegister.isParticipatedInSSP = requestBody.isParticipatedInSSP;
                userRegister.otherSportsInfo = (requestBody.otherSportsInfo ? JSON.stringify(requestBody.otherSportsInfo) : null);
                userRegister.walkingNetball = (requestBody.walkingNetball ? JSON.stringify(requestBody.walkingNetball) : null);
                userRegister.walkingNetballInfo = requestBody.walkingNetballInfo;
                userRegister.volunteerInfo = (requestBody.volunteerInfo ? JSON.stringify(requestBody.volunteerInfo) : null);
                await this.userRegistrationService.createOrUpdate(userRegister);

                let userRegistration = await this.userRegistrationService.findByRegistrationKey(requestBody.userRegUniqueKey);
                let teamInviteCount = 0;
                if (userRegistration) {
                    teamInviteCount = await this.transactionService.teamInviteCheck(userRegistration.userRegId);
                }

                return response.status(200).send({ message: "Successfully updated the User Profile", teamInviteCount: teamInviteCount })
            }
        }
        catch (error) {
            logger.error(`Error Occurred in teamRegistrationInviteUpdate` + error);
            return response.status(500).send({ message: process.env.NODE_ENV == AppConstants.development ? AppConstants.errMessage + error : AppConstants.errMessage })
        }
    }

    @Post('/invoice')
    async getInvoice(
        @Body() invoiceBody,
        @Res() response: Response): Promise<any> {
        try {
            let registrationId = invoiceBody.registrationId;
            let userRegId = invoiceBody.userRegId;
            let invoiceId = invoiceBody.invoiceId;
            let teamMemberRegId = invoiceBody.teamMemberRegId;
            let registration = null;
            let regTrackReviewData = null;
            let billToUser = null;
            let invoice = null;
            let noOfMatches = 1;
            if (isNotNullAndUndefined(userRegId)) {
                let userRegistration = await this.userRegistrationService.findByRegistrationKey(userRegId);
                /// console.log("userRegistration" + JSON.stringify(userRegistration));
                registration = await this.registrationService.findById(userRegistration.registrationId);
                regTrackReviewData = await this.registrationTrackService.findByUserRegistrationId(registration.id, 13,
                    userRegistration.userRegId);
                billToUser = userRegistration.userId;
                invoice = await this.invoiceService.getPaymentStatusTeamIndividual(registration.id, userRegistration.userRegId);
            }
            else if (isNotNullAndUndefined(invoiceId) && isNotNullAndUndefined(registrationId)) {
                registration = await this.registrationService.findByRegistrationKey(registrationId);
                regTrackReviewData = await this.registrationTrackService.findByInvoiceId(registration.id, 2, invoiceId);
                invoice = await this.invoiceService.getPaymentStatusByInvoiceId(invoiceId);
                billToUser = invoice[0].createdBy;
                noOfMatches = invoice[0].matches ? invoice[0].matches : 1;
            }
            else if (isNotNullAndUndefined(invoiceId) && !registrationId) {
                invoice = await this.invoiceService.getPaymentStatusByInvoiceId(invoiceId);
                registration = await this.registrationService.findById(invoice[0].registrationId);
                regTrackReviewData = await this.registrationTrackService.findByInvoiceId(registration.id, 2, invoiceId);
                billToUser = invoice[0].createdBy;
                noOfMatches = invoice[0].matches ? invoice[0].matches : 1;
            }
            else if (isNotNullAndUndefined(teamMemberRegId)) {
                registration = await this.registrationService.findByRegistrationKey(registrationId);
                regTrackReviewData = await this.registrationTrackService.findByteamMemberRegId(registration.id, 18, teamMemberRegId);
                invoice = await this.invoiceService.getPaymentStatusByteamMemberRegId(teamMemberRegId);
                billToUser = invoice[0].createdBy;
            }
            else {
                registration = await this.registrationService.findByRegistrationKey(registrationId);
                regTrackReviewData = await this.registrationTrackService.findByRegistrationId(registration.id, 2);
                billToUser = registration.createdBy;
                invoice = await this.invoiceService.findByRegistrationId(registration.id);
            }

            if (registration != undefined) {
                if (isNotNullAndUndefined(regTrackReviewData)) {
                    let billTo = await this.userService.getUserInfo(billToUser);
                    billTo["receiptId"] = invoice ? invoice[0].receiptId : "100000";
                    let jsonData = regTrackReviewData.jsonData;
                    let stateOrgId = null;
                    let organisationLogoUrl = null;
                    for (let item of jsonData.compParticipants) {
                        for (let mem of item.membershipProducts) {
                            if (isNotNullAndUndefined(mem.fees.membershipFee)) {
                                stateOrgId = mem.fees.membershipFee.organisationId;
                                break;
                            }
                        }
                    }

                    for (let item of jsonData.compParticipants) {
                        for (let mem of item.membershipProducts) {
                            if (isNotNullAndUndefined(mem.fees.membershipFee)) {
                                this.updateFeeAmount(mem.fees.membershipFee, noOfMatches);
                            }
                            if (isNotNullAndUndefined(mem.fees.competitionOrganisorFee)) {
                                this.updateFeeAmount(mem.fees.competitionOrganisorFee, noOfMatches);
                            }
                            if (isNotNullAndUndefined(mem.fees.affiliateFee)) {
                                this.updateFeeAmount(mem.fees.affiliateFee, noOfMatches);
                            }
                        }
                    }

                    if (stateOrgId == null) {
                        stateOrgId = jsonData.stateOrgId;
                    }
                    if (stateOrgId != null) {
                        let organisationId = await this.organisationService.findByUniquekey(stateOrgId);
                        let organisationLogo = await this.organisationLogoService.findByOrganisationId(organisationId);
                        if (isNotNullAndUndefined(organisationLogo)) {
                            organisationLogoUrl = organisationLogo.logoUrl;
                        }
                    }
                    jsonData["billTo"] = billTo;
                    jsonData["organisationLogo"] = organisationLogoUrl;
                    let isSchoolRegistrationApplied = 0;

                    if (jsonData.shopProducts && jsonData.shopProducts.length) {
                        for (let item of jsonData.shopProducts) {
                            let organisation = await this.organisationService.findOrganisationByUniqueKey(item.organisationId);
                            item["organisationName"] = organisation[0].name;
                        }
                    }

                    jsonData.compParticipants.map((item) => {
                        if (item.selectedOptions.isSchoolRegCodeApplied == 1) {
                            isSchoolRegistrationApplied = 1;
                        }
                        delete item.selectedOptions;
                        delete item.paymentOptions;
                        delete item.instalmentDates;
                        item.membershipProducts.map((mem) => {
                            delete mem.discounts;
                            delete mem.selectedDiscounts;
                        })
                    });
                    delete jsonData.deletedProducts;
                    delete jsonData.securePaymentOptions;

                    jsonData["isSchoolRegistrationApplied"] = isSchoolRegistrationApplied;

                    return response.status(200).send(jsonData);
                }
                else {
                    return response.status(212).send({ message: "No data" });
                }
            }
            else {
                return response.status(212).send({ message: "RegistrationKey is not valid" });
            }
        } catch (err) {
            logger.error(`Error Occurred in getInvoice` + err);
            return response.status(500).send({ err, message: process.env.NODE_ENV == AppConstants.development ? AppConstants.errMessage + err : AppConstants.errMessage })
        }
    }

    private updateFeeAmount(obj, noOfMatches) {
        obj.feesToPay = feeIsNull(obj.feesToPay) * noOfMatches;
        obj.feesToPayGST = feeIsNull(obj.feesToPayGST) * noOfMatches;
        obj.discountsToDeduct = feeIsNull(obj.discountsToDeduct) * noOfMatches;
        obj.nominationFeeToPay = feeIsNull(obj.nominationFeeToPay) * noOfMatches;
        obj.nominationGSTToPay = feeIsNull(obj.nominationGSTToPay) * noOfMatches;
        obj.childDiscountsToDeduct = feeIsNull(obj.childDiscountsToDeduct) * noOfMatches;
        obj.governmentVoucherAmount = feeIsNull(obj.governmentVoucherAmount) * noOfMatches;
    }

    @Authorized()
    @Get('/teamregistration/invite')
    async teamRegistrationInvite(
        @QueryParam('userRegUniqueKey') userRegUniqueKey: string,
        @QueryParam('userId') userId: number,
        @HeaderParam("authorization") currentUser: User,
        @Res() response: Response
    ) {
        try {
            if (currentUser.id) {
                let userRegistrationId = await this.userRegistrationService.findByRegistrationKey(userRegUniqueKey);
                if(userRegistrationId.userRegId){
                    let isPlayer = await this.player1Service.findByUserRegistrationIdAndStatus(userRegistrationId.userRegId);
                    let isNonPlayer = await this.nonPlayerService.findByUserRegistrationIdAndStatus(userRegistrationId.userRegId);
                    if(isPlayer || isNonPlayer){
                       return response.status(212).send({
                           error : 0,
                           message : AppConstants.teamDeregistrationInProgress
                       });
                    }
                }
                let res = await this.userRegistrationService.teamRegistrationInvite(userRegUniqueKey, userId);
                return response.status(200).send(res);
            }
        }
        catch (error) {
            logger.error(`Error Occurred in teamRegistrationInvite` + error);
            return response.status(500).send({ message: process.env.NODE_ENV == AppConstants.development ? AppConstants.errMessage + error : AppConstants.errMessage })
        }
    }

    @Authorized()
    @Get('/registration/termsandconditions')
    async getOrganisationTermsAndConditions(
        @QueryParam('registrationId') registrationId: string,
        @QueryParam('userRegistrationId') userRegistrationId: string,
        @HeaderParam("authorization") currentUser: User,
        @Res() response: Response
    ) {
        try {
            if (currentUser.id) {
                let res = null;
                if (userRegistrationId) {
                    let userRegDetails = await this.userRegistrationService.findByRegistrationKey(userRegistrationId);;
                    res = await this.affiliateService.getTermAndConditionOrganisationForInvite(userRegDetails.userRegId);
                    return response.status(200).send(res);
                }
                else {
                    let registration = await this.registrationService.findByRegistrationKey(registrationId);
                    res = await this.affiliateService.getTermAndConditionOrganisation(registration.id);
                    return response.status(200).send(res);
                }
            }

        }
        catch (error) {
            logger.error(`Error Occurred in getOrganisationTermsAndConditions` + error);
            return response.status(500).send({ message: process.env.NODE_ENV == AppConstants.development ? AppConstants.errMessage + error : AppConstants.errMessage })
        }
    }

    @Authorized()
    @Post('/registration/productfees')
    async getRegistrationProductFees(
        @HeaderParam("authorization") currentUser: User,
        @Body() requestBody: any,
        @Res() response: Response) {
        try {
            if (currentUser) {
                if (requestBody != null) {
                    let competitionId = await this.competitionRegService.findByUniquekey(requestBody.competitionId);
                    let organisationId = await this.organisationService.findByUniquekey(requestBody.organisationId);
                    let res = await this.registrationService.registrationProductFees(competitionId, organisationId,
                        requestBody.competitionMembershipProductTypes);
                    return response.status(200).send(res);
                }
                else {
                    return response.status(212).send({
                        errorCode: 4,
                        message: 'Empty Body'
                    });
                }

            }
            else {
                return response.status(212).send({
                    errorCode: 3,
                    message: 'UserId is Mandatory'
                })
            }
        }
        catch (error) {
            logger.error(`Error Occurred in getRegistrationProductFees ` + error);
            return response.status(500).send({
                message: process.env.NODE_ENV == AppConstants.development ? AppConstants.errMessage + error : AppConstants.errMessage
            });
        }
    }

    @Authorized()
    @Post('/registration/team/validate')
    async validateTeamExists(
        @HeaderParam("authorization") currentUser: User,
        @Body() requestBody,
        @Res() response: Response
    ) {
        try {
            if (currentUser.id) {
                let validateOrg = validateReqFilter(requestBody.organisationId, 'organisation');
                if (validateOrg != null) {
                    return response.status(212).send(validateOrg);
                }
                let validateCompetition = validateReqFilter(requestBody.competitionId, 'competitionUniqueKey');
                if (validateCompetition != null) {
                    return response.status(212).send(validateCompetition);
                }
                if (!isStringNullOrEmpty(requestBody.teamName)) {
                    return response.status(212).send("Team Name cannot be null");
                }
                let organisationId = await this.organisationService.findByUniquekey(requestBody.organisationId);
                let competitionId = await this.competitionRegService.findByUniquekey(requestBody.competitionId);
                let compDivisionDb = await this.competitionDivisionService.findBycmpd(requestBody.competitionMembershipProductDivisionId)

                let res = await this.teamService.checkTeamAlreadyExists(organisationId, competitionId, requestBody, compDivisionDb)

                return response.status(200).send(res);
            }
        }
        catch (error) {
            logger.error(`Error Occurred in validateTeamExists` + error);
            return response.status(500).send({ message: process.env.NODE_ENV == AppConstants.development ? AppConstants.errMessage + error : AppConstants.errMessage })
        }
    }

    @Authorized()
    @Post('/teamregistration/dashboard')
    async teamRegistrationDashboard(
      @HeaderParam("authorization") currentUser: User,
      @Body() requestBody: any,
      @QueryParam('sortBy') sortBy: string = undefined,
      @QueryParam('sortOrder') sortOrder: 'ASC' | 'DESC' = undefined,
      @Res() response: Response
    ) {
        try {
            if (currentUser) {
                if (requestBody != null) {
                    let validateComp = validateReqFilter(requestBody.competitionUniqueKey, 'competitionUniqueKey');
                    if (validateComp != null) {
                        return response.status(212).send(validateComp);
                    }
                    let validateOrg = validateReqFilter(requestBody.organisationUniqueKey, 'organisationUniqueKey');
                    if (validateOrg != null) {
                        return response.status(212).send(validateOrg);
                    }
                    let res = await this.registrationService.teamRegistrationDashboard(requestBody, requestBody.organisationUniqueKey, sortBy, sortOrder);
                    return response.status(200).send(res);
                } else {
                    return response.status(212).send({
                        errorCode: 4,
                        message: 'Empty Body'
                    });
                }
            } else {
                return response.status(212).send({
                    errorCode: 3,
                    message: 'UserId is Mandatory'
                })
            }
        } catch (error) {
            logger.error(`Error Occurred in team registration dashboard ` + error);
            return response.status(500).send({
                message: process.env.NODE_ENV == AppConstants.development ? AppConstants.errMessage + error : AppConstants.errMessage
            });
        }
    }

    @Authorized()
    @Post('/teamregistration/export')
    async exportTeamRegistrationDashboard(
        @HeaderParam("authorization") currentUser: User,
        @Body() requestBody: any,
        @Res() response: Response
    ) {
        try {
            if (currentUser) {
                if (requestBody != null) {
                    let validateComp = validateReqFilter(requestBody.competitionUniqueKey, 'competitionUniqueKey');
                    if (validateComp != null) {
                        return response.status(212).send(validateComp);
                    }

                    let validateOrg = validateReqFilter(requestBody.organisationUniqueKey, 'organisationUniqueKey');
                    if (validateOrg != null) {
                        return response.status(212).send(validateOrg);
                    }

                    if (requestBody != null) {
                        let res = await this.registrationService.exportTeamRegistrationDashboard(requestBody);

                        response.setHeader('Content-disposition', 'attachment; filename=teamRegistrations.csv');
                        response.setHeader('content-type', 'text/csv');
                        fastcsv
                            .write(res, { headers: true })
                            .on("finish", function () {
                            })
                            .pipe(response);
                    }
                } else {
                    return response.status(212).send({
                        errorCode: 4,
                        message: 'Empty Body'
                    });
                }
            } else {
                return response.status(212).send({
                    errorCode: 3,
                    message: 'UserId is Mandatory'
                })
            }
        } catch (error) {
            logger.error(`Error Occurred in team registration export ` + error);
            return response.status(500).send({
                message: process.env.NODE_ENV == AppConstants.development ? AppConstants.errMessage + error : AppConstants.errMessage
            });
        }
    }

    @Authorized()
    @Post('/registration/singlegame')
    async singleGamePaymentData(
        @HeaderParam("authorization") currentUser: User,
        @Body() requestBody,
        @Res() response: Response
    ) {
        try {
            if (currentUser.id) {
                let registration = await this.registrationService.findByRegistrationKey(requestBody.registrationId);
                let registrationId = registration.id;
                let registrationTrackData = await this.registrationTrackService.findByRegistrationId(registration.id, 2);
                // Create new Registration
                let competitionId = await this.competitionRegService.findByUniquekey(requestBody.competitionId);
                let organisationId = await this.organisationService.findByUniquekey(requestBody.organisationId);
                requestBody["compId"] = competitionId;
                requestBody["orgId"] = organisationId;

                let user = await this.userService.findByEmail(requestBody.email);

                let result = await this.orgRegistrationParticipantService.getSingleGameDetails(registrationTrackData, requestBody, user);
                return response.status(200).send(result);
            }
        }
        catch (error) {
            logger.error(`Exception occurred in singleGamePaymentData ${error}`);
            return response.status(500).send({ message: process.env.NODE_ENV == AppConstants.development ? AppConstants.errMessage + error : AppConstants.errMessage })
        }
    }

    @Authorized()
    @Post('/registrationcap/validate')
    async registrationCapValidate(
        @HeaderParam("authorization") currentUser: User,
        @Body() requestBody,
        @Res() response: Response
    ) {
        try {
            if (currentUser.id) {
                //let isExceed = 0;
                let regCapMap = new Map();
                //let userRegMap = new Map();
                if (requestBody.products && requestBody.products.length) {
                    for (let prod of requestBody.products) {
                        //console.log("111111" + JSON.stringify(prod));
                        let orgId = await this.organisationService.findByUniquekey(prod.organisationId);
                        let compId = await this.competitionRegService.findByUniquekey(prod.competitionId);
                        let cmptId = prod.competitionMembershipProductTypeId;
                        let divisionId = prod.divisionId ? prod.divisionId : 0;
                        let regCapCount = await this.registrationService.getRegistrationCap(compId, orgId, cmptId, divisionId);
                        //console.log(`@@@@@@@${JSON.stringify(regCapCount)}`);
                        if (requestBody.isTeamRegistration) {
                            regCapCount = regCapCount.teamRegistrationCap;
                        }
                        else {
                            regCapCount = regCapCount.registrationCap;
                        }
                        if(regCapCount == null)
                        {
                            continue;
                        }
                        //console.log("$$$$$$"+regCapCount);
                        let key = divisionId ? orgId + "#" + compId + "#" + cmptId + "#" + divisionId : orgId + "#" + compId + "#" + cmptId;
                        let regCapTemp = regCapMap.get(key);

                        //console.log("!!!!!!!!!!!!!" + key);
                        if (regCapTemp == undefined) {
                            let countObj = {
                                currentCount: 1,
                                draftCount: 0,
                                existingCount: 0
                            }
                            if (requestBody.registrationId) {
                                let regId = await this.registrationService.findByRegistrationKey(requestBody.registrationId);
                                let registrationData = await this.userRegistrationDraftService.findByRegistrationId(regId.id);
                                let participantData = [];
                                //console.log("%%%%%%%%%%%%%%%%%%%%%%%%");
                                for (let data of registrationData) {
                                    if (isNotNullAndUndefined(data.participantData)) {

                                        if (requestBody.participantId) {
                                            //console.log("&&&&&&&&&&&&&&&&&&&&&&&&&&&&")
                                            if (requestBody.participantId != data.userRegUniqueKey) {
                                                participantData.push(data.participantData);
                                            }
                                        }
                                        else {
                                            //console.log("$$$$$$$$$$$$$$$$$$$$$$$$")
                                            participantData.push(data.participantData);
                                        }
                                    }
                                }

                                for (let item of participantData) {
                                    if (requestBody.isTeamRegistration == 1) {
                                        let orgId2 = await this.organisationService.findByUniquekey(item.organisationId);
                                        let compId2 = await this.competitionRegService.findByUniquekey(item.competitionId);
                                        let cmptId2 = item.competitionMembershipProductTypeId;
                                        let divisionId2 = item.competitionMembershipProductDivisionId;
                                        let key2 = orgId2 + "#" + compId2 + "#" + cmptId2 + "#" + divisionId2;
                                        if (key == key2) {
                                            countObj.draftCount++;
                                            console.log(countObj.draftCount);
                                            if (countObj.currentCount + countObj.draftCount > regCapCount) {
                                                return response.status(212).send({ message: AppConstants.exceedMessage, errorCode: 400 });
                                            }
                                        }
                                    }
                                    else {
                                        for (let comp of item.competitions) {
                                            let orgId2 = await this.organisationService.findByUniquekey(comp.organisationId);
                                            let compId2 = await this.competitionRegService.findByUniquekey(comp.competitionId);
                                            let cmptId2 = 0;
                                            let divisionId2 = 0;
                                            let key2;
                                            if (divisionId) {
                                                //console.log("With Division");
                                                for (let d of comp.divisions) {
                                                    cmptId2 = d.competitionMembershipProductTypeId;
                                                    divisionId2 = d.competitionMembershipProductDivisionId;
                                                    key2 = orgId2 + "#" + compId2 + "#" + cmptId2 + "#" + divisionId2;
                                                    if (key == key2) {
                                                        countObj.draftCount++;
                                                        // console.log("draftCount" + countObj.draftCount);
                                                        // console.log("currentCount" + countObj.currentCount);
                                                        // console.log("regCapCount" + regCapCount);
                                                        if (countObj.currentCount + countObj.draftCount > regCapCount) {
                                                            return response.status(212).send({ message: AppConstants.exceedMessage, errorCode: 400 });
                                                        }
                                                    }
                                                }
                                            }
                                            else {
                                                //console.log("No Division");
                                                for (let p of comp.products) {
                                                    cmptId2 = p.competitionMembershipProductTypeId;
                                                    key2 = orgId2 + "#" + compId2 + "#" + cmptId2;
                                                }
                                                if (key == key2) {
                                                    countObj.draftCount++;
                                                    // console.log("draftCount" + countObj.draftCount);
                                                    // console.log("currentCount" + countObj.currentCount);
                                                    // console.log("regCapCount" + regCapCount);
                                                    if (countObj.currentCount + countObj.draftCount > regCapCount) {
                                                        return response.status(212).send({ message: AppConstants.exceedMessage, errorCode: 400 });
                                                    }
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                            countObj.existingCount = await this.getRegistrationCapValidate(compId, orgId, cmptId, divisionId, requestBody);
                            //console.log("First countObj.existingCount" + countObj.existingCount + "####" + countObj.draftCount + "###" + countObj.currentCount) ;
                            regCapMap.set(key, countObj);

                            if (regCapCount && (countObj.currentCount + countObj.draftCount + countObj.existingCount > regCapCount)) {
                                return response.status(212).send({ message: AppConstants.exceedMessage, errorCode: 400 });
                            }
                        }
                        else {
                            //console.log("^^^^^^^^^^^^^^^^^^^^^^^^^^^^^");
                            regCapTemp.currentCount++;
                            regCapTemp.existingCount = await this.getRegistrationCapValidate(compId, orgId, cmptId, divisionId, requestBody);
                            // console.log("Second countObj.existingCount" + countObj.existingCount + "####" + countObj.draftCount + "###" + countObj.currentCount) ;
                            if (regCapCount && (regCapTemp.currentCount + regCapTemp.draftCount + regCapTemp.existingCount > regCapCount)) {
                                return response.status(212).send({ message: AppConstants.exceedMessage, errorCode: 400 });
                            }
                        }
                    }
                    return response.status(200).send({ message: 'Success' });
                }

                else {
                    if (requestBody.registrationId) {
                        let regId = await this.registrationService.findByRegistrationKey(requestBody.registrationId);
                        let regJsonData = await this.registrationService.registrationTrackJsonData(regId.id, 2);

                        if (regJsonData && regJsonData.length) {

                            for (let reg of regJsonData) {
                                //console.log("#####" + JSON.stringify(reg.jsonData.compParticipants));
                                for (let comp of reg.jsonData.compParticipants) {


                                    let orgId = await this.organisationService.findByUniquekey(comp.organisationUniqueKey);
                                    let compId = await this.competitionRegService.findByUniquekey(comp.competitionUniqueKey);
                                    let count = 0;
                                    //console.log("#####" + compId + "!!!!!" + orgId);
                                    for (let mem of comp.membershipProducts) {
                                        let cmptId = mem.competitionMembershipProductTypeId;
                                        let divisionId = mem.divisionId ? mem.divisionId : 0;
                                        let regCapCount = await this.registrationService.getRegistrationCap(compId, orgId, cmptId, divisionId);
                                        //console.log("@@@@@@@@@@@" + JSON.stringify(regCapCount));

                                        if (comp.isTeamRegistration == 1 && mem.isPlayer == 1) {
                                            regCapCount = regCapCount.teamRegistrationCap;
                                            count++;
                                        }
                                        else {
                                            regCapCount = regCapCount.registrationCap;
                                        }

                                        if (regCapCount == null || (comp.isTeamRegistration == 1 && count > 1)) {
                                            continue;
                                        }
                                        //console.log("regCapCount" + regCapCount);
                                        let key = divisionId ? orgId + "#" + compId + "#" + cmptId + "#" + divisionId : orgId + "#" + compId + "#" + cmptId;
                                        let regCapTemp = regCapMap.get(key);
                                        //console.log("regCapTemp" + JSON.stringify(regCapTemp))

                                        if (regCapTemp == undefined) {
                                            let countObj = {
                                                currentCount: 1,
                                                draftCount: 0,
                                                existingCount: 0
                                            }
                                            // if(requestBody.registrationId) {
                                            //     let registrationData = await this.userRegistrationDraftService.findByRegistrationId(regId.id);
                                            //     let participantData = [];
                                            //     for(let data of registrationData) {
                                            //         if(isNotNullAndUndefined(data.participantData)) {
                                            //             participantData.push(data.participantData);
                                            //         }
                                            //     }
                                            //     console.log("participantData" + JSON.stringify(participantData));
                                            //     for(let item of participantData) {
                                            //         for(let comp of item.competitions) {
                                            //             let orgId2 = await this.organisationService.findByUniquekey(comp.organisationId);
                                            //             let compId2 = await this.competitionRegService.findByUniquekey(comp.competitionId);
                                            //             let cmptId2 = 0;
                                            //             let divisionId2 = 0;
                                            //             let key2;
                                            //             if(divisionId) {
                                            //                 cmptId2 = comp.divisions.find(x => x).competitionMembershipProductTypeId;
                                            //                 divisionId2 = comp.divisions.find(x => x).competitionMembershipProductDivisionId;
                                            //                 key2 = orgId2+"#"+compId2+"#"+cmptId2+"#"+divisionId2;
                                            //             }
                                            //             else {
                                            //                 cmptId2 = comp.products.find(x => x.competitionMembershipProductTypeId);
                                            //                 key2 = orgId2+"#"+compId2+"#"+cmptId2;
                                            //             }
                                            //             if(key == key2) {
                                            //                 countObj.draftCount++;
                                            //                 if(countObj.currentCount + countObj.draftCount > regCapCount) {
                                            //                     return response.status(212).send({message: AppConstants.exceedMessage, errorCode: 400});
                                            //                 }
                                            //             }
                                            //         }
                                            //     }
                                            // }
                                            countObj.existingCount = await this.getRegistrationCapValidate(compId, orgId, cmptId, divisionId, comp);
                                            //console.log("%%%%First countObj.existingCount" + countObj.existingCount + "###$" + countObj.currentCount + "##^" + regCapCount) ;
                                            if (regCapCount && (countObj.currentCount + countObj.existingCount > regCapCount)) {
                                                return response.status(212).send({ message: AppConstants.exceedMessage, errorCode: 400 });
                                            }

                                            regCapMap.set(key, countObj);
                                        }
                                        else {
                                            regCapTemp.currentCount++;
                                            regCapTemp.existingCount = await this.getRegistrationCapValidate(compId, orgId, cmptId, divisionId, comp);
                                            //console.log("countObj.existingCount" + regCapTemp.existingCount + "###" + regCapTemp.currentCount + "##" + regCapCount) ;
                                            if (regCapCount && (regCapTemp.currentCount + regCapTemp.existingCount > regCapCount)) {
                                                return response.status(212).send({ message: AppConstants.exceedMessage, errorCode: 400 });
                                            }
                                        }
                                    }
                                }
                            }
                            return response.status(200).send({ message: 'success' });
                        }
                    }
                }
            }

            return response.status(200).send({ message: 'success' });
        }
        catch (error) {
            logger.error(`Exception occurred in registrationCapValidate ${error}`);
            return response.status(500).send({ message: process.env.NODE_ENV == AppConstants.development ? AppConstants.errMessage + error : AppConstants.errMessage })
        }
    }

    @Authorized()
    @Post('/registration/teamparticipant')
    async saveTeamParticipant(
        @HeaderParam("authorization") currentUser: User,
        //@UploadedFiles("participantPhoto", { options: fileUploadOptions }) files: Express.Multer.File[],
        @Body() requestBody,
        @Res() response: Response) {
        try {
            if (requestBody != null) {
                //let requestBody = JSON.parse(requestSource.participantDetail);
                let userId = 0;
                // Validation
                let errorMsg = await this.validateCompetitionRestriction(requestBody,1);
                if (errorMsg && errorMsg.length) {
                    return response.status(200).send({
                        id: null, message: "Single Competition Error",
                        errorCode: 1,
                        errorMsg: errorMsg
                    });
                }
                // check #@#@
                // let errorArray = await this.validateUserDetailsOrUpdateEmail(requestBody, 1)
                // if (errorArray && errorArray.length) {
                //     let msg = await this.replaceErrorMsg(errorArray)
                //     return response.status(200).send({
                //         id: null, message: "User Details Invalid",
                //         errorCode: 2,
                //         errorMsg: msg
                //     });
                // }
                // return 1;
                let picURL = [];

                // let registrationRes = null;
                //let userRegDraftRes = null;
                userId = requestBody.registeringPersonUserId;


                //Registration
                // let registration = new Registration();
                let userRegData = [];
                let registration = await this.registrationService.findByRegistrationKey(requestBody.registrationId);
                userRegData = await this.userRegistrationDraftService.findByRegistrationId(registration.id);

                // Delete existing data
                if (!isNullOrEmpty(requestBody.teamMemberRegId)) {
                    let userRegDraftRes = await this.userRegistrationDraftService.findByTeamMemberRegId(requestBody.teamMemberRegId);
                    await this.userRegistrationDraftService.deleteUserRegDraftByTeamMemRegId(userId, requestBody.teamMemberRegId)
                }
                else {
                    requestBody.teamMemberRegId = uuidv4();
                }
                if (requestBody.registeringYourself == RegisteringYourself.TEAM) /// Team Registration Handling
                {
                    let competitionId = await this.competitionRegService.findByUniquekey(requestBody.competitionId);
                    let organisationId = await this.organisationService.findByUniquekey(requestBody.organisationId);
                    let orgRegistrationId = await this.orgRegistrationService.findOrgRegId(competitionId, organisationId);

                    let userRegList = await this.userRegistrationDraftService.findByRegistrationId(registration.id);
                    let registererUserRegDraftData = userRegList.find(x => x.personRoleRefId != null && x.teamName == requestBody.teamName);
                    let parentUserRegKey = registererUserRegDraftData.userRegUniqueKey
                    let orgParticipantIdList = [];
                    //named players

                    if (requestBody.teamMembers && requestBody.teamMembers.length) {
                        let playersList = requestBody.teamMembers;
                        if (playersList && playersList.length) {
                            for (let p of playersList) {
                                let data = JSON.parse(JSON.stringify(requestBody));
                                data.teamMembers = requestBody.teamMembers.filter(x => x.firstName == p.firstName && x.email == p.email);
                                let participantUserDB = await this.userService.findUserByUniqueFields(
                                    p.email.toLowerCase(), p.firstName, p.lastName,
                                    p.mobileNumber
                                )
                                let userRegister = new UserRegistrationDraft();
                                userRegister.id = 0;
                                userRegister.registrationId = registration.id;
                                userRegister.userId = isNotNullAndUndefined(participantUserDB) ? participantUserDB.id : 0;
                                userRegister.firstName = p.firstName;
                                userRegister.lastName = p.lastName;
                                userRegister.mobileNumber = p.mobileNumber;
                                userRegister.email = p.email;
                                userRegister.dateOfBirth = p.dateOfBirth;
                                userRegister.teamName = requestBody.teamName;
                                userRegister.competitionMembershipProductTypeId = requestBody.divisions[0].competitionMembershipProductTypeId;
                                userRegister.userRegUniqueKey = uuidv4();
                                userRegister.createdBy = userId;
                                userRegister.payingFor = p.payingFor;
                                userRegister.participantData = JSON.stringify(data);
                                //userRegister.isPlayer = playerType ? playerType.isPlayer : null;
                                userRegister.parentId = parentUserRegKey;
                                userRegister.teamMemberRegId = requestBody.teamMemberRegId
                                let userRegistrationRes = await this.userRegistrationDraftService.createOrUpdate(userRegister);
                                let selectedProducts = p.membershipProductTypes.filter(x => x.isChecked == true);
                                if (selectedProducts && selectedProducts.length) {
                                    for (let prod of selectedProducts) {
                                        let orpt = new OrgRegistrationParticipantDraft();
                                        orpt.id = 0;
                                        orpt.orgRegistrationId = orgRegistrationId;
                                        orpt.registrationId = registration.id;
                                        orpt.userRegistrationId = userRegistrationRes.id;
                                        orpt.teamRegistrationTypeRefId = 1;
                                        orpt.parentId = parentUserRegKey;
                                        orpt.competitionMembershipProductDivisionId = requestBody.divisions[0].competitionMembershipProductDivisionId;
                                        orpt.competitionMembershipProductTypeId = prod.competitionMembershipProductTypeId;
                                        orpt.membershipProductTypeName = prod.productTypeName;
                                        orpt.createdBy = userId;
                                        orpt.isPlayer = prod.isPlayer;
                                        let orgRegPartRes = await this.orgRegistrationParticipantDraftService.createOrUpdate(orpt);
                                        orgParticipantIdList.push(orgRegPartRes.id);
                                    }
                                }
                            }
                        }
                    }
                }


                return response.status(200).send({
                    id: requestBody.teamMemberRegId, message: "Successfully Registered",
                    errorMsg: null
                });

            } else {
                return response.status(204).send({
                    errorCode: 3,
                    message: 'Empty Body'
                });
            }
        }
        catch (error) {
            logger.error(`Exception occurred in saveTeamParticipant requestSource: ${requestBody} for user: ${currentUser.id}` + error);
            return response.status(500).send({
                message: process.env.NODE_ENV == AppConstants.development ? AppConstants.errMessage + error : AppConstants.errMessage
            });
        }
    }

    @Authorized()
    @Post('/registration/teamparticipant/removeoradd')
    async removeTeamParticipant(
        @HeaderParam("authorization") currentUser: User,
        @QueryParam("userRegUniqueKey") userRegUniqueKey: string,
        @QueryParam("processType") processType: string,
        @Body() requestBody,
        @Res() response: Response) {
        try {
            if (userRegUniqueKey) {
                let userRegParticipant = await this.userRegistrationService.getByUserRegUniqueKey(userRegUniqueKey);
                let userReg = new UserRegistration();

                userReg.id = userRegParticipant.id;
                if (processType == 'activate') {
                    userReg.isActive = 1;
                }
                if (processType == 'deactivate') {
                    userReg.isActive = 0;
                }
                let userRegDB = await this.userRegistrationService.createOrUpdate(userReg);

                if(processType == 'deactivate' && userRegDB.isActive == 0) {
                    this.mailForRemoveTeamMember(userRegDB.id, currentUser.id);
                }

                return response.status(200).send({
                    id: userRegUniqueKey,
                    message: "Successfully updated",
                    errorMsg: null,
                    processType
                });
            }
        }
        catch (error) {
            logger.error(`Exception occurred in removeTeamParticipant ${currentUser.id}` + error);
            return response.status(500).send({
                message: process.env.NODE_ENV == AppConstants.development ? AppConstants.errMessage + error : AppConstants.errMessage
            });
        }
    }

    // @Authorized()
    // @Get('/registration/mailForRemoveTeamMember')
    // async removeTeamParticipantMail(
    //     @HeaderParam("authorization") currentUser: User,
    //     @QueryParam("userRegId") userRegId: number,
    //     @Res() response: Response) {
    //     try {
    //         await this.mailForRemoveTeamMember(userRegId, currentUser.id);
    //         return "success";
    //     }
    //     catch(error) {
    //         throw error;
    //     }
    //     }

    private async mailForRemoveTeamMember(userRegId: number, userId: number) {
        try{
            let mailObj = await this.communicationTemplateService.findById(29);
            let removeUserObj = await this.registrationService.findRemoveMailUserObj(userRegId);
            let logInUser = await this.userService.findById(userId);
            console.log(`88888888${JSON.stringify(logInUser)}`);
            console.log("*************"+JSON.stringify(removeUserObj));
            console.log("+++++++++"+JSON.stringify(removeUserObj[0]));
            await this.userService.sendRemoveMail(removeUserObj[0], mailObj, logInUser);
        }
        catch(error) {
            throw error;
        }
    }

    @Authorized()
    @Get('/registration/teamparticipantdata')
    async getTeamParticipantData(
        @QueryParam('teamMemberRegId') teamMemberRegId: string,
        @HeaderParam("authorization") currentUser: User,
        @Res() response: Response) {
        try {
            if (teamMemberRegId) {
                let userRegData = await this.userRegistrationDraftService.findByteamMemberRegId(teamMemberRegId);
                let data = JSON.parse(JSON.stringify(userRegData));
                if (data) {
                    if (data && data.length) {
                        let userRegObj = data[0].participantData;
                        let teamMember = [];
                        for (let d of data) {
                            teamMember.push(...d.participantData.teamMembers);
                        }
                        userRegObj.teamMembers = teamMember;
                        return response.status(200).send(userRegObj);
                    }
                }
            }
            else {
                return response.status(212).send({ message: "teamMemberRegId is not valid" });
            }
        }
        catch (error) {
            logger.error(`Exception occurred in getTeamParticipant ${currentUser.id}` + error);
            return response.status(500).send({
                message: process.env.NODE_ENV == AppConstants.development ? AppConstants.errMessage + error : AppConstants.errMessage
            });
        }
    }

    @Authorized()
    @Get('/registration/teamparticipant/review')
    async registrationTeamParticipantReview(
        @QueryParam('registrationId') registrationId: string,
        @QueryParam('teamMemberRegId') teamMemberRegId: string,
        @HeaderParam("authorization") currentUser: User,
        @Res() response: Response) {
        try {
            let registration = await this.registrationService.findByRegistrationKey(registrationId);
            if (registration && teamMemberRegId) {
                let regTrackReviewData = await this.registrationTrackService.findByteamMemberRegId(registration.id, 18, teamMemberRegId);

                let result = await this.orgRegistrationParticipantDraftService.getRegistrationReview(registration.id, teamMemberRegId, regTrackReviewData);

                return response.status(200).send(result);
            }
            else {
                return response.status(212).send({ message: "Please provide the required information" });
            }
        }
        catch (error) {
            logger.error(`Exception occurred in registration review  ${currentUser.id}` + error);
            return response.status(500).send({
                message: process.env.NODE_ENV == AppConstants.development ? AppConstants.errMessage + error : AppConstants.errMessage
            });
        }
    }

    private invalidShopProductsData(shopProducts: any[]) {
        if (shopProducts && shopProducts.length) {
            //TODO: need to add a validation that will compare these fields with records in the database
            let hasError = false;
            for (let item of shopProducts) {
                if (item.quantity < 0 || item.amount < 0 || item.tax < 0 || item.totalAmt < 0) {
                    hasError = true;
                }
            }
            return hasError;
        }
    }

    private async getRegistrationCapValidate(compId: number, orgId: number, cmptId: number, divisionId: number, requestBody: any) {
        try {
            if (requestBody.isTeamRegistration) {
                let teamResult = await this.registrationService.getRegistrationTeamCount(compId, orgId, cmptId, divisionId);
                return parseInt(teamResult.teamCount);
            }
            else {
                let compMembership = await this.competitionMembershipProductTypeService.findById(cmptId);
                const membershipMappingId = compMembership ? compMembership.membershipProductTypeMappingId : 0;
                if (divisionId) {
                    let playerResult = await this.registrationService.getRegistrationPlayerCount(compId, orgId, cmptId, divisionId);
                    let playersCount = parseInt(playerResult.playerCount)

                    return playersCount;
                }
                else {
                    let nonPlayerResult = await this.registrationService.getRegistrationNonPlayerCount(compId, orgId, cmptId);
                    let nonPlayersCount = parseInt(nonPlayerResult.playerCount)

                    return nonPlayersCount;
                }
            }
        }
        catch (error) {
            throw error;
        }
    }

    private getOrgRegistrationPartObj(orgRegistrationId, registrationId, userRegId, memProdId, divisionId, userId, comp) {
        let orpt = new OrgRegistrationParticipantDraft();
        orpt.id = 0;
        orpt.orgRegistrationId = orgRegistrationId;
        orpt.registrationId = registrationId;
        orpt.userRegistrationId = userRegId;
        orpt.competitionMembershipProductTypeId = memProdId;
        orpt.competitionMembershipProductDivisionId = divisionId;
        orpt.tShirtSizeRefId = comp.tShirtSizeRefId ? comp.tShirtSizeRefId : null;
        orpt.createdBy = userId;

        return orpt;
    }

    private async validateCompetitionRestriction(requestBody, postRegistration) {
        try {

            let errorArr = [];
            let compMap = new Map();
            let competitions = [];
            let parentOrGuardianMap = new Map();
            if (isNotNullAndUndefined(requestBody)) {
                // for (let item of requestBody.userRegistrations) {
                let item = requestBody;
                if (item.registeringYourself == RegisteringYourself.TEAM) {
                    if (item.divisions && item.divisions.length)
                        item.divisions = item.divisions.filter(x => x.competitionMembershipProductDivisionId == item.competitionMembershipProductDivisionId)
                    else {
                        let div = item.divisions;
                        item.divisions = [];
                        item.divisions.push(div);
                    }
                    console.log("******* item.divisions" + JSON.stringify(item.divisions));

                    if (postRegistration == 0) {
                        if (item.email) {
                            let participantObj = await this.getParticipantObj(item, parentOrGuardianMap);

                            if (item.divisions && item.divisions.length) {
                                for (let div of item.divisions) {
                                    let key = this.getKey(item, div);
                                    let participantTemp = compMap.get(key);
                                    if (participantTemp == undefined) {
                                        this.setParticipantValue(compMap, participantObj, item, div, competitions, key);
                                    }
                                    else {
                                        participantTemp.participants.push(participantObj);
                                    }
                                }
                            }
                        }
                    }


                    if (item.teamMembers && item.teamMembers.length) {
                        for (let tm of item.teamMembers) {
                            let participantObj = await this.getParticipantObj(tm, parentOrGuardianMap);
                            if (item.divisions && item.divisions.length)
                                for (let div of item.divisions) {
                                    let key = this.getKey(item, div);
                                    let participantTemp = compMap.get(key);
                                    if (participantTemp == undefined) {
                                        this.setParticipantValue(compMap, participantObj, item, div, competitions, key);
                                    }
                                    else {
                                        participantTemp.participants.push(participantObj);
                                    }
                                }
                        }
                    }

                }
                else {
                    let participantObj = await this.getParticipantObj(item, parentOrGuardianMap);

                    if (item.competitions && item.competitions.length) {
                        for (let comp of item.competitions) {
                            //let isValid = this.checkIsPlayer(comp, comp.products);
                            // if (isValid == 1) {
                            //     let key = this.getKey(item);
                            //     let participantTemp = compMap.get(key);
                            //     if (participantTemp == undefined) {
                            //         this.setParticipantValue(compMap, participantObj, item, competitions, key);
                            //     }
                            //     else {
                            //         participantTemp.participants.push(participantObj);
                            //     }
                            // }
                            if (comp.divisions && comp.divisions.length)
                                for (let div of comp.divisions) {
                                    // for (let prod of item.products) {
                                    //   let isValid = this.checkIsPlayer(prod);
                                    //  if (isValid == 1) {
                                    let key = this.getKey(comp, div);
                                    let participantTemp = compMap.get(key);
                                    if (participantTemp == undefined) {
                                        this.setParticipantValue(compMap, participantObj, comp, div, competitions, key);
                                    }
                                    else {
                                        participantTemp.participants.push(participantObj);
                                    }
                                }
                            //   }
                            //       }

                        }
                    }
                }
                console.log("******* competitions" + JSON.stringify(competitions));
                for (let item of competitions) {
                    console.log('@@@@--@@@=---@')
                    if (item.registrationRestrictionTypeRefId == 3) {
                        continue;
                    }
                    let partMap = new Map();
                    let errMap = new Map();
                    let organisationId = await this.organisationService.findByUniquekey(item.organisationUniqueKey);
                    let competition = await this.competitionRegService.findCompetitionFeeDetailsByUniqueKey(item.competitionUniqueKey);
                    if (item.participants && item.participants.length) {
                        for (let part of item.participants) {
                            let key = part.firstName + "#" + part.lastName + "#" + part.mobileNumber + "#" + part.email;
                            if (part.userId == 0) {
                                if (partMap.get(key) == undefined) {
                                    partMap.set(key, part);
                                }
                                else {
                                    if (errMap.get(key) == undefined) {
                                        let msg = this.getErrorMsg(item, competition, part);
                                        errorArr.push(msg);
                                        errMap.set(key, part)
                                    }

                                }
                            }
                            else {
                                if (partMap.get(key) == undefined) {
                                    partMap.set(key, part);
                                    let validateArray = [];
                                    if (item.registrationRestrictionTypeRefId == 1) {
                                        validateArray = await this.registrationService.registrationRestrictionValidate(competition[0].id, organisationId, part.userId, 0,
                                            item.competitionMembershipProductTypeId)
                                    }
                                    else if (item.registrationRestrictionTypeRefId == 2) {
                                        let compDivisionDb = await this.competitionDivisionService.findBycmpd(item.competitionMembershipProductDivisionId)
                                        validateArray = await this.registrationService.registrationRestrictionValidate(competition[0].id, organisationId, part.userId,
                                            compDivisionDb.id, item.competitionMembershipProductTypeId)
                                    }
                                    if (validateArray && validateArray.length) {
                                        if (errMap.get(key) == undefined) {
                                            let msg = this.getErrorMsg(item, competition, part);
                                            errorArr.push(msg);
                                            errMap.set(key, part)
                                        }
                                    }
                                }
                                else {
                                    if (errMap.get(key) == undefined) {
                                        let msg = this.getErrorMsg(item, competition, part);
                                        errorArr.push(msg);
                                        errMap.set(key, part)
                                    }
                                }
                            }
                        }
                    }
                }
            } console.log("22222222");
            return errorArr;
        } catch (error) {
            throw error;
        }
    }

    private async getParticipantObj(item, parentOrGuardianMap) {
        try {

            let participantEmail = '';
            logger.info(`@@@@@--BEFORE CHECK`)
            if (item.referParentEmail) {
                if (item.tempParents && item.tempParents.length) {
                    logger.info(`@@@@@-- temp parents`, JSON.stringify(item.tempParents[0]))
                    let parentEmail = item.tempParents[0];
                    // let parentEmail = parentOrGuardianMap.get(tempParentId);
                    participantEmail = parentEmail.toLowerCase() + '.' + item.firstName.toLowerCase();

                } else {
                    logger.info(`@@@@@-- parentGuardian`, JSON.stringify(item.parentOrGuardian[0]))
                    let parent = item.parentOrGuardian[0]
                    participantEmail = parent.email.toLowerCase() + '.' + item.firstName.toLowerCase();
                    parentOrGuardianMap.set(parent.tempParentId, parent.email.toLowerCase())
                }
            }
            else {
                logger.info(`@@@@@--  ELSE to child email`)
                participantEmail = item.email.toLowerCase();
            }
            let participantObj = {
                firstName: item.firstName,
                lastName: item.lastName,
                mobileNumber: item.mobileNumber,
                email: participantEmail.toLowerCase(),
                userId: item.userId
            }
            let userInfo = await this.userService.findByEmail(participantEmail);
            if (isNotNullAndUndefined(userInfo)) {
                participantObj.userId = userInfo.id;
            }
            else {
                participantObj.userId = 0;
            }

            return participantObj;
        } catch (error) {
            throw error;
        }

    }

    private setParticipantValue(compMap, participantObj, item, div, competitions, key) {
        try {
            let obj = {
                competitionUniqueKey: item.competitionId,
                organisationUniqueKey: item.organisationId,
                competitionMembershipProductTypeId: div.competitionMembershipProductTypeId,
                competitionMembershipProductDivisionId: div.competitionMembershipProductDivisionId,
                registrationRestrictionTypeRefId: item.registrationRestrictionTypeRefId,
                participants: []
            }
            obj.participants.push(participantObj);
            compMap.set(key, obj);
            competitions.push(obj);


        } catch (error) {
            throw error;
        }
    }

    private getKey(item, division) {
        let key = null;
        if (item.registrationRestrictionTypeRefId == 1) {
            key = item.competitionId;
        }
        else if (item.registrationRestrictionTypeRefId == 2) {
            key = item.competitionId + "#" + division.competitionMembershipProductDivisionId;
        }
        return key;
    }

    private checkIsPlayer(membershipProducts) {
        try {
            let isValid = 0;
            let memProd = membershipProducts.find(x => x.isPlayer == 1);
            if (isNotNullAndUndefined(memProd)) {
                isValid = 1;
            }

            return isValid;

        } catch (error) {
            throw error;
        }
    }

    private getErrorMsg(item, competition, part) {
        let msg = item.registrationRestrictionTypeRefId == 1 ? AppConstants.singleCompValidationMsg : (
            item.registrationRestrictionTypeRefId == 2 ? AppConstants.singleCompDivValidationMsg : null);
        msg = msg.replace('{COMP_NAME}', competition[0].name);
        msg = msg.replace('{PLAYER_NAME}', (part.firstName + ' ' + part.lastName));

        return msg;
    }

     private async validateUser () {

    }

    private async validateUserDetailsOrUpdateEmail(requestBody, postRegistration) {

        // post rego = 1 in team rego

        // fixme: refactor in progress

        let errors = [];
        console.log('---- before checking user details')
        if (!requestBody) {
            console.error('validating user details called with empty value. weird.' +
                ' But if this error doesnt show up, it should eventually be removed')
            return
        }
        console.log('-------------1')
        // let parentOrGuardianMap = new Map(); // unused ???
        let userMap = new Map() // { email: User }
        let contact = requestBody;
        if (contact.registeringYourself == RegisteringYourself.TEAM) {
            if (contact.email) { // usually true
                // if there is any user with this email
                let foundUser = await this.userService.findByEmail(contact.email)
                if (foundUser) {
                    if (!lenientObjectCompare(contact, foundUser, ['firstName', 'lastName', 'mobileNumber'])) {
                        let errObj = await this.errorMessage(contact, AppConstants.userMismatchError)
                        errors.push(errObj);
                    }
                } else {
                    foundUser = await this.userService.findByNameAndNumber(contact.firstName, contact.lastName, contact.mobileNumber);
                    if (foundUser) {
                        let errObj = await this.errorMessage(contact, AppConstants.emailMismatchError)
                        errors.push(errObj);
                    }
                }
                userMap.set(contact.email.toLowerCase().trim(), contact)
            } else {
                console.error('it is really unusual there is no contact.email, why?')
            }

            if (contact.teamMembers && contact.teamMembers.length) {
                let {teamMembers} = contact  //.filter(x => x.isDisabled == false);
                if (teamMembers && teamMembers.length) {
                    for (let member of teamMembers) {
                        // in case of using "use parent email", set email to (first) parent
                        if (member.referParentEmail) {
                            let parent = member.parentOrGuardian[0];
                            member.email = `${parent.email.toLowerCase()}.${contact.firstName}`;
                        } else {
                            member.email = member.email.toLowerCase();
                        }
                        let foundUser = await this.userService.findByEmail(member.email)
                        if (foundUser) {
                            if (lenientObjectCompare(member, foundUser, ['firstName', 'lastName', 'mobileNumber'])) {
                                if (!userMap.get(member.email.toLowerCase().trim())) {
                                    userMap.set(member.email.toLowerCase().trim(), member)
                                } else {
                                    console.log('-------------1 ---- ')
                                    let errObj = await this.errorMessage(member, AppConstants.userMismatchError)
                                    errors.push(errObj);
                                }
                            } else {
                                let errObj = await this.errorMessage(member, AppConstants.userMismatchError)
                                errors.push(errObj);
                            }
                        } else {
                            foundUser = await this.userService.findByNameAndNumber(member.firstName, member.lastName, member.mobileNumber);
                            if (foundUser) {
                                let errObj = await this.errorMessage(member, AppConstants.emailMismatchError)
                                errors.push(errObj);
                            } else {
                                if (!userMap.get(member.email.toLowerCase().trim())) {
                                    console.log("map");
                                    userMap.set(member.email.toLowerCase().trim(), member)
                                } else {
                                    console.log('-------------1 ---- ')
                                    let errObj = await this.errorMessage(member, AppConstants.userMismatchError)
                                    errors.push(errObj);
                                }
                            }
                        }
                        // what is isRegistererAsParent?
                        if (member.isRegistererAsParent == 1) {
                            if (member.parentOrGuardian && member.parentOrGuardian.length) {
                                for (let parent of member.parentOrGuardian) {
                                    // todo: refactor the whole block below
                                    if ([null, 0].includes(parent.userId)) {
                                        let parentUser = await this.userService.findByEmail(parent.email)
                                        if (parentUser) {
                                            if (lenientObjectCompare(parent, parentUser, ['firstName', 'lastName', 'mobileNumber'])) {
                                                if (userMap.get(parent.email.toLowerCase().trim()) == undefined) {
                                                    userMap.set(parent.email.toLowerCase().trim(), parent)
                                                } else {
                                                    let errObj = await this.errorMessage(parent, AppConstants.userMismatchError)
                                                    errors.push(errObj);
                                                }
                                            } else {
                                                let errObj = await this.errorMessage(parent, AppConstants.userMismatchError)
                                                errors.push(errObj);
                                            }
                                        } else {
                                            parentUser = await this.userService.findByNameAndNumber(parent.firstName, parent.lastName, parent.mobileNumber);
                                            if (parentUser) {
                                                let errObj = await this.errorMessage(parent, AppConstants.emailMismatchError)
                                                errors.push(errObj);
                                            } else {
                                                if (userMap.get(parent.email.toLowerCase().trim()) == undefined) {
                                                    userMap.set(parent.email.toLowerCase().trim(), parent)
                                                } else {
                                                    let errObj = await this.errorMessage(parent, AppConstants.userMismatchError)
                                                    errors.push(errObj);
                                                }
                                            }
                                        }
                                    } else {
                                        let userDb1 = await this.userService.findById(parent.userId)
                                        let userDb2 = await this.userService.findByEmail(parent.email)
                                        if (userDb2 != undefined) {
                                            if (userDb1.email.toLowerCase().trim() != parent.email.toLowerCase().trim()) {
                                                let errObj = await this.errorMessage(parent, AppConstants.emailAlreadyInUse)
                                                errors.push(errObj);
                                            }
                                        }
                                    }
                                }

                            }
                        }
                    }
                }
            }
        } else {
            let participantEmail = '';
            console.log('-------------3')
            if (contact.referParentEmail) {
                if (contact.tempParents && contact.tempParents.length) {
                    let parentEmail = contact.tempParents[0];
                    // let parentUserId = parentOrGuardianMap.get(tempParentId);
                    // let parentUser = await this.userService.findById(parentUserId);
                    participantEmail = parentEmail.toLowerCase() + '.' + contact.firstName.toLowerCase();
                } else {
                    let parent = contact.parentOrGuardian[0]
                    participantEmail = parent.email.toLowerCase() + '.' + contact.firstName.toLowerCase();
                }
            } else {
                participantEmail = contact.email.toLowerCase();
            }
            contact.email = participantEmail.toLowerCase();
            console.log('-------------4')
            //let userMap = new Map();
            userMap.set(contact.email.toLowerCase().trim(), contact)
            if (contact.userId) {
                // change the email of exisitng user
                // if contact.userid => using this user, so no validation
                let userDb1 = await this.userService.findById(contact.userId)
                userDb1.email = contact.email
                await userDb1.save()
            } else {
                // create new user
                console.log('-------------5')
                let userDb = await this.userService.findByEmail(contact.email)
                if (userDb) {
                    if (contact.firstName.toLowerCase().trim() == userDb.firstName.toLowerCase().trim() && contact.lastName.toLowerCase().trim() == userDb.lastName.toLowerCase().trim() &&
                        ((contact.mobileNumber != null ? contact.mobileNumber.trim() : contact.mobileNumber) ==
                            (userDb.mobileNumber != null ? userDb.mobileNumber.trim() : userDb.mobileNumber))) {

                        if (contact.parentOrGuardian && contact.parentOrGuardian.length) {
                            for (let pg of contact.parentOrGuardian) {
                                if (pg.userId == 0 || pg.userId == null) {
                                    let userPG = await this.userService.findByEmail(pg.email)
                                    if (userPG) {
                                        if (pg.firstName.toLowerCase().trim() == userPG.firstName.toLowerCase().trim() && pg.lastName.toLowerCase().trim() == userPG.lastName.toLowerCase().trim() &&
                                            ((pg.mobileNumber != null ? pg.mobileNumber.trim() : pg.mobileNumber) ==
                                                (userPG.mobileNumber != null ? userPG.mobileNumber.trim() : userPG.mobileNumber))) {
                                            if (userMap.get(pg.email.toLowerCase().trim()) == undefined) {
                                                userMap.set(pg.email.toLowerCase().trim(), pg)
                                            } else {
                                                let errObj = await this.errorMessage(pg, AppConstants.userMismatchError)
                                                errors.push(errObj);
                                            }
                                        } else {
                                            let errObj = await this.errorMessage(pg, AppConstants.userMismatchError)
                                            errors.push(errObj);
                                        }
                                    } else {
                                        // AS 16/2  rely on claimed profiles

                                        // userPG = await this.userService.findByNameAndNumber(pg.firstName, pg.lastName, pg.mobileNumber);
                                        // if (isNotNullAndUndefined(userPG)) {
                                        //     let errObj = await this.errorMessage(pg, AppConstants.emailMismatchError)
                                        //     errors.push(errObj);
                                        // } else {
                                        //     if (userMap.get(pg.email.toLowerCase().trim()) == undefined) {
                                        //         userMap.set(pg.email.toLowerCase().trim(), pg)
                                        //     } else {
                                        //         let errObj = await this.errorMessage(pg, AppConstants.userMismatchError)
                                        //         errors.push(errObj);
                                        //     }
                                        // }
                                    }

                                } else {
                                    let userDb1 = await this.userService.findById(pg.userId)
                                    let userDb2 = await this.userService.findByEmail(pg.email)
                                    if (userDb2 != undefined) {
                                        if (userDb1.email.toLowerCase().trim() != pg.email.toLowerCase().trim()) {
                                            let errObj = await this.errorMessage(pg, AppConstants.emailAlreadyInUse)
                                            errors.push(errObj);
                                        }
                                    }
                                }
                            }

                        }
                    } else {
                        let errObj = await this.errorMessage(contact, AppConstants.userMismatchError)
                        errors.push(errObj);
                        console.log('-------------6')
                        if (contact.parentOrGuardian && contact.parentOrGuardian.length) {
                            for (let pg of contact.parentOrGuardian) {
                                if (pg.userId == 0 || pg.userId == null) {
                                    let userPG = await this.userService.findByEmail(pg.email)
                                    if (userPG) {
                                        if (pg.firstName.toLowerCase().trim() == userPG.firstName.toLowerCase().trim() && pg.lastName.toLowerCase().trim() == userPG.lastName.toLowerCase().trim() &&
                                            ((pg.mobileNumber != null ? pg.mobileNumber.trim() : pg.mobileNumber) ==
                                                (userPG.mobileNumber != null ? userPG.mobileNumber.trim() : userPG.mobileNumber))) {
                                            if (userMap.get(pg.email.toLowerCase().trim()) == undefined) {
                                                userMap.set(pg.email.toLowerCase().trim(), pg)
                                            } else {
                                                let errObj = await this.errorMessage(pg, AppConstants.userMismatchError)
                                                errors.push(errObj);
                                            }
                                        } else {
                                            let errObj = await this.errorMessage(pg, AppConstants.userMismatchError)
                                            errors.push(errObj);
                                        }
                                    } else {
                                        // AS 16/2  rely on claimed profiles

                                        // userPG = await this.userService.findByNameAndNumber(pg.firstName, pg.lastName, pg.mobileNumber);
                                        // if (isNotNullAndUndefined(userPG)) {
                                        //     let errObj = await this.errorMessage(pg, AppConstants.emailMismatchError)
                                        //     errors.push(errObj);
                                        // } else {
                                        //     if (userMap.get(pg.email.toLowerCase().trim()) == undefined) {
                                        //         userMap.set(pg.email.toLowerCase().trim(), pg)
                                        //     } else {
                                        //         let errObj = await this.errorMessage(pg, AppConstants.userMismatchError)
                                        //         errors.push(errObj);
                                        //     }
                                        // }
                                    }
                                } else {
                                    let userDb1 = await this.userService.findById(pg.userId)
                                    let userDb2 = await this.userService.findByEmail(pg.email)
                                    if (userDb2 != undefined) {
                                        if (userDb1.email.toLowerCase().trim() != pg.email.toLowerCase().trim()) {
                                            let errObj = await this.errorMessage(pg, AppConstants.emailAlreadyInUse)
                                            errors.push(errObj);
                                        }
                                    }
                                }
                            }

                        }
                    }
                } else {
                    // AS 16/2  rely on claimed profiles
                    userDb = await this.userService.findByNameAndNumber(contact.firstName, contact.lastName, contact.mobileNumber);
                    // if (isNotNullAndUndefined(userDb)) {
                    //     console.log(' USERE db  ::---------' + JSON.stringify(userDb))

                    //     let tempMail = this.getTempMail(userDb)
                    //     console.log(' tempMail ::---------' + tempMail)

                    //     if (tempMail == AppConstants.playerwsaDomain) {
                    //         // userDb.password = null;
                    //         // await this.userService.createOrUpdate(userDb);
                    //     } else if ((getAge(contact.dateOfBirth) <= 18) && contact.parentOrGuardian && contact.parentOrGuardian.find(x => x.email.toLowerCase() == userDb.email.toLowerCase())) {
                    //     } else {
                    //         let errObj = await this.errorMessage(contact, AppConstants.emailMismatchError)
                    //         errors.push(errObj);
                    //     }
                    // }
                }
            }

            console.log('-------------7')
        }
        if (!postRegistration) // for team: below doesnt trigger
            await this.validateUserDraftDetails(contact, errors, userMap);

        // what is a draft?

        console.log('-- ERROR ARR ---' + JSON.stringify(errors))
        return errors;
    }

    // below  only for personal rego not team
    private async validateUserDraftDetails(contact, errorArr, userMap) {
        try {
            let registration = await this.registrationService.findByRegistrationKey(contact.registrationId)
            if (registration) { console.log("enter111111");
                let userRegDraftExisting = await this.userRegistrationDraftService.findByRegistrationId(registration.id);
                if (userRegDraftExisting && userRegDraftExisting.length) {
                    for (let urd of userRegDraftExisting) { console.log("enter2222222");
                    console.log( ' ---  CONTACT :: '+JSON.stringify(contact))
                    console.log( ' ---  URD :: '+JSON.stringify(urd))
                    if(contact.participantId != urd.userRegUniqueKey){
                        if (contact.registeringYourself != 4) {
                            if (urd.registeringYourselfRefId == RegisteringYourself.TEAM) {
                                if(contact.email.toLowerCase() == urd.email.toLowerCase()) {
                                    if (contact.firstName.toLowerCase().trim() == urd.firstName.toLowerCase().trim() && contact.lastName.toLowerCase().trim() == urd.lastName.toLowerCase().trim() &&
                                    ((contact.mobileNumber != null ? contact.mobileNumber.trim() : contact.mobileNumber) ==
                                        (urd.mobileNumber != null ? urd.mobileNumber.trim() : urd.mobileNumber))) {

                                    }
                                    else {
                                        let errObj = await this.errorMessage(contact, AppConstants.userMismatchError)
                                        errorArr.push(errObj);
                                    }
                                }


                                let parentDraftData = JSON.parse(JSON.stringify(urd.parentData));
                                if (parentDraftData && parentDraftData.length) {
                                    for (let pd of parentDraftData) {
                                        if (userMap.get(pd.email.toLowerCase().trim()) != undefined) {
                                            if (contact.firstName.toLowerCase().trim() == pd.firstName.toLowerCase().trim() && contact.lastName.toLowerCase().trim() == pd.lastName.toLowerCase().trim() &&
                                                ((contact.mobileNumber != null ? contact.mobileNumber.trim() : contact.mobileNumber) ==
                                                    (pd.mobileNumber != null ? pd.mobileNumber.trim() : pd.mobileNumber))) {
                                                if (contact.parentOrGuardian && contact.parentOrGuardian.length) {
                                                    for (let pg of contact.parentOrGuardian) {
                                                        if (pg.firstName.toLowerCase().trim() == pd.firstName.toLowerCase().trim() && pg.lastName.toLowerCase().trim() == pd.lastName.toLowerCase().trim() &&
                                                            ((pg.mobileNumber != null ? pg.mobileNumber.trim() : pg.mobileNumber) ==
                                                                (pd.mobileNumber != null ? pd.mobileNumber.trim() : pd.mobileNumber))) {
                                                        }
                                                        else {
                                                            let errObj = await this.errorMessage(pg, AppConstants.userMismatchError)
                                                            errorArr.push(errObj);
                                                        }
                                                    }
                                                }
                                            }
                                            else {
                                                let errObj = await this.errorMessage(contact, AppConstants.userMismatchError)
                                                errorArr.push(errObj);
                                            }
                                        }
                                    }
                                }

                            }
                            else {
                                if (userMap.get(urd.email.toLowerCase().trim()) != undefined) {
                                    if (contact.firstName.toLowerCase().trim() == urd.firstName.toLowerCase().trim() && contact.lastName.toLowerCase().trim() == urd.lastName.toLowerCase().trim() &&
                                    ((contact.mobileNumber != null ? contact.mobileNumber.trim() : contact.mobileNumber) ==
                                        (urd.mobileNumber != null ? urd.mobileNumber.trim() : urd.mobileNumber))) {
                                        }
                                        else{
                                            let errObj = await this.errorMessage(contact, AppConstants.emailMismatchError)
                                            errorArr.push(errObj);
                                        }
                                }
                                let parentDraftData = JSON.parse(JSON.stringify(urd.parentData));
                                if (parentDraftData && parentDraftData.length) {
                                    for (let pd of parentDraftData) {
                                        if (userMap.get(pd.email.toLowerCase().trim()) != undefined) {
                                            if (contact.firstName.toLowerCase().trim() == pd.firstName.toLowerCase().trim() && contact.lastName.toLowerCase().trim() == pd.lastName.toLowerCase().trim() &&
                                                ((contact.mobileNumber != null ? contact.mobileNumber.trim() : contact.mobileNumber) ==
                                                    (pd.mobileNumber != null ? pd.mobileNumber.trim() : pd.mobileNumber))) {
                                                if (contact.parentOrGuardian && contact.parentOrGuardian.length) {
                                                    for (let pg of contact.parentOrGuardian) {
                                                        if (pg.firstName.toLowerCase().trim() == pd.firstName.toLowerCase().trim() && pg.lastName.toLowerCase().trim() == pd.lastName.toLowerCase().trim() &&
                                                            ((pg.mobileNumber != null ? pg.mobileNumber.trim() : pg.mobileNumber) ==
                                                                (pd.mobileNumber != null ? pd.mobileNumber.trim() : pd.mobileNumber))) {
                                                        }
                                                        else {
                                                            let errObj = await this.errorMessage(pg, AppConstants.userMismatchError)
                                                            errorArr.push(errObj);
                                                        }
                                                    }
                                                }
                                            }
                                            else {
                                                let errObj = await this.errorMessage(contact, AppConstants.userMismatchError)
                                                errorArr.push(errObj);
                                            }
                                        }
                                    }
                                }
                            }
                        }
                        else { console.log("enterrrr");

                            //  if (urd.registeringYourselfRefId == RegisteringYourself.team) {
                                console.log("++++++"+JSON.stringify(contact));
                                console.log("------"+JSON.stringify(urd));
                            if(contact.teamMemberRegId != urd.teamMemberRegId) {
                                if(contact.email.toLowerCase() == urd.email.toLowerCase()) { console.log("enterrrr22222");
                                if (contact.firstName.toLowerCase().trim() == urd.firstName.toLowerCase().trim() && contact.lastName.toLowerCase().trim() == urd.lastName.toLowerCase().trim() &&
                                ((contact.mobileNumber != null ? contact.mobileNumber.trim() : contact.mobileNumber) ==
                                    (urd.mobileNumber != null ? urd.mobileNumber.trim() : urd.mobileNumber))) { console.log("enteinseide");
                                }
                                else { console.log("enterrrr33333333");
                                    let errObj = await this.errorMessage(contact, AppConstants.userMismatchError)
                                    errorArr.push(errObj);
                                }
                            }

                            let parentDraftData = JSON.parse(JSON.stringify(urd.parentData));
                            if (parentDraftData && parentDraftData.length) {
                                for (let pd of parentDraftData) {
                                    if(contact.email.toLowerCase() == pd.email.toLowerCase()) {
                                        if (contact.firstName.toLowerCase().trim() == pd.firstName.toLowerCase().trim() && contact.lastName.toLowerCase().trim() == pd.lastName.toLowerCase().trim() &&
                                        ((contact.mobileNumber != null ? contact.mobileNumber.trim() : contact.mobileNumber) ==
                                            (pd.mobileNumber != null ? pd.mobileNumber.trim() : pd.mobileNumber))) {
                                            if (contact.parentOrGuardian && contact.parentOrGuardian.length) {
                                                for (let pg of contact.parentOrGuardian) {
                                                    if(pg.email.toLowerCase() == pd.email.toLowerCase()) {
                                                        if (pg.firstName.toLowerCase().trim() == pd.firstName.toLowerCase().trim() && pg.lastName.toLowerCase().trim() == pd.lastName.toLowerCase().trim() &&
                                                            ((pg.mobileNumber != null ? pg.mobileNumber.trim() : pg.mobileNumber) ==
                                                            (pd.mobileNumber != null ? pd.mobileNumber.trim() : pd.mobileNumber))) {
                                                        }
                                                        else { console.log("enterrrr44444444");
                                                            let errObj = await this.errorMessage(pg, AppConstants.userMismatchError)
                                                            errorArr.push(errObj);
                                                        }
                                                    }
                                                }
                                            }
                                        }
                                        else { console.log("enterrrr555555555");
                                            let errObj = await this.errorMessage(contact, AppConstants.userMismatchError)
                                            errorArr.push(errObj);
                                        }
                                    }
                                }
                            }

                            if (contact.teamMembers && contact.teamMembers.length) {
                                let playersList = contact.teamMembers //.filter(x => x.isDisabled == false);
                                if (playersList && playersList.length) {
                                    for (let p of playersList) { console.log("enterrrr66666666");
                                        if (p.referParentEmail) {
                                            let parent = p.parentOrGuardian[0];
                                            p.email = parent.email.toLowerCase() + '.' + contact.firstName;
                                        }
                                        else {
                                            p.email = p.email.toLowerCase();
                                        }
                                        console.log("+++++++"+ JSON.stringify(p));
                                        console.log("-------"+ JSON.stringify(urd));
                                        console.log("^^^^^^^^^" + JSON.stringify(p.email.toLowerCase()));
                                        console.log("^^^^^^^^^" + JSON.stringify(urd.email.toLowerCase()));
                                        if(p.email.toLowerCase() == urd.email.toLowerCase()) { console.log("enterrrr77777777");
                                            if (p.firstName.toLowerCase().trim() == urd.firstName.toLowerCase().trim() && p.lastName.toLowerCase().trim() == urd.lastName.toLowerCase().trim() &&
                                            ((p.mobileNumber != null ? p.mobileNumber.trim() : p.mobileNumber) ==
                                                (urd.mobileNumber != null ? urd.mobileNumber.trim() : urd.mobileNumber))) { console.log("insideeeeeeeeee");
                                            }
                                            else { console.log("enterrrr888888");
                                            let errObj = await this.errorMessage(p, AppConstants.userMismatchError)
                                            errorArr.push(errObj);
                                            }
                                        }
                                        //else{ console.log("hii error");}

                                        // if (p.isRegistererAsParent == 1) {
                                        let parentDraftData = JSON.parse(JSON.stringify(urd.parentData));
                                        if (parentDraftData && parentDraftData.length) {
                                            for (let pd of parentDraftData) { console.log("enterrrrhiiii");
                                                if (userMap.get(pd.email.toLowerCase().trim()) != undefined) { console.log("enterrrr56788");
                                                    if (p.firstName.toLowerCase().trim() == pd.firstName.toLowerCase().trim() && p.lastName.toLowerCase().trim() == pd.lastName.toLowerCase().trim() &&
                                                        ((p.mobileNumber != null ? p.mobileNumber.trim() : p.mobileNumber) ==
                                                            (pd.mobileNumber != null ? pd.mobileNumber.trim() : pd.mobileNumber))) { console.log("enterrrrcome");
                                                        if (p.parentOrGuardian && p.parentOrGuardian.length) {
                                                            for (let pg of p.parentOrGuardian) { console.log("enterrrrdone");
                                                                if (pg.firstName.toLowerCase().trim() == pd.firstName.toLowerCase().trim() && pg.lastName.toLowerCase().trim() == pd.lastName.toLowerCase().trim() &&
                                                                    ((pg.mobileNumber != null ? pg.mobileNumber.trim() : pg.mobileNumber) ==
                                                                        (pd.mobileNumber != null ? pd.mobileNumber.trim() : pd.mobileNumber))) { console.log("enterrrrmappppp");
                                                                }
                                                                else { console.log("enterrrr9999999");
                                                                    let errObj = await this.errorMessage(pg, AppConstants.userMismatchError)
                                                                    errorArr.push(errObj);
                                                                }
                                                            }
                                                        }
                                                    }
                                                    else {console.log("enterrrr10");
                                                        let errObj = await this.errorMessage(contact, AppConstants.userMismatchError)
                                                        errorArr.push(errObj);
                                                    }
                                                }
                                            }
                                        }

                                        // }
                                    }
                                }
                            }
                            //}
                            }

                        }
                    }

                    }
                }
            }
        }
        catch (error) {
            throw error;
        }
    }

    private errorMessage(contact, message) {
        try {
            console.log('-- ERROR OBJ ---')
            let errObj = {
                email: contact.email.toLowerCase().trim(),
                firstName: contact.firstName.trim(),
                lastName: contact.lastName.trim(),
                mobileNumber: contact.mobileNumber,
                message: message
            }
            return errObj
        }
        catch (error) {
            throw error;
        }
    }

    private replaceErrorMsg(errorArray) {
        try {
            let msgArray = []
            if (errorArray && errorArray.length) {
                for (let err of errorArray) {
                    err.message = err.message.replace('{user}', err.firstName + ' ' + err.lastName);
                    err.message = err.message.replace('{email}', err.email);
                    msgArray.push(err.message)
                }
            }
            return msgArray;
        }
        catch (error) {
            throw error;
        }
    }

    private async saveYoursInfo(requestBody) {
        try {
            let userId = 0;

            if (requestBody.registeringYourself == RegisteringYourself.SELF) {
                if (!isNullOrZero(requestBody.existingUserId)) {
                    userId = requestBody.existingUserId;
                }
                // else{
                //     let userDb = null;
                //     if(requestBody.parentOrGuardian && requestBody.parentOrGuardian.length || requestBody.tempParents && requestBody.tempParents.length){

                //     }
                //     else{

                //     }
                //     userDb = await this.userService.findUserByUniqueFields
                //     (requestBody.email, requestBody.firstName, requestBody.lastName, requestBody.mobileNumber);
                //     if(isNotNullAndUndefined(userDb)){
                //         userId = userDb.id;
                //     }
                //     else{
                //         userId = await this.createYourInfoUser(requestBody);
                //     }
                // }
            }
            else if (!isNullOrZero(requestBody.existingUserId)) {
                userId = requestBody.existingUserId;
            }
            console.log("*******" + userId);
            return userId;
        }

        catch (error) {
            logger.error(`---###--- Error Occurred in Your info save ${error}`)
            throw error;
        }
    }

    private async createYourInfoUser(requestBody) {
        try {
            let user = new User();
            user.id = 0;
            user.firstName = requestBody.firstName;
            user.middleName = requestBody.middleName;
            user.lastName = requestBody.lastName;
            user.mobileNumber = requestBody.mobileNumber;
            user.genderRefId = requestBody.genderRefId;
            user.email = requestBody.email.toLowerCase();
            user.dateOfBirth = requestBody.dateOfBirth;
            user.suburb = requestBody.suburb;
            user.street1 = requestBody.street1;
            user.street2 = requestBody.street2;
            user.postalCode = requestBody.postalCode;
            user.stateRefId = requestBody.stateRefId;
            let userRes = await this.userService.createOrUpdate(user);
            return userRes.id;

        } catch (error) {
            logger.error(`Exception occurred in createYourInfoUser ${error}`);
        }
    }

    private async checkVoucherBalance(voucherCode, pin) {
        try {
            let payload = {
                "pin": pin,
                "voucherCode": voucherCode,
                "voucherType": AppConstants.VOUCHER_TYPE
            }
            let voucherBalance = await AxiosHttpApi.checkBalance(payload);
            console.log("voucherBalance" + JSON.stringify(voucherBalance));
            if (voucherBalance) {
                if (voucherBalance.status == 1) {
                    return { balance: voucherBalance.result.balance, statusCode: VoucherStatus.SUCCESS, message: "Success", isValid: 1 };
                }
            }
        } catch (error) {
            console.info('checkVoucherBalance error', error);
            logger.error(`Exception occurred in checkVoucherBalance ${error}`);
            console.log("Bad Request" + error);
            return { balance: 0, statusCode: error.statusCode, message: error.message, isValid: 0 };
        }
    }

    private duplicateVoucherCheck(voucherCode, otherParticipants, voucherMap) {
        try {
            let isDuplicate = false;

            if (voucherMap.get(voucherCode) != undefined) {
                voucherMap.set(voucherCode, 1);
                return { balance: 0, message: "Duplicate code", isValid: 0 };
            }
            voucherMap.set(voucherCode, 1);
            for (let item of otherParticipants) {
                let vouchers = item.selectedOptions.selectedGovernmentVouchers;
                if (vouchers && vouchers.length) {
                    for (let voucher of vouchers) {
                        if (voucher.voucherCode == voucherCode) {
                            isDuplicate = true;
                            break;
                        }
                    }
                }
            }

            if (isDuplicate) {
                return { balance: 0, message: "Duplicate code", isValid: 0 };
            }

            return null;

        } catch (error) {
            logger.error(`Exception occurred in duplicateVoucherCheck ${error}`);
            return null;
        }
    }

    private getTempMail(userDb){
        let tempMail = userDb.email.toLowerCase().slice(0, 6)
        let temp2Mail = userDb.email.split('').reverse().join('').slice(0, 8)
        temp2Mail = temp2Mail.split('').reverse().join('')
        tempMail = tempMail + temp2Mail
        return tempMail;
    }

    private getUserInfoObj(userObj) {
        let user = new User();
        user.id = 0;
        user.firstName = userObj.firstName;
        user.lastName = userObj.lastName;
        user.mobileNumber = userObj.mobileNumber;
        user.email = userObj.email.toLowerCase();
        user.dateOfBirth = userObj.dateOfBirth;
        user.suburb = userObj.suburb;
        user.street1 = userObj.street1;
        user.street2 = userObj.street2;
        user.stateRefId = userObj.stateRefId;
        user.countryRefId = userObj.countryRefId;
        user.postalCode = userObj.postalCode;

        return user;
    }

    private async getTeamInviteYourInfoObj(userId, yourInfo) {
        try {
            let user = null;
            if (!isNullOrZero(userId)) {
                user = await this.userService.findById(userId);
            }

            // console.log("user" + JSON.stringify(user));

            let userObj = {
                userId: (user ? (user.userId ? user.userId : user.id) : (yourInfo ? yourInfo.userId : null)),
                firstName: (user ? user.firstName : (yourInfo ? yourInfo.firstName : null)),
                lastName: (user ? user.lastName : (yourInfo ? yourInfo.lastName : null)),
                email: (user ? user.email : (yourInfo ? yourInfo.email : null)),
                mobileNumber: (user ? user.mobileNumber : (yourInfo ? yourInfo.mobileNumber : null)),
                street1: (user ? user.street1 : (yourInfo ? yourInfo.street1 : null)),
                street2: (user ? user.street2 : (yourInfo ? yourInfo.street2 : null)),
                suburb: (user ? user.suburb : (yourInfo ? yourInfo.suburb : null)),
                stateRefId: (user ? user.stateRefId : (yourInfo ? yourInfo.stateRefId : null)),
                countryRefId: (user ? user.countryRefId : (yourInfo ? yourInfo.countryRefId : null)),
                postalCode: (user ? user.postalCode : (yourInfo ? yourInfo.postalCode : null)),
                referParentEmail: (user ? user.referParentEmail : (yourInfo ? yourInfo.referParentEmail : null))
            }
            return userObj;
        } catch (error) {
            logger.error(`Exception occurred in getYourInfoObj ${error}`);
        }
    }

    private async getYourInfoObj(registration, yourInfo) {
        try {
            let user = null;
            if (!isNullOrZero(registration.createdBy)) {
                user = await this.userService.findById(registration.createdBy);
            }
            else {
                let userRegData = await this.userRegistrationDraftService.findByRegistrationId(registration.id);
                if (userRegData && userRegData.length) {
                    let parents = [];
                    for (let userRegister of userRegData) {
                        if (userRegister.parentData) {
                            let parentData = JSON.parse(JSON.stringify(userRegister.parentData));
                            if (parentData) {
                                parents.push(...parentData);
                            }
                        }
                    }
                    // console.log("Parents" + JSON.stringify(parents));
                    // console.log("userRegData" + JSON.stringify(userRegData));
                    for (let userRegister of userRegData) {
                        let participantData = null;
                        if (userRegister.registeringYourselfRefId == RegisteringYourself.SELF) {
                            if (userRegister.participantData) {
                                participantData = JSON.parse(JSON.stringify(userRegister.participantData));
                                // console.log("DOB" + getAge(userRegister.dateOfBirth));
                                // if(getAge(userRegister.dateOfBirth) <= 18){
                                //     if(participantData.tempParents && participantData.tempParents.length){
                                //         user = parents.find(x=>x.email == participantData.tempParents[0]);
                                //     }
                                //     else if(participantData.parentOrGuardian && participantData.parentOrGuardian.length){
                                //         user = participantData.parentOrGuardian[0];
                                //     }
                                // }
                                // else{
                                user = JSON.parse(JSON.stringify(userRegister.participantData));
                                //}
                            }
                        }
                        else if (userRegister.registeringYourselfRefId == RegisteringYourself.CHILD) {
                            if (userRegister.participantData) {
                                participantData = JSON.parse(JSON.stringify(userRegister.participantData));
                                if (participantData.tempParents && participantData.tempParents.length) {
                                    user = parents.find(x => x.email == participantData.tempParents[0]);
                                }
                                else if (participantData.parentOrGuardian && participantData.parentOrGuardian.length) {
                                    user = participantData.parentOrGuardian[0];
                                }
                            }
                        }
                        else if (userRegister.registeringYourselfRefId == RegisteringYourself.TEAM) {
                            if (userRegister.personRoleRefId != null) {
                                if (userRegister.participantData) {
                                    user = JSON.parse(JSON.stringify(userRegister.participantData));
                                }

                            }
                        }
                    }
                }
            }
            // console.log("user" + JSON.stringify(user));

            let userObj = {
                userId: (user ? (user.userId ? user.userId : user.id) : (yourInfo ? yourInfo.userId : null)),
                firstName: (user ? user.firstName : (yourInfo ? yourInfo.firstName : null)),
                lastName: (user ? user.lastName : (yourInfo ? yourInfo.lastName : null)),
                email: (user ? user.email : (yourInfo ? yourInfo.email : null)),
                mobileNumber: (user ? user.mobileNumber : (yourInfo ? yourInfo.mobileNumber : null)),
                street1: (user ? user.street1 : (yourInfo ? yourInfo.street1 : null)),
                street2: (user ? user.street2 : (yourInfo ? yourInfo.street2 : null)),
                suburb: (user ? user.suburb : (yourInfo ? yourInfo.suburb : null)),
                stateRefId: (user ? user.stateRefId : (yourInfo ? yourInfo.stateRefId : null)),
                countryRefId: (user ? user.countryRefId : (yourInfo ? yourInfo.countryRefId : null)),
                postalCode: (user ? user.postalCode : (yourInfo ? yourInfo.postalCode : null)),
                referParentEmail: (user ? user.referParentEmail : (yourInfo ? yourInfo.referParentEmail : null))
            }
            return userObj;
        } catch (error) {
            logger.error(`Exception occurred in getYourInfoObj ${error}`);
            throw error;
        }
    }

    private getAddressObj(userObj) {

        let obj = {
            street1: userObj.street1,
            street2: userObj.street2,
            stateRefId: userObj.stateRefId,
            countryRefId: userObj.countryRefId,
            postalCode: userObj.postalCode,
            suburb: userObj.suburb
        }

        return obj;
    }

}

export interface InvoiceRequest {
    registrationId: number;
    invoiceId: number;
}
