import { Response } from 'express';
import { Authorized, Body, Delete, Get, HeaderParam, JsonController, Param, Post, QueryParam, Res, UploadedFiles } from 'routing-controllers';
import { logger } from '../logger';
import { CompetitionReg } from '../models/registrations/Competition';
import { CompetitionCharityRoundUp } from '../models/registrations/CompetitionCharityRoundUp';
import { CompetitionDivision } from '../models/registrations/CompetitionDivision';
import { CompetitionGovernmentVoucher } from '../models/registrations/CompetitionGovernmentVoucher';
import { CompetitionLogo } from '../models/registrations/CompetitionLogo';
import { CompetitionMembershipProduct } from '../models/registrations/CompetitionMembershipProduct';
import { CompetitionMembershipProductDivision } from '../models/registrations/CompetitionMembershipProductDivision';
import { CompetitionMembershipProductFee } from '../models/registrations/CompetitionMembershipProductFee';
import { CompetitionMembershipProductType } from '../models/registrations/CompetitionMembershipProductType';
import { CompetitionNonPlayingDates } from '../models/registrations/CompetitionNonPlayingDates';
import { CompetitionPaymentInstalment } from '../models/registrations/CompetitionPaymentInstalment';
import { CompetitionPaymentMethod } from '../models/registrations/CompetitionPaymentMethod';
import { CompetitionPaymentOption } from '../models/registrations/CompetitionPaymentOption';
import { CompetitionRegistrationInvitees } from '../models/registrations/CompetitionRegistrationInvitees';
import { CompetitionRegistrationInviteesOrg } from '../models/registrations/CompetitionRegistrationInviteesOrg';
import { CompetitionTypeChildDiscount } from '../models/registrations/CompetitionTypeChildDiscount';
import { CompetitionTypeDiscount } from '../models/registrations/CompetitionTypeDiscount';
import { CompetitionTypeDiscountType } from '../models/registrations/CompetitionTypeDiscountType';
import { CompetitionVenue } from '../models/registrations/CompetitionVenue';
import { OrgRegistration } from '../models/registrations/OrgRegistration';
import { OrganisationLogo } from '../models/security/OrganisationLogo';
import { User } from '../models/security/User';
import { ArrayIsEmpty, fileExt, fileUploadOptions, isArrayPopulated, isNotNullAndUndefined, isNullOrNumber, isNullOrUndefinedValue, isNullOrZero, isPhoto, isPropertyNullOrZero, isStringNullOrEmpty, paginationData, PagingData, stringTONumber, timestamp, uuidv4 } from "../utils/Utils";
import AppConstants from '../validation/AppConstants';
import { BaseController } from './BaseController';

@JsonController('/api/competitionfee')
export class CompetitionController extends BaseController {

    @Authorized()
    @Post('/listing/:yearRefId')
    async getCompetitionFeeListing(
        @HeaderParam("authorization") currentUser: User,
        @Body() mpCompPagingBody: PagingData,
        @Param("yearRefId") yearRefId: string,
        @QueryParam('organisationUniqueKey') organisationUniqueKey: string,
        @QueryParam('sortBy') sortBy: string=undefined,
        @QueryParam('sortOrder') sortOrder: 'ASC'|'DESC'=undefined,
        @QueryParam('search') search: string,
        @Res() response: Response) {
        // const userId = currentUser.id;
        if (mpCompPagingBody.paging && mpCompPagingBody.paging.limit !== (undefined || null) && mpCompPagingBody.paging.offset !== (undefined || null)) {
            if (yearRefId) {
                if (organisationUniqueKey) {
                    const foundOrganisation = await this.organisationService.findOrganisationByUniqueKey(organisationUniqueKey);
                    if (isArrayPopulated(foundOrganisation)) {
                        const ORG_TYPE_REF_ID = foundOrganisation[0].organisationTypeRefId;
                        const ORG__ID = foundOrganisation[0].id;
                        try {
                            const OFFSET = stringTONumber(mpCompPagingBody.paging.offset);
                            const LIMIT = stringTONumber(mpCompPagingBody.paging.limit);
                            const YEAR = stringTONumber(yearRefId);

                            if (search === undefined || search === null) search = '';

                            let getResult = await this.competitionRegService.getCompetitionFeeListing(OFFSET, LIMIT, YEAR, ORG_TYPE_REF_ID, ORG__ID, search, sortBy, sortOrder);

                            let responseObject = paginationData(stringTONumber(getResult.count), LIMIT, OFFSET)
                            responseObject["competitionFees"] = getResult.data;

                            return response.status(200).send(responseObject)

                        } catch (err) {
                            logger.error(`Unable to get Competition Fees List` + err);
                            return response.status(400).send({
                                err, name: 'unexpected_error', message: process.env.NODE_ENV == AppConstants.development? 'Failed to get Competition Fees List.' + err : 'Failed to get Competition Fees List.'
                            });
                        }
                    }
                } else {
                    return response.status(212).send({
                        errorCode: 3,
                        message: 'Please pass organisationUniqueKey as query parameter for Competition Fee Listing'
                    });
                }
            } else {
                return response.status(212).send({
                    errorCode: 2,
                    message: 'Please pass yearRefId as path parameter for Competition Fee Listing'
                })
            }
        } else {
            return response.status(212).send({
                errorCode: 1,
                message: 'Please pass offset and limit in correct format for Competition Fee Listing'
            });
        }
    }

    @Authorized()
    @Post('/detail')
    async createCompetitionFeeDetail(
        @Body() competitionFeeBody,
        @HeaderParam("authorization") currentUser: User,
        @UploadedFiles("competition_logo",{options: fileUploadOptions}) competition_logo_file: Express.Multer.File[],
        @QueryParam('organisationUniqueKey') organisationUniqueKey: string,
        @QueryParam('sourceModule') sourceModule: string,
        @QueryParam('affiliateOrgId') affiliateOrgId: string,
        @Res() response: Response): Promise<any> {
        const userId = currentUser.id;
        let newCompetitionStatus: Boolean = true;
        let COMPETITION_FEE_DELETION_ALLOWED: Boolean = false;
        try {
            // TODO: passing finalsMatchTypeRefId as a static parameter, will update as per discussion
            if (organisationUniqueKey) {
                const foundOrganisationId = await this.organisationService.findOrganisationByUniqueKey(organisationUniqueKey);
                const affiliateOrganisation = await this.organisationService.findOrganisationByUniqueKey(affiliateOrgId);
                if (isArrayPopulated(foundOrganisationId)) {
                    //if ((isNotNullAndUndefined(competitionFeeBody.invitees)) || competitionFeeBody.hasRegistration  == 0)
                    //{

                    let competitionLogoFile = null;
                    let heroImageFile = null;
                    let heroImageUrl = null;
                    if (competition_logo_file && competition_logo_file.length > 0) {
                        if(competitionFeeBody.uploadFileType === '1'){
                            competitionLogoFile = competition_logo_file[0];
                        }
                        else if(competitionFeeBody.uploadFileType === '2'){
                            heroImageFile = competition_logo_file[0];
                        }
                        else if(competitionFeeBody.uploadFileType === '3'){
                            competitionLogoFile = competition_logo_file[0];
                            heroImageFile = competition_logo_file[1];
                        }
                        if(heroImageFile){
                            if (isPhoto(heroImageFile.mimetype)) {
                                let filename = `/competition/heroImage/${userId}_${timestamp()}.${fileExt(heroImageFile.originalname)}`;
                                let upload = await this.firebaseService.upload(filename, heroImageFile);
                                if (upload) {
                                    heroImageUrl = upload['url'];
                                }
                            }
                            else{
                                return response.status(400).send({ errorCode: 4, name: 'validation_error', message: 'File mime type not supported' });
                            }
                        }
                    }
                    let registrationCloseDate = null;
                    if (isNotNullAndUndefined(competitionFeeBody.registrationCloseDate)) {
                        const ORGANISATION_ID = foundOrganisationId[0].id;
                        let comp = new CompetitionReg();
                        let competitionID: number;
                        if (competitionFeeBody.competitionUniqueKey === '' || competitionFeeBody.competitionUniqueKey == null) {
                            comp.competitionUniqueKey = uuidv4();
                            comp.id = 0;
                            newCompetitionStatus = true;
                            comp.organisationId = ORGANISATION_ID;
                            comp.createdBy = userId;
                        } else {
                            const findCompetition = await this.competitionRegService.findCompetitionFeeDetailsByUniqueKey(competitionFeeBody.competitionUniqueKey);
                            if (isArrayPopulated(findCompetition)) {
                                if(ORGANISATION_ID != findCompetition[0].organisationId){
                                    return response.status(400).send({ errorCode: 7, name: 'organisation_error', message: 'Network Connectivity has been lost. Please contact your Competition Organiser if this error continues.' });
                                }
                                comp.competitionUniqueKey = competitionFeeBody.competitionUniqueKey;
                                comp.id = findCompetition[0].id;
                                registrationCloseDate = findCompetition[0].registrationCloseDate;
                                if(registrationCloseDate != competitionFeeBody.registrationCloseDate) {
                                    let actionArray = await this.actionsService.createAction15(ORGANISATION_ID,findCompetition[0].id,userId);
                                    await this.actionsService.batchCreateOrUpdate(actionArray)
                                }
                            }

                            newCompetitionStatus = false;
                            //comp.createdBy = userId;
                            comp.updatedBy = userId;
                            comp.updatedOn = new Date();
                        }

                        comp.name = competitionFeeBody.name;
                        comp.yearRefId = competitionFeeBody.yearRefId;
                        comp.description = competitionFeeBody.description;
                        comp.competitionTypeRefId = stringTONumber(competitionFeeBody.competitionTypeRefId);
                        comp.competitionFormatRefId = competitionFeeBody.competitionFormatRefId;
                        if (isStringNullOrEmpty(competitionFeeBody.invitees)) {
                            competitionFeeBody.invitees = JSON.parse(competitionFeeBody.invitees);
                            if (isArrayPopulated(competitionFeeBody.invitees)) {
                                comp.hasRegistration = 1;
                            }
                            else {
                                comp.hasRegistration = 0;
                            }
                        }
                        else {
                            comp.hasRegistration = 0;
                        }
                        comp.startDate = competitionFeeBody.startDate;
                        comp.endDate = competitionFeeBody.endDate;
                        comp.noOfRounds = competitionFeeBody.noOfRounds;
                        comp.roundInDays = competitionFeeBody.roundInDays;
                        comp.roundInHours = competitionFeeBody.roundInHours;
                        comp.roundInMins = competitionFeeBody.roundInMins;
                        comp.registrationCloseDate = competitionFeeBody.registrationCloseDate;
                        comp.minimumPlayers = competitionFeeBody.minimunPlayers;
                        comp.maximumPlayers = competitionFeeBody.maximumPlayers;
                        comp.statusRefId = competitionFeeBody.statusRefId;
                        comp.finalsMatchTypeRefId = 1;
                        comp.heroImageUrl = heroImageUrl ? heroImageUrl : competitionFeeBody.heroImageUrl;
                        comp.finalTypeRefId = competitionFeeBody.finalTypeRefId;
                        const createCompDetail = await this.competitionRegService.createOrUpdate(comp);
                        competitionID = createCompDetail.id;
                        const orgLogoStatus = await this.competitionLogoService.getOrganisationLogoStatus(ORGANISATION_ID);
                        const checkCompetitionUsed = await this.competitionRegService.checkCompetitionUsed(competitionID);
                        COMPETITION_FEE_DELETION_ALLOWED = isArrayPopulated(checkCompetitionUsed) && (checkCompetitionUsed[0].isUsedOrgRegEntity === false || checkCompetitionUsed[0].isUsedVenueConstraintEntity === false);


                           if(competitionLogoFile){
                            if (isPhoto(competitionLogoFile.mimetype)) {
                                let filename = `/competitions/logo_comp_${createCompDetail.competitionUniqueKey}_${timestamp()}.${fileExt(competitionLogoFile.originalname)}`;
                                let fileUploaded = await this.firebaseService.upload(filename, competitionLogoFile);

                                if (fileUploaded) {
                                    let compLogo = new CompetitionLogo();
                                    compLogo.id = stringTONumber(competitionFeeBody.competitionLogoId);
                                    compLogo.competitionId = comp.id;
                                    compLogo.organisationId = ORGANISATION_ID;

                                    if (isNullOrZero(compLogo.id)) {
                                        compLogo.createdBy = userId;
                                    } else {
                                        //compLogo.createdBy = userId;
                                        compLogo.updatedBy = userId;
                                        compLogo.updatedOn = new Date();
                                    }
                                    if (competitionFeeBody.logoSetAsDefault === "true") {
                                        let o = new OrganisationLogo();
                                        o.id = stringTONumber(competitionFeeBody.organisationLogoId);
                                        o.organisationId = ORGANISATION_ID;
                                        o.isDefault = 0;
                                        o.createdBy = userId;
                                        o.logoUrl = fileUploaded['url'];

                                        await this.organisationLogoService.createOrUpdate(o);
                                        // await this.organisationLogoService.updateOrganisationLogo(ORGANISATION_ID, fileUploaded['url']);
                                        compLogo.isDefault = 1;
                                    }

                                    if (competitionFeeBody.logoIsDefault === "true") {
                                        if (isArrayPopulated(orgLogoStatus)) {
                                            compLogo.isDefault = 1;
                                            compLogo.logoUrl = orgLogoStatus[0].logoUrl;
                                        } else {
                                            compLogo.isDefault = 1;
                                            compLogo.logoUrl = fileUploaded['url'];
                                        }
                                    } else {
                                        compLogo.isDefault = 0;
                                        compLogo.logoUrl = fileUploaded['url'];
                                    }

                                    await this.competitionLogoService.createOrUpdate(compLogo);
                                } else {
                                    return response.status(400).send({ errorCode: 5, name: 'save_error', message: 'Competition Logo Image not saved, try again later.' });
                                }
                            } else {
                                return response.status(400).send({ errorCode: 4, name: 'validation_error', message: 'File mime type not supported' });
                            }
                        } else if (isNotNullAndUndefined(competitionFeeBody.logoFileUrl) || isNotNullAndUndefined(competitionFeeBody.competition_logo)) {
                            // user doesn't uploads the file and url sent again to update
                            let compLogo = new CompetitionLogo();
                            compLogo.id = stringTONumber(competitionFeeBody.competitionLogoId);
                            compLogo.competitionId = comp.id;
                            compLogo.organisationId = ORGANISATION_ID;
                            if (isNullOrZero(compLogo.id)) {
                                compLogo.createdBy = userId;
                            } else {
                                //compLogo.createdBy = userId;
                                compLogo.updatedBy = userId;
                                compLogo.updatedOn = new Date();
                            }

                            if (competitionFeeBody.logoSetAsDefault === "true") {
                                const o = new OrganisationLogo();
                                o.id = stringTONumber(competitionFeeBody.organisationLogoId);
                                o.organisationId = ORGANISATION_ID;
                                o.isDefault = 0;
                                o.createdBy = userId;
                                if (isNotNullAndUndefined(competitionFeeBody.logoFileUrl)) {
                                    o.logoUrl = competitionFeeBody.logoFileUrl;
                                } else if (isNotNullAndUndefined(competitionFeeBody.competition_logo)) {
                                    o.logoUrl = competitionFeeBody.competition_logo;
                                }

                                await this.organisationLogoService.createOrUpdate(o);
                                // await this.organisationLogoService.updateOrganisationLogo(ORGANISATION_ID, competitionFeeBody.competition_logo || competitionFeeBody.logoFileUrl);
                            }

                            if (competitionFeeBody.logoIsDefault === "true") {
                                if (isArrayPopulated(orgLogoStatus)) {
                                    compLogo.isDefault = 1;
                                    compLogo.logoUrl = orgLogoStatus[0].logoUrl;
                                } else {
                                    compLogo.isDefault = 1;
                                    compLogo.logoUrl = competitionFeeBody.logoFileUrl;
                                }
                            } else {
                                compLogo.isDefault = 0;
                                compLogo.logoUrl = competitionFeeBody.logoFileUrl;
                            }
                            await this.competitionLogoService.createOrUpdate(compLogo);

                        }
                        else if (!competition_logo_file) {
                            return response.status(400).send({ errorCode: 3, name: 'file_not_available_error', message: 'Competition Logo File is required to upload' });
                        }




                        if (isStringNullOrEmpty(competitionFeeBody.venues)) {
                            competitionFeeBody.venues = JSON.parse(competitionFeeBody.venues)
                            if (ArrayIsEmpty(competitionFeeBody.venues)) {
                                // check if previous CompVenues data same as the current one
                                const checkPreviousCompVenues = await this.competitionVenueService.checkCompVenuesPreviousData(competitionID);
                                if (isArrayPopulated(checkPreviousCompVenues)) {
                                    //if (COMPETITION_FEE_DELETION_ALLOWED)
                                    {
                                        const PREVIOUS_VENUES_ID = [];
                                        for (let i of checkPreviousCompVenues) PREVIOUS_VENUES_ID.push(i['id'])

                                        PREVIOUS_VENUES_ID.forEach(async e => {
                                            const index = competitionFeeBody.venues.findIndex(g => g.competitionVenueId === e);
                                            if (index !== -1) {
                                                // checkPreviousCompVenues.splice(index, 1);
                                            } else {
                                                // user deleted compVenues data
                                                // await this.competitionVenueService.deleteVenuesPreviousData(competitionID, userId, e);

                                                let compVenues = new CompetitionVenue();
                                                compVenues.competitionId = competitionID;
                                                compVenues.createdBy = userId;
                                                compVenues.id = e;
                                                compVenues.isDeleted = 1; // true
                                                await this.competitionVenueService.createOrUpdate(compVenues);
                                            }
                                        });
                                    }
                                }
                                for (let v of competitionFeeBody.venues) {
                                    let compVenue = new CompetitionVenue();
                                    compVenue.id = v.competitionVenueId;
                                    compVenue.venueId = v.venueId;
                                    if (isNullOrZero(compVenue.id)) {
                                        compVenue.createdBy = userId;
                                    } else {
                                        //compVenue.createdBy = userId;
                                        compVenue.updatedBy = userId;
                                        compVenue.updatedOn = new Date();
                                    }
                                    compVenue.competitionId = competitionID;
                                    await this.competitionVenueService.createOrUpdate(compVenue);
                                }
                            }
                        }
                        if (isStringNullOrEmpty(competitionFeeBody.nonPlayingDates)) {
                            competitionFeeBody.nonPlayingDates = JSON.parse(competitionFeeBody.nonPlayingDates);
                            if (ArrayIsEmpty(competitionFeeBody.nonPlayingDates)) {
                                // check if previous non Playing dates same as the current one
                                const checkPreviousNonPlayingDates = await this.competitionNonPlayingDatesService.checkNonPlayingPreviousDates(competitionID);
                                if (isArrayPopulated(checkPreviousNonPlayingDates)) {
                                    // edit mode
                                    if (COMPETITION_FEE_DELETION_ALLOWED) {
                                        const PREVIOUS_PLAYING_DATES_ID = [];
                                        for (let i of checkPreviousNonPlayingDates) PREVIOUS_PLAYING_DATES_ID.push(i['id'])

                                        PREVIOUS_PLAYING_DATES_ID.forEach(async e => {
                                            const index = competitionFeeBody.nonPlayingDates.findIndex(g => g.competitionNonPlayingDatesId === e);
                                            if (index !== -1) {
                                                // checkPreviousNonPlayingDates.splice(index, 1);
                                            } else {
                                                // user deleted non playing dates
                                                // await this.competitionNonPlayingDatesService.deleteNonPlayingDtes(e, competitionID, userId);

                                                let compNonPlayingDates = new CompetitionNonPlayingDates();
                                                compNonPlayingDates.isDeleted = 1; // true
                                                compNonPlayingDates.competitionId = stringTONumber(competitionID);
                                                compNonPlayingDates.createdBy = stringTONumber(userId);
                                                compNonPlayingDates.id = stringTONumber(e);
                                                await this.competitionNonPlayingDatesService.createOrUpdate(compNonPlayingDates);
                                            }
                                        });
                                    }
                                }

                                for (let npdates of competitionFeeBody.nonPlayingDates) {
                                    let compNonPlayingDates = new CompetitionNonPlayingDates();
                                    compNonPlayingDates.id = npdates.competitionNonPlayingDatesId;
                                    compNonPlayingDates.name = npdates.name;
                                    compNonPlayingDates.nonPlayingDate = npdates.nonPlayingDate;
                                    if (isNullOrZero(compNonPlayingDates.id)) {
                                        compNonPlayingDates.createdBy = userId;
                                    } else {
                                        //compNonPlayingDates.createdBy = userId;
                                        compNonPlayingDates.updatedOn = new Date();
                                        compNonPlayingDates.updatedBy = userId;
                                    }
                                    compNonPlayingDates.competitionId = competitionID;
                                    await this.competitionNonPlayingDatesService.createOrUpdate(compNonPlayingDates);
                                }
                            }
                        }

                        //if (isStringNullOrEmpty(competitionFeeBody.invitees)) {
                        //  competitionFeeBody.invitees = JSON.parse(competitionFeeBody.invitees);
                        if (isArrayPopulated(competitionFeeBody.invitees)) {

                            const checkPreviousInvitees = await this.competitionRegistrationInviteesService.checkInviteesPreviousData(competitionID, ORGANISATION_ID);
                            if (isArrayPopulated(checkPreviousInvitees)) {
                                if (COMPETITION_FEE_DELETION_ALLOWED) {
                                    const PREVIOUS_INVITEES_ID = [];
                                    for (let i of checkPreviousInvitees) PREVIOUS_INVITEES_ID.push(i['id'])

                                    PREVIOUS_INVITEES_ID.forEach(async e => {
                                        const index = competitionFeeBody.invitees.findIndex(g => g.inviteesId === e);
                                        if (index === -1) {
                                            // user deleted invitees data
                                            // await this.competitionRegistrationInviteesService.deleteInviteesPreviousData(competitionID, e);
                                            let compRegInviteesDelete = new CompetitionRegistrationInvitees();
                                            compRegInviteesDelete.id = e;
                                            compRegInviteesDelete.createdBy = userId;
                                            compRegInviteesDelete.competitionId = competitionID;
                                            compRegInviteesDelete.isDeleted = 1; // true
                                            await this.competitionRegistrationInviteesService.createOrUpdate(compRegInviteesDelete);
                                        }
                                    });
                                }
                            }

                            for (let inv of competitionFeeBody.invitees) {
                                let compRegInvitees = new CompetitionRegistrationInvitees();
                                compRegInvitees.competitionId = competitionID;
                                compRegInvitees.id = inv.inviteesId;
                                compRegInvitees.registrationInviteesRefId = inv.registrationInviteesRefId;
                                if (isNullOrZero(compRegInvitees.id)) {
                                    compRegInvitees.createdBy = userId;
                                } else {
                                    //compRegInvitees.createdBy = userId;
                                    compRegInvitees.updatedBy = userId;
                                    compRegInvitees.updatedOn = new Date();
                                }
                                let inviteesRes = await this.competitionRegistrationInviteesService.createOrUpdate(compRegInvitees);
                                let compInviteesOrgDb = await this.competitionRegistrationInviteesOrgService.findByRegInviteesId(inviteesRes.id)

                                let compInviteesOrgMap = new Map();
                                if (isArrayPopulated(inv.inviteesOrg)) {
                                    for (let invOrg of inv.inviteesOrg) {
                                        let orgId = await this.organisationService.findByUniquekey(invOrg.organisationUniqueKey);
                                        let competitionRegistrationInviteesOrg = new CompetitionRegistrationInviteesOrg()
                                        competitionRegistrationInviteesOrg.id = invOrg.competitionInviteesOrgId;
                                        competitionRegistrationInviteesOrg.organisationId = orgId
                                        competitionRegistrationInviteesOrg.competitionRegistrationInviteesId = inviteesRes.id
                                        competitionRegistrationInviteesOrg.createdBy = userId
                                        compInviteesOrgMap.set(competitionRegistrationInviteesOrg.id, competitionRegistrationInviteesOrg);
                                        await this.competitionRegistrationInviteesOrgService.createOrUpdate(competitionRegistrationInviteesOrg);

                                        // if(invOrg.competitionInviteesOrgId == 0)
                                        // {
                                        //     const orgReg = new OrgRegistration();
                                        //     orgReg.id = 0;
                                        //     orgReg.competitionId = competitionID;
                                        //     orgReg.yearRefId = competitionFeeBody.yearRefId;
                                        //     orgReg.organisationId = orgId;
                                        //     orgReg.statusRefId = 1;
                                        //     orgReg.createdBy = userId;
                                        //     await this.orgRegistrationService.createOrUpdate(orgReg);
                                        // }
                                    }
                                }
                                if (isArrayPopulated(compInviteesOrgDb)) {
                                    for (let item of compInviteesOrgDb) {
                                        if (compInviteesOrgMap.get(item.id) == undefined) {
                                            item.isDeleted = 1;
                                            item.updatedBy = userId;
                                            item.updatedOn = new Date();
                                            await this.competitionRegistrationInviteesOrgService.createOrUpdate(item);
                                            await this.orgRegistrationService.updatOrgRegistration(userId, competitionID, item.organisationId)
                                        }
                                    }
                                }


                            }
                        }
                        else {

                            let dummyMembershipProductId = await this.membershipProductService.findByDummyMembershipId()
                            let dummyMembershipTypeMappingId = await this.membershipProductTypeMappingService.findByMemebershipId(dummyMembershipProductId)
                            let cmpExist = await this.competitionMembershipProductService.findByCompetition(competitionID)
                            let compMembershipProduct = new CompetitionMembershipProduct();
                            if (!cmpExist) {
                                compMembershipProduct.id = 0;
                                compMembershipProduct.competitionId = competitionID
                                compMembershipProduct.membershipProductId = dummyMembershipProductId;
                                compMembershipProduct.createdBy = userId;
                                // compMembershipProduct.createdOn = new Date();
                                let compMembershipProductRes = await this.competitionMembershipProductService.createOrUpdate(compMembershipProduct);

                                let compMembershipProductType = new CompetitionMembershipProductType();
                                compMembershipProductType.id = 0;
                                compMembershipProductType.membershipProductTypeMappingId = dummyMembershipTypeMappingId;
                                compMembershipProductType.competitionMembershipProductId = compMembershipProductRes.id;
                                compMembershipProductType.createdBy = userId;
                                // compMembershipProductType.createdOn =new Date();
                                await this.competitionMembershipProductTypeService.createOrUpdate(compMembershipProductType);
                            }


                        }
                        // }
                        let affiliateOrganisationId = null;
                        if(isArrayPopulated(affiliateOrganisation)){
                            affiliateOrganisationId = affiliateOrganisation[0].id
                        }

                        return response.status(200).send({
                            id: createCompDetail.competitionUniqueKey,
                            errorCode: 0,
                            message: 'Competition Fees successfully saved',
                            data: await this.getCompetitionFeeDataAfterSaving(createCompDetail.competitionUniqueKey, competitionID, ORGANISATION_ID, ORGANISATION_ID, organisationUniqueKey, sourceModule,
                                affiliateOrganisationId)
                        });
                    } else {
                        return response.status(212).send({
                            errorCode: 9, message: 'Please select registration close date to proceed forward'
                        });
                    }
                    //}
                    // else {
                    //     return response.status(212).send({
                    //         errorCode: 8, message: 'Please select invitees to proceed forward'
                    //     });
                    // }
                } else {
                    return response.status(212).send({
                        errorCode: 2, message: 'Cannot find any organisation with the provided key.'
                    });
                }
            } else {
                return response.status(212).send({
                    errorCode: 1, message: 'Please pass organisationUniqueKey as a Query parameter.'
                });
            }
        } catch (err) {
            logger.error(`Unable to save competition fee detail` + err);
            return response.status(212).send({
                err, name: 'unexpected_error',message: process.env.NODE_ENV == AppConstants.development? 'Failed to save the competition fee detail.' + err : 'Failed to save the competition fee detail.'
            });

        }
    }

