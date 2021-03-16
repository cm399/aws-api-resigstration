import { Service } from "typedi";
import BaseService from "./BaseService";
import { isArrayPopulated } from "../utils/Utils";
import { User } from "../models/security/User";
import { DashBoardRequest } from "../controller/HomeDashboardController";

@Service()
export default class HomeDashboardService extends BaseService<User> {

    modelName(): string {
        return User.name;
    }

    public async getUserDetails(userDetails: DashBoardRequest): Promise<any> {
        const {
            organisationUniqueKey,
            yearRefId,
            competitionUniqueKey,
            roleId,
            genderRefId,
            linkedEntityId,
            postCode,
            searchText,
            limit,
            offset,
            userId } = userDetails;

        const userData = await this.entityManager.query("CALL `wsa_users`.`usp_user_dashboard_textual`(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
            [organisationUniqueKey, yearRefId, '-1', -1, -1,
                '-1', '-1', "", limit, offset, userId, '-1', '-1', null, null]);
        if (isArrayPopulated) return userData[1];
        else return [];
    }

    public async totalLiveScoreAndRegistrationCount(userDetails: DashBoardRequest): Promise<any> {
        const { organisationUniqueKey, yearRefId } = userDetails;

        const result = await this.entityManager.query("CALL `wsa_registrations`.`usp_get_livescore_reg_comp_count`(?,?)",
            [organisationUniqueKey, yearRefId]);

        if (isArrayPopulated(result[0]) && isArrayPopulated(result[1]) && (result[0][0]) && (result[1][0])) {
            return { liveScoreCompetitionCount: result[1][0].liveScoreCompetitionCount, regCompetitionCount: result[0][0].regCompetitionCount };
        } else {
            return { liveScoreCompetitionCount: 0, regCompetitionCount: 0 };
        } 
    }

    public async registrationCompetitionDashboard(yearRefId: number, organisationId: number, vSortBy:string=undefined, vSortOrder:'ASC'|'DESC'=undefined) {
        let response = {
            participatingInComptitions: [],
            ownedCompetitions: []
        }
        var result = await this.entityManager.query("call wsa_registrations.usp_registration_competition_dashboard(?,?,?,?)",
            [yearRefId, organisationId, vSortBy, vSortOrder]);

        if (result != null && result[0] != null) {
            if(isArrayPopulated(result[1])){
              
                result[1].map((item) => {
                    let arr = [];
                    let divMap = new Map();
                    let divisions = item.divisions;
                    if(isArrayPopulated(divisions)){
                        divisions.map((x) =>{
                            if(divMap.get(x.id) == undefined){
                                let obj = {
                                    id: x.id,
                                    divisionName: x.divisionName
                                }
                                arr.push(obj);
                                divMap.set(x.id, obj);
                            }
                        })
                        item.divisions = arr;
                    }
                })
            }
            if(isArrayPopulated(result[0])){
               
                result[0].map((item) => {
                    let arr = [];
                    let divMap = new Map();
                    let divisions = item.divisions;
                    if(isArrayPopulated(divisions)){
                        divisions.map((x) =>{
                            if(divMap.get(x.id) == undefined){
                                let obj = {
                                    id: x.id,
                                    divisionName: x.divisionName
                                }
                                divMap.set(x.id, obj);
                                arr.push(obj);
                            }
                        })
                        item.divisions = arr;
                    }
                })
            }
            response.participatingInComptitions = result[1];
            response.ownedCompetitions = result[0];
            return response;
        }

        return response;
    }
}