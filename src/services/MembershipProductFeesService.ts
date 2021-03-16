import { Service } from "typedi";
import BaseService from "./BaseService";
import { isArrayPopulated } from "../utils/Utils";
import { MembershipProductFees } from "../models/registrations/MembershipProductFees";

@Service()
export default class MembershipProductFeesService extends BaseService<MembershipProductFees> {

    modelName(): string {
        return MembershipProductFees.name;
    }

    public async getDetailsForDeleteProductByProductIdInFees(productId: number, organisationId: number): Promise<MembershipProductFees> {
        return this.entityManager.createQueryBuilder().select().from(MembershipProductFees, 'mpf')
            .andWhere("mpf.membershipProductId = :productId", { productId })
            .andWhere("mpf.organisationId = :organisationId", { organisationId })
            .andWhere("mpf.isDeleted = 0")
            .execute();
    }

    public async getProductFeeListingWithDivisionNames(userId: number, getlimitoffset: boolean, OFFSET: number, LIMIT: number, year: number) {
        const query =
            `SELECT DISTINCT mp.id AS membershipId, mp.membershipProductUniqueKey AS membershipProductId, mp.productName AS membershipProductName, 
            mpf.seasonalGst AS seasonalGst, mpf.casualGst AS casualGst, mpt.name AS membershipProductTypeName, mpf.seasonalFee AS seasonalFee,
            mpf.casualFee AS casualFee, (CASE WHEN ( SELECT COUNT(*) FROM competitionMembershipProduct AS cmp JOIN membershipProduct AS mp1 ON 
            mp1.id = cmp.membershipProductId and mp1.isDeleted = 0 WHERE mp1.id = mpm.membershipProductId AND mp1.createdBy = ? and cmp.isDeleted = 0 
            AND mp1.yearRefId = ? AND mp1.id = mp.id) = 0 THEN FALSE ELSE TRUE END) AS isUsed, (CASE WHEN (SELECT COUNT(*) FROM 
            competitionMembershipProductDivision AS cmpd RIGHT JOIN competitionMembershipProduct AS cmp1 ON cmp1.id = cmpd.competitionMembershipProductId 
            and cmp1.isDeleted = 0 RIGHT JOIN membershipProduct AS mp2 ON mp2.id = cmp1.membershipProductId and mp2.isDeleted = 0 WHERE cmp1.createdBy = ?
            and cmpd.isDeleted = 0 AND mp2.createdBy = ? AND mp2.yearRefId = ? AND mp.id = mp2.id) = 0 THEN NULL ELSE cmpd.divisionName END) AS divisionName,
            (CASE WHEN (SELECT COUNT(*) FROM membershipProductTypeDiscount as mptd WHERE mptd.createdBy = ? and mptd.isDeleted = 0 AND 
            mptd.membershipProductTypeMappingId IN (SELECT mpm2.id FROM membershipProductTypeMapping AS mpm2 JOIN membershipProduct AS mp ON 
            mp.id = mpm2.membershipProductId WHERE mp.yearRefId = ? and mpm2.isDeleted = 0 and mp.isDeleted = 0 AND mp.createdBy = ? AND mpm2.id = mpm.id)) = 0 
            THEN FALSE ELSE TRUE END) AS isDiscountApplicable FROM membershipProduct AS mp LEFT JOIN membershipProductTypeMapping AS mpm ON 
            mpm.membershipProductId = mp.id LEFT JOIN membershipProductFees AS mpf ON mp.id = mpf.membershipProductId AND mpf.membershipProductTypeMappingId = mpm.id 
            and mpf.isDeleted = 0 LEFT JOIN membershipProductTypeDiscount AS mptd ON mptd.membershipProductTypeMappingId = mpf.membershipProductTypeMappingId and 
            mptd.isDeleted = 0 LEFT JOIN competitionMembershipProduct AS cmp ON cmp.membershipProductId = mp.id and cmp.isDeleted = 0 LEFT JOIN membershipProductType 
            AS mpt ON mpt.id = mpm.membershipProductTypeId and mpt.isDeleted = 0 LEFT JOIN competitionMembershipProductDivision AS cmpd ON cmpd.competitionMembershipProductId = 
            cmp.id and cmpd.isDeleted = 0 WHERE mpm.membershipProductId = mp.id AND mpm.createdBy = ? AND mp.yearRefId = ? AND mp.createdBy = ? and mp.isDeleted = 0 
            and mpm.isDeleted = 0 ORDER BY mp.id DESC`

        const countQuery = `select count(*) as productFeeCount from  ( ` + query + ` ) as temp;`
        const finalQuery = getlimitoffset ? query + ` limit ? offset ?` : countQuery;
        const PARAMETERS = [userId, year, userId, userId, year, userId, year, userId, userId, year, userId];
        if (getlimitoffset) {
            return await this.entityManager.query(finalQuery, [...PARAMETERS, LIMIT, OFFSET])
        } else {
            return await this.entityManager.query(finalQuery, [...PARAMETERS])
        }
    }