    @Authorized()
    @Get('/detail')
    async getCompetitionFeeDetail(
        @HeaderParam("authorization") currentUser: User,
        @QueryParam('competitionUniqueKey') competitionUniqueKey: string,
        @QueryParam('organisationUniqueKey') organisationUniqueKey: string,
        @Res() response: Response) {
        // const userId = currentUser.id;
        try {
            if (competitionUniqueKey) {
                if (organisationUniqueKey) {
                    const foundCompetition = await this.competitionRegService.findCompetitionFeeDetailsByUniqueKey(competitionUniqueKey);
                    const foundOrganisation = await this.organisationService.findOrganisationByUniqueKey(organisationUniqueKey);
                    if (isArrayPopulated(foundCompetition)) {
                        // const userId = foundCompetition[0].createdBy;
                        if (isArrayPopulated(foundOrganisation)) {
                            const ORGANISATION_ID = foundOrganisation[0].id;
                            const competitionCreatorOrgId = foundCompetition[0].organisationId;
                            const foundDetails = await this.competitionRegService.getCompetitionFeeDetails(competitionUniqueKey, ORGANISATION_ID, competitionCreatorOrgId);
                            if (foundDetails) {
                                return response.status(200).send(foundDetails)
                            } else {
                                return response.status(212).send({
                                    errorCode: 5, message: 'Failed to get Competition Details.'
                                })
                            }
                        } else {
                            return response.status(212).send({
                                errorCode: 4,
                                message: 'Cannot find any organisation with the provided key'
                            });
                        }
                    } else {
                        return response.status(212).send({
                            errorCode: 3,
                            message: 'Cannot find any competition with the provided key'
                        });
                    }
                } else {
                    return response.status(212).send({
                        errorCode: 2, message: 'Please pass organisationUniqueKey as a Query parameter.'
                    })
                }
            } else {
                return response.status(212).send({
                    errorCode: 1, message: 'No competitions available.'
                })
            }
        } catch (err) {
            logger.error(`Unable to get Competition Details` + err);
            return response.status(400).send({
                err, name: 'unexpected_error', message: process.env.NODE_ENV == AppConstants.development? 'Failed to get Competition Details.' + err : 'Failed to get Competition Details.'
            });
        }
    }

