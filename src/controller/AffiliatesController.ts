import { Response } from 'express';
import { Authorized, Body, HeaderParam, JsonController, Post, Res } from 'routing-controllers';
import { BaseController } from './BaseController';
import { logger } from '../logger';
import { isArrayPopulated } from '../utils/Utils';
import AppConstants from '../validation/AppConstants';
import { User } from '../models/security/User';

@JsonController('/api/affiliates')
export class AffiliatesController extends BaseController {

    @Authorized()
    @Post('/affiliatedOrganisation')
    async getAffiliatedByOrganisationId(
        @HeaderParam("authorization") currentUser: User,
        @Body() orgAffiliatedBody: OrganisationAffiliationRequest,
        @Res() response: Response): Promise<any> {
        try {
            if(orgAffiliatedBody.search===null || orgAffiliatedBody.search ===undefined) orgAffiliatedBody.search = ''
            const getAffiliatedData = await this.affiliateService.getAllAssociations(orgAffiliatedBody.organisationId, orgAffiliatedBody.invitorId,orgAffiliatedBody.search)
            if (isArrayPopulated(getAffiliatedData)) {
                return getAffiliatedData[0]
            } else {
                return [] 
            }
        } catch (err) {
            logger.error(`Unable to get affiliated organisations` + err);
            return response.status(400).send({
                err, name: 'unexpected_error', message: process.env.NODE_ENV == AppConstants.development? 'Failed to get affiliated organisations' + err : 'Failed to get affiliated organisations'
            });
        }
    }
}

export interface OrganisationAffiliationRequest {
    organisationId: string,
    invitorId: number,
    search: string
}