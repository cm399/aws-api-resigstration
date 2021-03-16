import { Service } from "typedi";
import BaseService from "./BaseService";
import { CompetitionTypeChildDiscount } from '../models/registrations/CompetitionTypeChildDiscount';

@Service()
export default class CompetitionTypeChildDiscountService extends BaseService<CompetitionTypeChildDiscount> {

    modelName(): string {
        return CompetitionTypeChildDiscount.name;
    }

    public async getIDForDeleteCompChildByCompetitionId(competitionId: number): Promise<any> {
        return await this.entityManager.query(
            `select id FROM competitionTypeChildDiscount WHERE isDeleted = 0 and competitionTypeDiscountId in (select id from 
            competitionTypeDiscount where isDeleted = 0 and competitionMembershipProductTypeId in (select id from 
            competitionMembershipProductType where isDeleted = 0 and competitionMembershipProductId in (select id from 
            competitionMembershipProduct where isDeleted = 0 and competitionId = ? )))`
            , [competitionId]);
    }

    public async getPreviousCompChildDiscountTypesById(competitionId: number, organisationId:number): Promise<any> {
        return await this.entityManager.query(
            `SELECT id FROM competitionTypeChildDiscount WHERE isDeleted = 0 and organisationId = ? and competitionTypeDiscountId in 
            (select id from competitionTypeDiscount where isDeleted = 0 and competitionMembershipProductTypeId in (
            select id FROM competitionMembershipProductType WHERE isDeleted = 0 and competitionMembershipProductId in 
            (select id from competitionMembershipProduct where isDeleted = 0 and competitionId = ? )))`
            , [organisationId, competitionId]);
    }

    // public async deletePreviousCompChildDiscountById(childId: number, competitionId: number, userId: number): Promise<any> {
    //     return await this.entityManager.query(
    //         `DELETE FROM competitionTypeChildDiscount WHERE id = ? and createdBy = ? and competitionTypeDiscountId in 
    //         (select id from competitionTypeDiscount where createdBy = ? and competitionMembershipProductTypeId in (
    //         select id FROM competitionMembershipProductType WHERE createdBy = ? and competitionMembershipProductId in 
    //         (select id from competitionMembershipProduct where competitionId = ? and createdBy = ? and membershipProductId 
    //         in (select membershipProductId from membershipProductTypeMapping where createdBy = ? ))) and 
    //         competitionTypeDiscountTypeId in (select id from competitionTypeDiscountType where competitionId = ? 
    //         and createdBy = ? and isDefault = 0))`, [childId, userId, userId, userId, competitionId, userId, userId, competitionId, userId]);
    // }

    public async getIDForDeleteCompChildByCompMemProId(compMemProId: number, organisationId: number): Promise<any> {
        return await this.entityManager.query(
            `select ctcd.id FROM competitionTypeChildDiscount as ctcd WHERE ctcd.organisationId = ? and ctcd.isDeleted = 0 
            and ctcd.competitionTypeDiscountId in (select id from competitionTypeDiscount where isDeleted = 0 and 
            competitionMembershipProductTypeId in (select cmpt.id from competitionMembershipProductType as cmpt 
            join competitionMembershipProduct as cmp on cmpt.competitionMembershipProductId = cmp.id join competition 
            as c on c.id = cmp.competitionId where c.isDeleted = 0 and cmp.isDeleted = 0 and cmpt.isDeleted = 0 and 
            cmpt.competitionMembershipProductId = ?))` , [organisationId,compMemProId,organisationId]);
    }

    public async findByDiscountTypeId(competitionTypeDiscountId: number){
        try{
            let query = await this.entityManager.query(
                `SELECT id FROM competitionTypeChildDiscount
                 WHERE isDeleted = 0  and competitionTypeDiscountId = ?`,[competitionTypeDiscountId]);

            return query;
        }
        catch(error){
            throw error;
        }
    }
}