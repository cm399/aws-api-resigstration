import { Service } from "typedi";
import BaseService from "./BaseService";
import { isArrayPopulated } from '../utils/Utils';
import { CompetitionTypeDiscount } from '../models/registrations/CompetitionTypeDiscount';

@Service()
export default class CompetitionTypeDiscountService extends BaseService<CompetitionTypeDiscount> {

    modelName(): string {
        return CompetitionTypeDiscount.name;
    }

    public async getCompetitionFeeDiscount(competitionID: number, organisationId: number, affiliateOrgId: number): Promise<any> {
        const query = await this.entityManager.query(`call wsa_registrations.usp_competitionfee_discount(?,?,?)`, [competitionID, organisationId, affiliateOrgId]);
        if (isArrayPopulated(query) && isArrayPopulated(query[0])) {
            for (let i of query[0]) {
                if (i['competitionDiscounts']) {
                    if(i['competitionDiscounts']) i['competitionDiscounts'] = JSON.parse(i['competitionDiscounts']);
                    if (isArrayPopulated(i['competitionDiscounts'])) {
                        for (let j of i['competitionDiscounts']) {
                            if (j['discounts']) {
                                if(j['discounts']) j['discounts'] = JSON.parse(j['discounts']);
                                if (isArrayPopulated(j['discounts'])) {
                                    for (let k of j['discounts']) {
                                        if(k['childDiscounts']) k['childDiscounts'] = JSON.parse(k['childDiscounts']);
                                    }
                                }
                            }
                        }
                    }
                }
                if (i['govermentVouchers']) i['govermentVouchers'] = JSON.parse(i['govermentVouchers']);
            }
            return query[0];
        } else {
            return query;
        }
    }
   
    public async getPreviousCompDiscount(competitionID: number, organisationId: number):Promise<any> {
        return await this.entityManager.query(
            `select id from competitionTypeDiscount as ctd where ctd.organisationId = ? and ctd.isDeleted = 0 and 
            ctd.competitionMembershipProductTypeId in ( select cmpt.id from competitionMembershipProductType as cmpt 
            where cmpt.isDeleted = 0 and cmpt.competitionMembershipProductId in (select cmp.id from competitionMembershipProduct 
            as cmp where cmp.isDeleted = 0 and cmp.competitionId = ?) and cmpt.membershipProductTypeMappingId in 
            (select mpm.id from membershipProductTypeMapping as mpm join competitionMembershipProductType as cmpt on 
            cmpt.membershipProductTypeMappingId = mpm.id where mpm.isDeleted = 0 and cmpt.isDeleted = 0 ))`
            , [organisationId, competitionID]);
    }

    public async getIDForDeleteCompDisByCompetitionId(competitionId: number) {
        return await this.entityManager.query(
            `select id from competitionTypeDiscount where isDeleted = 0 and competitionMembershipProductTypeId in 
            (select id from competitionMembershipProductType where isDeleted = 0 and competitionMembershipProductId in 
            (select id from competitionMembershipProduct where isDeleted = 0 and competitionId = ?))`
            , [competitionId]);
    }

    // public async deletePreviousDiscounts(discountId: number, userId: number, competitionId: number) {
    //     return await this.entityManager.query(
    //         `delete from competitionTypeDiscount where id = ? and createdBy = ? and competitionMembershipProductTypeId in 
    //         (select id from competitionMembershipProductType where competitionMembershipProductId in 
    //         (select id from competitionMembershipProduct where competitionId = ? and createdBy = ?))`
    //         , [discountId, userId, competitionId, userId]);
    // }

    public async getIDForDeleteCompDisByCompMemProId(compMemProId: number, organisationId: number): Promise<any> {
        return await this.entityManager.query(
            `select cmptd.id FROM competitionTypeDiscount as cmptd WHERE cmptd.isDeleted = 0 
            and cmptd.organisationId = ? and cmptd.competitionMembershipProductTypeId in 
            (SELECT cmpt.id FROM competitionMembershipProductType as cmpt WHERE 
            cmpt.competitionMembershipProductId = ? and cmpt.isDeleted = 0) and isDeleted = 0`, [organisationId, compMemProId]);
    }

    public async getDiscountByCode(compMemProdTypeId: number, code: string) : Promise<any>{
        let query = await this.entityManager.query(`   select cmptd.id as competitionTypeDiscountId FROM competitionTypeDiscount as cmptd WHERE cmptd.isDeleted = 0 
                                            and cmptd.competitionMembershipProductTypeId = ? and  cmptd.discountCode = BINARY ?
                                            and cmptd.isDeleted = 0`, [compMemProdTypeId, code]);

        return query;

    }
}