import { Response } from 'express';
import { Authorized, Body, HeaderParam, JsonController, Post, QueryParam, Res } from 'routing-controllers';
import { User } from '../models/security/User';
import { isArrayPopulated } from '../utils/Utils';
import AppConstants from '../validation/AppConstants';
import { BaseController } from './BaseController';

@JsonController('/api/homedashboard')
export class HomeDashboardController extends BaseController {

    @Authorized()
    @Post('/usercount')
    async getUserDetails(
        @HeaderParam("authorization") currentUser: User,
        @Body() userDetailsBody: DashBoardRequest,
        @Res() response: Response) {
        const getUserCount = await this.homeDashboardService.getUserDetails(userDetailsBody);
        const totalRegistration = await this.registrationService.registrationCount(userDetailsBody.yearRefId, userDetailsBody.organisationUniqueKey)
        const totalLiveScoreAndRegistrationCount = await this.homeDashboardService.totalLiveScoreAndRegistrationCount(userDetailsBody);
        let userCount = 0;

        if (isArrayPopulated(getUserCount)) userCount = getUserCount[0]['totalCount'];

        return response.status(200).send({
            errorCode: 0,
            count: userCount,
            registrationCount: totalRegistration.totalRegistrations,
            liveScoreCompetitionCount: totalLiveScoreAndRegistrationCount.liveScoreCompetitionCount,
            registrationCompetitionCount: totalLiveScoreAndRegistrationCount.regCompetitionCount
        });
    }

    @Authorized()
    @Post("/registration")
    async dashboard(
        @Body() requestBody: RegistrationDashBoardRequest,
        @QueryParam('sortBy') sortBy: string = undefined,
        @QueryParam('sortOrder') sortOrder: 'ASC'|'DESC'=undefined,
        @Res() response: Response) {
        try {
            if (requestBody != null) {
                let organisationId = await this.organisationService.findByUniquekey(requestBody.organisationUniqueKey);
                if (organisationId !== null && organisationId !== undefined) {
                    return await this.homeDashboardService.registrationCompetitionDashboard(requestBody.yearRefId, organisationId, sortBy, sortOrder);
                } else {
                    return response.status(212).send({ errorCode: 2, message: 'No organisation found with the provided id' });
                }
            } else {
                return response.status(212).send({ errorCode: 4, message: 'Empty Body' });
            }
        } catch (error) {
            return response.status(500).send({ error, message: process.env.NODE_ENV == AppConstants.development? 'Something went wrong. Please contact administrator' + error : 'Something went wrong. Please contact administrator'});
        }
    }
}
export interface DashBoardRequest {
    organisationUniqueKey: string,
    yearRefId: number,
    competitionUniqueKey: string,
    roleId: number,
    genderRefId: number,
    linkedEntityId: number,
    postCode: number,
    searchText: string,
    limit: number,
    offset: number,
    userId: number
}

export interface RegistrationDashBoardRequest {
    organisationUniqueKey: string,
    yearRefId: number
}