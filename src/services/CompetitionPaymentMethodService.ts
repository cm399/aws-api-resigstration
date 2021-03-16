import { Service } from "typedi";
import BaseService from "./BaseService";
import { CompetitionPaymentMethod } from "../models/registrations/CompetitionPaymentMethod";

@Service()
export default class CompetitionPaymentMethodService extends BaseService<CompetitionPaymentMethod> {

    modelName(): string {
        return CompetitionPaymentMethod.name;
    }

    public async checkPreviousPaymentMethods(competitionID: number): Promise<any> {
        return await this.entityManager.query(
            `select * from competitionPaymentMethod where competitionId = ? and isDeleted = 0`, [competitionID]);
    }
}