    @Authorized()
    @Post('/membership')
    async createCompetitionFeeMembership(
        @HeaderParam("authorization") currentUser: User,
        @Body() competitionMembershipFeeBody,
        @QueryParam('competitionUniqueKey') competitionUniqueKey: string,
        @QueryParam('organisationUniqueKey') organisationUniqueKey: string,
        @QueryParam('affiliateOrgId') affiliateOrgId: string,
        @Res() response: Response) {
        const userId = currentUser.id;
        try {
            if (competitionUniqueKey) {
                if (organisationUniqueKey) {
                    const foundOrganisation = await this.organisationService.findOrganisationByUniqueKey(organisationUniqueKey);
                    const affiliateOrganisation = await this.organisationService.findOrganisationByUniqueKey(affiliateOrgId);
                    if (isArrayPopulated(foundOrganisation)) {
                        const foundCompetition = await this.competitionRegService.findCompetitionFeeDetailsByUniqueKey(competitionUniqueKey);
                        if (isArrayPopulated(foundCompetition)) {
                            const CompetitionId = foundCompetition[0].id;
                            const competitionCreatorOrgId = foundCompetition[0].organisationId;
                            const ORGANISATION_ID = foundOrganisation[0].id;
                            const foundCompCreatorOrganisation = await this.organisationService.findOrganisationById(competitionCreatorOrgId);
                            let competitionCreatorOrgUniqueKey = "";
                            if (isArrayPopulated(foundCompCreatorOrganisation)) {
                                competitionCreatorOrgUniqueKey = foundCompCreatorOrganisation[0].organisationUniqueKey;
                            }

                            if (isArrayPopulated(competitionMembershipFeeBody.membershipProducts)) {
                                for (let fee of competitionMembershipFeeBody.membershipProducts) {
                                    const foundMembershipProduct = await this.membershipProductService.findProductByUniqueId(fee.membershipProductUniqueKey);
                                    if (isArrayPopulated(foundMembershipProduct)) {
                                        if (isArrayPopulated(fee.membershipProductTypes)) {
                                            const MEMBERSHIP_PRODUCT = foundMembershipProduct[0].id;

                                            ///////////////////////////////////////////// Previous Membership Product Type check //////////////////////////////////////////////////

                                            const checkPreviousCompMembershipProductsTypes = await this.competitionMembershipProductTypeService.checkCompMemProTypePreviousData(CompetitionId, MEMBERSHIP_PRODUCT);
                                            if (ArrayIsEmpty(checkPreviousCompMembershipProductsTypes)) {
                                                const PREVIOUS_COMP_MEM_PRO_TYPE_ID = [];
                                                for (let i of checkPreviousCompMembershipProductsTypes) PREVIOUS_COMP_MEM_PRO_TYPE_ID.push(i['id'])
                                                console.log()
                                                PREVIOUS_COMP_MEM_PRO_TYPE_ID.forEach(async e => {
                                                    const index = fee.membershipProductTypes.findIndex(g => g.competitionMembershipProductTypeId === e);
                                                    if (index !== -1) {
                                                        // checkPreviousCompMembershipProductsTypes.splice(index, 1);
                                                    } else {
                                                        // user unchecks membershipProducts Types
                                                        let cmpt = new CompetitionMembershipProductType();
                                                        cmpt.id = e;
                                                        cmpt.isDeleted = 1; // true
                                                        await this.competitionMembershipProductTypeService.createOrUpdate(cmpt);
                                                        // const deletedTypes = await this.competitionMembershipProductTypeService.deleteCompMemProTypePreviousData(CompetitionId, MEMBERSHIP_PRODUCT, userId, e);
                                                    }
                                                });
                                            }

                                            ///////////////////////////////////////////// Previous Membership Product Type check //////////////////////////////////////////////////

                                            const checkPreviousCompMembershipProducts = await this.competitionMembershipProductService.checkCompMemProPreviousData(CompetitionId, ORGANISATION_ID);
                                            if (ArrayIsEmpty(checkPreviousCompMembershipProducts)) {
                                                const PREVIOUS_COMP_MEM_PRO_ID = [];
                                                for (let i of checkPreviousCompMembershipProducts) {
                                                    PREVIOUS_COMP_MEM_PRO_ID.push(i['id']);
                                                }

                                                let deleteChild;
                                                let deleteDiscount;
                                                let deleteFee;
                                                let deleteDivision;
                                                let deleteCompetitionMembershipProductType;
                                                let deleteCompetitionMembershipProduct;
                                                // PREVIOUS_COMP_MEM_PRO_ID.forEach(async e => {
                                                for (let e of PREVIOUS_COMP_MEM_PRO_ID) {
                                                    const index = competitionMembershipFeeBody.membershipProducts.findIndex(g => g.competitionMembershipProductId === e);
                                                    if (index !== -1) {
                                                        // checkPreviousCompMembershipProducts.splice(index, 1);
                                                    } else {
                                                        // user unchecks membershipProducts
                                                        // Child Discount
                                                        let getIDForChildDelete = await this.competitionTypeChildDiscountService.getIDForDeleteCompChildByCompMemProId(e, ORGANISATION_ID);
                                                        if (ArrayIsEmpty(getIDForChildDelete)) {

                                                            for (let i of getIDForChildDelete) {
                                                                const ctcd = new CompetitionTypeChildDiscount();
                                                                ctcd.id = i.id;
                                                                ctcd.organisationId = ORGANISATION_ID;
                                                                ctcd.isDeleted = 1; // true
                                                                deleteChild = await this.competitionTypeChildDiscountService.createOrUpdate(ctcd);
                                                            }
                                                        }

                                                        // Discount
                                                        let getIDForDiscountDelete = await this.competitionTypeDiscountService.getIDForDeleteCompDisByCompMemProId(e, ORGANISATION_ID);
                                                        if (ArrayIsEmpty(getIDForDiscountDelete)) {

                                                            for (let i of getIDForDiscountDelete) {
                                                                const ctd = new CompetitionTypeDiscount();
                                                                ctd.id = i.id;
                                                                ctd.isDeleted = 1; // true
                                                                deleteDiscount = await this.competitionTypeDiscountService.createOrUpdate(ctd);
                                                            }
                                                        }

                                                        // Fees
                                                        let getIDForFeeDelete = await this.competitionMembershipProductFeeService.getIDForDeleteCompFeesByCompMemproId(e);
                                                        if (ArrayIsEmpty(getIDForFeeDelete)) {

                                                            for (let i of getIDForFeeDelete) {
                                                                let cmpfee = new CompetitionMembershipProductFee();
                                                                cmpfee.id = i.id;
                                                                cmpfee.isDeleted = 1; // true
                                                                deleteFee = await this.competitionMembershipProductFeeService.createOrUpdate(cmpfee);
                                                            }
                                                        }

                                                        // Division
                                                        let getIDForDivisionDelete = await this.competitionMembershipProductDivisionService.getIDForDeleteCompDivisionbyCompMemProId(e);
                                                        if (ArrayIsEmpty(getIDForDivisionDelete)) {

                                                            for (let i of getIDForDivisionDelete) {
                                                                let cmpd = new CompetitionMembershipProductDivision();
                                                                cmpd.id = i.id;
                                                                cmpd.isDeleted = 1; // true
                                                                deleteDivision = await this.competitionMembershipProductDivisionService.createOrUpdate(cmpd);
                                                            }
                                                        }

                                                        // MembershipProductType
                                                        let getIDForCompetitionMembershipProductTypeDelete = await this.competitionMembershipProductTypeService.getIDForDeleteCompMemProTypeByMemProId(e);
                                                        if (ArrayIsEmpty(getIDForCompetitionMembershipProductTypeDelete)) {
                                                            for (let i of getIDForCompetitionMembershipProductTypeDelete) {
                                                                let cmpt = new CompetitionMembershipProductType();
                                                                cmpt.id = i.id;
                                                                cmpt.isDeleted = 1; // true
                                                                cmpt.competitionMembershipProductId = e;
                                                                deleteCompetitionMembershipProductType = await this.competitionMembershipProductTypeService.createOrUpdate(cmpt);
                                                            }
                                                        }

                                                        // MembershipProduct
                                                        let getIDForCompetitionMembershipProductDelete = await this.competitionMembershipProductService.getIDForDeletePreviousCompMemProduct(CompetitionId, e);
                                                        if (ArrayIsEmpty(getIDForCompetitionMembershipProductDelete)) {

                                                            for (let i of getIDForCompetitionMembershipProductDelete) {
                                                                let cmp = new CompetitionMembershipProduct();
                                                                cmp.id = i.id;
                                                                cmp.isDeleted = 1; // true
                                                                deleteCompetitionMembershipProduct = await this.competitionMembershipProductService.createOrUpdate(cmp);
                                                            }
                                                        }
                                                    }
                                                }//);
                                                // const deleteAll = await Promise.all([deleteChild, deleteDiscount, deleteFee, deleteDivision, deleteCompetitionMembershipProductType, deleteCompetitionMembershipProduct])
                                            }
                                        }
                                    }
                                }

                                for (let fee of competitionMembershipFeeBody.membershipProducts) {
                                    // check if membershipProduct exists
                                    const foundMembershipProduct = await this.membershipProductService.findProductByUniqueId(fee.membershipProductUniqueKey);

                                    if (isArrayPopulated(foundMembershipProduct)) {
                                        if (isArrayPopulated(fee.membershipProductTypes)) {
                                            const MEMBERSHIP_PRODUCT = foundMembershipProduct[0].id;

                                            let cmp = new CompetitionMembershipProduct();
                                            cmp.id = stringTONumber(isPropertyNullOrZero(fee.competitionMembershipProductId));

                                            if (isNullOrZero(cmp.id)) {
                                                cmp.createdBy = userId;
                                            } else {
                                                //cmp.createdBy = userId;
                                                cmp.updatedBy = userId;
                                                cmp.updatedOn = new Date();
                                            }
                                            cmp.competitionId = CompetitionId;
                                            cmp.membershipProductId = MEMBERSHIP_PRODUCT;

                                            const cmpData = await this.competitionMembershipProductService.createOrUpdate(cmp);

                                            for (let t of fee.membershipProductTypes) {
                                                let cmptype = new CompetitionMembershipProductType();

                                                cmptype.id = stringTONumber(isPropertyNullOrZero(t.competitionMembershipProductTypeId));
                                                cmptype.membershipProductTypeMappingId = t.membershipProductTypeMappingId;
                                                cmptype.competitionMembershipProductId = cmpData.id;

                                                if (isNullOrZero(cmptype.id)) {
                                                    cmptype.createdBy = userId;
                                                } else {
                                                    //cmptype.createdBy = userId;
                                                    cmptype.updatedBy = userId;
                                                    cmptype.updatedOn = new Date();
                                                }

                                                // const checkPreviousProductsWithTypes = await this.competitionMembershipProductService.getPreviousProductsWithTypes(cmpData.id, userId);

                                                await this.competitionMembershipProductTypeService.createOrUpdate(cmptype);
                                            }
                                        } else {
                                            return response.status(212).send({
                                                errorCode: 1,
                                                message: 'Please pass CompetitionFee Membership Product Type'
                                            });
                                        }
                                    } else {
                                        return response.status(212).send({
                                            errorCode: 2,
                                            message: 'Membership Product not found'
                                        });
                                    }
                                }

                                let affiliateOrganisationId = null;
                                if(isArrayPopulated(affiliateOrganisation)){
                                    affiliateOrganisationId = affiliateOrganisation[0].id
                                }

                                return response.status(200).send({
                                    errorCode: 0,
                                    message: 'CompetitionFee Membership successfully saved',
                                    data: await this.getCompetitionFeeDataAfterSaving(competitionUniqueKey, CompetitionId, ORGANISATION_ID, competitionCreatorOrgId,
                                        competitionCreatorOrgUniqueKey, AppConstants.reg, affiliateOrganisationId)
                                });
                            } else {
                                return response.status(212).send({
                                    errorCode: 5,
                                    message: 'Please choose a Membership Product'
                                });
                            }
                        } else {
                            return response.status(212).send({
                                errorCode: 4,
                                message: `No competition found with the id ${competitionUniqueKey}`
                            });
                        }
                    } else {
                        return response.status(212).send({
                            errorCode: 3,
                            message: 'No organisation found with the provided key'
                        });
                    }
                } else {
                    return response.status(212).send({
                        errorCode: 2,
                        message: 'Please pass organisationKey as a query parameter'
                    });
                }
            } else {
                return response.status(212).send({
                    errorCode: 1,
                    message: 'No competitions available'
                });
            }
        } catch (err) {
            logger.error(`Unable to save competitionfee membership` + err);
            return response.status(212).send({
                err, name: 'unexpected_error',  message: process.env.NODE_ENV == AppConstants.development?  'Failed to save competitionfee membership' + err : 'Failed to save competitionfee membership'
            });
        }
    }

    @Authorized()
    @Get('/membership')
    async getCompetitionFeeMembership(
        @HeaderParam("authorization") currentUser: User,
        @QueryParam('competitionUniqueKey') competitionUniqueKey: string,
        @QueryParam('organisationUniqueKey') organisationUniqueKey: string,
        @Res() response: Response) {
        // let userId = currentUser.id;
        try {
            if (competitionUniqueKey) {
                if (organisationUniqueKey) {
                    const foundCompetition = await this.competitionRegService.findCompetitionFeeDetailsByUniqueKey(competitionUniqueKey);
                    const foundOrganisation = await this.organisationService.findOrganisationByUniqueKey(organisationUniqueKey);
                    if (isArrayPopulated(foundOrganisation)) {
                        if (isArrayPopulated(foundCompetition)) {
                            // const userId = foundCompetition[0].createdBy;
                            const getMembership = await this.competitionMembershipProductService.getCompetitionFeeMembership(competitionUniqueKey, foundOrganisation[0].id);
                            if (isArrayPopulated(getMembership)) {
                                return response.status(200).send(getMembership);
                            } else {
                                return response.status(212).send({
                                    errorCode: 5, message: 'cannot get Competition Fee Membership'
                                });
                            }
                        } else {
                            return response.status(212).send({
                                errorCode: 4, message: `Cannot find competition with the provided key ${competitionUniqueKey}`
                            });
                        }
                    } else {
                        return response.status(212).send({
                            errorCode: 3, message: `Cannot find organisation with the provided key ${organisationUniqueKey}`
                        });
                    }
                } else {
                    return response.status(212).send({
                        errorCode: 2, message: 'Please pass organisationUniqueKey as query parameters'
                    });
                }
            } else {
                return response.status(212).send({
                    errorCode: 1, message: 'Please pass competitionUniqueKey as query parameters'
                });
            }
        } catch (err) {
            logger.error(`Unable to get competition fee membership`);
            return response.status(212).send({
                err, name: 'unexpected_error',  message: process.env.NODE_ENV == AppConstants.development? 'Failed to get competition fee membership' + err : 'Failed to get competition fee membership'
            });
        }
    }

    @Authorized()
    @Post('/division')
    async createCompetitionDivision(
        @HeaderParam("authorization") currentUser: User,
        @Body() competitionMembershipDivisionBody,
        @QueryParam('competitionUniqueKey') competitionUniqueKey: string,
        @QueryParam('organisationUniqueKey') organisationUniqueKey: string,
        @QueryParam('sourceModule') sourceModule: string,
        @QueryParam('affiliateOrgId') affiliateOrgId: string,
        @Res() response: Response) {
        const userId = currentUser.id;
        try {
            if (competitionUniqueKey) {
                if (organisationUniqueKey) {
                    const foundCompetition = await this.competitionRegService.findCompetitionFeeDetailsByUniqueKey(competitionUniqueKey);
                    const foundOrganisation = await this.organisationService.findOrganisationByUniqueKey(organisationUniqueKey);
                    const affiliateOrganisation = await this.organisationService.findOrganisationByUniqueKey(affiliateOrgId);
                    if (isArrayPopulated(foundOrganisation)) {
                        if (isArrayPopulated(foundCompetition)) {
                            const CompetitionId = foundCompetition[0].id;
                            const competitionCreatorOrgId = foundCompetition[0].organisationId;
                            const ORGANISATION_ID = foundOrganisation[0].id;
                            const foundCompCreatorOrganisation = await this.organisationService.findOrganisationById(competitionCreatorOrgId);
                            let competitionCreatorOrgUniqueKey = "";
                            if (isArrayPopulated(foundCompCreatorOrganisation)) {
                                competitionCreatorOrgUniqueKey = foundCompCreatorOrganisation[0].organisationUniqueKey;
                            }
                            if (competitionMembershipDivisionBody) {

                                let competition = new CompetitionReg();
                                competition.id = CompetitionId;
                                competition.statusRefId = competitionMembershipDivisionBody.statusRefId;
                                competition.registrationRestrictionTypeRefId = competitionMembershipDivisionBody.registrationRestrictionTypeRefId;
                                competition.updatedBy = userId;
                                competition.updatedOn = new Date();
                                await this.competitionRegService.createOrUpdate(competition)
                                if (isArrayPopulated(competitionMembershipDivisionBody.divisions)) {
                                    // Previous divisions check
                                    if (sourceModule == AppConstants.comp){
                                        await this.competitionDivsionSave(competitionMembershipDivisionBody.divisions, userId);
                                    }
                                    else{
                                        await this.competitionMembershipProductDivisionSave(competitionMembershipDivisionBody.divisions, userId)
                                    }
                                }

                                let affiliateOrganisationId = null;
                                if(isArrayPopulated(affiliateOrganisation)){
                                    affiliateOrganisationId = affiliateOrganisation[0].id
                                }

                                return response.status(200).send({
                                    errorCode: 0,
                                    message: 'CompetitionFee Division successfully saved',
                                    data: await this.getCompetitionFeeDataAfterSaving(competitionUniqueKey, CompetitionId, ORGANISATION_ID, competitionCreatorOrgId,
                                        competitionCreatorOrgUniqueKey, sourceModule, affiliateOrganisationId)
                                });

                            }

                        } else {
                            return response.status(212).send({
                                errorCode: 4,
                                message: `No competition found with the id ${competitionUniqueKey}`
                            });
                        }
                    } else {
                        return response.status(212).send({
                            errorCode: 3,
                            message: `No organisation found with the id ${organisationUniqueKey}`
                        });
                    }
                } else {
                    return response.status(212).send({
                        errorCode: 2, message: 'Please pass organisationUniqueKey as a query parameter'
                    });
                }
            } else {
                return response.status(212).send({
                    errorCode: 1, message: 'No competitions available'
                });
            }
        } catch (err) {
            logger.error(`Unable to save competition fee division`);
            return response.status(212).send({
                err, name: 'unexpected_error', message: process.env.NODE_ENV == AppConstants.development? 'Failed to save competition fee division' + err : 'Failed to save competition fee division'
            });
        }
    }

    public async competitionMembershipProductDivisionSave(divisions: any, userId: number) {
        try {
            for (let div of divisions) {
                const checkPreviousDivisions = await this.competitionMembershipProductDivisionService.checkCompMemProDivisionsPreviousData(div.competitionMembershipProductId);

                if (isArrayPopulated(checkPreviousDivisions)) {
                    const PREVIOUS_DIVISIONS_ID = [];
                    for (let i of checkPreviousDivisions) PREVIOUS_DIVISIONS_ID.push(i['id'])

                    PREVIOUS_DIVISIONS_ID.forEach(async e => {
                        const index = divisions.findIndex(g => g.competitionMembershipProductDivisionId === e);
                        if (index !== -1) {
                            // checkPreviousDivisions.splice(index, 1);
                        } else {
                            // user deleted divisions data
                            // await this.competitionMembershipProductDivisionService.deleteDivisionsPreviousData(div.competitionMembershipProductId, userId, e);
                            const cmpd = new CompetitionMembershipProductDivision();
                            cmpd.id = e;
                            cmpd.isDeleted = 1; // true
                            await this.competitionMembershipProductDivisionService.createOrUpdate(cmpd);
                        }
                    });
                }
            }


            for (let div of divisions) {
                let division = new CompetitionMembershipProductDivision();
                division.competitionMembershipProductId = div.competitionMembershipProductId;
                division.id = div.competitionMembershipProductDivisionId
                division.divisionName = div.divisionName;
                division.genderRefId = div.genderRefId;
                division.fromDate = div.fromDate;
                division.toDate = div.toDate;

                if (isNullOrZero(division.id)) {
                    division.createdBy = userId;
                } else {
                    division.updatedBy = userId;
                    division.updatedOn = new Date();
                }

                await this.competitionMembershipProductDivisionService.createOrUpdate(division);
            }
        }
        catch (error) {
            throw error;
        }
    }

    public async competitionDivsionSave(divisions: any, userId: number) {
        try {

            for (let div of divisions) {
                const checkPreviousDivisions = await this.competitionDivisionService.checkCompMemProDivisionsPreviousData(div.competitionMembershipProductId);
                //console.log("******" + JSON.stringify(checkPreviousDivisions));
                if (isArrayPopulated(checkPreviousDivisions)) {
                    const PREVIOUS_DIVISIONS_ID = [];
                    for (let i of checkPreviousDivisions) PREVIOUS_DIVISIONS_ID.push(i['id'])

                   // console.log("PREVIOUS_DIVISIONS_ID" + JSON.stringify(PREVIOUS_DIVISIONS_ID));

                    PREVIOUS_DIVISIONS_ID.forEach(async e => {
                        const index = divisions.findIndex(g => g.competitionDivisionId === e);
                        if (index !== -1) {
                            // checkPreviousDivisions.splice(index, 1);
                        } else {
                            // user deleted divisions data
                            // await this.competitionMembershipProductDivisionService.deleteDivisionsPreviousData(div.competitionMembershipProductId, userId, e);
                            const cmpd = new CompetitionDivision();
                            cmpd.id = e;
                            cmpd.isDeleted = 1; // true
                            await this.competitionDivisionService.createOrUpdate(cmpd);
                        }
                    });
                }
            }

            for (let div of divisions) {
                let division = new CompetitionDivision();
                division.id = div.competitionDivisionId;
                division.competitionMembershipProductId = div.competitionMembershipProductId;
                division.competitionMembershipProductDivisionId = div.competitionMembershipProductDivisionId
                division.divisionName = div.divisionName;
                division.genderRefId = div.genderRefId;
                division.fromDate = div.fromDate;
                division.toDate = div.toDate;

                if (isNullOrZero(division.id)) {
                    division.createdBy = userId;
                } else {
                    division.updatedBy = userId;
                    division.updatedOn = new Date();
                }

                await this.competitionDivisionService.createOrUpdate(division);
            }
        }
        catch (error) {
            throw error;
        }
    }

