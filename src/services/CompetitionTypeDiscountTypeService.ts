import { Service } from "typedi";
import BaseService from "./BaseService";
import { CompetitionTypeDiscountType } from '../models/registrations/CompetitionTypeDiscountType';

@Service()
export default class CompetitionTypeDiscountTypeService extends BaseService<CompetitionTypeDiscountType> {

    modelName(): string {
        return CompetitionTypeDiscountType.name;
    }

    public async getDefaultCompetitionDiscountTypes(isDefault) {
        return await this.entityManager.createQueryBuilder(CompetitionTypeDiscountType, 'ctdt')
            .andWhere("ctdt.isDefault = :isDefault", { isDefault })
            .andWhere("ctdt.isDeleted = 0")
            .execute();
    }

    public async getPreviousCompDiscountTypesById(competitionId: number, organisationId:number):Promise<any> {
        return await this.entityManager.query(
            `SELECT id FROM competitionTypeDiscountType WHERE organisationId = ? and competitionId = ? and isDeleted = 0`, [organisationId, competitionId]);
    }

    public async getIDForDeletePreviousCustomDiscountTypes(discountTypeId: number, competitionId: number, organisationId: number):Promise<any> {
        let isDefault = 0 // false
        return await this.entityManager.query(`select id FROM competitionTypeDiscountType 
        WHERE organisationId = ? and isDefault = ? and competitionId = ? and id = ? and isDeleted = 0`
            , [organisationId, isDefault, competitionId, discountTypeId]);
    }

    public async getDefaultDiscountTypes(isDefault: number) {
        return await this.entityManager.query(`select * from competitionTypeDiscountType where isDefault = ? and isDeleted = 0`, [isDefault])
    }

    public async getIDForDeleteCompDisTypeByCompetitionId(competitionId: number):Promise<any> {
        let isDefault = 0; // false
        return await this.entityManager.query(
            `select id from competitionTypeDiscountType where competitionId = ? and isDefault = ? and isDeleted = 0`
            , [competitionId, isDefault]);
    }
}