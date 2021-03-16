import { Response } from 'express';
import { Authorized, Body, Get, HeaderParam, JsonController, Param, Post, QueryParam, Res } from 'routing-controllers';
import { logger } from '../logger';
import { OrgRegistration } from '../models/registrations/OrgRegistration';
import { OrgRegistrationDisclaimerLink } from '../models/registrations/OrgRegistrationDisclaimerLink';
import { OrgRegistrationHardshipCode } from '../models/registrations/OrgRegistrationHardshipCode';
import { OrgRegistrationMembershipProductType } from '../models/registrations/OrgRegistrationMembershipProductType';
import { OrgRegistrationRegisterMethod } from '../models/registrations/OrgRegistrationRegisterMethod';
import { OrgRegistrationSettings } from '../models/registrations/OrgRegistrationSettings';
import { User } from '../models/security/User';
import { ArrayIsEmpty, isArrayPopulated, isNotNullAndUndefined, isNullOrZero, paginationData, PagingData, stringTONumber } from "../utils/Utils";
import AppConstants from '../validation/AppConstants';
import { BaseController } from './BaseController';

@JsonController('/api/orgregistration')
export class OrgRegistrationController extends BaseController {

    @Authorized()
    @Post('/')
    async createOrgRegistration(
        @HeaderParam("authorization") currentUser: User,
        @Body() orgRegBody,
        @QueryParam('organisationUniqueKey') organisationUniqueKey: string,
        @Res() response: Response) {
        const userId = currentUser.id;

        try {
            if (organisationUniqueKey) {

                const foundOrganisationId = await this.organisationService.findOrganisationByUniqueKey(organisationUniqueKey);
                if (isArrayPopulated(foundOrganisationId)) {
                    const ORGANISATION_ID = foundOrganisationId[0].id;

                    const orgReg = new OrgRegistration();
                    const findCompetition = await this.competitionRegService.findCompetitionFeeDetailsByUniqueKey(orgRegBody.competitionUniqueKeyId)
                    let url = process.env.REGISTRATION_FORM_URL;
                    if (isArrayPopulated(findCompetition)) {
                        orgReg.competitionId = findCompetition[0].id;

                        const foundOrgReg = await this.orgRegistrationService.findOrganisationRegistrationByOrganisationId(orgRegBody.yearRefId, findCompetition[0].id, ORGANISATION_ID);
                        let REGISTRATION_FORM_STATUS = 1;
                        if (isArrayPopulated(foundOrgReg)) {
                            REGISTRATION_FORM_STATUS = foundOrgReg[0].statusRefId;
                        }

                        //if (REGISTRATION_FORM_STATUS !== 2) {
                            orgReg.yearRefId = orgRegBody.yearRefId;
                            // orgReg.registrationOpenDate = orgRegBody.registrationOpenDate;
                            orgReg.organisationId = ORGANISATION_ID;
                       // }

                        let inviteCompetitionId = null;
                        if (orgRegBody.inviteCompetitionId != null && orgRegBody.inviteCompetitionId != '0') {
                            inviteCompetitionId = await this.competitionRegService.findByUniquekey(orgRegBody.inviteCompetitionId);
                        }

                        orgReg.statusRefId = orgRegBody.statusRefId;

                        orgReg.dobPreferenceLessThan = orgRegBody.dobPreferenceLessThan;
                        orgReg.dobPreferenceMoreThan = orgRegBody.dobPreferenceMoreThan;
                        orgReg.genderRefId = orgRegBody.genderRefId;
                        orgReg.inviteTypeRefId = orgRegBody.inviteTypeRefId;
                        orgReg.canInviteSend = orgRegBody.canInviteSend;
                        orgReg.inviteCompetitionId = inviteCompetitionId == null ? '0' : inviteCompetitionId;
                        orgReg.inviteYearRefId = orgRegBody.inviteYearRefId;
                        orgReg.replyName = orgRegBody.replyName;
                        orgReg.replyRole = orgRegBody.replyRole;
                        orgReg.replyEmail = orgRegBody.replyEmail;
                        orgReg.replyPhone = orgRegBody.replyPhone;
                        orgReg.specialNote = orgRegBody.specialNote;
                        orgReg.trainingDaysAndTimes = orgRegBody.trainingDaysAndTimes;
                        orgReg.trainingVenueId = orgRegBody.trainingVenueId;
                        orgReg.id = orgRegBody.orgRegistrationId;
                        orgReg.registrationCloseDate = orgRegBody.registrationCloseDate;
                        orgReg.registrationOpenDate = orgRegBody.registrationOpenDate;

                        if (isNullOrZero(orgReg.id)) {
                            orgReg.createdBy = userId;
                        } else {
                            orgReg.createdBy = userId;
                            orgReg.updatedBy = userId;
                            orgReg.updatedOn = new Date();
                        }

                        const orgRegCreated = await this.orgRegistrationService.createOrUpdate(orgReg);
                        const ORG_REG_ID = orgRegCreated.id;
                        const ORG_REG_ORGANISATION_ID = orgRegCreated.organisationId;


                        if (isArrayPopulated(orgRegBody.membershipProductTypes)) {
                            let arr = [];
                            let memMap = new Map();
                            orgRegBody.membershipProductTypes.map((x) => {
                                let key = x.membershipProductTypeMappingId+"#"+x.divisionId;
                                let memProdTemp = memMap.get(key);
                                if(memProdTemp == undefined){
                                    arr.push(x);
                                    memMap.set(key, x);
                                }
                                else{
                                    if(x.isIndividualRegistration == 1){
                                        memProdTemp.isIndividualRegistration = x.isIndividualRegistration;
                                        if(x.registrationLock)
                                            memProdTemp.registrationLock = 1
                                        else
                                            memProdTemp.registrationLock = 0
                                        memProdTemp.registrationCap = x.registrationCap;
                                    }
                                    
                                    if(x.isTeamRegistration == 1){
                                        memProdTemp.isTeamRegistration = x.isTeamRegistration;
                                        if(x.registrationLock)
                                            memProdTemp["registrationTeamLock"]= 1
                                        else
                                            memProdTemp["registrationTeamLock"]= 0
                                        memProdTemp.teamRegistrationCap = x.teamRegistrationCap;
                                    }
                                    
                                }
                            });

                            orgRegBody.membershipProductTypes = [];
                            orgRegBody.membershipProductTypes = arr;

                            const checkPreviousTypes = await this.orgRegistrationMembershipProductTypeService.checkPreviousTypes(ORG_REG_ID)
                            let PREVIOUS_TYPES = [];
                            if (isArrayPopulated(checkPreviousTypes)) {
                                for (let i of checkPreviousTypes) PREVIOUS_TYPES.push(i.id)
                            }

                            checkPreviousTypes.forEach(async e => {
                                const index = orgRegBody.membershipProductTypes.findIndex(g => g.orgRegMemProTypeId === e.id);
                                if (index === -1) {
                                    // user deleted some types 
                                    let typesDelete = new OrgRegistrationMembershipProductType();
                                    typesDelete.isDeleted = 1;
                                    typesDelete.competitionMembershipProductTypeId = e.competitionMembershipProductTypeId;
                                    // typesDelete.competitionMembershipProductDivisionId = e.competitionMembershipProductDivisionId;
                                    typesDelete.id = e.id;

                                    await this.orgRegistrationMembershipProductTypeService.createOrUpdate(typesDelete);
                                }
                            });
                          
                            for (let o of orgRegBody.membershipProductTypes) {
                                let orgRegMemProType = new OrgRegistrationMembershipProductType();
                               
                               // if (REGISTRATION_FORM_STATUS !== 2) {
                                    orgRegMemProType.orgRegistrationId = ORG_REG_ID;
                                    orgRegMemProType.createdBy = userId;
                                    orgRegMemProType.competitionMembershipProductTypeId = o.membershipProductTypeId;
                                    orgRegMemProType.competitionMembershipProductDivisionId = (o.divisionId && o.divisionName) ? o.divisionId : null;
                                    orgRegMemProType.isIndividualRegistration = o.isIndividualRegistration;
                                    orgRegMemProType.isTeamRegistration = o.isTeamRegistration;
                                    orgRegMemProType.registrationCap = o.registrationCap;
                                    orgRegMemProType.teamRegistrationCap = o.teamRegistrationCap;
                               // }
                                
                                orgRegMemProType.id = o.orgRegMemProTypeId;
                                let regLock = o.registrationLock === false ? 0 : 1;
                                console.log('---- @@@ -- regLock '+ regLock)
                                console.log('---- @@@ -- isIndividualRegistration '+ o.isIndividualRegistration)
                                console.log('---- @@@ -- isTeamRegistration '+ o.isTeamRegistration)

                                orgRegMemProType.registrationLock =  o.registrationLock;
                                orgRegMemProType.registrationTeamLock =  o.registrationTeamLock ;

                                if (isNullOrZero(orgRegMemProType.id)) {
                                    orgRegMemProType.createdBy = userId;
                                } else {
                                    orgRegMemProType.createdBy = userId;
                                    orgRegMemProType.updatedBy = userId;
                                    orgRegMemProType.updatedOn = new Date();
                                }

                                await this.orgRegistrationMembershipProductTypeService.createOrUpdate(orgRegMemProType)
                            }
                        }

                        if (ArrayIsEmpty(orgRegBody.registerMethods)) {
                            const checkPreviousMethods = await this.orgRegistrationRegisterMethodService.checkPreviousMethods(ORG_REG_ID)
                            let PREVIOUS_METHODS = [];
                            if (isArrayPopulated(checkPreviousMethods)) {
                                for (let i of checkPreviousMethods) PREVIOUS_METHODS.push(i.id)
                            }

                            PREVIOUS_METHODS.forEach(async e => {
                                const index = orgRegBody.registerMethods.findIndex(g => g.registrationMethodId === e);
                                if (index === -1) {
                                    // user deleted some methods 
                                    let methodDelete = new OrgRegistrationRegisterMethod();
                                    methodDelete.isDeleted = 1;
                                    methodDelete.id = e;
                                    await this.orgRegistrationRegisterMethodService.createOrUpdate(methodDelete);
                                }
                            });

                            for (let o of orgRegBody.registerMethods) {
                                let orgRegRegdMethod = new OrgRegistrationRegisterMethod();
                                orgRegRegdMethod.registrationMethodRefId = o.registrationMethodRefId;
                                orgRegRegdMethod.orgRegistrationId = ORG_REG_ID;
                                orgRegRegdMethod.createdBy = userId;
                                orgRegRegdMethod.id = o.registrationMethodId;

                                if (isNullOrZero(orgRegRegdMethod.id)) {
                                    orgRegRegdMethod.createdBy = userId;
                                } else {
                                    orgRegRegdMethod.createdBy = userId;
                                    orgRegRegdMethod.updatedBy = userId;
                                    orgRegRegdMethod.updatedOn = new Date();
                                }

                                await this.orgRegistrationRegisterMethodService.createOrUpdate(orgRegRegdMethod)
                            }
                        }

                        if (ArrayIsEmpty(orgRegBody.registrationSettings)) {

                            const checkPreviousSettings = await this.orgRegistrationSettingsService.checkPreviousSettings(ORG_REG_ID);
                            let PREVIOUS_SETTINGS = [];
                            if (isArrayPopulated(checkPreviousSettings)) {
                                for (let i of checkPreviousSettings) PREVIOUS_SETTINGS.push(i.id);
                            }

                            PREVIOUS_SETTINGS.forEach(async e => {
                                const index = orgRegBody.registrationSettings.findIndex(g => g.registrationSettingsId === e);
                                if (index === -1) {
                                    // user deleted some settings 
                                    let settingDelete = new OrgRegistrationSettings();
                                    settingDelete.isDeleted = 1;
                                    settingDelete.id = e;
                                    await this.orgRegistrationSettingsService.createOrUpdate(settingDelete);
                                }
                            });

                            for (let o of orgRegBody.registrationSettings) {
                                let orgRegSetting = new OrgRegistrationSettings();
                                orgRegSetting.id = o.registrationSettingsId;
                                orgRegSetting.registrationSettingsRefId = o.registrationSettingsRefId;
                                orgRegSetting.orgRegistrationId = ORG_REG_ID;
                                orgRegSetting.createdBy = userId;

                                if (isNullOrZero(orgRegSetting.id)) {
                                    orgRegSetting.createdBy = userId;
                                } else {
                                    orgRegSetting.createdBy = userId;
                                    orgRegSetting.updatedBy = userId;
                                    orgRegSetting.updatedOn = new Date();
                                }

                                await this.orgRegistrationSettingsService.createOrUpdate(orgRegSetting)
                            }
                        }
                        let hardShipCodesDb = await this.orgRegistrationHardshipCodeService.findByOrgRegId(ORG_REG_ID)
                        let hardShipMap = new Map;
                        if(isArrayPopulated(orgRegBody.hardShipCodes)){
                            for (let o of orgRegBody.hardShipCodes) {
                                let orgRegHardship = new OrgRegistrationHardshipCode();
                                orgRegHardship.id = o.id;
                                orgRegHardship.code = o.code;
                                orgRegHardship.orgRegistrationId = ORG_REG_ID;
                                orgRegHardship.createdBy = userId;
                                orgRegHardship.isActive = o.isActive;
                                if (isNullOrZero(orgRegHardship.id)) {
                                    orgRegHardship.createdBy = userId;
                                } else {
                                    orgRegHardship.createdBy = userId;
                                    orgRegHardship.updatedBy = userId;
                                    orgRegHardship.updatedOn = new Date();
                                }

                               let orgRegHarshipRes = await this.orgRegistrationHardshipCodeService.createOrUpdate(orgRegHardship)
                                hardShipMap.set(orgRegHarshipRes.id, orgRegHarshipRes)
                            }
                        }
                        if(isArrayPopulated(hardShipCodesDb)){
                            for(let hardShipCode of hardShipCodesDb){
                                if(hardShipMap.get(hardShipCode.id) == undefined){
                                    hardShipCode.isDeleted = 1
                                    hardShipCode.updatedBy = userId;
                                    hardShipCode.updatedOn = new Date();
                                 await this.orgRegistrationHardshipCodeService.createOrUpdate(hardShipCode)
                                }
                            }
                        }
                        if (ArrayIsEmpty(orgRegBody.registrationDisclaimer)) {

                            const checkPreviousDisclaimer = await this.orgRegistrationDisclaimerLinkService.checkPreviousDisclaimer(ORG_REG_ID);
                            let PREVIOUS_DISCLAIMER = [];
                            if (isArrayPopulated(checkPreviousDisclaimer)) {
                                for (let i of checkPreviousDisclaimer) PREVIOUS_DISCLAIMER.push(i.id);
                            }

                            PREVIOUS_DISCLAIMER.forEach(async e => {
                                const index = orgRegBody.registrationDisclaimer.findIndex(g => g.orgRegistrationDisclaimerLinkId === e);
                                if (index === -1) {
                                    // user deleted some disclaimer 
                                    let disclaimerDelete = new OrgRegistrationDisclaimerLink();
                                    disclaimerDelete.isDeleted = 1;
                                    disclaimerDelete.id = e;
                                    await this.orgRegistrationDisclaimerLinkService.createOrUpdate(disclaimerDelete);
                                }
                            });

                            for (let o of orgRegBody.registrationDisclaimer) {
                                let orgRegDisclaimerLink = new OrgRegistrationDisclaimerLink();
                                orgRegDisclaimerLink.id = o.orgRegistrationDisclaimerLinkId;
                                orgRegDisclaimerLink.disclaimerLink = o.disclaimerLink;
                                orgRegDisclaimerLink.orgRegistrationId = ORG_REG_ID;
                                orgRegDisclaimerLink.disclaimerText = o.disclaimerText;
                                orgRegDisclaimerLink.createdBy = userId;

                                if (isNullOrZero(orgRegDisclaimerLink.id)) {
                                    orgRegDisclaimerLink.createdBy = userId;
                                } else {
                                    orgRegDisclaimerLink.createdBy = userId;
                                    orgRegDisclaimerLink.updatedBy = userId;
                                    orgRegDisclaimerLink.updatedOn = new Date();
                                }

                                await this.orgRegistrationDisclaimerLinkService.createOrUpdate(orgRegDisclaimerLink)
                            }
                        }

                       // if (REGISTRATION_FORM_STATUS !== 2) {
                            if (orgRegBody.isResend == 1) {
                                //mail
                                this.sendOrgFormMail(ORGANISATION_ID, orgRegCreated,findCompetition,foundOrganisationId,userId)
                                url = url.replace('{ORGANISATIONID}', organisationUniqueKey);
                                url = url.replace('{COMPETITIONID}', findCompetition.competitionUniqueKey);
                            }

                        //}
                        
                        console.log("(((((((((( End of Org Registration )))))))))");
                        return response.status(200).send({
                            id: ORG_REG_ID,
                            errorCode: 0,
                            message: 'Organisation registered successfully',
                            userRegistrationUrl: url
                        });  
                        
                    } else {
                        return response.status(212).send({
                            errorCode: 1,
                            message: 'Cannot find competition with the provided ID'
                        });
                    }
                } else {
                    return response.status(212).send({
                        errorCode: 3, message: 'Cannot find any organisation with the provided key.'
                    });
                }
            } else {
                return response.status(212).send({
                    errorCode: 2,
                    message: 'Please pass organisationUniqueKey as a query parameter'
                });
            }
        } catch (err) {
            logger.error(`Unable to save organisation details` + err);
            return response.status(400).send({
                err, name: 'unexpected_error', message: process.env.NODE_ENV == AppConstants.development? 'Unable to save organisation details' + err : 'Unable to save organisation details'
            });
        }
    }