    @Authorized()
    @Post('/competitiondivision/delete')
    async deleteCompetitionDivision(
        @HeaderParam("authorization") currentUser: User,
        @Body() competitionDivisionBody,
        @Res() response: Response) {
        const userId = currentUser.id;
        try {
            await this.competitionDivisionService.findTeamByDivision(competitionDivisionBody.competitionDivisionId, userId)

            await this.competitionDivisionService.findPlayerByDivision(competitionDivisionBody.competitionDivisionId, userId)

            // if( (isArrayEmpty(findDivisionTeams)) || (isArrayEmpty(findDivisionPlayers)) ){
            //     return response.status(212).send({message: AppConstants.competitionDivisionValidation})
            // }
            // else{
            let compDiv = new CompetitionDivision();
            compDiv.id = competitionDivisionBody.competitionDivisionId;
            compDiv.isDeleted = 1;
            compDiv.updatedBy = userId;
            compDiv.updatedOn = new Date();
            await this.competitionDivisionService.createOrUpdate(compDiv);

            return response.status(200).send({ message: AppConstants.competitionDivisionDeleteSuccess })
            // }

        } catch (err) {
            logger.error(`Unable to save competition fee division`);
            return response.status(212).send({
                err, name: 'unexpected_error', message: process.env.NODE_ENV == AppConstants.development? 'Failed to save competition fee division' + err : 'Failed to save competition fee division'
            });
        }
    }


    @Authorized()
    @Get('/division')
    async getCompetitionFeeDivision(
        @HeaderParam("authorization") currentUser: User,
        @QueryParam('competitionUniqueKey') competitionUniqueKey: string,
        @QueryParam('organisationUniqueKey') organisationUniqueKey: string,
        @QueryParam('sourceModule') sourceModule: string,
        @Res() response: Response) {
        // let userId = currentUser.id;
        try {
            const foundOrganisation = await this.organisationService.findOrganisationByUniqueKey(organisationUniqueKey);
            const foundCompetition = await this.competitionRegService.findCompetitionFeeDetailsByUniqueKey(competitionUniqueKey);
            if (isArrayPopulated(foundOrganisation)) {
                if (isArrayPopulated(foundCompetition)) {
                    // const userId = foundCompetition[0].createdBy;
                    let getMembership;

                    if (sourceModule == AppConstants.comp)
                        getMembership = await this.competitionMembershipProductDivisionService.getCompetitionFeeDivisionForComp(competitionUniqueKey, foundOrganisation[0].id);
                    else
                        getMembership = await this.competitionMembershipProductDivisionService.getCompetitionFeeDivision(competitionUniqueKey, foundOrganisation[0].id);
                    if (isArrayPopulated(getMembership)) {
                        if (isArrayPopulated(getMembership[0]['competitionFeeDivision'])) {
                            return response.status(200).send(getMembership);
                        }
                    } else {
                        return response.status(212).send({
                            errorCode: 1, message: 'cannot get competition Membership Division'
                        });
                    }
                } else {
                    return response.status(212).send({
                        errorCode: 2, message: 'No Competition found with the provided ID'
                    });
                }
            } else {
                return response.status(212).send({
                    errorCode: 3, message: 'No Organisation found with the provided ID'
                });
            }
        } catch (err) {
            logger.error(`Unable to get competition membership division`);
            return response.status(212).send({
                err, name: 'unexpected_error', message: process.env.NODE_ENV == AppConstants.development? 'Failed to get competition membership division' + err : 'Failed to get competition membership division'
            });
        }
    }

    @Authorized()
    @Post('/fees')
    async createCompetitionFeeFees(
        @HeaderParam("authorization") currentUser: User,
        @Body() competitionMembershipFeeBody,
        @QueryParam('organisationUniqueKey') organisationUniqueKey: string,
        @QueryParam('competitionUniqueKey') competitionUniqueKey: string,
        @QueryParam('affiliateOrgId') affiliateOrgId: string,
        @Res() response: Response) {
        const userId = currentUser.id;
        try {
            if (isArrayPopulated(competitionMembershipFeeBody)) {
                if (organisationUniqueKey) {
                    if (competitionUniqueKey) {
                        const foundCompetition = await this.competitionRegService.findCompetitionFeeDetailsByUniqueKey(competitionUniqueKey);
                        const foundOrganisation = await this.organisationService.findOrganisationByUniqueKey(organisationUniqueKey);
                        const affiliateOrganisation = await this.organisationService.findOrganisationByUniqueKey(affiliateOrgId);
                        let orgRegDb = await this.orgRegistrationService.findOrgReg(foundCompetition[0].id, foundOrganisation[0].id);

                        if (isArrayPopulated(foundCompetition)) {
                            if (isArrayPopulated(foundOrganisation)) {
                                const CompetitionId: number = foundCompetition[0].id;
                                const CompetitionCreatorOrgId: number = foundCompetition[0].organisationId;
                                const ORGANISATION_ID: number = foundOrganisation[0].id;

                                const foundCompCreatorOrganisation = await this.organisationService.findOrganisationById(CompetitionCreatorOrgId);
                                let competitionCreatorOrgUniqueKey = "";
                                if (isArrayPopulated(foundCompCreatorOrganisation)) {
                                    competitionCreatorOrgUniqueKey = foundCompCreatorOrganisation[0].organisationUniqueKey;
                                }

                                for (let f of competitionMembershipFeeBody) {

                                    const checkPreviousDivisions = await this.competitionMembershipProductFeeService.findDivisionsOfSpecificFees(f.competitionMembershipProductTypeId, ORGANISATION_ID);

                                    if (isArrayPopulated(checkPreviousDivisions)) {
                                        for (let i of checkPreviousDivisions) {
                                            // as division can be object type (null) in one case and can be number type (2) so, type is compared and checked below
                                            //if ((typeof i.competitionMembershipProductDivisionId) !== (typeof f.competitionMembershipProductDivisionId)) {
                                                // delete the previous divisions ::::
                                                // delete division of affiliaites for the same change from per to all or vice versa
                                                const cmpfeedelete = new CompetitionMembershipProductFee();
                                                cmpfeedelete.isDeleted = 1;
                                                cmpfeedelete.id = i.id;
                                                cmpfeedelete.competitionMembershipProductDivisionId = i.competitionMembershipProductDivisionId;
                                                cmpfeedelete.competitionMembershipProductTypeId = i.competitionMembershipProductTypeId;
                                                await this.competitionMembershipProductFeeService.createOrUpdate(cmpfeedelete);

                                            // } else {
                                            //     // no changes made within all and per divisons type
                                            // }
                                        }
                                    }
                                }

                                for (let f of competitionMembershipFeeBody) {

                                    let cmpfee = new CompetitionMembershipProductFee();

                                    cmpfee.id = 0; //f.competitionMembershipProductFeeId;

                                    if (isNullOrZero(cmpfee.id)) {
                                        cmpfee.createdBy = userId;
                                    } else {
                                        //cmpfee.createdBy = userId;
                                        cmpfee.updatedBy = userId;
                                        cmpfee.updatedOn = new Date();
                                    }

                                    cmpfee.organisationId = ORGANISATION_ID;
                                    cmpfee.competitionMembershipProductTypeId = f.competitionMembershipProductTypeId;
                                    if(f.isPlayer == 1)
                                        cmpfee.competitionMembershipProductDivisionId = f.competitionMembershipProductDivisionId;
                                    else
                                        cmpfee.competitionMembershipProductDivisionId = null;

                                    // if (f.affiliateCasualFees || f.affiliateCasualGST || f.affiliateSeasonalFees || f.affiliateSeasonalGST
                                    //     || f.affiliateTeamSeasonalFees || f.affiliateTeamSeasonalGST) {
                                    if(CompetitionCreatorOrgId!= ORGANISATION_ID){
                                        cmpfee.casualFees = isNullOrNumber(f.affiliateCasualFees);
                                        cmpfee.casualGST = isNullOrNumber(f.affiliateCasualGST);
                                        cmpfee.seasonalFees = isNullOrNumber(f.affiliateSeasonalFees);
                                        cmpfee.seasonalGST = isNullOrNumber(f.affiliateSeasonalGST);
                                        cmpfee.teamSeasonalFees = isNullOrNumber(f.affiliateTeamSeasonalFees);
                                        cmpfee.teamSeasonalGST = isNullOrNumber(f.affiliateTeamSeasonalGST);
                                        cmpfee.teamCasualFees = isNullOrNumber(f.affiliateTeamCasualFees);
                                        cmpfee.teamCasualGST = isNullOrNumber(f.affiliateTeamCasualGST);
                                        cmpfee.isSeasonal = f.isSeasonal == null ? 1 : f.isSeasonal;
                                        cmpfee.isCasual = f.isCasual == null ? 1 : f.isCasual;
                                        cmpfee.isTeamSeasonal = f.isTeamSeasonal == null ? 1 : f.isTeamSeasonal;
                                        cmpfee.isTeamCasual = f.isTeamCasual == null ? 1 : f.isTeamCasual;
                                        cmpfee.nominationSeasonalFee = isNullOrNumber(f.affNominationSeasonalFee);
                                        cmpfee.nominationSeasonalGST = isNullOrNumber(f.affNominationSeasonalGST);
                                        cmpfee.nominationTeamSeasonalFee = isNullOrNumber(f.affNominationTeamSeasonalFee);
                                        cmpfee.nominationTeamSeasonalGST = isNullOrNumber(f.affNominationTeamSeasonalGST);
                                        cmpfee.teamRegChargeTypeRefId = f.teamRegChargeTypeRefId;
                                    } else {
                                        cmpfee.casualFees = isNullOrUndefinedValue(f.casualFees);
                                        cmpfee.casualGST = isNullOrUndefinedValue(f.casualGST);
                                        cmpfee.seasonalFees = isNullOrUndefinedValue(f.seasonalFees);
                                        cmpfee.seasonalGST = isNullOrUndefinedValue(f.seasonalGST);
                                        cmpfee.teamSeasonalFees = isNullOrNumber(f.teamSeasonalFees);
                                        cmpfee.teamSeasonalGST = isNullOrNumber(f.teamSeasonalGST);
                                        cmpfee.teamCasualFees = isNullOrNumber(f.teamCasualFees);
                                        cmpfee.teamCasualGST = isNullOrNumber(f.teamCasualGST);
                                        cmpfee.isSeasonal = f.isSeasonal == null ? 1 : f.isSeasonal;
                                        cmpfee.isCasual = f.isCasual == null ? 1 : f.isCasual;
                                        cmpfee.isTeamSeasonal = f.isTeamSeasonal == null ? 1 : f.isTeamSeasonal;
                                        cmpfee.isTeamCasual = f.isTeamCasual == null ? 1 : f.isTeamCasual;
                                        cmpfee.nominationSeasonalFee = isNullOrNumber(f.nominationSeasonalFee);
                                        cmpfee.nominationSeasonalGST = isNullOrNumber(f.nominationSeasonalGST);
                                        cmpfee.nominationTeamSeasonalFee = isNullOrNumber(f.nominationTeamSeasonalFee);
                                        cmpfee.nominationTeamSeasonalGST = isNullOrNumber(f.nominationTeamSeasonalGST);
                                        cmpfee.teamRegChargeTypeRefId = f.teamRegChargeTypeRefId;

                                        await this.competitionMembershipProductFeeService.updateTeamFeesForAffiliates(f.competitionMembershipProductTypeId , f.isTeamSeasonal, f.teamRegChargeTypeRefId, userId)
                                    }
                                    await this.competitionMembershipProductFeeService.createOrUpdate(cmpfee);
                                }

                                if(orgRegDb != undefined){
                                    let orgReg = new OrgRegistration();
                                    orgReg.id = orgRegDb.id;
                                    orgReg.competitionId = orgRegDb.competitionId;
                                    orgReg.feeStatusRefId = 2;
                                    orgReg.updatedBy = userId;
                                    orgReg.updatedOn = new Date();
                                    await this.orgRegistrationService.createOrUpdate(orgReg);
                                }

                                let affiliateOrganisationId = null;
                                if(isArrayPopulated(affiliateOrganisation)){
                                    affiliateOrganisationId = affiliateOrganisation[0].id
                                }

                                return response.status(200).send({
                                    errorCode: 0,
                                    message: 'CompetitionFee Fees successfully saved',
                                    data: await this.getCompetitionFeeDataAfterSaving(competitionUniqueKey, CompetitionId, ORGANISATION_ID, CompetitionCreatorOrgId,
                                        competitionCreatorOrgUniqueKey, AppConstants.reg, affiliateOrganisationId)
                                });
                            } else {
                                return response.status(212).send({
                                    errorCode: 5,
                                    message: `No organisation found with the id ${organisationUniqueKey}`
                                });
                            }
                        } else {
                            return response.status(212).send({
                                errorCode: 4,
                                message: `No competition found with the id ${competitionUniqueKey}`
                            });
                        }
                    } else {
                        return response.status(212).send({
                            errorCode: 3,
                            message: `No competitions available`
                        });
                    }
                } else {
                    return response.status(212).send({
                        errorCode: 2,
                        message: `Please pass organisationUniqueKey as a query parameter`
                    });
                }

            } else {
                return response.status(212).send({
                    errorCode: 1,
                    message: `Please pass competitionMembershipFeeBody in the correct format`
                });
            }
        } catch (err) {
            logger.error(`Unable to save competitionfee fees` + err);
            return response.status(212).send({
                err, name: 'unexpected_error', message: process.env.NODE_ENV == AppConstants.development? 'Failed to save competitionfee fees' + err : 'Failed to save competitionfee fees'
            });
        }
    }

    @Authorized()
    @Get('/fees')
    async getCompetitionFeeFees(
        @HeaderParam("authorization") currentUser: User,
        @QueryParam('competitionUniqueKey') competitionUniqueKey: string,
        @QueryParam('organisationUniqueKey') organisationUniqueKey: string,
        @Res() response: Response) {
        // let userId = currentUser.id;
        try {
            if (organisationUniqueKey) {
                if (competitionUniqueKey) {
                    const foundCompetition = await this.competitionRegService.findCompetitionFeeDetailsByUniqueKey(competitionUniqueKey);
                    const foundOrganisation = await this.organisationService.findOrganisationByUniqueKey(organisationUniqueKey);
                    if (isArrayPopulated(foundOrganisation)) {
                        if (isArrayPopulated(foundCompetition)) {
                            // const userId = foundCompetition[0].createdBy;
                            const competitionCreatorOrgId = foundCompetition[0].organisationId;

                            const getCompFee = await this.competitionMembershipProductFeeService.getCompetitionFeeFees(0, competitionUniqueKey, foundOrganisation[0].id, competitionCreatorOrgId);
                            if (isArrayPopulated(getCompFee)) {
                                return response.status(200).send(getCompFee);
                            } else {
                                return response.status(212).send([]);
                            }
                        } else {
                            return response.status(212).send({
                                errorCode: 2,
                                message: `No competition found with the provided key ${competitionUniqueKey}`
                            });
                        }
                    } else {
                        return response.status(212).send({
                            errorCode: 3, message: `No organisation found with the provided key ${organisationUniqueKey}`
                        });
                    }
                } else {
                    return response.status(212).send({
                        errorCode: 4, message: 'No competitions available'
                    });
                }
            } else {
                return response.status(212).send({
                    errorCode: 5, message: 'Please pass organisationUniqueKey as a query parameter'
                });
            }
        } catch (err) {
            logger.error(`Unable to get competitionfee fees` + err);
            return response.status(212).send({
                err, name: 'unexpected_error', message: process.env.NODE_ENV == AppConstants.development? 'Failed to get competitionfee fees' + err : 'Failed to get competitionfee fees'
            });
        }
    }

