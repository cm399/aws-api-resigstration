import { Service } from "typedi";
import BaseService from "./BaseService";
import { MembershipProductTypeChildDiscount } from "../models/registrations/MembershipProductTypeChildDiscount";

@Service()
export default class MembershipProductTypeChildDiscountService extends BaseService<MembershipProductTypeChildDiscount> {

    modelName(): string {
        return MembershipProductTypeChildDiscount.name;
    }

    public async getIDForDeleteProductByProductIdInChildDiscount(productId: number, organisationId: number): Promise<any> {
        return await this.entityManager.query(
            `select id FROM membershipProductTypeChildDiscount as mptcd WHERE mptcd.isDeleted = 0 and  
            mptcd.membershipProductTypeDiscountId in (SELECT id FROM membershipProductTypeDiscount as mptd where mptd.isDeleted = 0 
            and mptd.membershipProductTypeMappingId in (SELECT mpm.id FROM membershipProductTypeMapping as mpm join membershipProduct 
            as mp on mp.id = mpm.membershipProductId where mpm.isDeleted = 0 and mp.isDeleted = 0  and mp.organisationId = ? and 
            mpm.membershipProductId = ?))`, [organisationId, productId]);
    }

    public async getIDForDeleteProductByMappingIdInDiscountChild(typeId: number, productId: number,organisationId: number): Promise<MembershipProductTypeChildDiscount[]> {
        return await this.entityManager.query(
            `select id from membershipProductTypeChildDiscount where isDeleted = 0 and membershipProductTypeDiscountId in (select id FROM 
            membershipProductTypeDiscount where isDeleted = 0 and membershipProductTypeMappingId in (select mpm.id from membershipProductTypeMapping as mpm 
            join membershipProduct as m on m.id = mpm.membershipProductId where mpm.isDeleted = 0 and mpm.membershipProductId = ? and m.isDeleted = 0 
            and mpm.membershipProductTypeId = ? and m.organisationId = ?))`, [productId, typeId, organisationId]);
    }

    public async findPreviousDiscountTypeChildData(productId: number, organisationId: number): Promise<any> {
        return await this.entityManager.query(
            `SELECT id FROM membershipProductTypeChildDiscount where isDeleted = 0 and membershipProductTypeDiscountId in (SELECT mpd.id FROM 
            membershipProductTypeDiscount AS mpd JOIN membershipProductTypeMapping AS mpm ON mpm.id = mpd.membershipProductTypeMappingId join 
            membershipProduct as mp on mp.id = mpm.membershipProductId WHERE mp.organisationId = ? and mp.id = ? and mpm.isDeleted = 0 and 
            mpd.isDeleted = 0 and mp.isDeleted = 0)`, [organisationId, productId]);
    }

    // public async getIDForDeleteProductByIdInDiscountChild(childId: number, userId: number): Promise<MembershipProductTypeChildDiscount> {
    //     return await this.entityManager.query(
    //         `select id from membershipProductTypeChildDiscount where createdBy = ? and id = ? and isDeleted = 0`, [userId, childId]);
    // }
}