    @Authorized()
    @Post('/details')
    async getOrgRegistration(
        @HeaderParam("authorization") currentUser: User,
        @QueryParam('organisationUniqueKey', { required: true }) organisationUniqueKey: string,
        @Body() orgRegBody: OrganisationRequest,
        @Res() response: Response) {
        // const userId = currentUser.id;
        try {
            if (orgRegBody.competitionUniqueKey) {
                const foundCompID = await this.competitionRegService.findCompetitionFeeDetailsByUniqueKey(orgRegBody.competitionUniqueKey);
                if (isArrayPopulated(foundCompID)) {
                    const year = orgRegBody.yearRefId;
                    const competitionID = foundCompID[0].id;
                    const userId = currentUser.id;
                    const foundOrganisationId = await this.organisationService.findOrganisationByUniqueKey(organisationUniqueKey);
                    if (isArrayPopulated(foundOrganisationId)) {
                        const foundOrganisationRegistrationDetails = await this.orgRegistrationService.findOrganisationRegistrationByOrganisationId(year, competitionID, foundOrganisationId[0].id);
                        let divisionDates = await this.orgRegistrationService.findDivisionDates(competitionID)

                        let isHardshipEnabled = 0;
                        let competitionPaymentOptions = await this.competitionPaymentOptionService.checkPreviousPaymentOptions(competitionID);
                        if(isArrayPopulated(competitionPaymentOptions)){
                            if(competitionPaymentOptions.find(x=>x.paymentOptionRefId == 9)){
                                isHardshipEnabled = 1;
                            }
                        }

                        if (isArrayPopulated(foundOrganisationRegistrationDetails)) {

                          //  console.log("------@@ " + foundOrganisationId[0].id + " ## " + competitionID)
                            let url = this.getEndUserRegistrationUrl(organisationUniqueKey,orgRegBody.competitionUniqueKey);
                            foundOrganisationRegistrationDetails.map(e => e.userRegistrationUrl = url);

                            foundOrganisationRegistrationDetails[0]["dobPreferenceRefId"] = foundOrganisationRegistrationDetails[0].dobPreferenceMoreThan == null ? 1 : 2;
                            
                            console.log("competitionPaymentOptions" + JSON.stringify(competitionPaymentOptions));
                            
                            foundOrganisationRegistrationDetails[0]["isHardshipEnabled"] = isHardshipEnabled;

                            if (isArrayPopulated(foundOrganisationRegistrationDetails[0].membershipProductTypes)) {
                                foundOrganisationRegistrationDetails.map(e =>
                                    e.membershipProductTypes = foundOrganisationRegistrationDetails[0].membershipProductTypes.filter((thing, index) =>
                                        index === foundOrganisationRegistrationDetails[0].membershipProductTypes.findIndex(obj => JSON.stringify(obj) === JSON.stringify(thing))));

                                if (foundOrganisationRegistrationDetails[0].membershipProductTypes) {
                                    console.log("foundOrganisationRegistrationDetails membershipProductTypes" + JSON.stringify(foundOrganisationRegistrationDetails[0].membershipProductTypes))
                                    foundOrganisationRegistrationDetails[0].membershipProductTypes.map(e => {
                                        e.id = e.divisionId + '_' + e.membershipProductTypeMappingId + '_'+
                                        e.isIndividualRegistration + '_' + e.isTeamRegistration;
                                        e.registrationLock = e.registrationLock ?  true : false;
                                        
                                        return e;
                                    });



                                    return response.status(200).send(foundOrganisationRegistrationDetails);
                                } else {
                                    return response.status(212).send([{
                                        errorCode: 1,
                                        message: "Cannot find any entry with provided ID"
                                    }])
                                }
                            } else {
                                let orgPhotos = await this.orgRegistrationService.getOrgnisationPhotos(foundOrganisationId[0].id);

                                let genderRefId = (divisionDates.minGenderRefId == divisionDates.maxGenderRefId && divisionDates.genderCount > 0) ? 3 :
                                    (divisionDates.minGenderRefId != divisionDates.maxGenderRefId) ? 3 :
                                        (divisionDates.minGenderRefId == 1 && divisionDates.maxGenderRefId == 1) ? 1 :
                                            (divisionDates.minGenderRefId == 2 && divisionDates.maxGenderRefId == 2) ? 2 : 3;
                                // let genderRefId = (divisionDates.minGenderRefId == 1 && divisionDates.maxGenderRefId == 1) ? 1 :
                                // ((divisionDates.minGenderRefId == 2 && divisionDates.maxGenderRefId == 2) ? 2 : 3 );

                                return response.status(200).send([
                                    {
                                        orgRegistrationId: 0,
                                        yearRefId: 1,
                                        statusRefId: "",
                                        dobPreferenceLessThan: divisionDates.toDate,
                                        dobPreferenceMoreThan: divisionDates.fromDate,
                                        genderRefId: genderRefId,
                                        inviteTypeRefId: 1,
                                        dobPreferenceRefId: divisionDates.fromDate == null ? 1 : 2,
                                        canInviteSend: 0,
                                        inviteYearRefId: -1,
                                        inviteCompetitionId: '0',
                                        competitionUniqueKeyId: "",
                                        registrationOpenDate: "",
                                        registrationCloseDate: "",
                                        membershipProductTypes: [],
                                        hardShipCodes: [],
                                        organisationPhotos: orgPhotos,
                                        specialNote: "",
                                        replyName: "",
                                        replyRole: "",
                                        replyEmail: "",
                                        replyPhone: "",
                                        trainingDaysAndTimes: "",
                                        trainingVenueId: null,
                                        registerMethods: [],
                                        registrationSettings: [],
                                        registrationDisclaimer: [],
                                        userRegistrationUrl: url,
                                        isHardshipEnabled: isHardshipEnabled
                                    }
                                    /* {
                                    errorCode: 2,
                                    message: 'Cannot find membershipProduct Types with the provided ID'
                                } */
                                ]);
                            }
                        } 
                        else {
                            let url = this.getEndUserRegistrationUrl(organisationUniqueKey,orgRegBody.competitionUniqueKey);
                            let orgPhotos = await this.orgRegistrationService.getOrgnisationPhotos(foundOrganisationId[0].id);
                            let genderRefId = (divisionDates.minGenderRefId == divisionDates.maxGenderRefId && divisionDates.genderCount > 0) ? 3 :
                                (divisionDates.minGenderRefId != divisionDates.maxGenderRefId) ? 3 :
                                    (divisionDates.minGenderRefId == 1 && divisionDates.maxGenderRefId == 1) ? 1 :
                                        (divisionDates.minGenderRefId == 2 && divisionDates.maxGenderRefId == 2) ? 2 : 3;
                            // let genderRefId = (divisionDates.minGenderRefId == 1 && divisionDates.maxGenderRefId == 1) ? 1 :
                            //             ((divisionDates.minGenderRefId == 2 && divisionDates.maxGenderRefId == 2) ? 2 : 3 );
                            return response.status(200).send([
                                {
                                    orgRegistrationId: 0,
                                    yearRefId: 1,
                                    statusRefId: "",
                                    dobPreferenceLessThan: divisionDates.toDate,
                                    dobPreferenceMoreThan: divisionDates.fromDate,
                                    genderRefId: genderRefId,
                                    inviteTypeRefId: 1,
                                    dobPreferenceRefId: divisionDates.fromDate == null ? 1 : 2,
                                    canInviteSend: 0,
                                    inviteYearRefId: -1,
                                    inviteCompetitionId: '0',
                                    competitionUniqueKeyId: "",
                                    registrationOpenDate: "",
                                    registrationCloseDate: "",
                                    membershipProductTypes: [],
                                    hardShipCodes: [],
                                    organisationPhotos: orgPhotos,
                                    specialNote: "",
                                    replyName: "",
                                    replyRole: "",
                                    replyEmail: "",
                                    replyPhone: "",
                                    trainingDaysAndTimes: "",
                                    trainingVenueId: null,
                                    registerMethods: [],
                                    registrationSettings: [],
                                    registrationDisclaimer: [],
                                    userRegistrationUrl: url,
                                    isHardshipEnabled: isHardshipEnabled
                                }
                            ]);
                        }
                    } else {
                        return response.status(212).send({
                            errorCode: 5, message: 'Cannot find any organisation with the provided key.'
                        });
                    }
                } else {
                    return response.status(212).send({
                        errorCode: 3,
                        message: 'Cannot find competition with the provided ID'
                    });
                }
            } else {
                return response.status(212).send({
                    errorCode: 4,
                    message: 'Please pass competitionUniqueKey as body paramters'
                });
            }
        } catch (err) {
            logger.error(`Unable to get Organisation Registration ` + err);
            return response.status(400).send({
                name: 'unexpected_error', message: process.env.NODE_ENV == AppConstants.development? 'Failed to get Organisation Registration.' + err : 'Failed to get Organisation Registration.'
            });
        }

    }

