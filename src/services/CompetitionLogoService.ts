import { Service } from "typedi";
import BaseService from "./BaseService";
import { CompetitionLogo } from '../models/registrations/CompetitionLogo';

@Service()
export default class CompetitionLogoService extends BaseService<CompetitionLogo> {

    modelName(): string {
        return CompetitionLogo.name;
    }

    public async getIDForDeleteCompLogoByCompId(competitionId: number): Promise<any> {
        return await this.entityManager.query(`select id from competitionLogo where competitionId = ? and isDeleted = 0`, [competitionId]);
    }

    public async getOrganisationLogoStatus(organisationId: number): Promise<any> {
        return await this.entityManager.query(`SELECT * FROM wsa_users.organisationLogo WHERE organisationId = ? and isDeleted = 0`, [organisationId]);
    }

    // public async updateLogoUrl( organisationId: number,competitionId: number,logo: string): Promise<any> {
    //     return await this.entityManager.query(`UPDATE competitionLogo SET logoUrl = ? WHERE competitionId = ? and organisationId = ?`, [logo, organisationId, competitionId]);
    // }
}