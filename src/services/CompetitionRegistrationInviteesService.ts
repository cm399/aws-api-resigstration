import { Service } from "typedi";
import BaseService from "./BaseService";
import { CompetitionRegistrationInvitees } from '../models/registrations/CompetitionRegistrationInvitees';

@Service()
export default class CompetitionRegistrationInviteesService extends BaseService<CompetitionRegistrationInvitees> {

    modelName(): string {
        return CompetitionRegistrationInvitees.name;
    }

    public async checkInviteesPreviousData(competitionId: number, organisationId: number): Promise<any> {
        return await this.entityManager.query(
            `select cri.id from competitionRegistrationInvitees cri 
            join competition as c on c.id = cri.competitionId and c.isDeleted = 0
            where cri.isDeleted = 0 and c.organisationId = ? and cri.competitionId = ?`, [organisationId, competitionId]);
    }

    // public async deleteInviteesPreviousData(competitionId: number, userId: number, inviteesId: number): Promise<any> {
    //     return await this.entityManager.query(`DELETE FROM competitionRegistrationInvitees WHERE competitionId = ? and createdBy = ? and id = ?`, [competitionId, userId, inviteesId]);
    // }

    public async getInviteesDetail(competitionUniqueKey: string, organisationId: number): Promise<CompetitionRegistrationInvitees[]> {
        return await this.entityManager.query(`select inv.registrationInviteesRefId, inv.id from competitionRegistrationInvitees
         as inv join competition as c on c.id = inv.competitionId where c.competitionUniqueKey = ? and c.organisationId = ? and c.isDeleted = 0 and inv.isDeleted = 0`,
            [competitionUniqueKey, organisationId]);
    }

    public async getIDForDeleteCompInviteesByCompId(competitionId: number): Promise<any> {
        return await this.entityManager.query(`select id FROM competitionRegistrationInvitees WHERE competitionId = ? and isDeleted = 0`, [competitionId]);
    }
}