    @Authorized()
    @Get('/competitionyear/:yearID')
    async getCompetitionsFromYearID(
        @HeaderParam("authorization") currentUser: User,
        @Param('yearID') yearID: number,
        @QueryParam('organisationUniqueKey') organisationUniqueKey: string,
        @Res() response: Response) {
        // let userId = currentUser.id;
        try {
            if (yearID) {
                if (organisationUniqueKey) {
                    const foundOrganisationId = await this.organisationService.findOrganisationByUniqueKey(organisationUniqueKey);
                    if (isArrayPopulated(foundOrganisationId)) {
                        const ORGANISATION_ID = foundOrganisationId[0].id;
                        const foundCompetitions = await this.competitionRegService.getCompetitionsFromYear(stringTONumber(yearID), ORGANISATION_ID);
                        if (foundCompetitions) {
                            return response.status(200).send(foundCompetitions);
                        } else {
                            return response.status(212).send({
                                errorCode: 1,
                                message: 'Cannot find competitions'
                            });
                        }
                    } else {
                        return response.status(212).send({
                            errorCode: 2, message: 'Cannot find any organisation with the provided key.'
                        });
                    }
                } else {
                    return response.status(212).send({
                        errorCode: 2, message: 'Please pass organisationUniqueKey as a Query parameter.'
                    });
                }

            } else {
                return response.status(212).send({
                    errorCode: 1, message: 'Please pass yearID as a Path parameter.'
                });
            }
        } catch (err) {
            logger.error(`Unable to get Competitions` + err);
            return response.status(400).send({
                name: 'unexpected_error', message: process.env.NODE_ENV == AppConstants.development? 'Unable to get Competitions' + err : 'Unable to get Competitions'
            });
        }
    }

