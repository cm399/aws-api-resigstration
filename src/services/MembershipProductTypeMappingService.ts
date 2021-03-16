import { Service } from "typedi";
import BaseService from "./BaseService";
import { MembershipProductTypeMapping } from "../models/registrations/MembershipProductTypeMapping";

@Service()
export default class MembershipProductTypeMappingService extends BaseService<MembershipProductTypeMapping> {

    modelName(): string {
        return MembershipProductTypeMapping.name;
    }

    public async getIDForDeleteProductByProductIdInMapping(productId: number, organisationId: number): Promise<MembershipProductTypeMapping> {
        return await this.entityManager.query(
            `select mpm.* from membershipProductTypeMapping as mpm join membershipProduct as mp on mp.id = mpm.membershipProductId 
            where mpm.isDeleted = 0 and mp.isDeleted = 0 and mpm.membershipProductId = ? and mp.organisationId = ?`, [productId, organisationId]);
    }

    public async findByMemebershipId(membershipProductId: number) {
        let query = this.entityManager.createQueryBuilder(MembershipProductTypeMapping, 'mpm')
        query.where('mpm.membershipProductId = :membershipProductId and mpm.membershipProductTypeId = 1 and mpm.isDeleted = 0', { membershipProductId })
        return (await query.getOne()).id;
    }
    public async getMembershipProductTypes(productId: number, organisationId: number): Promise<any> {
        return await this.entityManager.query(
            `select mpm.membershipProductTypeId from membershipProductTypeMapping as mpm join membershipProduct as mp on mp.id = mpm.membershipProductId 
            where mpm.membershipProductId = ? and mpm.isDeleted = 0 and mp.organisationId = ?`, [productId, organisationId]);
    }

    public async getIDForDeleteProductByTypeIdInMapping(typeId: number, productId: number, organisationId: number): Promise<MembershipProductTypeMapping[]> {
        return await this.entityManager.query(
            `select mpm.* from membershipProductTypeMapping mpm join membershipProduct as m on m.id = mpm.membershipProductId where 
            mpm.membershipProductTypeId = ? and mpm.membershipProductId = ? and mpm.isDeleted = 0 and m.organisationId = ? and 
            m.isDeleted = 0`, [typeId, productId, organisationId]);
    }

    public async findMappingById(mappingId: number, userId: number): Promise<MembershipProductTypeMapping[]> {
        return await this.entityManager.createQueryBuilder().select().from(MembershipProductTypeMapping, 'm')
            .andWhere("m.id = :mappingId", { mappingId })
            .andWhere("m.createdBy = :userId", { userId })
            .execute();
    }
}
