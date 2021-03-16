import { Response } from 'express';
import moment from 'moment';
import { Authorized, Body, Get, HeaderParam, JsonController, Post, QueryParam, Res } from "routing-controllers";
import { ParticipantRegistrationInfoDto } from '../models/dto/ParticipantRegistrationInfoDto';
import { Friend } from '../models/registrations/Friend';
import { NonPlayer } from '../models/registrations/NonPlayer';
import { OrgRegistrationParticipant } from '../models/registrations/OrgRegistrationParticipant';
import { Player } from '../models/registrations/Player';
import { Registration } from '../models/registrations/Registration';
import { Team } from '../models/registrations/Team';
import { UserMembershipExpiry } from '../models/registrations/UserMembershipExpiry';
import { UserRegistration } from '../models/registrations/UserRegistration';
import { UserRoleEntity } from '../models/security/UserRoleEntity';
import Stripe from 'stripe';
import { logger } from "../logger";
import { Transaction } from "../models/registrations/Transaction";
import { User } from "../models/security/User";
import { feeIsNull, formatFeeForStripe1, formatPersonName, isArrayPopulated, isNotNullAndUndefined, isNullOrUndefined, isNullOrZero, md5, objectIsNotEmpty, uuidv4 } from "../utils/Utils";
import AppConstants from "../validation/AppConstants";
import { BaseController } from "./BaseController";
import { Invoice } from '../models/registrations/Invoice';
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2020-03-02' });

@JsonController("/api")
export class DatatMassageController extends BaseController{

    @Authorized()
    @Post("/reprocess/registration")
    public async RegistrationReprocess(
        @HeaderParam("authorization") currentUser: User,
        @Body() requestBody: any,
        @Res() response: Response
    ){
        try {
            if(isNullOrUndefined(requestBody)){
                let registrationUniqueKey = requestBody.registrationId;
                let registration = await this.registrationService.findByRegistrationKey(registrationUniqueKey);
                let getInvoice = await this.invoiceService.findByRegistrationId(registration.id);
                let invoiceData = null;
                if(!isArrayPopulated(getInvoice)){
                    let invoice = await this.createOrUpdateInvoice(registration, AppConstants.registration, null);
                    invoiceData.push(invoice);
                }
                else{
                    invoiceData = getInvoice;
                }
                let registrationTrackData = await this.registrationTrackService.findByRegistrationId(registration.id, 2);
                let registrationProduct = registrationTrackData.jsonData;
                const INVOICE_ID = invoiceData[0].id;
                const PAYMENT_TYPE = invoiceData[0].paymentType;
                const PAYMENT_SUBTYPE = invoiceData[0].subPaymentType;
                const sourceTransaction = invoiceData[0].stripeSourceTransaction;
                const CURRENCY_TYPE: string = "aud";
               
                const paymentIntent = await this.getIntentObject(sourceTransaction);
                logger.info(`RegistrationReprocess paymentIntent :: ${JSON.stringify(paymentIntent)}`);

                if (isNotNullAndUndefined(registrationProduct) && isArrayPopulated(registrationProduct.compParticipants)) {
                    let account = await this.checkOrganisationStripeAccount(registrationProduct);
                    if ((!account.membershipStripeAccountIdError) &&
                        (!account.competitionStripeAccountIdError) &&
                        (!account.affiliateStripeAccountIdError)) {
                        console.log("paymentIntent" + paymentIntent);
                        let transArr = [];
                        let totalFee = feeIsNull(registrationProduct.total.targetValue);
                        logger.info("totalFee::" + totalFee);

                        await this.saveYoursInfo(registrationProduct.yourInfo, registration);
                        const paidBy = registrationProduct.yourInfo.id;

                        console.log("Your Info Saved Successfully" + registrationUniqueKey);

                        await this.saveRegistrationInfo(registration, registrationProduct);

                        console.log("Registration Info Saved Successfully" + registrationUniqueKey);

                        if(isNotNullAndUndefined(paymentIntent) && totalFee > 0){
    
                            let transferGroup = AppConstants.registration + "#" + registration.registrationUniqueKey;
                            let trans = await this.performInvoicePayment(registrationProduct,
                                paymentIntent, CURRENCY_TYPE, registration, INVOICE_ID,
                                transferGroup, AppConstants.registration, PAYMENT_TYPE);
                            transArr.push(...trans);

                            console.log("Registration Invoice Payment Successfully" + registrationUniqueKey);
                        }
                        
                        console.log("transArr" + JSON.stringify(transArr));

                        await this.createTransactions(transArr, registration, paidBy);
                        console.log("Registration Transaction inserted Successfully" + registrationUniqueKey);
                        await this.performHardshipUpdate(registrationProduct, registration);
                        console.log("Registration Hardship Update Successfully" + registrationUniqueKey);
                        await this.createTeamTransactions(registration,INVOICE_ID);
                        console.log("Registration Team Transactions Successfully" + registrationUniqueKey);
                        await this.createInstalmentTransactions(registration,null, 14, INVOICE_ID, paidBy);
                        console.log("Registration Instalment Transactions Successfully" + registrationUniqueKey);
                        await this.performShopPayment(paymentIntent,registration, registrationProduct,
                            INVOICE_ID, AppConstants.directDebit);
                        console.log("Registration performShopPayment  Successfully" + registrationUniqueKey);
                        await this.registrationMail(registration, registrationProduct, 1, INVOICE_ID)
                        console.log("Registration Mail  Successfully" + registrationUniqueKey);
                     
                    }
                    else {
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
    
                    }
                }
                else {
                    logger.error(`"cannot get invoice details, an error occured ${registrationUniqueKey}`);
                }
            }
        } catch (error) {
            logger.error(`Exception occurred in RegistrationReprocess ${error}`);
            return response.status(500).send({
                message: process.env.NODE_ENV == AppConstants.development ? AppConstants.errMessage + error : AppConstants.errMessage
            });
        }
    }

