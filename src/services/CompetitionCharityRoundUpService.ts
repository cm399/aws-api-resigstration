
import { Service } from "typedi";
import BaseService from "./BaseService";
import { CompetitionCharityRoundUp } from "../models/registrations/CompetitionCharityRoundUp";

@Service()
export default class CompetitionCharityRoundUpService extends BaseService<CompetitionCharityRoundUp> {

    modelName(): string {
        return CompetitionCharityRoundUp.name;
    }

    public async getIDForDeleteCompCharityByCompId(competitionId: number): Promise<any> {
        return await this.entityManager.query(
            `select id from competitionCharityRoundUp where competitionId = ? and isDeleted = 0`, [competitionId]);
    }

    public async checkPreviousCharity(competitionId: number): Promise<any> {
        return await this.entityManager.query(
            `select * from competitionCharityRoundUp where competitionId = ? and isDeleted = 0`, [competitionId]);
    }

}