    public async getProductFeeListing(organisationId: number, getlimitoffset: boolean, OFFSET: number, LIMIT: number, year: number, sortBy:string=undefined, sortOrder:'ASC'|'DESC'=undefined) {
        return await this.entityManager.query("CALL wsa_registrations.membership_fee_listing(?, ?, ?, ?, ?, ?)", [organisationId,year, LIMIT, OFFSET, sortBy, sortOrder]);
    }

    public async findProductFeesById(productId: number, organisationId: number): Promise<any> {
        //   await this.entityManager.query(`SET SESSION group_concat_max_len = 819200;`)
        const result = await this.entityManager.query(
            `SELECT DISTINCT mp1.membershipProductUniqueKey as membershipProductId, mp1.paymentOptionRefId, CONCAT( "[",( SELECT cast(GROUP_CONCAT( json_object(
            "membershipProductFeesId",mpf.id, "membershipProductTypeMappingId",mpf.membershipProductTypeMappingId, "casualFee",mpf.casualFee,
            "casualGst",mpf.casualGst, "seasonalFee",mpf.seasonalFee, "seasonalGst",mpf.seasonalGst, "membershipProductFeesTypeRefId",
            mpf.membershipProductFeesTypeRefId, "validityDays", mpf.validityDays, "extendEndDate", mpf.extendEndDate, "organisationId",mpf.organisationId, 
            "membershipProductName", mp.productName, "membershipProductTypeRefName",mpt.name) )AS CHAR (819200)) FROM membershipProductFees as mpf 
            join membershipProduct as mp on mp.id = mpf.membershipProductId join membershipProductTypeMapping as mpm on mpm.id = mpf.membershipProductTypeMappingId
            join membershipProductType as mpt on mpt.id = mpm.membershipProductTypeId and mpt.isDeleted = 0 where mpf.organisationId = ? and 
            mp.id = ? and mpf.isDeleted = 0 and mp.isDeleted = 0 and mpm.isDeleted = 0 ),"]") AS membershipFees FROM membershipProduct as mp1 
            where mp1.organisationId = ? and mp1.id = ? and mp1.isDeleted = 0 ` , [organisationId, productId, organisationId, productId]);
            
        let isAlreadyRegistered = 0;
        let feeValueData = true;
        for (let p of result) {
            if (p['membershipFees']) {
                p['membershipFees'] = JSON.parse(p['membershipFees']);
                feeValueData = true;
                for(let mf of p['membershipFees']){
                    let transaction = await this.entityManager.query(`select * from  wsa_registrations.transactions tr where tr.membershipProductMappingId = ? and tr.isDeleted = 0`,[mf.membershipProductTypeMappingId]);
                    if(isArrayPopulated(transaction)){
                        isAlreadyRegistered = 1;
                    }
                }
            } else {
                feeValueData = false;
            }
            p['isAlreadyRegistered'] = isAlreadyRegistered;
        }
        return { result, feeValueData };
    }

    public async getIDForDeleteProductFeesByMappingID(typeId: number, productId: string, organisationId: number): Promise<any> {
        return await this.entityManager.query(
            `select mpf.id from membershipProductFees as mpf where mpf.isDeleted = 0 and mpf.membershipProductId  = ? and mpf.membershipProductTypeMappingId in 
            (select mpm.id from membershipProductTypeMapping as mpm join membershipProduct as m on m.id = mpm.membershipProductId where 
            mpm.isDeleted = 0 and m.isDeleted = 0 and m.organisationId = ? and mpm.membershipProductId = ? and mpm.membershipProductTypeId in (?))`
            , [productId, organisationId, productId, typeId]);
    }

    public async getMembershipFeesUsedInCompetition(competitionUniqueKey: string): Promise<any> {
        return await this.entityManager.query(
            `select distinct mpf.* from competitionMembershipProduct as cmp 
            join membershipProductTypeMapping as mpm on mpm.membershipProductId = cmp.membershipProductId and mpm.isDeleted = 0
            join membershipProductFees as mpf on mpf.membershipProductTypeMappingId = mpm.id and mpf.isDeleted = 0
            join competition as c on c.id = cmp.competitionId and c.isDeleted = 0
            where c.competitionUniqueKey = ? and cmp.isDeleted = 0`, [competitionUniqueKey]);
    }

    public async getMembeshipFeeValidityDetails(membershipProductMappingId: number, organisationId: number): Promise<any> {
        return this.entityManager.query(`select validityDays, extendEndDate from wsa_registrations.membershipProductFees mpf where membershipProductTypeMappingId = ?
                        and membershipProductFeesTypeRefId = 1 and organisationId = ? and isDeleted = 0`, [membershipProductMappingId, organisationId])
    }
}