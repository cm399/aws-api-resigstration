import { Service } from "typedi";
import BaseService from "./BaseService";
import { CompetitionMembershipProductType } from '../models/registrations/CompetitionMembershipProductType';

@Service()
export default class CompetitionMembershipProductTypeService extends BaseService<CompetitionMembershipProductType> {

    modelName(): string {
        return CompetitionMembershipProductType.name;
    }

    // public async deleteCompetitionMembershipProductTypeByMappingId(productId: number, userId: number): Promise<any> {
    //     return await this.entityManager.query(`delete from competitionMembershipProductType where createdBy = ? and membershipProductTypeMappingId in 
    //         (select id from membershipProductTypeMapping where membershipProductId = ? and createdBy = ?)`, [userId, productId, userId]);
    // }

    public async checkCompMemProTypePreviousData(competitionId: number, productId: number): Promise<any> {
        return await this.entityManager.query(
            `SELECT id FROM competitionMembershipProductType WHERE isDeleted = 0 and competitionMembershipProductId in (select id from 
            competitionMembershipProduct where isDeleted = 0 and competitionId = ? and membershipProductId = ? ) and 
            membershipProductTypeMappingId in (select id from membershipProductTypeMapping where isDeleted = 0 and membershipProductId = ?)`
            , [competitionId, productId, productId]);
    }

    // public async deleteCompMemProTypePreviousData(competitionId: number, productId: number, userId: number, compMemProTypeID: number): Promise<any> {
    //     return await this.entityManager.query(
    //         `DELETE FROM competitionMembershipProductType WHERE id = ? and createdBy = ? and competitionMembershipProductId in 
    //         (select id from competitionMembershipProduct where competitionId = ? and membershipProductId = ? and createdBy = ?) 
    //         and membershipProductTypeMappingId in (select id from membershipProductTypeMapping where createdBy = ? and membershipProductId = ?)`
    //         , [compMemProTypeID, userId, competitionId, productId, userId, userId, productId]);
    // }

    public async getIDForDeleteCompMemProTypeByMemProId(cmpId: number): Promise<any> {
        return await this.entityManager.query(`select id FROM competitionMembershipProductType WHERE isDeleted = 0 and competitionMembershipProductId = ?`, [cmpId]);
    }

    public async getIDForDeleteCompMemProTypeByCompId(competitionId: number): Promise<any> {
        return await this.entityManager.query(`select id FROM competitionMembershipProductType WHERE isDeleted = 0 and 
        competitionMembershipProductId in (select id from competitionMembershipProduct where competitionId = ? and 
        isDeleted = 0 and membershipProductId in (select membershipProductId from membershipProductTypeMapping where 
        isDeleted = 0 ))`, [competitionId]);
    }
    public async findByCompetitionMembershipProduct(competitionMembershipProductId: number){
        let query = await this.entityManager.createQueryBuilder(CompetitionMembershipProductType, 'cmpt')
        query.where('cmpt.competitionMembershipProductId= :competitionMembershipProductId and isDeleted = 0', { competitionMembershipProductId: competitionMembershipProductId })
        return (await query.getOne()).id;
    }

    public async findMembershipProductName(competitionMembershipProductTypeId){
        try{
            let query = await this.entityManager.query(
                `
                SELECT mpt.* 
                FROM wsa_registrations.competitionMembershipProductType cmpt 
                inner join wsa_registrations.membershipProductTypeMapping mptm 
                    on mptm.id = cmpt.membershipProductTypeMappingId and mptm.isDeleted = 0
                inner join wsa_registrations.membershipProductType mpt 
                    on mpt.id = mptm.membershipProductTypeId and mpt.isDeleted = 0
                where cmpt.id = ? `,[competitionMembershipProductTypeId]);

                return query[0]
        }
        catch(error){
            throw error;
        }
    }
}