import { Service } from "typedi";
import BaseService from "./BaseService";
import { MembershipProductTypeDiscountType } from "../models/registrations/MembershipProductTypeDiscountType";

@Service()
export default class MembershipProductTypeDiscountTypeService extends BaseService<MembershipProductTypeDiscountType> {

    modelName(): string {
        return MembershipProductTypeDiscountType.name;
    }

    public async getDefaultDiscountTypes(isDefault: number): Promise<MembershipProductTypeDiscountType[]> {
        return await this.entityManager.createQueryBuilder().select().from(MembershipProductTypeDiscountType, 'mptdt')
            .andWhere("mptdt.isDefault = :isDefault", { isDefault })
            .andWhere("mptdt.isDeleted = 0")
            .execute();
    }

    public async getIDForDeleteProductByProductIdInDiscountType(productId: number, organisationId: number): Promise<MembershipProductTypeDiscountType> {
        return await this.entityManager.query(
            `select mptdt.id FROM membershipProductTypeDiscountType as mptdt join membershipProduct as mp on mp.id = mptdt.membershipProductId 
            WHERE mptdt.membershipProductId = ? and mptdt.isDeleted = 0 and mp.isDeleted = 0 and mp.organisationId = ? `, [productId, organisationId]);
    }

    public async getIDForDeleteProductByMappingIdInDiscountType(typeId: number, productId: number, organisationId: number): Promise<MembershipProductTypeDiscountType[]> {
        return await this.entityManager.query(
            `select id from membershipProductTypeDiscountType where isDeleted = 0 and id in (select membershipProductTypeDiscountTypeId from membershipProductTypeDiscount 
            where isDeleted = 0 and membershipProductTypeMappingId in (select mpm.id from membershipProductTypeMapping as mpm join membershipProduct as m on 
            m.id = mpm.membershipProductId where mpm.membershipProductId = ? and mpm.isDeleted = 0 and m.organisationId = ? and m.isDeleted = 0 and 
            mpm.membershipProductTypeId in (?)))`, [productId, organisationId, typeId]);
    }


    public async findPreviousDiscountTypeData(productId: number, organisationId: number) {
        return await this.entityManager.query(
            `SELECT mptdt.id FROM membershipProductTypeDiscountType as mptdt join membershipProduct as mp on mp.id = mptdt.membershipProductId 
            where mptdt.membershipProductId = ? and mp.isDeleted = 0 and mptdt.isDeleted = 0 and mp.organisationId = ?`, [productId, organisationId]);
    }

    // public async deleteProductByIdInDiscountType(discountTypeId: number, userId: number) {
    //     return await this.entityManager.query(
    //         `delete FROM membershipProductTypeDiscountType where id = ? and createdBy = ?`
    //         , [discountTypeId, userId]);
    // }
}
