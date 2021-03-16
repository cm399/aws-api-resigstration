import { Service } from "typedi";
import BaseService from "./BaseService";
import { isArrayPopulated } from "../utils/Utils";
import { CompetitionMembershipProduct } from '../models/registrations/CompetitionMembershipProduct';

@Service()
export default class CompetitionMembershipProductService extends BaseService<CompetitionMembershipProduct> {

    modelName(): string {
        return CompetitionMembershipProduct.name;
    }

    public async getCompetitionFeeMembership(competitionUniqueKey: string, organisationId: number): Promise<any> {
       // await this.entityManager.query(`SET SESSION group_concat_max_len = 819200`);
        const query = await this.entityManager.query(
            `SELECT DISTINCT ( SELECT DISTINCT (CONCAT('[', CAST(GROUP_CONCAT(JSON_OBJECT( 'competitionMembershipProductId', cmp1.id, 
            'membershipProductUniqueKey', mp.membershipProductUniqueKey, 'membershipProductName', mp.productName, 'membershipProductTypes', 
            (SELECT DISTINCT (CONCAT('[', CAST(GROUP_CONCAT(JSON_OBJECT( 'competitionMembershipProductId', cmp.id, 'competitionMembershipProductTypeId', 
            cmpt.id, 'membershipProductTypeMappingId', mpm.id, 'membershipProductTypeName', mpt.name,'isPlaying',mpt.isPlaying, 'isDefault', mpt.isDefault,'mCasualFee',mpf.casualFee,'mSeasonalFee', 
            mpf.seasonalFee, 'mCasualGst', mpf.casualGst, 'mSeasonalGst',mpf.seasonalGst,'allowTeamRegistrationTypeRefId', mpm.allowTeamRegistrationTypeRefId)) AS CHAR (819200)), ']')) 
            FROM competitionMembershipProductType 
            as cmpt JOIN competitionMembershipProduct AS cmp ON cmpt.competitionMembershipProductId = cmp.id join membershipProductTypeMapping as mpm 
            on mpm.id = cmpt.membershipProductTypeMappingId left join membershipProductFees as mpf on mpf.membershipProductTypeMappingId = mpm.id and 
            mpf.isDeleted = 0 JOIN membershipProductType AS mpt ON mpt.id = mpm.membershipProductTypeId and mpt.isDeleted = 0 JOIN competition AS c 
            ON c.id = cmp.competitionId WHERE c.isDeleted = 0 and cmpt.isDeleted = 0 and cmp.isDeleted = 0 and mpm.isDeleted = 0 and 
            c.competitionUniqueKey = ? AND cmp.id = cmp1.id AND mp.id = cmp.membershipProductId))) AS CHAR (819200)), ']')) FROM 
            competitionMembershipProduct AS cmp1 JOIN membershipProduct AS mp ON mp.id = cmp1.membershipProductId JOIN competition AS c 
            ON c.id = cmp1.competitionId WHERE c.isDeleted = 0 and mp.isDeleted = 0 AND c.competitionUniqueKey = ? and cmp1.isDeleted = 0) AS membershipProducts` ,
            [competitionUniqueKey, competitionUniqueKey]);

            console.log("-----------"+JSON.stringify(query));
        if (isArrayPopulated(query)) {
            for (let r of query) {
                if (r['membershipProducts']) {
                    r['membershipProducts'] = JSON.parse(r['membershipProducts']);
                    if (isArrayPopulated(r['membershipProducts'])) {
                        for (let q of r['membershipProducts']) {
                            if (q['membershipProductTypes']) q['membershipProductTypes'] = JSON.parse(q['membershipProductTypes']);
                        }
                    }
                }
            }
        }
        console.log("-----------"+JSON.stringify(query));

        if (isArrayPopulated(query) && isArrayPopulated(query[0].membershipProducts)) {
            const filterArray = query[0].membershipProducts.filter((thing, index) =>
                index === query[0].membershipProducts.findIndex(obj => JSON.stringify(obj) === JSON.stringify(thing)))
            query.map(s => s.membershipProducts = filterArray)
            return query
        } else return query;

    }

    // public async deleteCompMemProByProductId(productId: number, userId: number): Promise<any> {
    //     return await this.entityManager.query(`delete from competitionMembershipProduct where membershipProductId = ? and createdBy = ?`, [productId, userId]);
    // }

    public async checkMemProUsed(productId: number): Promise<any> {
        return await this.entityManager.query(`select * from competitionMembershipProduct where membershipProductId = ? and isDeleted = 0`, [productId]);
    }

    public async checkCompMemProPreviousData(competitionId: number,organisationId: number): Promise<any> {
        return await this.entityManager.query(`select cmp.id, cmp.membershipProductId from competitionMembershipProduct as cmp join competition as c on c.id = cmp.competitionId where 
        cmp.competitionId = ? and c.isDeleted = 0 and c.organisationId = ? and cmp.isDeleted = 0`, [competitionId, organisationId]);
    }

    public async getIDForDeletePreviousCompMemProduct(competitionId: number, compMemProID: number): Promise<any> {
        return await this.entityManager.query(
            `select id from competitionMembershipProduct where isDeleted = 0 and competitionId = ? and id = ?`, [competitionId, compMemProID]);
    }

    public async getIDForDeleteCompMemProByCompetitionId(competitionId: number): Promise<any> {
        return await this.entityManager.query(
            `select id from competitionMembershipProduct where competitionId = ? and isDeleted = 0 and membershipProductId 
            in (select membershipProductId from membershipProductTypeMapping where isDeleted = 0 )`, [competitionId]);
    }

    public async findByCompetition(competitionId: number){
        let query = await this.entityManager.createQueryBuilder(CompetitionMembershipProduct, 'cmp')
        query.where('cmp.competitionId= :competitionId and isDeleted = 0', { competitionId: competitionId })
        return (await query.getOne());
    }

    public async getMembershipProductsUsedDetails(competitionUniqueKey: string): Promise<any> {
        return await this.entityManager.query(
        `select mp.* from competitionMembershipProduct as cmp join competition as c on c.id = cmp.competitionId and c.isDeleted = 0
        join membershipProduct as mp on mp.id = cmp.membershipProductId and mp.isDeleted = 0 where c.competitionUniqueKey = ?`,[competitionUniqueKey]);
    }
}