    @Authorized()
    @Get('/competition/:yearID')
    async getOwnCompetitionsFromYearID(
        @HeaderParam("authorization") currentUser: User,
        @Param('yearID') yearID: number,
        @QueryParam('organisationUniqueKey') organisationUniqueKey: string,
        @QueryParam('listedCompetitions') listedCompetitions: 'owned' | 'participating',
        @Res() response: Response) {
        // const userId = currentUser.id;
        try {
            if (yearID) {
                if (organisationUniqueKey) {
                    if (listedCompetitions === "owned" || listedCompetitions === "participating") {
                    const foundOrganisationId = await this.organisationService.findOrganisationByUniqueKey(organisationUniqueKey);
                    if (isArrayPopulated(foundOrganisationId)) {
                        const foundCompetitions = await this.competitionRegService.getCompetitionsByYear(foundOrganisationId[0].id, stringTONumber(yearID), listedCompetitions);
                        if (foundCompetitions) {
                            return response.status(200).send(foundCompetitions);
                        } else {
                            return response.status(212).send([]);
                        }
                    } else {
                        return response.status(212).send({
                            errorCode: 2, message: 'Cannot find any organisation with the provided key.'
                        });
                    }
                } else {
                    return response.status(212).send({
                        errorCode: 6, message: 'Please pass listedCompetitions as a Query parameter.'
                    });
                    }
                } else {
                    return response.status(212).send({
                        errorCode: 1, message: 'Please pass organisationUniqueKey as a Query parameter.'
                    });
                }
            } else {
                return response.status(212).send({
                    errorCode: 3, message: 'Please pass yearID as a Path parameter.'
                });
            }
        } catch (err) {
            logger.error(`Unable to get own Competitions` + err);
            return response.status(400).send({
                err, name: 'unexpected_error', message: process.env.NODE_ENV == AppConstants.development? 'Unable to get own Competitions' + err : 'Unable to get own Competitions'
            });
        }
    }