    @Authorized()
    @Post('/paymentoption')
    async createCompetitionFeePaymentOption(
        @HeaderParam("authorization") currentUser: User,
        @Body() competitionMembershipPayBody,
        @QueryParam('organisationUniqueKey') organisationUniqueKey: string,
        @QueryParam('competitionUniqueKey') competitionUniqueKey: string,
        @QueryParam('affiliateOrgId') affiliateOrgId: string,
        @Res() response: Response) {
        const userId = currentUser.id;
        try {
            if (competitionUniqueKey) {
                if (organisationUniqueKey) {
                    const foundCompetition = await this.competitionRegService.findCompetitionFeeDetailsByUniqueKey(competitionUniqueKey);
                    const foundOrganisation = await this.organisationService.findOrganisationByUniqueKey(organisationUniqueKey);
                    const affiliateOrganisation = await this.organisationService.findOrganisationByUniqueKey(affiliateOrgId);
                    if (isArrayPopulated(foundCompetition)) {
                        if (isArrayPopulated(foundOrganisation)) {
                            const CompetitionId = foundCompetition[0].id;
                            const competitionCreatorOrgId = foundCompetition[0].organisationId;
                            const ORGANISATION_ID = foundOrganisation[0].id;
                            const foundCompCreatorOrganisation = await this.organisationService.findOrganisationById(competitionCreatorOrgId);
                            let competitionCreatorOrgUniqueKey = "";
                            if (isArrayPopulated(foundCompCreatorOrganisation)) {
                                competitionCreatorOrgUniqueKey = foundCompCreatorOrganisation[0].organisationUniqueKey;
                            }
                            if (ArrayIsEmpty(competitionMembershipPayBody.charityRoundUp)) {

                                const checkPreviousCharity = await this.competitionCharityRoundUpService.checkPreviousCharity(CompetitionId);
                                let PREVIOUS_CHARITY = [];
                                if (isArrayPopulated(checkPreviousCharity)) {
                                    for (let i of checkPreviousCharity) PREVIOUS_CHARITY.push(i.id);
                                }

                                PREVIOUS_CHARITY.forEach(async e => {
                                    const index = competitionMembershipPayBody.charityRoundUp.findIndex(g => g.charityRoundUpId === e);
                                    if (index === -1) {
                                        // user deleted some charity
                                        let charityDelete = new CompetitionCharityRoundUp();
                                        charityDelete.isDeleted = 1;
                                        charityDelete.id = e;
                                        await this.competitionCharityRoundUpService.createOrUpdate(charityDelete);
                                    }
                                });

                                for (let c of competitionMembershipPayBody.charityRoundUp) {
                                    let cmpcharity = new CompetitionCharityRoundUp();
                                    cmpcharity.competitionId = CompetitionId;
                                    cmpcharity.charityRoundUpRefId = c.charityRoundUpRefId;
                                    cmpcharity.id = c.charityRoundUpId;
                                    cmpcharity.name = c.charityRoundUpName;
                                    cmpcharity.description = c.charityRoundUpDescription;

                                    if (isNullOrZero(cmpcharity.id)) {
                                        cmpcharity.createdBy = userId;
                                    } else {
                                        //cmpcharity.createdBy = userId;
                                        cmpcharity.updatedBy = userId;
                                        cmpcharity.updatedOn = new Date();
                                    }

                                    await this.competitionCharityRoundUpService.createOrUpdate(cmpcharity);
                                }
                            }

                            if (isArrayPopulated(competitionMembershipPayBody.paymentOptions)) {

                                const checkPreviousPaymentOptions = await this.competitionPaymentOptionService.checkPreviousPaymentOptions(CompetitionId);
                                let PREVIOUS_PAYMENTS = [];
                                if (isArrayPopulated(checkPreviousPaymentOptions)) {
                                    for (let i of checkPreviousPaymentOptions) PREVIOUS_PAYMENTS.push(i.id);
                                }

                                PREVIOUS_PAYMENTS.forEach(async e => {
                                    const index = competitionMembershipPayBody.paymentOptions.findIndex(g => g.paymentOptionId === e);
                                    if (index === -1) {
                                        // user deleted some payments
                                        let paymentDelete = new CompetitionPaymentOption();
                                        paymentDelete.isDeleted = 1;
                                        paymentDelete.id = e;
                                        await this.competitionPaymentOptionService.createOrUpdate(paymentDelete);
                                    }
                                });


                                for (let p of competitionMembershipPayBody.paymentOptions) {
                                    let cmppay = new CompetitionPaymentOption();
                                    cmppay.id = p.paymentOptionId;

                                    if (isNullOrZero(cmppay.id)) {
                                        cmppay.createdBy = userId;
                                    } else {
                                        //cmppay.createdBy = userId;
                                        cmppay.updatedBy = userId;
                                        cmppay.updatedOn = new Date();
                                    }

                                    cmppay.feesTypeRefId = p.feesTypeRefId;
                                    cmppay.paymentOptionRefId = p.paymentOptionRefId;
                                    cmppay.competitionId = foundCompetition[0].id;
                                    let res = await this.competitionPaymentOptionService.createOrUpdate(cmppay);
                                }

                                let instalmentDatesArr = [];
                                if(isArrayPopulated(competitionMembershipPayBody.instalmentDates)){

                                    competitionMembershipPayBody.instalmentDates.map((x) => {
                                        let instalment = new CompetitionPaymentInstalment();
                                        if(isNullOrZero(x.paymentInstalmentId)){
                                            instalment.createdBy = userId;
                                        }
                                        else{
                                            instalment.updatedBy = userId;
                                            instalment.updatedOn = new Date();
                                        }
                                        instalment.id = x.paymentInstalmentId;
                                        instalment.instalmentDate = x.instalmentDate;
                                        instalment.feesTypeRefId = x.feesTypeRefId;
                                        instalment.paymentOptionRefId = x.paymentOptionRefId;
                                        instalment.competitionId = foundCompetition[0].id;
                                        instalmentDatesArr.push(instalment);
                                    })
                                }

                                const checkPreviousPaymentInstalments = await this.competitionPaymentInstalmentService.checkPreviousPaymentInstalments(CompetitionId);
                                let PREVIOUS_INSTALMENTS = [];
                                if (isArrayPopulated(checkPreviousPaymentInstalments)) {
                                    for (let i of checkPreviousPaymentInstalments) PREVIOUS_INSTALMENTS.push(i.id);
                                }

                                PREVIOUS_INSTALMENTS.forEach(async e => {
                                    const index = instalmentDatesArr.findIndex(g => g.id === e);
                                    if (index === -1) {
                                        // user deleted some payments
                                        let instalmentDelete = new CompetitionPaymentInstalment();
                                        instalmentDelete.isDeleted = 1;
                                        instalmentDelete.id = e;
                                        await this.competitionPaymentInstalmentService.createOrUpdate(instalmentDelete);
                                    }
                                });

                                if(isArrayPopulated(instalmentDatesArr)){
                                    await this.competitionPaymentInstalmentService.batchCreateOrUpdate(instalmentDatesArr);
                                }
                            }

                            if (isArrayPopulated(competitionMembershipPayBody.paymentMethods)) {

                                const checkPreviousPaymentMethods = await this.competitionPaymentMethodService.checkPreviousPaymentMethods(CompetitionId);
                                let PREVIOUS_METHODS = [];
                                if (isArrayPopulated(checkPreviousPaymentMethods)) {
                                    for (let i of checkPreviousPaymentMethods) PREVIOUS_METHODS.push(i.id);
                                }

                                PREVIOUS_METHODS.forEach(async e => {
                                    const index = competitionMembershipPayBody.paymentMethods.findIndex(g => g.paymentMethodId === e);
                                    if (index === -1) {
                                        // user deleted some payments
                                        let paymentDelete = new CompetitionPaymentMethod();
                                        paymentDelete.isDeleted = 1;
                                        paymentDelete.id = e;
                                        await this.competitionPaymentMethodService.createOrUpdate(paymentDelete);
                                    }
                                });


                                for (let p of competitionMembershipPayBody.paymentMethods) {
                                    let cmppay = new CompetitionPaymentMethod();
                                    cmppay.id = p.paymentMethodId;

                                    if (isNullOrZero(cmppay.id)) {
                                        cmppay.createdBy = userId;
                                    } else {
                                        cmppay.updatedBy = userId;
                                        cmppay.updatedOn = new Date();
                                    }

                                    cmppay.paymentMethodRefId = p.paymentMethodRefId;
                                    cmppay.competitionId = foundCompetition[0].id;
                                    let res = await this.competitionPaymentMethodService.createOrUpdate(cmppay);
                                }
                            }

                            let competitionReg = new CompetitionReg();
                            competitionReg.id = CompetitionId;
                            competitionReg.updatedOn = new Date();
                            competitionReg.updatedBy = userId;
                            competitionReg.isSeasonalUponReg = competitionMembershipPayBody.isSeasonalUponReg;
                            competitionReg.isTeamSeasonalUponReg = competitionMembershipPayBody.isTeamSeasonalUponReg;
                            competitionReg.seasonalSchoolRegCode = competitionMembershipPayBody.seasonalSchoolRegCode;
                            competitionReg.teamSeasonalSchoolRegCode = competitionMembershipPayBody.teamSeasonalSchoolRegCode;

                            await this.competitionRegService.createOrUpdate(competitionReg);

                            let affiliateOrganisationId = null;
                            if(isArrayPopulated(affiliateOrganisation)){
                                affiliateOrganisationId = affiliateOrganisation[0].id
                            }

                            return response.status(200).send({
                                errorCode: 0,
                                message: 'CompetitionFee Payment Options successfully saved',
                                data: await this.getCompetitionFeeDataAfterSaving(competitionUniqueKey, CompetitionId, ORGANISATION_ID, competitionCreatorOrgId,
                                    competitionCreatorOrgUniqueKey, AppConstants.reg, affiliateOrganisationId)
                            });

                        } else {
                            return response.status(212).send({
                                errorCode: 4,
                                message: `No organisation found with the id ${organisationUniqueKey}`
                            });
                        }

                    } else {
                        return response.status(212).send({
                            errorCode: 3,
                            message: `No competition found with the id ${competitionUniqueKey}`
                        });
                    }
                } else {
                    return response.status(212).send({
                        errorCode: 2,
                        message: `Please pass organisationUniqueKey as a query parameter`
                    });
                }
            } else {
                return response.status(212).send({
                    errorCode: 1,
                    message: `No competitions available`
                });
            }
        } catch (err) {
            logger.error(`Unable to save competition fee payment option`);
            return response.status(212).send({
                err, name: 'unexpected_error', message: process.env.NODE_ENV == AppConstants.development? 'Failed to save competitionfee payment option' + err : 'Failed to save competitionfee payment option'
            });
        }
    }

    @Authorized()
    @Get('/paymentoption')
    async getCompetitionFeePaymentOption(
        @HeaderParam("authorization") currentUser: User,
        @QueryParam('competitionUniqueKey') competitionUniqueKey: string,
        @QueryParam('organisationUniqueKey') organisationUniqueKey: string,
        @Res() response: Response) {
        // let userId = currentUser.id;
        try {
            const foundCompetition = await this.competitionRegService.findCompetitionFeeDetailsByUniqueKey(competitionUniqueKey);
            const foundOrganisation = await this.organisationService.findOrganisationByUniqueKey(organisationUniqueKey);
            if (isArrayPopulated(foundOrganisation)) {
                if (isArrayPopulated(foundCompetition)) {
                    // const userId = foundCompetition[0].createdBy;
                    const getCompPay = await this.competitionPaymentOptionService.getCompetitionFeePaymentOption(foundCompetition[0].id);
                    if (isArrayPopulated(getCompPay)) {
                        return response.status(200).send(getCompPay);
                    } else {
                        return response.status(212).send({
                            errorCode: 1, message: 'cannot get CompetitionFee Payment Option'
                        });
                    }
                } else {
                    return response.status(212).send({
                        errorCode: 3,
                        message: `No competition found with the id ${competitionUniqueKey}`
                    });
                }
            } else {
                return response.status(212).send({
                    errorCode: 2,
                    message: `No organisation found with the id ${organisationUniqueKey}`
                });
            }
        } catch (err) {
            logger.error(`Unable to get competitionfee payment option`);
            return response.status(212).send({
                err, name: 'unexpected_error', message: process.env.NODE_ENV == AppConstants.development? 'Failed to get competitionfee Payment Option' + err : 'Failed to get competitionfee Payment Option'
            });
        }
    }

