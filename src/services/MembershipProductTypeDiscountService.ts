import { Service } from "typedi";
import BaseService from "./BaseService";
import { MembershipProductTypeDiscount } from "../models/registrations/MembershipProductTypeDiscount";
import { isArrayPopulated } from "../utils/Utils";

@Service()
export default class MembershipProductTypeDiscountService extends BaseService<MembershipProductTypeDiscount> {

    modelName(): string {
        return MembershipProductTypeDiscount.name;
    }

    public async getIDForDeleteProductByProductIdInDiscount(productId: number, organisationId: number): Promise<MembershipProductTypeDiscount> {
        return await this.entityManager.query(
            `select id FROM membershipProductTypeDiscount as mptd where mptd.membershipProductTypeMappingId in (select mpm.id from membershipProductTypeMapping 
            as mpm join membershipProduct as mp on mp.id = mpm.membershipProductId where mpm.membershipProductId = ? and mpm.isDeleted = 0 and mp.isDeleted = 0 
            and mp.organisationId = ?) and mptd.isDeleted = 0`, [productId, organisationId]);
    }

    public async findProductDiscountById(productId: number, organisationId: number): Promise<any> {
     //   await this.entityManager.query(`SET SESSION group_concat_max_len = 999999`);
        let query = await this.entityManager.query(
            `SELECT DISTINCT mp.membershipProductUniqueKey AS membershipProductId, mp.statusRefId as statusRefId, (CONCAT('[',
            (SELECT CAST(GROUP_CONCAT(JSON_OBJECT('membershipProductTypeRefName', mp.productName,
            'discounts', (CONCAT('[', (SELECT CAST(GROUP_CONCAT(JSON_OBJECT('membershipProductTypeMappingId',
            mptd.membershipProductTypeMappingId, 'membershipProductTypeDiscountId', mptd.id, 
            'membershipPrdTypeDiscountTypeRefId', mptd.membershipProductTypeDiscountTypeId, 'amount', 
            mptd.percentageOffOrFixedAmount,'description', mptd.description, 'availableFrom', 
            mptd.availableFrom, 'availableTo', mptd.availableTo, 'discountTypeRefId', 
            mptd.discountTypeRefId, 'discountCode', mptd.discountCode, 'applyDiscount', mptd.applyDiscount,
            'question', mptd.question, 'childDiscounts', (CONCAT('[', (SELECT CAST(GROUP_CONCAT(JSON_OBJECT(
            'membershipFeesChildDiscountId', mptcd.id, 'percentageValue', mptcd.percentageValue)) AS CHAR (999999))
            FROM membershipProductTypeChildDiscount as mptcd join membershipProductTypeDiscount as mptd1 on 
            mptd1.id = mptcd.membershipProductTypeDiscountId WHERE mptcd.membershipProductTypeDiscountId = mptd1.id
            and mptd1.id = mptd.id AND mptcd.isDeleted = 0 and mptd1.isDeleted = 0), ']')))) AS CHAR (999999)) FROM 
            membershipProductTypeDiscount as mptd JOIN membershipProductTypeMapping AS mpm ON mpm.id = mptd.membershipProductTypeMappingId 
            JOIN membershipProduct AS mp ON mp.id = mpm.membershipProductId WHERE mpm.membershipProductId = ? 
            and mptd.isDeleted = 0 and mpm.isDeleted = 0 and mp.isDeleted = 0), ']')))) AS CHAR (999999)) FROM membershipProduct AS mp1 
            WHERE mp1.id = mp.id and mp1.id = ? and mp1.isDeleted = 0), ']')) AS membershipProductDiscounts FROM membershipProduct AS mp 
            WHERE mp.organisationId = ? AND mp.id = ? and mp.isDeleted = 0` , [productId, productId, organisationId, productId]);

        for (let p of query) {
            if (p['membershipProductDiscounts']) p['membershipProductDiscounts'] = JSON.parse(p['membershipProductDiscounts']);
            if (Array.isArray(p['membershipProductDiscounts'])) {
                for (let q of p['membershipProductDiscounts']) {
                    if (q['discounts']) {
                        q['discounts'] = JSON.parse(q['discounts']);
                    }
                    if (isArrayPopulated(q['discounts'])) {
                        for (let r of q['discounts']) {
                            if (r['childDiscounts']) {
                                r['childDiscounts'] = JSON.parse(r['childDiscounts']);
                            }
                        }
                    }
                }
            }
        }
        return query;
    }

    public async getIDForDeleteProductByMappingIdInDiscount(typeId: number, productId: number, organisationId: number): Promise<MembershipProductTypeDiscount[]> {
        return await this.entityManager.query(
            `select id FROM membershipProductTypeDiscount where isDeleted = 0 and membershipProductTypeMappingId in (select mpm.id from membershipProductTypeMapping 
            as mpm join membershipProduct as m on m.id = mpm.membershipProductId where mpm.isDeleted = 0 and m.organisationId = ? and m.isDeleted = 0 and 
            mpm.membershipProductId = ? and mpm.membershipProductTypeId in (?))`, [organisationId, productId, typeId]);
    }

    public async findPreviousDiscountData(productId: number, ORGANISATION_ID: number): Promise<any> {
        return await this.entityManager.query(
            `SELECT mpd.id FROM membershipProductTypeDiscount AS mpd JOIN membershipProductTypeMapping AS mpm ON mpm.id = 
            mpd.membershipProductTypeMappingId join membershipProduct as mp on mp.id = mpm.membershipProductId WHERE 
            mp.id = ? and mp.organisationId = ? and mpd.isDeleted = 0 and mp.isDeleted = 0 and mpm.isDeleted = 0` , [productId, ORGANISATION_ID]);
    }

    // public async deleteProductByIdInDiscount(discountId: number, userId: number): Promise<DeleteResult> {
    //     return await this.entityManager.query(
    //         `delete from membershipProductTypeDiscount where id = ? and createdBy = ?`, [discountId, userId]
    //     )
    // }

    public async getDiscountByCode(memMappingId: number, code: string) : Promise<any>{
        let query = await this.entityManager.query(`select mptd.id as membershipProductTypeDiscountId 
                FROM membershipProductTypeDiscount as mptd 
                WHERE mptd.isDeleted = 0 and mptd.membershipProductTypeMappingId = ? and  mptd.discountCode = BINARY ?
                 and mptd.isDeleted = 0`, [memMappingId, code]);
        return query;
    }
}