    @Authorized()
    @Get('/affiliatedcompetition/:yearID')
    async getAffiliatedCompetitionsFromYearID(
        @HeaderParam("authorization") currentUser: User,
        @Param('yearID') yearID: number,
        @QueryParam('organisationUniqueKey') organisationUniqueKey: string,
        @Res() response: Response) {
        try {
            if (yearID) {
                if (organisationUniqueKey) {
                    const foundOrganisationId = await this.organisationService.findOrganisationByUniqueKey(organisationUniqueKey);
                    if (isArrayPopulated(foundOrganisationId)) {
                        const ORGANISATION_ID = foundOrganisationId[0].id;
                        const foundCompetitions = await this.competitionRegService.getAffiliatedCompetitionsFromYear(ORGANISATION_ID, stringTONumber(yearID));
                        if (foundCompetitions) {
                            return response.status(200).send(foundCompetitions);
                        } else {
                            return response.status(212).send([]);
                        }
                    } else {
                        return response.status(212).send({
                            errorCode: 3, message: 'Cannot find any organisation with the provided key'
                        });
                    }
                } else {
                    return response.status(212).send({
                        errorCode: 2,
                        message: 'Please pass organisationUniqueKey as a query parameter'
                    });
                }
            } else {
                return response.status(212).send({
                    errorCode: 1, message: 'Please pass yearID as a path parameter.'
                });
            }
        } catch (err) {
            logger.error(`Unable to get Participating Competitions` + err);
            return response.status(400).send({
                err, name: 'unexpected_error', message: process.env.NODE_ENV == AppConstants.development? 'Unable to get Participating Competitions' + err : 'Unable to get Participating Competitions'
            });
        }
    }