    @Authorized()
    @Post('/discount')
    async createCompetitionFeeDiscount(
        @HeaderParam("authorization") currentUser: User,
        @Body() competitionMembershipDiscountBody,
        @QueryParam('competitionUniqueKey') competitionUniqueKey: string,
        @QueryParam('organisationUniqueKey') organisationUniqueKey: string,
        @QueryParam('affiliateOrgId') affiliateOrgId: string,
        @Res() response: Response) {
        const userId = currentUser.id;
        try {

            if (competitionUniqueKey) {
                if (organisationUniqueKey) {
                    if (competitionMembershipDiscountBody.competitionId === competitionUniqueKey) {
                        const foundCompetition = await this.competitionRegService.findCompetitionFeeDetailsByUniqueKey(competitionUniqueKey);
                        const foundOrganisation = await this.organisationService.findOrganisationByUniqueKey(organisationUniqueKey);
                        const affiliateOrganisation = await this.organisationService.findOrganisationByUniqueKey(affiliateOrgId);
                        console.log("competitionUniqueKey::" + competitionUniqueKey + "***" + foundCompetition);
                        console.log("organisationUniqueKey::" + organisationUniqueKey + "***" + foundOrganisation);
                        if (isArrayPopulated(foundCompetition)) {
                            if (isArrayPopulated(foundOrganisation)) {
                                const competitionID = foundCompetition[0].id;
                                const ORGANISATION_ID = foundOrganisation[0].id;
                                const competitionCreatorOrgId = foundCompetition[0].organisationId;
                                const organisationTypeRefId: number = foundOrganisation[0].organisationTypeRefId;
                                const STATUS_ID = stringTONumber(competitionMembershipDiscountBody.statusRefId);

                                const foundCompCreatorOrganisation = await this.organisationService.findOrganisationById(competitionCreatorOrgId);
                                let competitionCreatorOrgUniqueKey = "";
                                if (isArrayPopulated(foundCompCreatorOrganisation)) {
                                    competitionCreatorOrgUniqueKey = foundCompCreatorOrganisation[0].organisationUniqueKey;
                                }

                                if (STATUS_ID !== 3) {
                                    await this.competitionRegService.updateStatus(competitionUniqueKey, STATUS_ID);

                                    if (STATUS_ID === 2) {
                                        // published
                                        let INVITED_TO: number = 0;
                                        let getAllAffiliatesByInvitorId = [];
                                        let anyOrgansiationAffiliates = [];
                                        let competitionInviteeId = 0;

                                        // get invitees whether 3 or 2
                                        const getInvitees = await this.competitionRegistrationInviteesService.getInviteesDetail(competitionUniqueKey, ORGANISATION_ID);

                                        const parentFeeBody = await this.competitionMembershipProductFeeService.getCompetitionFeeParentFees(ORGANISATION_ID, competitionUniqueKey);
                                        const parentCompetition = await this.competitionRegService.getCompetitionFeeParentDetails(ORGANISATION_ID, competitionUniqueKey);

                                        let INVITEES_ID: any = [];
                                        let INVITEES_REF_ID: any = [];
                                        let organisationArray = [];

                                        if (isArrayPopulated(getInvitees)) {
                                            for (let i of getInvitees) {
                                                INVITEES_ID.push(i.id);
                                                INVITEES_REF_ID.push(i.registrationInviteesRefId);
                                            }
                                        }

                                        if ((INVITEES_REF_ID.includes(2) || INVITEES_REF_ID.includes(3)) && (INVITEES_REF_ID.includes(7) || INVITEES_REF_ID.includes(8))) {
                                            // both anyOrganisation and affiliatedOrganisations selected

                                            let affliliateInvited;
                                            if ((INVITEES_REF_ID.includes(2)) && (!INVITEES_REF_ID.includes(3))) affliliateInvited = 3
                                            else if ((INVITEES_REF_ID.includes(3)) && (!INVITEES_REF_ID.includes(2))) affliliateInvited = 4

                                            getAllAffiliatesByInvitorId = await this.competitionMembershipProductFeeService.getAllAffiliations(ORGANISATION_ID, affliliateInvited, organisationTypeRefId);
                                            organisationArray.push(...getAllAffiliatesByInvitorId);

                                            for (let i of INVITEES_ID) {
                                                anyOrgansiationAffiliates = await this.competitionMembershipProductFeeService.getAllAnyOrgInvitees(i);
                                                organisationArray.push(...anyOrgansiationAffiliates);
                                            }

                                        } else {

                                            if (INVITEES_REF_ID.includes(2) || INVITEES_REF_ID.includes(3)) {

                                                let affliliateInvited;
                                                if ((INVITEES_REF_ID.includes(2)) && (!INVITEES_REF_ID.includes(3))) affliliateInvited = 3
                                                else if ((INVITEES_REF_ID.includes(3)) && (!INVITEES_REF_ID.includes(2))) affliliateInvited = 4

                                                getAllAffiliatesByInvitorId = await this.competitionMembershipProductFeeService.getAllAffiliations(ORGANISATION_ID, affliliateInvited, organisationTypeRefId);
                                                organisationArray.push(...getAllAffiliatesByInvitorId);

                                            } else if (INVITEES_REF_ID.includes(5)) {

                                                // direct invites
                                                let regFormDirect = new OrgRegistration();
                                                regFormDirect.id = 0;
                                                regFormDirect.organisationId = parentCompetition[0].organisationId;
                                                regFormDirect.createdBy = parentCompetition[0].createdBy;
                                                regFormDirect.isDeleted = 0;
                                                regFormDirect.yearRefId = parentCompetition[0].yearRefId;
                                                regFormDirect.feeStatusRefId = 2;
                                                regFormDirect.competitionId = parentCompetition[0].id;

                                                await this.orgRegistrationService.createOrUpdate(regFormDirect);

                                                let actionObject = await this.actionsService.createAction3(ORGANISATION_ID, competitionID, userId)
                                                await this.actionsService.createOrUpdate(actionObject);

                                            } else if (INVITEES_REF_ID.includes(7) || INVITEES_REF_ID.includes(8)) {

                                                for (let i of INVITEES_ID) {
                                                    anyOrgansiationAffiliates = await this.competitionMembershipProductFeeService.getAllAnyOrgInvitees(i);
                                                    organisationArray.push(...anyOrgansiationAffiliates);
                                                }

                                            }

                                        }

                                        const flags = new Set();
                                        console.log("ORGANISATION_ID" + ORGANISATION_ID)
                                        console.log("competitionCreatorOrgId" + competitionCreatorOrgId)
                                        console.log("organisationArray" + JSON.stringify(organisationArray))
                                        const UniqueOrganisations = organisationArray.filter(entry => {

                                            if (flags.has(entry.organisationId)) {
                                                return false;
                                            }
                                            flags.add(entry.organisationId);
                                            return true;
                                            
                                        });

                                        console.log("UniqueOrganisations" + JSON.stringify(UniqueOrganisations));

                                        let feeArray = [];
                                        if (isArrayPopulated(parentFeeBody)) {
                                            for (let f of parentFeeBody) {
                                                // initially to create empty fees for all affiliates
                                                if (isArrayPopulated(UniqueOrganisations)) {
                                                    for (let i of UniqueOrganisations) {
                                                        if(i.organisationId == competitionCreatorOrgId){
                                                            continue;
                                                        }

                                                        let cmpfeeAFFILIATES = new CompetitionMembershipProductFee();
                                                        cmpfeeAFFILIATES.id = 0;

                                                        cmpfeeAFFILIATES.createdBy = userId;

                                                        cmpfeeAFFILIATES.organisationId = i.organisationId;
                                                        cmpfeeAFFILIATES.competitionMembershipProductTypeId = f.competitionMembershipProductTypeId;
                                                        cmpfeeAFFILIATES.competitionMembershipProductDivisionId = f.competitionMembershipProductDivisionId;

                                                        cmpfeeAFFILIATES.casualFees = null;
                                                        cmpfeeAFFILIATES.casualGST = null;
                                                        cmpfeeAFFILIATES.seasonalFees = null;
                                                        cmpfeeAFFILIATES.seasonalGST = null;
                                                        cmpfeeAFFILIATES.isCasual = f.isCasual;
                                                        cmpfeeAFFILIATES.isSeasonal = f.isSeasonal;
                                                        cmpfeeAFFILIATES.isTeamSeasonal = f.isTeamSeasonal;
                                                        cmpfeeAFFILIATES.isTeamCasual = f.isTeamCasual;

                                                        feeArray.push(cmpfeeAFFILIATES);
                                                    }

                                                }
                                            }
                                            let orgString = ''
                                            let orgArray = [];
                                            if (isArrayPopulated(UniqueOrganisations)) {
                                                for (let i of UniqueOrganisations) {
                                                    orgArray.push(i.organisationId)
                                                }
                                                orgString = orgArray.join(',');
                                                await this.competitionMembershipProductFeeService.deleteRemovedAffiliateTeams(parentCompetition[0].id, orgString, userId)
                                            }
                                            await this.competitionMembershipProductFeeService.batchCreateOrUpdate(feeArray);

                                            let regArray = [];
                                            if (isArrayPopulated(UniqueOrganisations)) {
                                                for (let i of UniqueOrganisations) {
                                                    let regForm = new OrgRegistration();
                                                    regForm.id = 0;
                                                    regForm.organisationId = i.organisationId;
                                                    regForm.createdBy = userId;
                                                    regForm.isDeleted = 0;
                                                    regForm.yearRefId = parentCompetition[0].yearRefId;
                                                    regForm.competitionId = parentCompetition[0].id;
                                                    regForm.feeStatusRefId = 1;
                                                    regArray.push(regForm);
                                                }
                                            }

                                            await this.orgRegistrationService.batchCreateOrUpdate(regArray);

                                            if (isArrayPopulated(UniqueOrganisations)) {
                                                let actionArray = await this.actionsService.createAction1(UniqueOrganisations, ORGANISATION_ID, competitionID, userId)
                                                await this.actionsService.batchCreateOrUpdate(actionArray)
                                            }
                                        }
                                        let compMembProdDivFromDb = await this.competitionMembershipProductDivisionService.findByCompetition(competitionID)

                                        if (isArrayPopulated(compMembProdDivFromDb)) {
                                            for (let div of compMembProdDivFromDb) {
                                                let compDiv = new CompetitionDivision();
                                                compDiv.id = 0;
                                                compDiv.competitionMembershipProductDivisionId = div.id;
                                                compDiv.competitionMembershipProductId = div.competitionMembershipProductId;
                                                compDiv.divisionName = div.divisionName;
                                                compDiv.genderRefId = div.genderRefId;
                                                compDiv.fromDate = div.fromDate;
                                                compDiv.toDate = div.toDate;
                                                compDiv.createdBy = userId;
                                                await this.competitionDivisionService.createOrUpdate(compDiv);
                                            }
                                        }
                                    }
                                }

                                if (ArrayIsEmpty(competitionMembershipDiscountBody.govermentVouchers)) {

                                    const getPreviousGovtVouchers = await this.competitionGovernmentVoucherService.getPreviousGovernmentVouchers(competitionID, ORGANISATION_ID);
                                    const GOVT_VOUCHERS_ID = [];
                                    if (isArrayPopulated(getPreviousGovtVouchers)) {
                                        for (let i of getPreviousGovtVouchers) GOVT_VOUCHERS_ID.push(i['id'])

                                        GOVT_VOUCHERS_ID.forEach(async e => {
                                            const index = competitionMembershipDiscountBody.govermentVouchers.findIndex(g => g.competitionGovernmentVoucherId === e);
                                            if (index !== -1) {
                                                // getPreviousGovtVouchers.splice(index, 1);
                                            } else {
                                                // user deleted some government vouchers
                                                // await this.competitionGovernmentVoucherService.deletePreviousVouchers(e, userId, competitionID)
                                                let deleteVouchers = new CompetitionGovernmentVoucher();
                                                deleteVouchers.id = e;
                                                deleteVouchers.isDeleted = 1; // true
                                                await this.competitionGovernmentVoucherService.createOrUpdate(deleteVouchers);
                                            }
                                        })
                                    }

                                    for (let g of competitionMembershipDiscountBody.govermentVouchers) {
                                        let govt = new CompetitionGovernmentVoucher();
                                        govt.id = g.competitionGovernmentVoucherId;

                                        if (isNullOrZero(govt.id)) {
                                            govt.createdBy = userId;
                                        } else {
                                            //govt.createdBy = userId;
                                            govt.updatedBy = userId;
                                            govt.updatedOn = new Date();
                                        }

                                        govt.competitionId = competitionID;
                                        govt.governmentVoucherRefId = g.governmentVoucherRefId;

                                        await this.competitionGovernmentVoucherService.createOrUpdate(govt);
                                    }
                                }

                                if (isArrayPopulated(competitionMembershipDiscountBody.competitionDiscounts)) {
                                    // getting the default types of competitiondiscount type
                                    const defaultDiscountTypes = await this.competitionTypeDiscountTypeService.getDefaultCompetitionDiscountTypes(1);
                                    let defaultTypesID = []
                                    const CHILD_DISCOUNT_ID = [];
                                    const DISCOUNT_TYPES_ID = [];
                                    const DISCOUNT_ID = [];

                                    if (Array.isArray(defaultDiscountTypes) && defaultDiscountTypes.length > 0) {
                                        for (let i of defaultDiscountTypes) defaultTypesID.push(i.ctdt_id);
                                    }

                                    const checkPreviousChildDiscount = await this.competitionTypeChildDiscountService.getPreviousCompChildDiscountTypesById(competitionID, ORGANISATION_ID);

                                    for (let i of checkPreviousChildDiscount) CHILD_DISCOUNT_ID.push(i['id'])

                                    const checkPreviousDiscountTypes = await this.competitionTypeDiscountTypeService.getPreviousCompDiscountTypesById(competitionID, ORGANISATION_ID);

                                    for (let i of checkPreviousDiscountTypes) DISCOUNT_TYPES_ID.push(i['id'])

                                    const checkPreviousDiscount = await this.competitionTypeDiscountService.getPreviousCompDiscount(competitionID, ORGANISATION_ID);

                                    for (let i of checkPreviousDiscount) DISCOUNT_ID.push(i['id']);

                                    let deleteDiscount;
                                    let deleteDiscountType;
                                    let deleteDiscountChild;

                                    for (let cd of competitionMembershipDiscountBody.competitionDiscounts) {

                                        if (isArrayPopulated(cd.discounts)) {

                                            for (let d of cd.discounts) {

                                                if (isArrayPopulated(CHILD_DISCOUNT_ID) || isArrayPopulated(DISCOUNT_ID) || isArrayPopulated(DISCOUNT_TYPES_ID)) {
                                                    // child Discounts
                                                    if (isArrayPopulated(CHILD_DISCOUNT_ID)) {
                                                        // edit and delete
                                                        let childDiscounts =  await this.competitionTypeChildDiscountService.findByDiscountTypeId(d.competitionTypeDiscountId)
                                                        childDiscounts.forEach(async e => {
                                                            if (isArrayPopulated(d.childDiscounts)) {
                                                                console.log('----d.childDiscounts -- '+JSON.stringify(d.childDiscounts))
                                                                const index = d.childDiscounts.findIndex(g => g.membershipFeesChildDiscountId === e.id);
                                                                console.log('**---** e- '+e.id)
                                                                console.log('**---** index- '+index)
                                                                if (index !== -1) {
                                                                    console.log('---- 1 ')
                                                                    // checkPreviousChildDiscount.splice(index, 1);
                                                                } else {
                                                                    console.log('---- -1 ')
                                                                    // user deleted some custom child discount
                                                                    // deleteDiscountChild = await this.competitionTypeChildDiscountService.deletePreviousCompChildDiscountById(e, competitionID, userId);
                                                                    const compchild = new CompetitionTypeChildDiscount();
                                                                    compchild.id = e;
                                                                    compchild.isDeleted = 1;
                                                                    compchild.organisationId = ORGANISATION_ID;
                                                                    deleteDiscountChild = await this.competitionTypeChildDiscountService.createOrUpdate(compchild);
                                                                }
                                                            } else {

                                                                // deleteDiscountChild = await this.competitionTypeChildDiscountService.deletePreviousCompChildDiscountById(e, competitionID, userId);
                                                                const compchild = new CompetitionTypeChildDiscount();
                                                                compchild.id = e;
                                                                compchild.isDeleted = 1;
                                                                compchild.organisationId = ORGANISATION_ID;
                                                                deleteDiscountChild = await this.competitionTypeChildDiscountService.createOrUpdate(compchild);
                                                            }
                                                        });
                                                    } else {
                                                        // childDiscount is null and cannot be edited or deleted
                                                    }

                                                    // discount types
                                                    if (d.competitionTypeDiscountTypeRefId !== null && d.competitionTypeDiscountTypeRefId !== 0) {

                                                        if (isArrayPopulated(DISCOUNT_TYPES_ID)) {

                                                            DISCOUNT_TYPES_ID.forEach(async e => {
                                                                if (isArrayPopulated(cd.discounts)) {
                                                                    const index = cd.discounts.findIndex(g => g.competitionTypeDiscountTypeRefId === e);
                                                                    if (index !== -1) {

                                                                        // checkPreviousDiscountTypes.splice(index, 1);
                                                                    } else {

                                                                        // user deleted some custom discount types
                                                                        let getIDForDeleteDiscountType = await this.competitionTypeDiscountTypeService.getIDForDeletePreviousCustomDiscountTypes(e, competitionID, ORGANISATION_ID);
                                                                        console.log("Id to be deleted +++++ "+getIDForDeleteDiscountType)
                                                                        if (isArrayPopulated(getIDForDeleteDiscountType)) {
                                                                            const comptypedisctype = new CompetitionTypeDiscountType();
                                                                            comptypedisctype.id = e;
                                                                            comptypedisctype.organisationId = ORGANISATION_ID;
                                                                            comptypedisctype.isDeleted = 1; // true
                                                                            deleteDiscountType = await this.competitionTypeDiscountTypeService.createOrUpdate(comptypedisctype);
                                                                        }
                                                                    }
                                                                } else {
                                                                    let getIDForDeleteDiscountType = await this.competitionTypeDiscountTypeService.getIDForDeletePreviousCustomDiscountTypes(e, competitionID, ORGANISATION_ID);
                                                                    if (isArrayPopulated(getIDForDeleteDiscountType)) {

                                                                        const comptypedisctype = new CompetitionTypeDiscountType();
                                                                        comptypedisctype.id = e;
                                                                        comptypedisctype.organisationId = ORGANISATION_ID;
                                                                        comptypedisctype.isDeleted = 1; // true
                                                                        deleteDiscountType = await this.competitionTypeDiscountTypeService.createOrUpdate(comptypedisctype);
                                                                    }
                                                                }
                                                            })
                                                        }
                                                    }

                                                    // discount
                                                    if (d.competitionTypeDiscountId !== null && d.competitionTypeDiscountId !== 0 &&
                                                        d.competitionTypeDiscountTypeRefId !== null && d.competitionTypeDiscountTypeRefId !== 0) {

                                                        if (isArrayPopulated(DISCOUNT_ID)) {
                                                            DISCOUNT_ID.forEach(async e => {
                                                                if (isArrayPopulated(cd.discounts)) {
                                                                    const index = cd.discounts.findIndex(g => g.competitionTypeDiscountId === e);
                                                                    if (index !== -1) {

                                                                        // checkPreviousDiscount.splice(index, 1);
                                                                    } else {

                                                                        // user deleted some custom discount types
                                                                        // deleteDiscount = await this.competitionTypeDiscountService.deletePreviousDiscounts(e, userId, competitionID);
                                                                        const compdis = new CompetitionTypeDiscount();
                                                                        compdis.id = e;
                                                                        compdis.organisationId = ORGANISATION_ID;
                                                                        compdis.isDeleted = 1; // true
                                                                        deleteDiscount = await this.competitionTypeDiscountService.createOrUpdate(compdis);
                                                                    }
                                                                } else {

                                                                    // deleteDiscount = await this.competitionTypeDiscountService.deletePreviousDiscounts(e, userId, competitionID);
                                                                    const compdis = new CompetitionTypeDiscount();
                                                                    compdis.id = e;
                                                                    compdis.isDeleted = 1; // true
                                                                    compdis.organisationId = ORGANISATION_ID;
                                                                    deleteDiscount = await this.competitionTypeDiscountService.createOrUpdate(compdis);
                                                                }
                                                            })
                                                        }
                                                    }
                                                }

                                                const deleteDiscounts = await Promise.all([deleteDiscountChild, deleteDiscountType, deleteDiscount]);
                                            }
                                        }
                                        else{


                                            if (isArrayPopulated(CHILD_DISCOUNT_ID)) {
                                                // edit and delete

                                                CHILD_DISCOUNT_ID.forEach(async e => {
                                                    const compchild = new CompetitionTypeChildDiscount();
                                                    compchild.id = e;
                                                    compchild.isDeleted = 1;
                                                    compchild.organisationId = ORGANISATION_ID;
                                                    deleteDiscountChild = await this.competitionTypeChildDiscountService.createOrUpdate(compchild);
                                                });
                                            }

                                                if (isArrayPopulated(DISCOUNT_TYPES_ID)) {

                                                    DISCOUNT_TYPES_ID.forEach(async e => {
                                                        let getIDForDeleteDiscountType = await this.competitionTypeDiscountTypeService.getIDForDeletePreviousCustomDiscountTypes(e, competitionID, ORGANISATION_ID);
                                                        if (isArrayPopulated(getIDForDeleteDiscountType)) {
                                                            const comptypedisctype = new CompetitionTypeDiscountType();
                                                            comptypedisctype.id = e;
                                                            comptypedisctype.organisationId = ORGANISATION_ID;
                                                            comptypedisctype.isDeleted = 1; // true
                                                            deleteDiscountType = await this.competitionTypeDiscountTypeService.createOrUpdate(comptypedisctype);
                                                        }
                                                    })
                                                }
                                                if (isArrayPopulated(DISCOUNT_ID)) {

                                                    DISCOUNT_ID.forEach(async e => {
                                                        const compdis = new CompetitionTypeDiscount();
                                                        compdis.id = e;
                                                        compdis.isDeleted = 1; // true
                                                        compdis.organisationId = ORGANISATION_ID;
                                                        deleteDiscount = await this.competitionTypeDiscountService.createOrUpdate(compdis);
                                                    })
                                                }
                                                await Promise.all([deleteDiscountChild, deleteDiscountType, deleteDiscount]);

                                        }
                                    }

                                    for (let cd of competitionMembershipDiscountBody.competitionDiscounts) {
                                        if (isArrayPopulated(cd.discounts)) {
                                            for (let d of cd.discounts) {

                                                let comptyped = new CompetitionTypeDiscount();
                                                comptyped.competitionMembershipProductTypeId = d.competitionMembershipProductTypeId;
                                                comptyped.id = d.competitionTypeDiscountId;
                                                comptyped.percentageOffOrFixedAmount = d.amount;
                                                comptyped.description = d.description;
                                                comptyped.availableFrom = d.availableFrom;
                                                comptyped.organisationId = ORGANISATION_ID;
                                                comptyped.availableTo = d.availableTo;
                                                comptyped.discountTypeRefId = d.discountTypeRefId;
                                                comptyped.discountCode = d.discountCode;

                                                if (isNullOrZero(comptyped.id)) {
                                                    comptyped.createdBy = userId;
                                                } else {
                                                    //comptyped.createdBy = userId;
                                                    comptyped.updatedBy = userId;
                                                    comptyped.updatedOn = new Date();
                                                }

                                                comptyped.question = d.question;
                                                comptyped.applyDiscount = d.applyDiscount;

                                                let comptypedt = new CompetitionTypeDiscountType();
                                                if (d.competitionTypeDiscountTypeRefId === 0) {
                                                    comptypedt.competitionId = competitionID;
                                                    comptypedt.createdBy = userId;
                                                    comptypedt.organisationId = ORGANISATION_ID;
                                                    comptypedt.name = d.competitionTypeDiscountTypeName;
                                                    comptypedt.description = d.competitionTypeDiscountTypeDesc;
                                                    comptypedt.isDefault = 0; //false
                                                }

                                                let compDiscountTypeID;
                                                if (defaultTypesID.indexOf(d.competitionTypeDiscountTypeRefId) === -1) {
                                                    compDiscountTypeID = await this.competitionTypeDiscountTypeService.createOrUpdate(comptypedt);
                                                }

                                                comptyped.competitionTypeDiscountTypeId = d.competitionTypeDiscountTypeRefId == 0 ? compDiscountTypeID.id : d.competitionTypeDiscountTypeRefId;
                                                const compTypeDiscount = await this.competitionTypeDiscountService.createOrUpdate(comptyped);
                                                if (isArrayPopulated(d.childDiscounts)) {
                                                    await this.createChildDiscounts(compTypeDiscount.id, d.childDiscounts, userId, ORGANISATION_ID);
                                                }
                                            }
                                        }
                                    }

                                    let orgRegistration = await this.orgRegistrationService.findOrgReg(competitionID, ORGANISATION_ID);
                                    let orgRegistrationId = null;
                                    if(orgRegistration != undefined)
                                        orgRegistrationId = orgRegistration.id;

                                    let affiliateOrganisationId = null;
                                    if(isArrayPopulated(affiliateOrganisation)){
                                        affiliateOrganisationId = affiliateOrganisation[0].id
                                    }

                                    return response.status(200).send({
                                        errorCode: 0,
                                        message: 'CompetitionFee Discounts successfully saved',
                                        data: await this.getCompetitionFeeDataAfterSaving(competitionUniqueKey, competitionID, ORGANISATION_ID, competitionCreatorOrgId,
                                            competitionCreatorOrgUniqueKey, AppConstants.reg, affiliateOrganisationId ),
                                        orgRegistrationId: orgRegistrationId
                                    });

                                } else {
                                    return response.status(212).send({
                                        errorCode: 6,
                                        message: 'Please pass competitionDiscounts in correct format'
                                    });
                                }

                            } else {
                                return response.status(212).send({
                                    errorCode: 5,
                                    message: `No organisation found with the id ${organisationUniqueKey}`
                                });
                            }
                        } else {
                            return response.status(212).send({
                                errorCode: 4,
                                message: `No competition found with the id ${competitionUniqueKey}`
                            });
                        }
                    } else {
                        return response.status(212).send({
                            errorCode: 3,
                            message: 'Please pass same competitionID in body and params'
                        });
                    }
                } else {
                    return response.status(212).send({
                        errorCode: 2,
                        message: `Please pass organisationUniqueKey as a query parameter`
                    });
                }
            } else {
                return response.status(212).send({
                    errorCode: 1,
                    message: `No competitions available`
                });
            }
        } catch (err) {
            logger.error(`Unable to save competitionfee discounts`);
            return response.status(212).send({
                err, name: 'unexpected_error', message: process.env.NODE_ENV == AppConstants.development? 'Failed to save competitionfee discounts' + err : 'Failed to save competitionfee discounts'
            });
        }
    }

