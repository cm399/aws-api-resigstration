import { Service } from "typedi";
import BaseService from "./BaseService";
import { CompetitionGovernmentVoucher } from '../models/registrations/CompetitionGovernmentVoucher';

@Service()
export default class CompetitionGovernmentVoucherService extends BaseService<CompetitionGovernmentVoucher> {

    modelName(): string {
        return CompetitionGovernmentVoucher.name;
    }

    public async getPreviousGovernmentVouchers(compId: number,organisationId:number) {
        return await this.entityManager.query(
            `SELECT gv.id FROM competitionGovernmentVoucher as gv join competition as c on c.id = gv.competitionId WHERE gv.competitionId = ? and c.organisationId = ? and c.isDeleted = 0 and gv.isDeleted = 0`, [compId,organisationId]);
    }

    public async getIDForDeleteCompGovVoucherByCompId(competitionId: number): Promise<any> {
        return await this.entityManager.query(
            `select id from competitionGovernmentVoucher where competitionId = ? and isDeleted = 0`, [competitionId]);
    }
}