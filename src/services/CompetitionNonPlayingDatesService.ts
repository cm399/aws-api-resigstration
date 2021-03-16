import { Service } from "typedi";
import BaseService from "./BaseService";
import { CompetitionNonPlayingDates } from "../models/registrations/CompetitionNonPlayingDates";

@Service()
export default class CompetitionNonPlayingDatesService extends BaseService<CompetitionNonPlayingDates> {

    modelName(): string {
        return CompetitionNonPlayingDates.name;
    }

    public async checkNonPlayingPreviousDates(competitionId: number): Promise<any> {
        return await this.entityManager.createQueryBuilder().select().from(CompetitionNonPlayingDates, "cnpd")
            .andWhere("cnpd.competitionId = :competitionId", { competitionId })
            .andWhere("cnpd.isDeleted = 0")
            .execute();
    }

    // public async deleteNonPlayingDtes(nonPlayingId: number, competitionId: number, userId: number): Promise<any> {
    //     return await this.entityManager.query(
    //         `DELETE FROM competitionNonPlayingDates WHERE competitionId = ? and id = ? and createdBy = ?`
    //         , [competitionId, nonPlayingId, userId]);
    // }

    public async getIDForDeleteCompNonPlayingDatesByCompId(competitionId: number): Promise<any> {
        return await this.entityManager.query(
            `select id FROM competitionNonPlayingDates WHERE competitionId = ? and isDeleted = 0 `, [competitionId]);
    }
}