    @Authorized()
    @Get('/discount')
    async getCompetitionFeeDiscount(
        @HeaderParam("authorization") currentUser: User,
        @QueryParam('competitionUniqueKey') competitionUniqueKey: string,
        @QueryParam('organisationUniqueKey') organisationUniqueKey: string,
        @Res() response: Response) {
        // let userId = currentUser.id;
        try {
            if (competitionUniqueKey) {
                if (organisationUniqueKey) {
                    const foundCompetition = await this.competitionRegService.findCompetitionFeeDetailsByUniqueKey(competitionUniqueKey);
                    const foundOrganisation = await this.organisationService.findOrganisationByUniqueKey(organisationUniqueKey);
                    if (isArrayPopulated(foundCompetition)) {
                        // const userId = foundCompetition[0].createdBy;
                        if (isArrayPopulated(foundOrganisation)) {
                            const getCompDiscount = await this.competitionTypeDiscountService.getCompetitionFeeDiscount(foundCompetition[0].id, foundOrganisation[0].id, null);
                            if (isArrayPopulated(getCompDiscount)) {
                                return response.status(200).send(getCompDiscount);
                            } else {
                                return response.status(212).send({
                                    errorCode: 5, message: 'Cannot get CompetitionFee Discount'
                                });
                            }
                        } else {
                            return response.status(212).send({
                                errorCode: 4,
                                message: `No organisation found with the id ${competitionUniqueKey}`
                            });
                        }
                    } else {
                        return response.status(212).send({
                            errorCode: 3,
                            message: `No competition found with the id ${competitionUniqueKey}`
                        });
                    }
                } else {
                    return response.status(212).send({
                        errorCode: 2,
                        message: `Please pass organisationUniqueKey as a query Params`
                    });
                }
            } else {
                return response.status(212).send({
                    errorCode: 1,
                    message: `Please pass competitionUniqueKey as a query Params`
                });
            }
        } catch (err) {
            logger.error(`Unable to get Competitionfee Discount`);
            return response.status(212).send({
                err, name: 'unexpected_error', message: process.env.NODE_ENV == AppConstants.development? 'Failed to get competitionfee Discount' + err : 'Failed to get competitionfee Discount'
            });
        }
    }

    async createChildDiscounts(comptypedID, childDiscounts, userId, ORGANISATION_ID) {
        const child = new CompetitionTypeChildDiscount();
        for (let c of childDiscounts) {
            child.competitionTypeDiscountId = comptypedID;
            child.percentageValue = c.percentageValue;
            child.id = c.membershipFeesChildDiscountId;
            child.organisationId = ORGANISATION_ID;
            if (isNullOrZero(child.id)) {
                child.createdBy = userId;
            } else {
                //child.createdBy = userId;
                child.updatedBy = userId;
                child.updatedOn = new Date();
            }

            await this.competitionTypeChildDiscountService.createOrUpdate(child);
        }
    }

    @Authorized()
    @Get('/competitiondetails')
    async getCompetitionFeeCompetitionDetails(
        @HeaderParam("authorization") currentUser: User,
        @QueryParam('competitionUniqueKey') competitionUniqueKey: string,
        @QueryParam('organisationUniqueKey') organisationUniqueKey: string,
        @QueryParam('sourceModule') sourceModule: string,
        @QueryParam("affiliateOrgId") affiliateOrgId: string,
        @Res() response: Response) {
        // let userId = currentUser.id;
        try {
            if (competitionUniqueKey) {
                if (organisationUniqueKey) {
                    const foundCompetition = await this.competitionRegService.findCompetitionFeeDetailsByUniqueKey(competitionUniqueKey);
                    const foundOrganisation = await this.organisationService.findOrganisationByUniqueKey(organisationUniqueKey);
                    const affiliateOrganisation = await this.organisationService.findOrganisationByUniqueKey(affiliateOrgId);
                    if (isArrayPopulated(foundCompetition)) {
                        if (isArrayPopulated(foundOrganisation)) {
                            logger.info("------ BEGIN ---------")
                            const COMPETITION_ID = foundCompetition[0].id;
                            const userId = foundCompetition[0].createdBy;
                            const ORGANISATION_ID = foundOrganisation[0].id;
                            let competitionCreatorOrgId = foundCompetition[0].organisationId;
                            const foundCompCreatorOrganisation = await this.organisationService.findOrganisationById(competitionCreatorOrgId);
                            let competitionCreatorOrgUniqueKey = "";
                            if (isArrayPopulated(foundCompCreatorOrganisation)) {
                                competitionCreatorOrgUniqueKey = foundCompCreatorOrganisation[0].organisationUniqueKey;
                            }
                            let affiliateOrganisationId = null;
                            if(isArrayPopulated(affiliateOrganisation)){
                                affiliateOrganisationId = affiliateOrganisation[0].id;
                            }

                            const getCompetitionDetails = await this.getCompetitionFeeDataAfterSaving(competitionUniqueKey, COMPETITION_ID, ORGANISATION_ID, competitionCreatorOrgId,
                                competitionCreatorOrgUniqueKey, sourceModule, affiliateOrganisationId)
                            logger.info("-----END -@@@@@@@@@@")
                            return response.status(200).send({
                                errorCode: 0,
                                message: 'CompetitionFee Details successfully fetched',
                                data: getCompetitionDetails
                            });
                        } else {
                            return response.status(212).send({
                                errorCode: 4,
                                message: `No organisation found with the id ${organisationUniqueKey}`
                            });
                        }
                    } else {
                        return response.status(212).send({
                            errorCode: 3,
                            message: `No competition found with the id ${competitionUniqueKey}`
                        });
                    }
                } else {
                    return response.status(212).send({
                        errorCode: 2,
                        message: `Please pass organisationUniqueKey as a query parameters`
                    });
                }
            } else {
                return response.status(212).send({
                    errorCode: 1,
                    message: `No competitions availables`
                });
            }
        } catch (err) {
            logger.error(`Unable to get Competitionfee Details` + err);
            return response.status(212).send({
                err, name: 'unexpected_error', message: process.env.NODE_ENV == AppConstants.development? 'Failed to get competitionfee Details' + err : 'Failed to get competitionfee Details'
            });
        }
    }

    @Authorized()
    @Get('/membershipdetails')
    async getMembershipProductDetailsInCompetitionFee(
        @HeaderParam("authorization") currentUser: User,
        @QueryParam('organisationUniqueKey') organisationUniqueKey: string,
        @QueryParam('hasRegistration') hasRegistration: number,
        @QueryParam('yearRefId') yearRefId: number,
        @Res() response: Response) {
        // let userId = currentUser.id;
        try {
            let ORG_LEVEL_ID: number = 0;
            const organisationId = await this.organisationService.findByUniquekey(organisationUniqueKey);
            const getOrglevel = await this.organisationLogoService.getOrganisationDetail(organisationUniqueKey);
            if (getOrglevel)
                ORG_LEVEL_ID = getOrglevel.organisationTypeRefId;

            let getMembershipDetails;
            //const getMembershipDetails = await this.competitionRegService.getMembershipProductDetailsInCompetitionFee(userId);
            if (ORG_LEVEL_ID === 1 || ORG_LEVEL_ID === 2) {
                getMembershipDetails = await this.competitionRegService.getMembershipProductByOrganisation(organisationId, yearRefId)

            } else if (ORG_LEVEL_ID == 3) {
                let affiliatedToOrg = await this.affiliateService.getAffilitedToOrg(organisationId);
                getMembershipDetails = await this.competitionRegService.getMembershipProductByOrganisation(affiliatedToOrg, yearRefId)

            } else if (ORG_LEVEL_ID == 4) {
                let affiliatedToOrg1 = await this.affiliateService.getAffilitedToOrg(organisationId);
                let affiliatedToOrg2 = await this.affiliateService.getAffilitedToOrg(affiliatedToOrg1);
                getMembershipDetails = await this.competitionRegService.getMembershipProductByOrganisation(affiliatedToOrg2, yearRefId);
            }
            let data = [];
            const foundCompetitionMembershipDummy = await this.competitionRegService.getMembershipProductByOrganisation(0,yearRefId);
            if (hasRegistration == 0) {
                data = foundCompetitionMembershipDummy[0];
            } else if (getMembershipDetails != null && getMembershipDetails != undefined) {
                data = getMembershipDetails[0];
            }
            // if (isArrayEmpty(getMembershipDetails)) {
            return response.status(200).send({
                errorCode: 0,
                message: 'MembershipProduct Details successfully fetched',
                data: data
            });
            // }
        } catch (err) {
            logger.error(`Unable to get Membership Product Details` + err);
            return response.status(212).send({
                err, name: 'unexpected_error', message: process.env.NODE_ENV == AppConstants.development? 'Failed to get membership product details' + err : 'Failed to get membership product details'
            });
        }
    }

    async getCompetitionFeeDataAfterSaving(competitionUniqueKey: string, competitionID: number, organisationId: number,
        competitionCreatorOrgId: number, competitionCreatorOrgUniqueKey: string, sourceModule: string, affiliateOrgId: number): Promise<any> {
        let CompetitionData = Object.assign({});
        let foundCompetitionDivisions;
        const foundCompetitionDetail = await this.competitionRegService.getCompetitionFeeDetails(competitionUniqueKey, organisationId, competitionCreatorOrgUniqueKey);
        const foundCompetitionMembership = await this.competitionMembershipProductService.getCompetitionFeeMembership(competitionUniqueKey, organisationId);
        if (sourceModule === AppConstants.comp)
            foundCompetitionDivisions = await this.competitionMembershipProductDivisionService.getCompetitionFeeDivisionForComp(competitionUniqueKey, organisationId);
        else
            foundCompetitionDivisions = await this.competitionMembershipProductDivisionService.getCompetitionFeeDivision(competitionUniqueKey, organisationId);
        const foundCompetitionFees = await this.competitionMembershipProductFeeService.getCompetitionFeeFees(0, competitionUniqueKey, organisationId, competitionCreatorOrgId);
        const foundCompetitionPayments = await this.competitionPaymentOptionService.getCompetitionFeePaymentOption(competitionID);
        const foundCompetitionDiscounts = await this.competitionTypeDiscountService.getCompetitionFeeDiscount(competitionID, organisationId, affiliateOrgId);

        if (isArrayPopulated(foundCompetitionDetail)) CompetitionData.competitiondetail = foundCompetitionDetail[0];
        else CompetitionData.competitiondetail = Object.assign({});

        if (isArrayPopulated(foundCompetitionMembership)) CompetitionData.competitionmembershipproduct = foundCompetitionMembership[0];
        else CompetitionData.competitionmembershipproduct = Object.assign({});

        if (isArrayPopulated(foundCompetitionDivisions)) CompetitionData.competitiondivisions = foundCompetitionDivisions[0];
        else CompetitionData.competitiondivisions = Object.assign({});

        if (isArrayPopulated(foundCompetitionFees)) CompetitionData.competitionfees = foundCompetitionFees;
        else CompetitionData.competitionfees = [Object.assign({})];

        if (isArrayPopulated(foundCompetitionPayments)) CompetitionData.competitionpayments = foundCompetitionPayments[0];
        else CompetitionData.competitionpayments = Object.assign({});

        if (isArrayPopulated(foundCompetitionDiscounts)) CompetitionData.competitiondiscounts = foundCompetitionDiscounts[0];
        else CompetitionData.competitiondiscounts = Object.assign({});
        logger.info("Found competition Divisions" + JSON.stringify(foundCompetitionDivisions[0]));
        return CompetitionData;
    }

    @Authorized()
    @Get('/competitiondiscounttype/default')
    async getDefaultCompetitionDiscountType(
        @HeaderParam("authorization") currentUser: User,
        @Res() response: Response): Promise<any> {
        try {
            const foundCompetitionDiscountTypes = await this.competitionTypeDiscountTypeService.getDefaultDiscountTypes(1)
            if (isArrayPopulated(foundCompetitionDiscountTypes)) {
                return response.status(200).send({
                    id: foundCompetitionDiscountTypes,
                    errorCode: 0,
                    message: 'successfully get default Competition Discount Type'
                })
            } else {
                return response.status(212).send({
                    errorCode: 1,
                    message: 'Cannot get default Competition Discount Type'
                })
            }
        } catch (err) {
            logger.error(`Unable to get default Competition Discount Type` + err);
            return response.status(400).send({
                err, name: 'unexpected_error', message: process.env.NODE_ENV == AppConstants.development? 'Failed to get default Competition discount types.' + err : 'Failed to get default Competition discount types.'
            });
        }
    }