    @Authorized()
    @Post('/dashboard/:yearId')
    async getOrgRegistrationDashboard(
        @HeaderParam("authorization") currentUser: User,
        @Param('yearId') yearID: number,
        @Body() orgRegPagingBody: PagingData,
        @QueryParam('organisationUniqueKey') organisationUniqueKey: string,
        @QueryParam('sortBy') sortBy: string = undefined,
        @QueryParam('sortOrder') sortOrder: 'ASC'|'DESC'=undefined,
        @Res() response: Response) {
        try {
            if (orgRegPagingBody.paging && orgRegPagingBody.paging.limit !== (undefined || null) && orgRegPagingBody.paging.offset !== (undefined || null)) {
                if (yearID) {
                    if (organisationUniqueKey) {
                        const foundOrganisationId = await this.organisationService.findOrganisationByUniqueKey(organisationUniqueKey);
                        if (isArrayPopulated(foundOrganisationId)) {
                            const ORGANISATION_ID = foundOrganisationId[0].id;
                            const OFFSET = stringTONumber(orgRegPagingBody.paging.offset);
                            const LIMIT = stringTONumber(orgRegPagingBody.paging.limit);
                            const YEAR = stringTONumber(yearID);

                            let getResult = await this.orgRegistrationService.getOrgregListing(OFFSET, LIMIT, YEAR, ORGANISATION_ID, sortBy, sortOrder);
                            for (let result of getResult.data) {
                                let competitionUniqueKey = result['competitionId'];
                                if (isNotNullAndUndefined(competitionUniqueKey)) {
                                    let userRegistrationUrl = this.getEndUserRegistrationUrl(
                                        organisationUniqueKey,
                                        competitionUniqueKey
                                    );
                                    result["userRegistrationUrl"] = userRegistrationUrl;
                                }
                            }

                            let responseObject = paginationData(stringTONumber(getResult.count), LIMIT, OFFSET)
                            responseObject["orgReg"] = getResult.data;

                            return response.status(200).send(responseObject)
                        } else {
                            return response.status(212).send({
                                errorCode: 3, message: 'Cannot find any organisation with the provided key'
                            });
                        }
                    } else {
                        return response.status(212).send({
                            errorCode: 2,
                            message: 'Please pass organisationUniqueKey as a query parameter'
                        });
                    }
                } else {
                    return response.status(212).send({
                        errorCode: 1, message: 'Please pass yearId as a path parameter.'
                    });
                }
            } else {
                return response.status(212).send({
                    errorCode: 4,
                    message: 'Please pass offset and limit in correct format for orgRegistration Dashboard Listing'
                });
            }
        } catch (err) {
            logger.error(`Unable to get orgRegistration Dashboard Listing`, err);
            return response.status(400).send({
                err, name: 'unexpected_error', message: process.env.NODE_ENV == AppConstants.development? 'Unable to get orgRegistration Dashboard Listing' + err : 'Unable to get orgRegistration Dashboard Listing'
            });
        }
    }