    private async getIntentObject(chargeId: string) {
        const paymentIntent = await stripe.paymentIntents.retrieve(
            chargeId
        );

        return paymentIntent;
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

                                if(objectIsNotEmpty(membershipData)){
                                    let mOrgData = await this.organisationService.findOrganisationByUniqueKey(membershipData.organisationId);
                                    let mStripeAccountId = null;
                                    if(isArrayPopulated(mOrgData)){
                                        mStripeAccountId = mOrgData[0].stripeAccountID;
                                        membershipData["organisationAccountId"] = mStripeAccountId;
                                    }
                                    if ( mStripeAccountId === null) {
                                        obj.membershipStripeAccountIdError = true;
                                        obj.membershipOrganisationName = membershipData['name'];
                                        break;
                                    }
                                }

                                if(objectIsNotEmpty(compOrgData)){
                                    let cOrgData = await this.organisationService.findOrganisationByUniqueKey(compOrgData.organisationId);
                                    let cStripeAccountId = null;
                                    if(isArrayPopulated(cOrgData)){
                                        cStripeAccountId = cOrgData[0].stripeAccountID;
                                        compOrgData["organisationAccountId"] = cStripeAccountId;
                                    }

                                    if (cStripeAccountId === null) {
                                        obj.competitionStripeAccountIdError = true;
                                        obj.competitionOrganisationName = compOrgData['name'];
                                        break;
                                    }
                                }

                                if(objectIsNotEmpty(affiliateData)){
                                    let aOrgData = await this.organisationService.findOrganisationByUniqueKey(affiliateData.organisationId);
                                    let aStripeAccountId = null;
                                    if(isArrayPopulated(aOrgData)){
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

    async saveRegistrationInfo(registrationRes, registrationProduct) {
        try {

            let iAmRegisteringMyself = 0;
            let userId = registrationRes.createdBy;
            let registrationData = await this.userRegistrationDraftService.findByRegistrationId(registrationRes.id);
            let requestBody = {
                userRegistrations: []
            };

            if (isArrayPopulated(registrationData)) {
                for(let data of registrationData){
                    if(isNotNullAndUndefined(data.participantData)){
                        data.participantData["participantId"] = data.userRegUniqueKey;
                        requestBody.userRegistrations.push(data.participantData) ;
                    }
                }

                let getDeletedProducts = await this.orgRegistrationParticipantDraftService.getDeletedProducts(registrationRes.id);
                getDeletedProducts = getDeletedProducts != null ? getDeletedProducts : [];

                let volunteerInfo  = registrationProduct.volunteerInfo;
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
                    if(isNotNullAndUndefined(userReg)){
                        if (userReg.registeringYourself == 1) {
                            iAmRegisteringMyself = 1;
                        }

                        if (userReg.registeringYourself == 4) {
                            let userRegDraftRes = await this.userRegistrationDraftService.findByUniqueKey(userReg.participantId);

                            let competitionId = await this.competitionRegService.findByUniquekey(userReg.competitionId);
                            let organisationId = await this.organisationService.findByUniquekey(userReg.organisationId);
                            let orgRegistrationId = await this.orgRegistrationService.findOrgRegId(competitionId, organisationId);
                            isTeamRegAvailable = true;
                            //  let userDb = await this.user1Service.findUserByTemplate(userReg.team.email.toLowerCase(), userReg.team.firstName, userReg.team.lastName, userReg.team.mobileNumber)
                            let orgParticipant = registrationProduct.compParticipants.find( x => x.isTeamRegistration == 1 && x.email.toLowerCase() == userReg.email.toLowerCase()
                            && x.competitionUniqueKey == userReg.competitionId && x.organisationUniqueKey == userReg.organisationId)
                            let userDb = await this.userService.findByEmail(userReg.email.toLowerCase())
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
                            user.emergencyLastName= userReg.emergencyLastName;
                            user.emergencyContactNumber = userReg.emergencyContactNumber;
                            user.emergencyContactRelationshipId = userReg.emergencyContactRelationshipId;
                            if(userDb) {
                                user.updatedBy = userId;
                                user.updatedOn = new Date();
                            }
                            else {
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
                                    let userParentDb = null;
                                    if(pg.userId == 0){
                                        userParentDb = await this.userService.findByEmail(pg.email.toLowerCase())
                                    }
                                    else{
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
                                        //await this.updateFirebaseData(parentOrGuardianUser, userPG.password);
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
                                    }
                                    else {
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

                            let teamId = await this.createTeam(userReg.teamName, competitionId, organisationId, compDivisionDb.id, userReg.competitionMembershipProductDivisionId, userRes.id)
                           
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
                            userRegister.otherSportsInfo = (userReg.additionalInfo.otherSportsInfo ? JSON.stringify(userReg.additionalInfo.otherSportsInfo) : null );
                            userRegister.volunteerInfo = (volunteerInfo ? JSON.stringify(volunteerInfo) : null);
                            userRegister.walkingNetball = (userReg.additionalInfo.walkingNetball ? JSON.stringify(userReg.additionalInfo.walkingNetball) : null);
                            userRegister.walkingNetballInfo = userReg.additionalInfo.walkingNetballInfo;
                            userRegister.countryRefId = userReg.countryRefId;
                            if(userRegDraftRes != undefined)
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
                                orpt.paymentOptionRefId = (orgParticipant && orgParticipant.selectedOptions) ?  orgParticipant.selectedOptions.paymentOptionRefId : 0;
                                orpt.voucherCode = (orgParticipant && orgParticipant.selectedOptions && isArrayPopulated(orgParticipant.selectedOptions.selectedGovernmentVouchers))?
                                                            orgParticipant.selectedOptions.selectedGovernmentVouchers.find(x => x).voucherCode : null;
                                orpt.createdBy = userId;
                                await this.orgRegistrationParticipantService.createOrUpdate(orpt);
                            }

                            let roleTempId;
                            switch (userReg.personRoleRefId) {
                                case 1: roleTempId = 21;
                                    break;

                                case 2: roleTempId = 17;
                                    break;

                                case 3: roleTempId = 3;
                                    break;

                                default: roleTempId = 18;
                            }
                            await this.createTeamUre(userRes.id, competitionId, userId, roleTempId)

                            let playerArr = []

                            //Coach
                            if (userReg.personRoleRefId == 2 || userReg.personRoleRefId == 3) {
                                let nonPlayerDb = await this.nonPlayerService.findExistingNonPlayer(userRes.id, competitionId, organisationId, userReg.competitionMembershipProductTypeId)
                                // let coachProductType =  await this.competitionMembershipProductTypeService.findcouchProductType()
                                let productType = null;
                                if(userReg.personRoleRefId == 2 )
                                    productType = userReg.membershipProducts.find(x => x.name == "Coach");
                                else
                                    productType = userReg.membershipProducts.find(x => x.competitionMembershipProductTypeId == userReg.competitionMembershipProductTypeId);

                                if (isNotNullAndUndefined(productType)) {
                                    let nonPlayer = new NonPlayer();
                                    nonPlayer.id =  0;//nonPlayerDb != undefined ? nonPlayerDb.id : 0;
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
                                    playerObj.competitionDivisionId = compDivisionDb != null ? compDivisionDb.id : null;
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
                                        playerObj.competitionDivisionId = compDivisionDb != null ? compDivisionDb.id : null;
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

                                            //let userDb1 = await this.userService.findUserByUniqueFields(p.email.toLowerCase(), p.firstName, p.lastName, p.mobileNumber);
                                            let userDb1 = await this.userService.findByEmail(p.email.toLowerCase())

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
                                            user.emergencyLastName= p.emergencyLastName;
                                            user.emergencyContactNumber = p.emergencyContactNumber;
                                            user.emergencyContactRelationshipId = p.emergencyContactRelationshipId;
                                            let password = Math.random().toString(36).slice(-8);
                                            if (userDb1 == undefined) {
                                                user.createdBy = userRes.id;
                                                //user.password = md5(password);
                                            }
                                            let userRes1 = await this.userService.createOrUpdate(user);
                                            if (userDb1 == undefined) {
                                                await this.updateFirebaseData(userRes1, user.password);
                                            }

                                            if (isArrayPopulated(p.parentOrGuardian)) {
                                                for (let pg of p.parentOrGuardian) {
                                                    let userParentDb = null;
                                                    if(pg.userId == 0){
                                                        userParentDb = await this.userService.findByEmail(pg.email.toLowerCase())
                                                    }
                                                    else{
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
                                                        //await this.updateFirebaseData(parentOrGuardianUser, userPG.password);
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
                                                    }
                                                    else {
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
                                                orpt.paymentOptionRefId = (orgParticipant && orgParticipant.selectedOptions ) ? orgParticipant.selectedOptions.paymentOptionRefId : 0;
                                                orpt.voucherCode = (orgParticipant && orgParticipant.selectedOptions && isArrayPopulated(orgParticipant.selectedOptions.selectedGovernmentVouchers))?
                                                            orgParticipant.selectedOptions.selectedGovernmentVouchers.find(x => x).voucherCode : null;
                                                orpt.createdBy = userId;
                                                await this.orgRegistrationParticipantService.createOrUpdate(orpt);
                                            }
                                            let selectedProducts = p.membershipProductTypes.filter( x => x.isChecked == 1);
                                            if(isArrayPopulated(selectedProducts)){
                                                for(let sp of selectedProducts){
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

                                                    }
                                                    else {
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
                                                       if(sp.productTypeName == AppConstants.coach){
                                                            roleId =  AppConstants.coachRoleId
                                                       }
                                                       else if(sp.productTypeName == AppConstants.umpire){
                                                        roleId =  AppConstants.umpireRoleId
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
                        }
                        else {
                            isParticipantAvailable = true;
                            let userFromDb = await this.userService.findById(userReg.userId);
                            let userAge = (Math.floor((Date.now() - new Date(userReg.dateOfBirth).getTime()) / 3.15576e+10))
                            let participantEmail = '';

                            if (userReg.referParentEmail == true) {
                                if(isArrayPopulated(userReg.tempParents)){
                                    let parentEmail = userReg.tempParents[0];
                                    // let parentUserId = parentOrGuardianMap.get(tempParentId);
                                    // let parentUser = await this.userService.findById(parentUserId);
                                    participantEmail = parentEmail.toLowerCase() + '.' + userReg.firstName.toLowerCase();
                                }
                                else{
                                    let parent = userReg.parentOrGuardian[0]
                                    participantEmail = parent.email.toLowerCase() + '.' + userReg.firstName.toLowerCase();
                                }
                            }
                            else {
                                participantEmail = userReg.email.toLowerCase();
                            }

                            let user = new User();
                            let userDb = await this.userService.findByEmail(userReg.email.toLowerCase())
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
                            user.emergencyLastName= userReg.emergencyLastName;
                            user.emergencyContactNumber = userReg.emergencyContactNumber;
                            user.emergencyContactRelationshipId = userReg.emergencyContactRelationshipId;
                            user.statusRefId = userReg.referParentEmail == true ? 0 : 1;
                            user.isInActive = userReg.referParentEmail == true ? 1 : 0;
                            user.accreditationLevelUmpireRefId = userReg.additionalInfo.accreditationLevelUmpireRefId;
                            user.accreditationUmpireExpiryDate = userReg.additionalInfo.accreditationUmpireExpiryDate;
                            user.associationLevelInfo = userReg.additionalInfo.associationLevelInfo;
                            user.accreditationLevelCoachRefId = userReg.additionalInfo.accreditationLevelCoachRefId;
                            user.accreditationCoachExpiryDate = userReg.additionalInfo.accreditationCoachExpiryDate;
                            user.isPrerequestTrainingComplete = userReg.additionalInfo.isPrerequestTrainingComplete;

                            let password = Math.random().toString(36).slice(-8);
                            if (!isNullOrUndefined(userDb)) {
                                user.createdBy = userId;
                                //user.password = md5(AppConstants.password);
                            } else {
                                user.updatedBy = userId;
                                user.updatedOn = new Date();
                            }

                            let userRes = await this.userService.createOrUpdate(user);

                            if (userFromDb != undefined) {
                                if (userFromDb.email !== participantEmail.toLowerCase()) {
                                    await this.updateFirebaseData(userRes, userFromDb.password);
                                }
                            }

                            i++;

                            if (isArrayPopulated(userReg.parentOrGuardian)) {
                                for (let pg of userReg.parentOrGuardian) {
                                    let userParentDb = null;
                                    if(pg.userId == 0){
                                        userParentDb = await this.userService.findByEmail(pg.email.toLowerCase())
                                    }
                                    else{
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
                                        //await this.updateFirebaseData(parentOrGuardianUser, userPG.password);
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
                                    }
                                    else {
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
                            userRegister.otherSportsInfo = (userReg.additionalInfo.otherSportsInfo ? JSON.stringify(userReg.additionalInfo.otherSportsInfo) : null );
                            userRegister.volunteerInfo = (volunteerInfo ? JSON.stringify(volunteerInfo) : null);
                            userRegister.walkingNetball = (userReg.additionalInfo.walkingNetball ? JSON.stringify(userReg.additionalInfo.walkingNetball) : null);
                            userRegister.walkingNetballInfo = userReg.additionalInfo.walkingNetballInfo;

                            userRegister.countryRefId = userReg.additionalInfo.countryRefId;

                           // if (userReg.userRegistrationId == 0 || userReg.userRegistrationId == "") {
                                userRegister.createdBy = userId;
                           // }
                            let UserRegistrationRes = await this.userRegistrationService.createOrUpdate(userRegister);
                            if(isArrayPopulated(userReg.competitions)){
                                for(let comp of userReg.competitions){
                                    let orgParticipant = registrationProduct.compParticipants.find( x => (x.isTeamRegistration == 0 || x.isTeamRegistration == null ) && x.email.toLowerCase() == userReg.email.toLowerCase()
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
                                        orpt.voucherCode = (orgParticipant && orgParticipant.selectedOptions && isArrayPopulated(orgParticipant.selectedOptions.selectedGovernmentVouchers))?
                                                            orgParticipant.selectedOptions.selectedGovernmentVouchers.find(x => x).voucherCode : null;
                                        orpt.createdBy = userId;
                                        orpt.tShirtSizeRefId = comp.tShirtSizeRefId ? comp.tShirtSizeRefId : null;
                                        await this.orgRegistrationParticipantService.createOrUpdate(orpt);
                                    }
                                    if(isArrayPopulated(comp.divisions)){
                                        for(let div of comp.divisions){
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
                                            player.competitionDivisionId = compDivisionDb != null ? compDivisionDb.id : null;
                                            player.competitionMembershipProductDivisionId = div.competitionMembershipProductDivisionId;
                                            player.competitionMembershipProductTypeId = div.competitionMembershipProductTypeId;
                                            player.positionId1 = comp.positionId1;
                                            player.positionId2 = comp.positionId2;
                                            //if (userReg.playerId == 0 || userReg.playerId == "") {
                                                player.createdBy = userId;
                                            //}
                                            let ureplayerDb = await this.ureService.findExisting(userRes.id, competitionId, 1, 18)
                                            let ureplayer = new UserRoleEntity();
                                            if (ureplayerDb) {
                                                ureplayer.id = ureplayerDb.id;
                                                ureplayer.updatedBy = userId;
                                                ureplayer.updatedAt = new Date();
                                            }
                                            else {
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
                                                        friend.email = friendBody.email? friendBody.email.toLowerCase(): null;
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
                                                        friend.email = friendBody.email? friendBody.email.toLowerCase(): null;
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
                                    if(isArrayPopulated(comp.products)){
                                        for(let product of comp.products){
                                            if(product.isPlayer != 1){
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
                                                //if (userReg.playerId == 0 || userReg.playerId == "") {
                                                    nonPlayer.createdBy = userId;
                                                //}

                                                let roleId = await this.findRoleId(product)
                                                let ureplayerDb = await this.ureService.findExisting(userRes.id, competitionId, 1, roleId)
                                                let ureplayer = new UserRoleEntity();
                                                if (ureplayerDb) {
                                                    ureplayer.id = ureplayerDb.id;
                                                    ureplayer.updatedBy = userId;
                                                    ureplayer.updatedAt = new Date();
                                                }
                                                else {
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
                        }
                        else {
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
            logger.error(` ERROR occurred in registration save `+error)
            throw error;
        }
    }

    async performInvoicePayment(registrationData, paymentIntent, currencyType, registration, invoiceId,
        transferGroup, registrationMode, paymentType) {
        try {
            logger.info(`Inside the performInvoicePayment ${JSON.stringify(paymentIntent)}`);
            let stateOrgData = null;
            let transArr = [];
            let otherParticipants = [];
            let statusRefId = this.getTransactionStatus();

            (registrationData.compParticipants.map((item) => {
                if ((item.selectedOptions.paymentOptionRefId != 5 ||
                        (item.selectedOptions.paymentOptionRefId == 5 && item.selectedOptions.isSchoolRegCodeApplied == 0)) &&
                        item.selectedOptions.isHardshipCodeApplied == 0 ) {
                    //otherParticipants.push(item);
                    item["canPerformTransaction"] = 1;
                }
                else{
                    item["canPerformTransaction"] = 0;
                    statusRefId = AppConstants.NOT_PAID;
                }
                if(!paymentIntent){
                    item["canPerformTransaction"] = 0;
                }
                otherParticipants.push(item);
            }));

            for (let item of otherParticipants) {
                let transObj = null;
                let playerName = null;
                let registeringPerson = null;
                if(item.isTeamRegistration == null || item.isTeamRegistration == 0){
                    transObj =  JSON.parse(JSON.stringify(this.getTransObj()));
                    registeringPerson = formatPersonName(item.firstName, null, item.lastName);
                }


                let paymentOptionRefId = item.selectedOptions.paymentOptionRefId;
                let paymentFeeTypeRefId = this.getPaymentFeeTypeRefId(paymentOptionRefId, item.isTeamRegistration);
                if (isArrayPopulated(item.membershipProducts)) {
                    for (let mem of item.membershipProducts) {
                        if(item.isTeamRegistration == 1){
                            transObj = JSON.parse(JSON.stringify(this.getTransObj()));
                            playerName = formatPersonName(mem.firstName, null, mem.lastName);
                            registeringPerson = formatPersonName(item.firstName, null, item.lastName);
                        }
                        const membershipData = isNotNullAndUndefined(mem.fees.membershipFee) ? mem.fees.membershipFee : Object.assign({});
                        const compOrgData = isNotNullAndUndefined(mem.fees.competitionOrganisorFee) ? mem.fees.competitionOrganisorFee : Object.assign({});
                        const affiliateData = isNotNullAndUndefined(mem.fees.affiliateFee) ? mem.fees.affiliateFee : Object.assign({});
                        let description = null;
                        const competitionOrganiserOrganisationName_: string = compOrgData['name'];
                        //const playerName_: string = formatPersonName(item.firstName, null, item.lastName);
                        const competitionId_ = await this.competitionRegService.findByUniquekey(item.competitionUniqueKey);

                        const membershipProductTypeName_ = mem.membershipTypeName;
                        const membershipMappingId_ = mem.membershipMappingId;
                        let compDivisionDb = await this.competitionDivisionService.findBycmpd(mem.divisionId)
                        const divisionId_ = compDivisionDb!= undefined ? compDivisionDb.id : 0;
                        transObj.firstName = mem.firstName;
                        transObj.lastName = mem.lastName;
                        transObj.mobileNumber = mem.mobileNumber;
                        transObj.email = mem.email;
                            if(item.isTeamRegistration && item.email!= mem.email) {
                                description = `${registeringPerson} -  ${membershipProductTypeName_} - ${playerName}`;
                            }
                            else {
                                description = `${registeringPerson} - ${membershipProductTypeName_}`;
                            }

                        if(objectIsNotEmpty(membershipData)){
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

                            const membershipOrganisationId_ = await this.organisationService.findByUniquekey(membershipData.organisationId);


                            // let userDb = await this.userService.findUserByUniqueFields(item.email, item.firstName, item.lastName, item.mobileNumber);
                            // const participantId_ = isNotNullAndUndefined(userDb) ? userDb.id : 0;

                            stateOrgData = membershipData;

                            // transfer for membershipFees
                            console.log('going to pay a total of ' + membershipProductTypeTotalAmount_ + ' for ' + membershipProductTypeName_ + ' to ' + membershipProductOrganisationName_ + ' as membershipFee')

                            //console.log("paymentIntent.id::" + paymentIntent.id + "@@@" + paymentIntent.charges.data.length);
                            if (STRIPE_MEMBERSHIP_TOTAL_FEE >= 1) {
                                let transferForMembershipFee = null;
                                if(item.canPerformTransaction ){
                                    if(transferGroup!= null){
                                        transferForMembershipFee = await stripe.transfers.create({
                                            amount: STRIPE_MEMBERSHIP_TOTAL_FEE,
                                            currency: currencyType,
                                            description: `${description} - ${membershipProductOrganisationName_} - MEMBERSHIP FEE`,
                                            source_transaction: paymentIntent.charges.data.length > 0 ? paymentIntent.charges.data[0].id : paymentIntent.id,
                                            destination: membershipOrganisationAccountId_,
                                            transfer_group: transferGroup
                                        });
                                    }
                                    else{
                                        transferForMembershipFee = await stripe.transfers.create({
                                            amount: STRIPE_MEMBERSHIP_TOTAL_FEE,
                                            currency: currencyType,
                                            description: `${description} - ${membershipProductOrganisationName_} - MEMBERSHIP FEE`,
                                            source_transaction: paymentIntent.charges.data.length > 0 ? paymentIntent.charges.data[0].id : paymentIntent.id,
                                            destination: membershipOrganisationAccountId_
                                        });
                                    }
                                }

                                console.log('transferForMembershipFee :::: ', transferForMembershipFee);

                                let transactionId = this.getTransactionId(registrationMode,membershipData.transactionId);

                                let trxnMembership = this.getTransactionObj(invoiceId, registration.createdBy, membershipProductTypeFeeAmount_,
                                    membershipProductTypeGstAmount_,membershipProductTypeDiscountAmount_,membershipProductFamilyDiscountAmount_,AppConstants.membership,
                                    membershipMappingId_,competitionId_,membershipOrganisationId_, paymentOptionRefId, paymentFeeTypeRefId,
                                    divisionId_, membershipProductGVAmount_,transferForMembershipFee, transactionId, statusRefId);

                                console.log("transObj" + JSON.stringify(trxnMembership));

                                transObj.transactions.push(trxnMembership);
                            }
                        }

                        if(objectIsNotEmpty(compOrgData)){
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
                            const STRIPE_COMPETITION_TOTAL_FEE = formatFeeForStripe1(competitionTotalAmount_);

                            const cOrganisationAccountId_: string = compOrgData.organisationAccountId;
                            const cOrganisationId_: number = await this.organisationService.findByUniquekey(compOrgData.organisationId);

                            console.log('going to pay a total of ' + competitionTotalAmount_  + ' to ' + competitionOrganiserOrganisationName_ + ' as Competition Fee')

                            // transfer to association for organiser fees
                            if (STRIPE_COMPETITION_TOTAL_FEE >= 1) {
                                let transferForCompetitionOrganiser = null;
                                if(item.canPerformTransaction){
                                    if(transferGroup != null){
                                        transferForCompetitionOrganiser = await stripe.transfers.create({
                                            amount: STRIPE_COMPETITION_TOTAL_FEE,
                                            currency: currencyType,
                                            description: `${description} - ${competitionOrganiserOrganisationName_} - COMPETITION FEE`,
                                            destination: cOrganisationAccountId_,
                                            source_transaction: paymentIntent.charges.data.length > 0 ? paymentIntent.charges.data[0].id : paymentIntent.id,
                                            transfer_group: transferGroup
                                        });
                                    }
                                    else{
                                        transferForCompetitionOrganiser = await stripe.transfers.create({
                                            amount: STRIPE_COMPETITION_TOTAL_FEE,
                                            currency: currencyType,
                                            description: `${description} - ${competitionOrganiserOrganisationName_} - COMPETITION FEE`,
                                            destination: cOrganisationAccountId_,
                                            source_transaction: paymentIntent.charges.data.length > 0 ? paymentIntent.charges.data[0].id : paymentIntent.id,
                                        });
                                    }
                                }

                                console.log('transferForCompetitionOrganiser :::: ', transferForCompetitionOrganiser)

                                let transactionId = this.getTransactionId(registrationMode,compOrgData.transactionId);

                                let trxnCompetition = this.getTransactionObj(invoiceId, registration.createdBy, competitionFeeAmount_,
                                    competitionGstAmount_,competitionDiscountAmount_,competitionFamilyDiscountAmount_,AppConstants.competition,
                                    membershipMappingId_,competitionId_,cOrganisationId_, paymentOptionRefId, paymentFeeTypeRefId,
                                    divisionId_, competitionGVAmount_,transferForCompetitionOrganiser, transactionId, statusRefId);

                                transObj.transactions.push(trxnCompetition);
                            }

                            if(!isNullOrZero(competitionNominationFeeAmount_) || !isNullOrZero(competitionNominationGstAmount_))
                            {
                                const nominationTotalAmount_: number = competitionNominationFeeAmount_ +
                                                competitionNominationGstAmount_ - nominationGVAmount_;
                                const STRIPE_NOMINATION_TOTAL_FEE = formatFeeForStripe1(nominationTotalAmount_);

                                if (STRIPE_NOMINATION_TOTAL_FEE >= 1) {
                                    let transferForCompetitionOrganiser = null;
                                    if(item.canPerformTransaction){
                                        if(transferGroup != null){
                                            transferForCompetitionOrganiser = await stripe.transfers.create({
                                                amount: STRIPE_NOMINATION_TOTAL_FEE,
                                                currency: currencyType,
                                                description: `${description} - ${competitionOrganiserOrganisationName_} - NOMINATION FEE`,
                                                destination: cOrganisationAccountId_,
                                                source_transaction: paymentIntent.charges.data.length > 0 ? paymentIntent.charges.data[0].id : paymentIntent.id,
                                                transfer_group: transferGroup
                                            });
                                        }
                                        else{
                                            transferForCompetitionOrganiser = await stripe.transfers.create({
                                                amount: STRIPE_NOMINATION_TOTAL_FEE,
                                                currency: currencyType,
                                                description: `${description} - ${competitionOrganiserOrganisationName_} - NOMINATION FEE`,
                                                destination: cOrganisationAccountId_,
                                                source_transaction: paymentIntent.charges.data.length > 0 ? paymentIntent.charges.data[0].id : paymentIntent.id,
                                            });
                                        }
                                    }

                                    console.log('transferForCompetitionOrganiser Nomination :::: ', transferForCompetitionOrganiser)
                                    let transactionId = this.getTransactionId(registrationMode,compOrgData.nominationTransId);

                                    let trxnNomination = this.getTransactionObj(invoiceId, registration.createdBy, competitionNominationFeeAmount_,
                                        competitionNominationGstAmount_,0,0,AppConstants.nomination,
                                        membershipMappingId_,competitionId_,cOrganisationId_, paymentOptionRefId, paymentFeeTypeRefId,
                                        divisionId_, nominationGVAmount_,transferForCompetitionOrganiser, transactionId, statusRefId);

                                    transObj.transactions.push(trxnNomination);
                                }

                            }
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

                            const STRIPE_AFFILIATE_TOTAL_AMOUNT = formatFeeForStripe1(affiliateTotalAmount_);

                            let aOrganisationId_: number = await this.organisationService.findByUniquekey(affiliateData.organisationId);
                            let aOrganisationAccountId_: string = affiliateData.organisationAccountId;
                            const affiliateOrganisationName_: string = affiliateData.name;

                            console.log('going to pay a total of ' + affiliateTotalAmount_ + ' for ' + membershipProductTypeName_ + ' to ' + affiliateOrganisationName_ + ' as Affiliate Fee')

                            // transfer for affiliateFees
                            if (STRIPE_AFFILIATE_TOTAL_AMOUNT >= 1) {
                                let transferForAffiliateFee = null;
                                if(item.canPerformTransaction){
                                    if(transferGroup!= null){
                                        transferForAffiliateFee = await stripe.transfers.create({
                                            amount: STRIPE_AFFILIATE_TOTAL_AMOUNT,
                                            description: `${description} - ${affiliateOrganisationName_} - AFFILIATE FEE`,
                                            currency: currencyType,
                                            destination: aOrganisationAccountId_,
                                            source_transaction: paymentIntent.charges.data.length > 0 ? paymentIntent.charges.data[0].id : paymentIntent.id,
                                            transfer_group: transferGroup
                                        });
                                    }
                                    else{
                                        transferForAffiliateFee = await stripe.transfers.create({
                                            amount: STRIPE_AFFILIATE_TOTAL_AMOUNT,
                                            description: `${description} - ${affiliateOrganisationName_} - AFFILIATE FEE`,
                                            currency: currencyType,
                                            destination: aOrganisationAccountId_,
                                            source_transaction: paymentIntent.charges.data.length > 0 ? paymentIntent.charges.data[0].id : paymentIntent.id,
                                        });
                                    }
                                }

                                console.log('transferForAffiliateFee :::: ', transferForAffiliateFee);
                                let transactionId = this.getTransactionId(registrationMode,affiliateData.transactionId);

                                let trxnAffiliate = this.getTransactionObj(invoiceId, registration.createdBy, affiliateFeeAmount_,
                                    affiliateGstAmount_,affiliateDiscountAmount_,affiliateFamilyDiscountAmount_,AppConstants.affiliate,
                                    membershipMappingId_,competitionId_,aOrganisationId_, paymentOptionRefId, paymentFeeTypeRefId,
                                    divisionId_, affiliateGVAmount_,transferForAffiliateFee, transactionId, statusRefId);

                                transObj.transactions.push(trxnAffiliate);
                                //await this.transactionService.createOrUpdate(trxnAffiliate);
                            }

                            if(!isNullOrZero(affiliateNominationFeeAmount_) || !isNullOrZero(affiliateNominationGstAmount_))
                            {
                                const nominationTotalAmount_: number = affiliateNominationFeeAmount_ +
                                affiliateNominationGstAmount_ - nominationGVAmount_;
                                const STRIPE_NOMINATION_TOTAL_FEE = formatFeeForStripe1(nominationTotalAmount_);
                                if (STRIPE_NOMINATION_TOTAL_FEE >= 1) {
                                    let transferForAffiliateFee = null;
                                    if(item.canPerformTransaction){
                                        if(transferGroup != null){
                                            transferForAffiliateFee = await stripe.transfers.create({
                                                amount: STRIPE_NOMINATION_TOTAL_FEE,
                                                currency: currencyType,
                                                description: `${description} - ${affiliateOrganisationName_} - NOMINATION FEE`,
                                                destination: aOrganisationAccountId_,
                                                source_transaction: paymentIntent.charges.data.length > 0 ? paymentIntent.charges.data[0].id : paymentIntent.id,
                                                transfer_group: transferGroup
                                            });
                                        }
                                        else{
                                            transferForAffiliateFee = await stripe.transfers.create({
                                                amount: STRIPE_NOMINATION_TOTAL_FEE,
                                                currency: currencyType,
                                                description: `${description} - ${affiliateOrganisationName_} - NOMINATION FEE`,
                                                destination: aOrganisationAccountId_,
                                                source_transaction: paymentIntent.charges.data.length > 0 ? paymentIntent.charges.data[0].id : paymentIntent.id,
                                            });
                                        }
                                    }

                                    console.log('transferForAffiliateFee Nomination :::: ', transferForAffiliateFee)
                                    let transactionId = this.getTransactionId(registrationMode,affiliateData.nominationTransId);

                                    let trxnNomination = this.getTransactionObj(invoiceId, registration.createdBy, affiliateNominationFeeAmount_,
                                        affiliateNominationGstAmount_,0,0,AppConstants.nomination,
                                        membershipMappingId_,competitionId_,aOrganisationId_, paymentOptionRefId, paymentFeeTypeRefId,
                                        divisionId_, nominationGVAmount_, transferForAffiliateFee, transactionId, statusRefId);

                                    transObj.transactions.push(trxnNomination);
                                }
                            }

                        }
                        if(item.isTeamRegistration == 1)
                        transArr.push(transObj);
                    }
                }

                if(item.isTeamRegistration == null || item.isTeamRegistration == 0)
                    transArr.push(transObj);
            }

            /// Charity amount for State Organisation
            let stateOrgId = null;
            if(isNotNullAndUndefined(stateOrgData)){
                stateOrgId = stateOrgData.organisationId;
            }
            else {
                stateOrgId = registrationData.stateOrgId;
            }
            if (isNotNullAndUndefined(stateOrgId)) {
                if (isNotNullAndUndefined(registrationData.charity)) {
                    if (registrationData.charityRoundUpRefId > 0) {
                        let charity = registrationData.charity;
                        const charityValue = feeIsNull(registrationData.total.charityValue);
                        let STRIPE_CHARITY_TOTAL_AMOUNT = formatFeeForStripe1(charityValue);
                        const CHARITY_TITLE = charity.name;
                        let organisation = await this.organisationService.findOrganisationByUniqueKey(stateOrgId);
                        const organisationName_: string = `${organisation[0].name}`;
                        const organisationAccountId_: string = organisation[0].stripeAccountID;
                        const organisationId_: number = await this.organisationService.findByUniquekey(stateOrgId);

                        if (STRIPE_CHARITY_TOTAL_AMOUNT >= 1) {
                            let transferForCharitySelected = null;
                            if(paymentIntent){
                                if(transferGroup!= null){
                                    transferForCharitySelected = await stripe.transfers.create({
                                        amount: STRIPE_CHARITY_TOTAL_AMOUNT,
                                        currency: currencyType,
                                        description: `${organisationName_}  - CHARITY-${CHARITY_TITLE}`,
                                        destination: organisationAccountId_,
                                        source_transaction: paymentIntent.charges.data.length > 0 ? paymentIntent.charges.data[0].id : paymentIntent.id,
                                        transfer_group: transferGroup
                                    });
                                }
                                else{
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
                                0,0,0,AppConstants.charity,
                                0,0,organisationId_, null, null, null, 0, transferForCharitySelected, 0, statusRefId);
                            await this.transactionService.createOrUpdate(trxnCharity);
                        }
                    }
                }
            }

            return transArr;

        } catch (error) {
            logger.error(`Exception in Invoice Payment ${error}`);
            throw error;
        }
    }

    async saveYoursInfo(userObj, registration, source = undefined) {
        try{
            logger.info(`--- UserObj -userId = ${userObj.userId}`)

             let userDb = await this.userService.findByEmail(userObj.email.toLowerCase())

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
            let userRes = await this.userService.createOrUpdate(user);
            if (userDb != undefined) {
                if (userDb.email !== userObj.email.toLowerCase()) {
                    await this.updateFirebaseData(userRes, userDb.password);
                }
            }
            else {
                let user1 = new User();
                user1.id = userRes.id;
                user1.createdBy = userRes.id;
                await this.userService.createOrUpdate(user1);
            }
            userObj['id'] = userRes.id;
            if(source == AppConstants.singleGame){
                registration.updatedBy = userRes.id;
            }
            else{
                registration.createdBy = userRes.id;
            }

            await this.registrationService.createOrUpdate(registration);

            return userRes;
        }
        catch(error){
            logger.error(`---###--- Error Occurred in Payment Controller Your info save ${error}`)
            throw error;
        }

    }

    private getTransactionStatus(){
        let statusRefId = AppConstants.PAID;
        return statusRefId;
    }

    private getTransObj(){
        let transObj = {
            firstName: null,
            lastName: null,
            email: null,
            mobileNumber: null,
            transactions: []
        }

        return transObj;
    }

    private getPaymentFeeTypeRefId(paymentOptionRefId, isTeamRegistration){
        if(paymentOptionRefId <=2 && (isTeamRegistration == null || isTeamRegistration == 0)){
            return AppConstants.CASUAL_FEE;
        }
        else{
            return AppConstants.SEASONAL_FEE;
        }
    }

    private getTransactionId(registrationMode, transactionId){
        if(registrationMode != AppConstants.registration){
            return transactionId;
        }
        else{
            return 0;
        }
    }

    private getTransactionObj(invoiceId, createdBy, fee, gst, discount, familyDiscount, feeType, membershipMappingId,
        competitionId, organisationId, paymentOptionRefId, paymentFeeTypeRefId, divisionId,
        gvrnmAmount, stripeTransaction, transactionId, statusRefId) {

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
        trxn.membershipProductMappingId = membershipMappingId;
        trxn.competitionId = competitionId;
        trxn.organisationId = organisationId;
        trxn.paymentOptionRefId = paymentOptionRefId
        trxn.paymentFeeTypeRefId = paymentFeeTypeRefId;
        trxn.divisionId = divisionId;
        trxn.governmentVoucherAmount = gvrnmAmount;
        trxn.statusRefId = statusRefId;
        trxn.stripeTransactionId = stripeTransaction ? stripeTransaction.id : null;

        return trxn;
    }

    async findRoleId(product: any) {
        try {
            let productTypeName = product.membershipTypeName;
            let roleId;
            if (productTypeName == AppConstants.coach) {
                roleId = AppConstants.coachRoleId;
            }
            else if (productTypeName == AppConstants.umpire) {
                roleId = AppConstants.umpireRoleId;
            }
            else {
                roleId = AppConstants.nonPlayerRoleId;
            }
            return roleId;
        }
        catch (error) {
            logger.error(`---###--- Error Occurred in  findRoleId ${error}`)
            throw error;
        }
    }

    async createTeam(teamName: string, competitionId: number, organisationId: number, competitionDivisionId: number, competitionMembershipProductDivisionId: number, userId: number) {
        try {
            let teamSortMax = await this.teamService.findMaxSortId(competitionDivisionId,
                organisationId);
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
            }
            else {
                team.sortorder = 1;
            }


            let teamRes = await this.teamService.createOrUpdate(team);

            return teamRes.id;
        }
        catch (error) {
            logger.error(`---###--- Error Occurred in Team save ${error}`)
            throw error;
        }
    }

    async createTeamUre(ureUserId: number, competitionId: number, userId: number, roleId: number) {
        try {
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
        } catch (error) {
            throw error;
        }
    }

    private async createTransactions(transArr, registration, paidBy) {
        console.log("Inside the createTransactions" + JSON.stringify(transArr));
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
                        //console.log("***********" + tran.paymentFeeTypeRefId)
                        if(tran.paymentFeeTypeRefId == AppConstants.SEASONAL_FEE && tran.feeType == AppConstants.membership){
                            let key = participantId_ + "#" + tran.competitionId + "#" + tran.membershipProductMappingId;
                            //console.log("key::" + key);
                            if(personMap.get(key) == undefined){
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

                        if(!tran.id){
                            tran.updatedBy = participantId_;
                            tran.updatedOn = new Date();
                        }
                        if(tran.invoiceId){
                            tran.paidBy = paidBy;
                        }
                        await this.transactionService.createOrUpdate(tran);
                    }
                }

                if(isArrayPopulated(expiryArr)){
                    console.log("expiryArr" + JSON.stringify(expiryArr));
                   await this.performExpiryValidation(expiryArr,registration);
                }
            }
        } catch (error) {
            throw error;
        }
    }

    private async performExpiryValidation(expiryArr, registration){
        try {
            console.log("expiryArr::" + JSON.stringify(expiryArr));
            let feeMap = new Map();
            for(let item of expiryArr){
                let expiryData = await this.userMembershipExpiryService.getExistingMembership(
                    item.participantId,item.membershipProductMappingId);
                let validityList = await this.membershipProductFeesService.getMembeshipFeeValidityDetails(
                    item.membershipProductMappingId, item.organisationId);

                let validityData = validityList ? validityList.find(x=>x) : null;
                let validityDays = validityData ? validityData.validityDays : 0;
                let extendDate = validityData ? validityData.extendEndDate : null;

                console.log("&&&&&&&&&&&&&&&&&&&&&validityDays" + JSON.stringify(validityDays));
                console.log("&&&&&&&&&&&&&&&&&&&&&extendDate" + JSON.stringify(extendDate));

                let expiryDateToCheck = await this.getExpiryDate(validityDays, extendDate, new Date(), 1);

                console.log("&&&&&&&&&&&&&&&&&&&&&expiryDateToCheck" + JSON.stringify(expiryDateToCheck));

                if(isArrayPopulated(expiryData)){
                    let compData = await this.competitionRegService.findById(item.competitionId);
                    let id = expiryData[0].id;
                    let existingExpiryDate = expiryData[0].expiryDate;
                    let amount = expiryData[0].amount;

                    if(moment(compData.endDate).isSameOrAfter(existingExpiryDate)){
                        console.log(`Membership Expired :: UserId::${item.participantId} :: Membership:: ${item.membershipProductMappingId} + "ExpiryDate" ${existingExpiryDate} + "ID::" ${id}`)
                        let expiryDateToCheck = await this.getExpiryDate(validityDays, extendDate,existingExpiryDate, 2);
                        let newExpiryDate = expiryDateToCheck ? expiryDateToCheck : moment(new Date());
                        console.log("$$$$$$$newExpiryDate $$$$" + JSON.stringify(newExpiryDate));
                        let updatedExpiryDate = newExpiryDate.format("YYYY-MM-DD");
                        console.log("$$$$$$$updatedExpiryDate $$$$" + JSON.stringify(updatedExpiryDate));
                        let newAmount = feeIsNull(amount) + feeIsNull(item.amount);
                        await this.insertIntoUserMembershipExpiry(existingExpiryDate, item,0, id, registration, amount);
                        await this.insertIntoUserMembershipExpiry(updatedExpiryDate, item,1, 0, registration, newAmount);
                    }
                    else{
                        let newAmount = feeIsNull(amount) + feeIsNull(item.amount);
                        console.log("$$$$$$$updatedExistingExpiry $$$$" + JSON.stringify(newAmount));
                        await this.insertIntoUserMembershipExpiry(existingExpiryDate, item, 1, id, registration, newAmount);
                    }
                }
                else{
                    // Insert Into User Mapping Expiry Data
                    //let expiryDate = moment().subtract(1,'days').add(1,'years');
                    let updatedExpiryDate = expiryDateToCheck ? expiryDateToCheck.format("YYYY-MM-DD") : moment(new Date()).format("YYYY-MM-DD");
                    console.log("First Expiry date::" + JSON.stringify(updatedExpiryDate));
                    await this.insertIntoUserMembershipExpiry(updatedExpiryDate, item,1, 0, registration, item.amount);
                }

            }
        } catch (error) {
            logger.error(`Exception occurred in performExpiryValidation ${error}`);
            throw error;
        }
    }

    private async getExpiryDate(validityDays, extendDate, fromDate, flag){
        try {
            let expiryDateToCheck = null;
            let expiryValidyDate = null;
            if(flag == 1){
                expiryValidyDate = moment(fromDate).subtract(1,'days').add(validityDays,'days');
            }
            else{
                expiryValidyDate = moment(fromDate).add(validityDays,'days');
            }

            console.log("expiryValidyDate" + JSON.stringify(expiryValidyDate) + "fromDate" + JSON.stringify(fromDate) +  "validityDays::" + validityDays + "extendDate" + JSON.stringify(extendDate));

            if(extendDate){
                if(validityDays == null || moment(extendDate).isAfter(expiryValidyDate)){
                    console.log("!!!!!!!!!!!!!!!!!!ExtendDate is After ExpiryDate")
                    expiryDateToCheck = moment(extendDate);
                }
                else{
                    console.log("!!!!!!!!!!!!!!!!!!ExtendDate is Before ExpiryDate")
                    expiryDateToCheck = expiryValidyDate;
                }
            }
            else{
                console.log("!!!!!!!!!!!!!!!!!!ExpiryDate is set based on validity days")
                expiryDateToCheck = expiryValidyDate;
            }
            return expiryDateToCheck;
        } catch (error) {
            throw error;
        }


    }

    private async insertIntoUserMembershipExpiry(expiryDate, item, isActive, id, registration, amount){
        try {
            let membership = new UserMembershipExpiry();
            membership.id = id;
            membership.expiryDate = expiryDate;
            membership.isActive = isActive;
            if(id != 0){
                membership.updatedBy = registration.createdBy;
                membership.updatedOn = new Date();
            }else{
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

    async performHardshipUpdate(registrationData, registration){
        try {
            for(let item of registrationData.compParticipants){
                if(item.selectedOptions.isHardshipCodeApplied == 1){
                    if(isArrayPopulated(item.selectedOptions.discountCodes)){
                        for(let discount of item.selectedOptions.discountCodes){
                            if(discount.isHardshipCode == 1){
                                let appliedTo = 0;
                                let userDb = await this.userService.findUserByUniqueFields(item.email.toLowerCase(), item.firstName, item.lastName, item.mobileNumber);
                                if(userDb){
                                    appliedTo = userDb.id;
                                }
                               await this.orgRegistrationHardshipCodeService.updateByCode(item.orgRegistrationId,
                                discount.discountCode, registration, appliedTo);
                            }
                        }
                    }
                }
            }

        } catch (error) {
            logger.error(`Exception occurred in performHardshipUpdate ${error}`);
        }
    }

    private async createTeamTransactions(registration, invoiceId){
        logger.info(`Inside createTeamTransactions :: ${registration.id}`);
        try {
            let trackData = await this.registrationTrackService.findByRegistrationId(registration.id,12);
            let transArr = [];
            if(isNotNullAndUndefined(trackData)){
                let jsonData = trackData.jsonData;
                if(isNotNullAndUndefined(jsonData)){
                    let transactions = jsonData;
                    console.log("Team Transaction ::" + JSON.stringify(transactions));
                    if(isArrayPopulated(transactions)){
                        for(let item of transactions){
                            let userDb = await this.userService.findUserByUniqueFields(item.email.toLowerCase(), item.firstName, item.lastName, item.mobileNumber);
                            let participantId_ = isNotNullAndUndefined(userDb) ? userDb.id : 0;
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
                            trxn.membershipProductMappingId = item.membershipProductMappingId;
                            trxn.competitionId = item.competitionId;
                            trxn.organisationId = item.organisationId;
                            trxn.divisionId = item.divisionId;
                            trxn.governmentVoucherAmount = item.governmentVoucherAmount;
                            trxn.paidBy = participantId_;
                            transArr.push(trxn);

                            if(trxn.feeType == "competition" || trxn.feeType == "affiliate"){
                                if(!isNullOrZero(item.nominationFee) || !isNullOrZero(item.nominationGST)){
                                    if(item.nominationFeeToPay){
                                        const trxn = new Transaction();
                                        trxn.id = 0;
                                        trxn.invoiceRefId = invoiceId;
                                        trxn.participantId = participantId_;
                                        trxn.createdBy = registration.createdBy;
                                        trxn.feeAmount = item.nominationFeeToPay;
                                        trxn.gstAmount = item.nominationGSTToPay;
                                        trxn.feeType = "nomination";
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

                    if(isArrayPopulated(transArr)){
                        await this.transactionService.batchCreateOrUpdate(transArr);
                    }
                }
            }
        } catch (error) {
            logger.error(`Exception occurred in createTeamTransactions ${error} `);
            throw error;
        }
    }

    private async createInstalmentTransactions(registration, userRegId, stepsId, invoiceId, paidBy){
        try {
            let trackData = null;
            if(userRegId!= null){
                trackData = await this.registrationTrackService.findByUserRegistrationId(registration.id, stepsId, userRegId);
            }
            else{
                trackData = await this.registrationTrackService.findByRegistrationId(registration.id, stepsId);
            }

            let transArr = [];
            if(isNotNullAndUndefined(trackData)){
                let jsonData = trackData.jsonData;
                if(isNotNullAndUndefined(jsonData)){
                    let transactions = jsonData;
                    console.log("Instalment Transaction ::" + JSON.stringify(transactions));
                    if(isArrayPopulated(transactions)){
                        for(let item of transactions){
                            let userDb = await this.userService.findUserByUniqueFields(item.email.toLowerCase(), item.firstName, item.lastName, item.mobileNumber);
                            let participantId_ = isNotNullAndUndefined(userDb) ? userDb.id : 0;
                            if(item.feeAmount){
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
                                trxn.membershipProductMappingId = item.membershipProductMappingId;
                                trxn.competitionId = item.competitionId;
                                trxn.organisationId = item.organisationId;
                                trxn.paymentOptionRefId = item.paymentOptionRefId;
                                trxn.divisionId = item.divisionId;
                                trxn.governmentVoucherAmount = item.governmentVoucherAmount;
                                trxn.paidBy = paidBy;
                                transArr.push(trxn);
                            }

                            if(item.feeType == "competition" || item.feeType == "affiliate"){
                                if(!isNullOrZero(item.nominationFee) || !isNullOrZero(item.nominationGST)){
                                    if(item.nominationFeeToPay){
                                        const trxn = new Transaction();
                                        trxn.id = 0;
                                        trxn.invoiceRefId = invoiceId;
                                        trxn.instalmentDate = item.instalmentDate;
                                        trxn.participantId = participantId_;
                                        trxn.createdBy = registration.createdBy;
                                        trxn.feeAmount = item.nominationFeeToPay;
                                        trxn.gstAmount = item.nominationGSTToPay;
                                        trxn.feeType = "nomination";
                                        trxn.membershipProductMappingId = item.membershipProductMappingId;
                                        trxn.competitionId = item.competitionId;
                                        trxn.organisationId = item.organisationId;
                                        trxn.divisionId = item.divisionId;
                                        trxn.paidBy = paidBy;
                                        transArr.push(trxn);
                                    }
                                }
                            }
                        }
                    }

                    if(isArrayPopulated(transArr)){
                        await this.transactionService.batchCreateOrUpdate(transArr);
                    }
                }
            }
        } catch (error) {
            logger.error(`Exception occurred in createTeamTransactions ${error} `);
            throw error;
        }
    }

    private async performShopPayment(paymentIntent, registration, registrationProducts,
        INVOICE_ID, paymentType){
        try {
            console.log("performShopPayment::" + JSON.stringify(registrationProducts.shopProducts));


            if(isArrayPopulated(registrationProducts.shopProducts)){
                let userInfo = await this.userService.findById(registration.createdBy);
                let shopTotalFee = 0;
                let accountError = false;
                let paymentMethod = null;
                let paymentStatus = '1';
                if(paymentType == "card" || paymentType === AppConstants.cashCard){
                    paymentMethod = "Credit Card";
                    paymentStatus = '2';
                }
                else if(paymentType == "direct_debit"){
                    paymentMethod = "Direct debit";
                }

                for(let prod of registrationProducts.shopProducts){
                    shopTotalFee += feeIsNull(prod.totalAmt);
                    let mOrgData = await this.organisationService.findOrganisationByUniqueKey(prod.organisationId);
                    let mStripeAccountId = null;
                    if(isArrayPopulated(mOrgData)){
                        mStripeAccountId = mOrgData[0].stripeAccountID;
                        if(isNullOrUndefined(mStripeAccountId)){
                            prod["organisationAccountId"] = mStripeAccountId;
                            prod["orgId"] = mOrgData[0].id;
                            prod["orgName"] = mOrgData[0].name;
                        }
                        else{
                            logger.error(`Organisation doesn't have Stripe Account ${prod.organisationId}` )
                            accountError = true;
                            break;
                        }
                    }
                }
                if(!accountError){
                    console.log("Shop Total Fee" + shopTotalFee);
                    let orderGrpObj =  await this.orderGroupService.getOrderGroupObj(registration.createdBy,shopTotalFee);
                    let orderGrp = await this.orderGroupService.createOrUpdate(orderGrpObj);
                    let cartObj = await this.cartService.getCartObj(registration.createdBy);
                    let cart = await this.cartService.createOrUpdate(cartObj);

                    for(let prod of registrationProducts.shopProducts){
                        logger.debug(`Product Fee ${prod.totalAmt}`);

                        let transferForShopFee;
                        if(paymentType!= AppConstants.directDebit){
                            transferForShopFee = await this.shopStripePayment(prod, paymentIntent,AppConstants.registration,
                                registration, userInfo);
                            logger.debug(`transferForShop Fee ${JSON.stringify(transferForShopFee)}`);
                        }

                        let orderObj = await this.orderService.getOrderObj(paymentMethod, paymentStatus,
                            registration, prod, orderGrp,INVOICE_ID, registrationProducts, paymentIntent, transferForShopFee);
                        let order = await this.orderService.createOrUpdate(orderObj);
                        logger.debug("order created" + order.id);

                        const sku = await this.skuService.findById(prod.skuId);
                        let sellProductObj = await this.sellProductService.getSellProductObj(cart, order, prod, sku, registration.createdBy);
                        let sellProduct = await this.sellProductService.createOrUpdate(sellProductObj);
                        logger.debug("sellproduct created" + sellProduct.id);

                        if (prod.inventoryTracking) {
                            await this.skuService.updateQuantity(prod.skuId,
                                sku.quantity - sellProductObj.quantity,
                                registration.createdBy
                            );

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

    private async shopStripePayment(prod, paymentIntent, transferPrefix, registration, userInfo)
    {
        try {
            const orgName = prod.orgName;
            const productName = prod.productName;
            const CURRENCY_TYPE: string = "aud";
            const STRIPE_TOTAL_FEE = formatFeeForStripe1(prod.totalAmt);
            const orgAccountId = prod.organisationAccountId;
            //const transferGroup = transferPrefix + "#" + registration.registrationUniqueKey;
            const transferGroup = paymentIntent.transfer_group;

            let userName = userInfo ? userInfo.firstName + ' ' + userInfo.lastName : "";

            const transferForMembershipFee = await stripe.transfers.create({
                amount: STRIPE_TOTAL_FEE,
                currency: CURRENCY_TYPE,
                description: `${userName} - ${productName} - ${orgName}  - SHOP FEE`,
                source_transaction: paymentIntent.charges.data.length > 0 ? paymentIntent.charges.data[0].id : paymentIntent.id,
                destination: orgAccountId,
                transfer_group: transferGroup
            });

            return transferForMembershipFee;
        } catch (error) {
            logger.error(`Exception occurred in shopStripePayment ${error}`);
            throw error;
        }
    }

    private async registrationMail(registration: Registration, registrationTrackJson: string, friend, invoiceId){
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

                // if (Number(res.teamReg) > 0) {
                //     await this.mailForTeamRegistration(registration.id, userId, fileName, invoiceRecieverType, futureInstalments);
                // }
                if (Number(res.individualReg) == 1) {
                    await this.mailToParticipant(registration.id, userId, fileName, invoiceRecieverType);
                }
                if (friend == 1 && isArrayPopulated(friendArray)) {
                    await this.mailToReferFriend(registration.id, friendArray, userId);
                }
            }
        } catch (error) {
            logger.error(`Exception occurred in registrationMail ${error}`);
            throw error;
        }
    }

    private async getInvoiceData(registration, registrationTrackJson) {
        let invoiceData = null;
        try {
            //let registrationTrackJson = await this.registrationTrackService.findByRegistrationId(registration.id, 3);
            if (isNotNullAndUndefined(registrationTrackJson)) {
                let billTo = await this.userService.getUserInfo(registration.createdBy);
                invoiceData = registrationTrackJson;
                let stateOrgId = null;
                let organisationLogoUrl = null;
                for (let item of invoiceData.compParticipants) {
                    for (let mem of item.membershipProducts) {
                        if(mem.fees.membershipFee){
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

    public async invoiceRecieverType(registrationId) : Promise<number> {
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
            logger.error(`Exception occurred in invoiceRecieverType ` + error);
            throw error;
        }
    }

    public async mailToParticipant(registrationId: number, userId: number, fileName: string, invoiceReciever: number) {
        try {
            let passwordMap = new Map();
            let invoiceRecieverMap = new Map();
            let result = await this.registrationService.findParticipantRegistrationInfo(registrationId)
            console.log("~~~~mailToParticipant");
            if (isArrayPopulated(result[0])) {
                let particpants : ParticipantRegistrationInfoDto[] = result[0];
                let participant = result[0].find((x) => x);
                let password = null;
                if (participant.creator.password == null) {
                    let creator = await this.userService.findById(participant.creator.id);
                    password = Math.random().toString(36).slice(-8);
                    creator.password = md5(password);
                    await this.userService.createOrUpdate(creator);
                    await this.updateFirebaseData(creator, creator.password);
                }
                let template = await this.communicationTemplateService.findById(7);
               
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
        }
        catch (error) {
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

            //return response.status(200).send("Success")
        }
        catch (error) {
            logger.error(`Error Occurred in mailToReferFriend ` + error);
            throw error;
        }
    }

    async createOrUpdateInvoice(registration, flag, userRegId) {
        try {
            const REGISTRATION_CREATOR_USER_ID = registration.createdBy;
            let getInvoiceStatus = null;
            if(flag == AppConstants.registration){
                getInvoiceStatus = await this.invoiceService.findByRegistrationId(registration.id);
            }
           
            let inv = new Invoice();
            if (!isArrayPopulated(getInvoiceStatus)) {
                let invoiceReceipt = await this.invoiceService.getInvoiceReciptId();
                let receiptId = feeIsNull(invoiceReceipt.receiptId) + 1;
                inv.id = 0;
                inv.createdBy = REGISTRATION_CREATOR_USER_ID;
                inv.paymentStatus = "pending";
                inv.receiptId = receiptId.toString();
            }
            else {
                inv.id = getInvoiceStatus[0].id
                inv.paymentStatus = getInvoiceStatus[0].paymentStatus;
                inv.updatedBy = REGISTRATION_CREATOR_USER_ID;
                inv.updatedOn = new Date();
            }
            inv.registrationId = registration.id;
            inv.userRegistrationId = userRegId;
            let invoiceDetails = await this.invoiceService.createOrUpdate(inv);

            return invoiceDetails;
        } catch (error) {
            throw error;
        }
    }
}