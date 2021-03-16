import { Service } from "typedi";
import BaseService from "./BaseService";
import { isArrayPopulated } from "../utils/Utils";
import AppConstants from "../validation/AppConstants";
import { Team } from "../models/registrations/Team";

@Service()
export default class TeamService extends BaseService<Team> {

    modelName(): string {
        return Team.name;
    }

    public async findMaxSortId(divisionId, organisationId): Promise<number> {
        if (divisionId == null) {
            return await this.entityManager.query(
                'select max(IFNULL(sortorder,0)) as sortOrder  from wsa_competitions.team t where \n' +
                'competitionDivisionId is null and organisationId = ? and isDeleted = 0 ;'
                , [organisationId]);
        }
        else {
            return await this.entityManager.query(
                'select max(IFNULL(sortorder,0)) as sortOrder  from wsa_competitions.team t where \n' +
                'competitionDivisionId = ? and organisationId = ? and isDeleted = 0 ;'
                , [divisionId, organisationId]);
        }
    }

    public async checkTeamAlreadyExists(organisationId, competitionId, requestBody, compDivisionDb): Promise<any> {
        let teamName = requestBody.teamName.toString().toLowerCase();
        let competitionDivisionId = compDivisionDb != null ? compDivisionDb.id : null;
        let result = {
            resultCode: 1,
            message: AppConstants.teamNameNotExists
        }
        try {
            let query = [];
            if (competitionDivisionId != null) {
                query = await this.entityManager.query(` select * from wsa_competitions.team t where 
                t.competitionId = ? and t.organisationId = ? and t.competitionDivisionId = ? and 
                LOWER(t.name)  = ? and t.isDeleted = 0`, [competitionId, organisationId, competitionDivisionId,
                    teamName]
                );
            }
            else {
                query = await this.entityManager.query(` select * from wsa_competitions.team t where 
                t.competitionId = ? and t.organisationId = ? and t.competitionDivisionId is null and 
                LOWER(t.name)  = ? and t.isDeleted = 0`, [competitionId, organisationId, teamName]
                );
            }

            if (isArrayPopulated(query)) {
                result.resultCode = 2;
                result.message = AppConstants.teamNameAlreadyExists
            }
        } catch (error) {
            throw error;
        }

        return result;
    }

    public async updateLivescoresTeamStatusByTeamUniqueKey(teamUniqueKey: string) {
        try {
            let result = await this.entityManager.query(`UPDATE wsa.team t Set t.deleted_at = current_timestamp() where t.teamUniqueKey = ?`, [teamUniqueKey])
            return result;
        } catch (error) {
            throw error;
        }
    }
}