    public async sendOrgFormMail(ORGANISATION_ID, orgRegistration,findCompetition,foundOrganisationId,userId){
        try{
            let contacts = await this.ureService.findUserRegistrationParticipants(ORGANISATION_ID, orgRegistration.id);
            console.log("%%%%  CONTACTS %%%%" + JSON.stringify(contacts))
            
            let formContacts = await this.ureService.findByEntityId(ORGANISATION_ID);
            let mailObj = await this.communicationTemplateService.findById(2);

            console.log("::: form contacts ::" + formContacts[0].user.firstName)
            for (let contact of contacts) {
                console.log("--::::  CONTACT MAIL:: ----" + contact.email)
                await this.userService.sendRegoFormInvites(contact, mailObj, findCompetition[0], orgRegistration, foundOrganisationId[0], userId)
                //await this.sleep(1000);
               
            }
        }
        catch(error){
            throw error;
        }
    }


    public async sleep(ms) {
        return new Promise((resolve) => {
            setTimeout(resolve, ms);
        });
    }

    private getEndUserRegistrationUrl (organisationUniqueKey, competitionUniqueKey)
    {
        let url = process.env.REGISTRATION_FORM_URL;
        url = url.replace('{ORGANISATIONID}', organisationUniqueKey);
        url = url.replace('{COMPETITIONID}', competitionUniqueKey);
       
        return url;

    }
}

export interface OrganisationRequest {
    yearRefId: number,
    competitionUniqueKey: string
}