    @Authorized()
    @Delete('/:competitionUniqueKey')
    async deleteCompetitionFee(
        @Param("competitionUniqueKey") competitionUniqueKey: string,
        @QueryParam("organisationUniqueKey") organisationUniqueKey: string,
        @HeaderParam("authorization") currentUser: User,
        @Res() response: Response): Promise<any> {
        // let currentUserId = currentUser.id;
        try {
            if (competitionUniqueKey) {
                if (organisationUniqueKey) {
                    const foundOrganisation = await this.organisationService.findOrganisationByUniqueKey(organisationUniqueKey);
                    if (isArrayPopulated(foundOrganisation)) {
                        const ORGANISATION_ID = foundOrganisation[0].id;
                        const foundCompetition = await this.competitionRegService.findCompetitionFeeDetailsByUniqueKey(competitionUniqueKey);
                        const competitionCreatorOrgId = foundCompetition[0].organisationId;
                        if (competitionCreatorOrgId === ORGANISATION_ID) {
                            if (isArrayPopulated(foundCompetition)) {
                                const COMPETITION_ID = foundCompetition[0].id;
                                // check for competition is used
                                const checkCompetitionUsed = await this.competitionRegService.checkCompetitionUsed(COMPETITION_ID);
                                if (isArrayPopulated(checkCompetitionUsed) && (checkCompetitionUsed[0].isUsedOrgRegEntity === true || checkCompetitionUsed[0].isUsedVenueConstraintEntity === true)) {
                                    // used in orgReg or venueConstraint, cannot be deleted
                                    return response.status(212).send({
                                        errorCode: 3,
                                        message: `Competition cannot be deleted as it is being used ${checkCompetitionUsed[0].isUsedOrgRegEntity ? 'in Organisation Registration' : (checkCompetitionUsed[0].isUsedVenueConstraintEntity ? 'in Venue Constraint' : '')}`
                                    });
                                } else {
                                    // can be deleted
                                    // Child Discount
                                    const getChildForDelete = await this.competitionTypeChildDiscountService.getIDForDeleteCompChildByCompetitionId(COMPETITION_ID);
                                    if (isArrayPopulated(getChildForDelete)) {

                                        for (let f of getChildForDelete) {
                                            let compChildDiscount = new CompetitionTypeChildDiscount();
                                            compChildDiscount.id = f.id;
                                            compChildDiscount.organisationId = ORGANISATION_ID;
                                            compChildDiscount.isDeleted = 1; // true
                                            await this.competitionTypeChildDiscountService.createOrUpdate(compChildDiscount);
                                        }
                                    }

                                    // Discount Type
                                    const getDiscountTypeForDelete = await this.competitionTypeDiscountTypeService.getIDForDeleteCompDisTypeByCompetitionId(COMPETITION_ID);
                                    if (isArrayPopulated(getDiscountTypeForDelete)) {

                                        for (let f of getDiscountTypeForDelete) {
                                            let compTypeDiscType = new CompetitionTypeDiscountType();
                                            compTypeDiscType.id = f.id;
                                            compTypeDiscType.organisationId = ORGANISATION_ID;
                                            compTypeDiscType.isDeleted = 1; // true
                                            await this.competitionTypeDiscountTypeService.createOrUpdate(compTypeDiscType);
                                        }
                                    }

                                    // Discount
                                    const getDiscountForDelete = await this.competitionTypeDiscountService.getIDForDeleteCompDisByCompetitionId(COMPETITION_ID);
                                    if (isArrayPopulated(getDiscountForDelete)) {

                                        for (let i of getDiscountForDelete) {
                                            let compTypeDisc = new CompetitionTypeDiscount();
                                            compTypeDisc.id = i.id;
                                            compTypeDisc.organisationId = ORGANISATION_ID;
                                            compTypeDisc.isDeleted = 1; // true
                                            await this.competitionTypeDiscountService.createOrUpdate(compTypeDisc);
                                        }
                                    }

                                    // Payment Option
                                    const getPaymentForDelete = await this.competitionPaymentOptionService.getIDForDeletePaymentOptByCompetitionId(COMPETITION_ID);
                                    if (isArrayPopulated(getPaymentForDelete)) {

                                        for (let i of getPaymentForDelete) {
                                            let compPay = new CompetitionPaymentOption();
                                            compPay.id = i.id;
                                            compPay.isDeleted = 1; // true
                                            await this.competitionPaymentOptionService.createOrUpdate(compPay);
                                        }
                                    }

                                    // Fees
                                    const getFeeForDelete = await this.competitionMembershipProductFeeService.getIDForDeleteCompFeesByCompetitionId(COMPETITION_ID);
                                    if (isArrayPopulated(getFeeForDelete)) {

                                        for (let i of getFeeForDelete) {
                                            let compMemProFee = new CompetitionMembershipProductFee();
                                            compMemProFee.id = i.id;
                                            compMemProFee.isDeleted = 1; // true
                                            await this.competitionMembershipProductFeeService.createOrUpdate(compMemProFee);
                                        }
                                    }

                                    // MembershipProductType
                                    const getMemProTypeForDelete = await this.competitionMembershipProductTypeService.getIDForDeleteCompMemProTypeByCompId(COMPETITION_ID);
                                    if (isArrayPopulated(getMemProTypeForDelete)) {

                                        for (let i of getMemProTypeForDelete) {
                                            let compMemProType = new CompetitionMembershipProductType();
                                            compMemProType.id = i.id;
                                            compMemProType.isDeleted = 1; // true
                                            await this.competitionMembershipProductTypeService.createOrUpdate(compMemProType);
                                        }
                                    }

                                    // Division
                                    const getDivisionForDelete = await this.competitionMembershipProductDivisionService.getIDForDeleteCompDivisionbyCompetitionId(COMPETITION_ID);
                                    if (isArrayPopulated(getDivisionForDelete)) {

                                        for (let i of getDivisionForDelete) {
                                            let compDivision = new CompetitionMembershipProductDivision();
                                            compDivision.id = i.id;
                                            compDivision.isDeleted = 1; // true
                                            await this.competitionMembershipProductDivisionService.createOrUpdate(compDivision);
                                        }
                                    }

                                    // MembershipProduct
                                    const getMemProForDelete = await this.competitionMembershipProductService.getIDForDeleteCompMemProByCompetitionId(COMPETITION_ID);
                                    if (isArrayPopulated(getMemProForDelete)) {

                                        for (let i of getMemProForDelete) {
                                            let compMempro = new CompetitionMembershipProduct();
                                            compMempro.id = i.id;
                                            compMempro.isDeleted = 1; // true
                                            await this.competitionMembershipProductService.createOrUpdate(compMempro);
                                        }
                                    }

                                    // CharityRoundUp
                                    const getCharityForDelete = await this.competitionCharityRoundUpService.getIDForDeleteCompCharityByCompId(COMPETITION_ID);
                                    if (isArrayPopulated(getCharityForDelete)) {

                                        for (let i of getCharityForDelete) {
                                            let compCharity = new CompetitionCharityRoundUp();
                                            compCharity.id = i.id;
                                            compCharity.isDeleted = 1; // true
                                            await this.competitionCharityRoundUpService.createOrUpdate(compCharity);
                                        }
                                    }

                                    // GovernmentVoucher
                                    const getVouchersForDelete = await this.competitionGovernmentVoucherService.getIDForDeleteCompGovVoucherByCompId(COMPETITION_ID);
                                    if (isArrayPopulated(getVouchersForDelete)) {

                                        for (let o of getVouchersForDelete) {
                                            let compVouchers = new CompetitionGovernmentVoucher();
                                            compVouchers.id = o.id;
                                            compVouchers.isDeleted = 1; // true
                                            await this.competitionGovernmentVoucherService.createOrUpdate(compVouchers);
                                        }
                                    }

                                    // invitees
                                    const getInviteesForDelete = await this.competitionRegistrationInviteesService.getIDForDeleteCompInviteesByCompId(COMPETITION_ID);
                                    if (isArrayPopulated(getInviteesForDelete)) {

                                        for (let i of getInviteesForDelete) {
                                            let compInvitees = new CompetitionRegistrationInvitees();
                                            compInvitees.id = i.id;
                                            compInvitees.isDeleted = 1; // true
                                            await this.competitionRegistrationInviteesService.createOrUpdate(compInvitees);
                                        }
                                    }

                                    // venues
                                    const getVenuesForDelete = await this.competitionVenueService.getIDForDeleteCompVenuesByCompId(COMPETITION_ID);
                                    if (isArrayPopulated(getVenuesForDelete)) {

                                        for (let i of getVenuesForDelete) {
                                            let compVenue = new CompetitionVenue();
                                            compVenue.id = i.id;
                                            compVenue.isDeleted = 1; // true
                                            await this.competitionVenueService.createOrUpdate(compVenue);
                                        }
                                    }

                                    // non playing dates
                                    const getNonPlayingDatesForDelete = await this.competitionNonPlayingDatesService.getIDForDeleteCompNonPlayingDatesByCompId(COMPETITION_ID);
                                    if (isArrayPopulated(getNonPlayingDatesForDelete)) {

                                        for (let i of getNonPlayingDatesForDelete) {
                                            let compNonPlayingDates = new CompetitionNonPlayingDates();
                                            compNonPlayingDates.id = i.id;
                                            compNonPlayingDates.isDeleted = 1; // true
                                            await this.competitionNonPlayingDatesService.createOrUpdate(compNonPlayingDates);
                                        }
                                    }

                                    // logo
                                    const getLogoForDelete = await this.competitionLogoService.getIDForDeleteCompLogoByCompId(COMPETITION_ID);
                                    if (isArrayPopulated(getLogoForDelete)) {

                                        for (let i of getLogoForDelete) {
                                            let compLogo = new CompetitionLogo();
                                            compLogo.id = i.id;
                                            compLogo.isDeleted = 1; // true
                                            await this.competitionLogoService.createOrUpdate(compLogo);
                                        }
                                    }

                                    // competition
                                    const getCompetitionForDelete = await this.competitionRegService.getIDForDeleteCompbyCompId(COMPETITION_ID);
                                    if (isArrayPopulated(getCompetitionForDelete)) {

                                        for (let i of getCompetitionForDelete) {
                                            let compReg = new CompetitionReg();
                                            compReg.id = i.id;
                                            compReg.isDeleted = 1; // true
                                            await this.competitionRegService.createOrUpdate(compReg);
                                        }
                                    }

                                    const allDeleted = await Promise.all([getChildForDelete, getDiscountTypeForDelete, getDiscountForDelete, getPaymentForDelete, getFeeForDelete, getDivisionForDelete, getMemProTypeForDelete,
                                        getMemProForDelete, getCharityForDelete, getVouchersForDelete, getInviteesForDelete, getVenuesForDelete, getNonPlayingDatesForDelete, getLogoForDelete, getCompetitionForDelete])

                                    return response.status(200).send({
                                        errorCode: 0,
                                        message: 'successfully deleted the competition'
                                    });
                                }
                            } else {
                                return response.status(212).send({
                                    errorCode: 2,
                                    message: 'This Competition has already been deleted'
                                });
                            }
                        } else {
                            return response.status(212).send({
                                errorCode: 5,
                                message: 'Cannot Delete competition as creator of competition can delete competition'
                            })
                        }
                    } else {
                        return response.status(212).send({
                            errorCode: 9,
                            message: `Cannot find organisation with the provided id ${organisationUniqueKey}`
                        });
                    }
                } else {
                    return response.status(400).send({
                        errorCode: 8, message: 'Please pass organisationUniqueKey as a Query parameter.'
                    });
                }
            } else {
                return response.status(400).send({
                    errorCode: 1, message: 'Please pass competitionUniqueKey as a Path parameter.'
                });
            }
        } catch (err) {
            logger.error(`Unable to delete competition fee.` + err);
            return response.status(400).send({
                err, name: 'unexpected_error', message: process.env.NODE_ENV == AppConstants.development? 'Failed to delete the competition fee.' + err : 'Failed to delete the competition fee.'
            });
        }
    }

    @Authorized()
    @Get('/getOrganisationLogo/:organisationUniqueKey')
    async getOrganisationLogo(
        @Param("organisationUniqueKey") organisationUniqueKey: string,
        @HeaderParam("authorization") currentUser: User,
        @Res() response: Response): Promise<any> {
        try {
            if (organisationUniqueKey) {
                const foundOrganisation = await this.organisationService.findOrganisationByUniqueKey(organisationUniqueKey);
                if (isArrayPopulated(foundOrganisation)) {
                    const orgLogoStatus = await this.competitionLogoService.getOrganisationLogoStatus(foundOrganisation[0].id);

                    return response.status(200).send({
                        errorCode: 0,
                        data: isArrayPopulated(orgLogoStatus) ? orgLogoStatus[0] : { logoUrl: null, id: 0 },
                        message: isArrayPopulated(orgLogoStatus) ? `Competition Logo successfully found` : `Competition Logo doesnot exists`
                    });

                } else {
                    return response.status(200).send({
                        errorCode: 2,
                        data: [],
                        message: `Cannot find organisation with provided key ${organisationUniqueKey}`
                    });
                }
            } else {
                return response.status(212).send({
                    errorCode: 1,
                    message: `Please pass organisationuniqueKey as a path parameter`
                })
            }
        } catch (err) {
            logger.error(`Unable to get organisation details` + err);
            return response.status(400).send({
                err, name: 'unexpected_error', message: process.env.NODE_ENV == AppConstants.development? 'Failed to get organisation details' + err : 'Failed to get organisation details'
            });
        }
    }

    @Authorized()
    @Post('/divisionsByCompetition')
    async getDivisionsByCompetitions(
        @HeaderParam("authorization") currentUser: User,
        @QueryParam('competitionUniqueKey') competitionUniqueKey: string,
        @QueryParam('yearRefId') yearRefId: number,
        @Body() divisionBody: any,
        @Res() response: Response) {
        // const userId = currentUser.id;
        try {
            if (competitionUniqueKey) {
                if (yearRefId) {
                    const getCompetition = await this.competitionRegService.findCompetitionFeeDetailsByUniqueKey(competitionUniqueKey);
                    const ORGANISATION_ID = await this.organisationService.findByUniquekey(divisionBody.organisationUniqueKey)
                    if (isArrayPopulated(getCompetition)) {
                        // const userId = getCompetition[0].createdBy;
                        const YEAR_ID = stringTONumber(yearRefId);
                        const foundCompetition = await this.competitionRegService.findCompetitionFeeDetailsByUniqueKeyAndYearId(competitionUniqueKey, YEAR_ID);
                        if (isArrayPopulated(foundCompetition)) {
                            let result = null;
                            if (divisionBody.sourceModule == AppConstants.ftg) {
                                result = await this.competitionRegService.getDivisionsForFinalTeamGrading(foundCompetition[0].id, YEAR_ID);
                            } else {
                                result = await this.competitionRegService.getDivisionsByCompetition(foundCompetition[0].id, YEAR_ID, ORGANISATION_ID);
                            }
                            return response.status(200).send(result);
                        } else {
                            return response.status(212).send({
                                errorCode: 3,
                                message: `No competition found with the id ${competitionUniqueKey}`
                            });
                        }
                    } else {
                        return response.status(212).send({
                            errorCode: 5,
                            message: `Cannot find competition with provided key`
                        });
                    }
                } else {
                    return response.status(212).send({
                        errorCode: 2,
                        message: `Please pass yearRefId as a query parameter`
                    });
                }
            } else {
                return response.status(212).send({
                    errorCode: 1,
                    message: `No competitions available`
                });
            }
        } catch (err) {
            logger.error(`Unable to get divisions by competition`);
            return response.status(212).send({
                err, name: 'unexpected_error', message: process.env.NODE_ENV == AppConstants.development? 'Failed to get divisions by competition' + err : 'Failed to get divisions by competition'
            });
        }
    }

    @Authorized()
    @Get('/getVenues/:competitionUniqueKey')
    async getVenuesByCompetitionId(
        @Param("competitionUniqueKey") competitionUniqueKey: string,
       // @QueryParam('organisationUniqueKey') organisationUniqueKey: string,
        @HeaderParam("authorization") currentUser: User,
        @Res() response: Response): Promise<any> {
        // let userId = currentUser.id;
        try {
            let competitionId = null
            let organisationId = null;
           // if(competitionUniqueKey != '-1'){
                const findCompetition = await this.competitionRegService.findCompetitionFeeDetailsByUniqueKey(competitionUniqueKey);
                if (isArrayPopulated(findCompetition)) {
                    // const userId = findCompetition[0].createdBy;
                    // console.log("**************------::" + userId + "##" + findCompetition[0].id)
                    competitionId = findCompetition[0].id;
                    organisationId = findCompetition[0].organisationId;
                }
            // }
            // else{
            //     competitionId = -1;
            // }
            //organisationId = await this.organisationService.findByUniquekey(organisationUniqueKey);
           // const getVenues = await this.competitionVenueService.getVenuesByCompetitionId(competitionId, organisationId);
            const getVenues = await this.competitionVenueService.getVenuesByCompetitionId(competitionId);

                if (getVenues) {
                    return response.status(200).send(getVenues);
                } else {
                    return response.status(212).send({
                        errorCode: 3,
                        data: [],
                        message: `No Venue found with competition id ${competitionUniqueKey}`
                    });
                }
        } catch (err) {
            logger.error(`Unable to get competition Venue details` + err);
            return response.status(400).send({
                err, name: 'unexpected_error', message: process.env.NODE_ENV == AppConstants.development? 'Failed to get competition Venue details' + err : 'Failed to get competition Venue details'
            });
        }
    }
    @Authorized()
    @Post('/getVenues')
    async getVenuesByCompetition(
        @HeaderParam("authorization") currentUser: User,
        @Body() requestBody: any,
        @Res() response: Response): Promise<any> {

        // let userId = currentUser.id;
        try {
            let competitionId = null
            //let organisationId = null;
            if(requestBody.competitionUniqueKey != '-1'){
                const findCompetition = await this.competitionRegService.findCompetitionFeeDetailsByUniqueKey(requestBody.competitionUniqueKey);
                if (isArrayPopulated(findCompetition)) {
                    // const userId = findCompetition[0].createdBy;
                    // console.log("**************------::" + userId + "##" + findCompetition[0].id)
                    competitionId = findCompetition[0].id;
                   // organisationId = findCompetition[0].organisationId;
                }
             }
             else{
                 competitionId = -1;
             }
            let organisationId = await this.organisationService.findByUniquekey(requestBody.organisationUniqueKey);
            const getVenues = await this.competitionVenueService.getVenuesByCompetition(competitionId, organisationId, requestBody.startDate, requestBody.endDate);

                if (getVenues) {
                    return response.status(200).send(getVenues);
                } else {
                    return response.status(212).send({
                        errorCode: 3,
                        data: [],
                        message: `No Venue found with competition id ${requestBody.competitionUniqueKey}`
                    });
                }
        } catch (err) {
            logger.error(`Unable to get competition Venue details` + err);
            return response.status(400).send({
                err, name: 'unexpected_error', message: process.env.NODE_ENV == AppConstants.development? 'Failed to get competition Venue details' + err : 'Failed to get competition Venue details'
            });
        }
    }
    @Authorized()
    @Get('/registrationWizard')
    async getCompetitionForRegistrationWizard(
        @QueryParam('organisationUniqueKey') organisationUniqueKey: string,
        @QueryParam('yearId') yearId: number,
        @HeaderParam("authorization") currentUser: User,
        @Res() response: Response): Promise<any> {
        try {
            if (isNotNullAndUndefined(organisationUniqueKey) && isNotNullAndUndefined(yearId)) {
                const foundCompetitions = await this.competitionRegService.getCompetitionsForRegistrationWizard(yearId, organisationUniqueKey);
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
                    errorCode: 2, message: 'Please pass organisationUniqueKey and yearId as a Query parameter.'
                });
            }
        } catch (err) {
            logger.error(`Unable to get competition List` + err);
            return response.status(400).send({
                err, name: 'unexpected_error', message: process.env.NODE_ENV == AppConstants.development? 'Failed to get competition List' + err : 'Failed to get competition List'
            });
        }
    }

    @Authorized()
    @Post('/status/update')
    async competitionStatusUpdate(
        @HeaderParam("authorization") currentUser: User,
        @Body() requestBody,
        @Res() response: Response) {
        try {
            if (requestBody != null) {
                if (!isNotNullAndUndefined(requestBody.competitionUniqueKey) ||
                            !isNotNullAndUndefined(requestBody.statusRefId)) {
                    return response.status(212).send("Please provide competition id and status id");
                }
                await this.competitionRegService.updateCompetitionStatus(requestBody.competitionUniqueKey, requestBody.statusRefId, currentUser.id);
                return response.status(200).send({message: "Successfully updated"});
            }
            else {
                return response.status(212).send({
                    errorCode: 4,
                    message: 'Empty Body'
                });
            }
        } catch (error) {
            logger.error(`Error Occurred in updating the competition status  ${currentUser.id}`+error);
            return response.status(400).send({
                error, name: 'unexpected_error', message: process.env.NODE_ENV == AppConstants.development? 'Failed to update competition status' + error : 'Failed to update competition status'
            });
        }
    }
}
