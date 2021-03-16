import { Service } from "typedi";
import BaseService from "./BaseService";
import { CompetitionPaymentInstalment } from '../models/registrations/CompetitionPaymentInstalment';

@Service()
export default class CompetitionPaymentInstalmentService extends BaseService<CompetitionPaymentInstalment> {

    modelName(): string {
        return CompetitionPaymentInstalment.name;
    }

    public async checkPreviousPaymentInstalments(competitionID: number): Promise<any> {
        return await this.entityManager.query(
            `select * from wsa_registrations.competitionPaymentInstalment cpi 
            where cpi.competitionId = ? and cpi.isDeleted = 0`, [competitionID]);
    }
}