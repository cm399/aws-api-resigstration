import { Service } from "typedi";
import BaseService from "./BaseService";
import { MembershipProductType } from "../models/registrations/MembershipProductType";
import { isArrayPopulated } from "../utils/Utils";

@Service()
export default class MembershipProductTypeService extends BaseService<MembershipProductType> {

    modelName(): string {
        return MembershipProductType.name;
    }

    public async getDefaultMembershipProductTypes(isDefault: number): Promise<MembershipProductType[]> {
        return await this.entityManager.createQueryBuilder().select().from(MembershipProductType, 'mpt')
            .andWhere("mpt.isDefault = :isDefault", { isDefault })
            .andWhere("mpt.isDeleted = 0")
            .execute();
    }

    public async getDefaultTypes(isDefault: number): Promise<any> {
        const query = await this.entityManager.query(
            `SELECT distinct ( CONCAT( '[', ( SELECT GROUP_CONCAT( json_object( 'membershipProductTypeMappingId', null, 
            'membershipProductTypeRefId', mpt.id, 'membershipProductTypeRefName', mpt.name, 'dobFrom', null, 'dobTo', null, 'isPlaying', isPlaying)) 
            FROM membershipProductType as mpt where mpt.isDefault = ? and mpt.isDeleted = 0), ']' ) ) AS MembershipProductTypes` , [isDefault]);

        for (let i of query) {
            i['MembershipProductTypes'] = JSON.parse(i['MembershipProductTypes'])
        }
        return query;
    }

    public async getDetailsForDeleteProductByProductIdInType(productId: number, organisationId: number): Promise<MembershipProductType> {
        return await this.entityManager.query(
            `select mpm.* from membershipProductTypeMapping as mpm join membershipProduct as mp on mp.id = mpm.membershipProductId where mpm.isDeleted = 0 
            and mp.isDeleted = 0 and mpm.membershipProductId = ? and mp.organisationId = ?`, [productId, organisationId]);
    }

    public async findProductTypes(productId: number, organisationId: number): Promise<any> {
        //   await this.entityManager.query(`SET SESSION group_concat_max_len = 819200`);
        const query = await this.entityManager.query(
            `select distinct CONCAT( '[', ( SELECT distinct CAST( GROUP_CONCAT( json_object( 'membershipProductTypeMappingId',  mpm.id, 'allowTeamRegistrationTypeRefId', mpm.allowTeamRegistrationTypeRefId,
            'membershipProductTypeRefId', mpt.id, 'membershipProductTypeRefName', mpt.name,'isPlaying', mpt.isPlaying, 'isDefault',mpt.isDefault, 'dobFrom', mpm.dobFromDate, 
            'isChildrenCheckNumber', mpm.isChildrenCheckNumber,'dobTo', mpm.dobToDate )) AS CHAR(819200)) FROM membershipProductTypeMapping as mpm join membershipProduct as mp on 
            mp.id = mpm.membershipProductId Join membershipProductType as mpt on mpt.id = mpm.membershipProductTypeId and 
            mpt.isDeleted = 0 where mpm.isDeleted = 0 and mp.isDeleted = 0 and mp.id = ? and mp.organisationId = ?
            ),']') as MembershipProductTypes union all select distinct CONCAT( '[', ( SELECT distinct CAST( GROUP_CONCAT( json_object(
            'membershipProductTypeMappingId', 0, 'membershipProductTypeRefId', mpt.id, 'membershipProductTypeRefName', mpt.name, 
            'dobFrom', null,'dobTo', null, 'isPlaying', mpt.isPlaying )order by mpt.sortOrder ASC ) AS CHAR(819200)) FROM membershipProductType as mpt where mpt.isDefault = ? and 
            mpt.isDeleted = 0),']') as MembershipProductTypes` , [productId, organisationId, 1]);

        if (isArrayPopulated(query)) {
            let userSelectedArray = [];
            let defaultArray = [];

            for (let r of query) {
                if (r['MembershipProductTypes']) r['MembershipProductTypes'] = JSON.parse(r['MembershipProductTypes']);
            }

            if (query[0]) userSelectedArray.push(query[0])
            if (query[1]) defaultArray.push(query[1])

            let temp = []
            if (isArrayPopulated(userSelectedArray[0].MembershipProductTypes)) {
                userSelectedArray[0].MembershipProductTypes.forEach(e => temp.push(e.membershipProductTypeRefId));
                if (isArrayPopulated(temp)) {
                    temp.forEach(e => {
                        if (isArrayPopulated(defaultArray[0].MembershipProductTypes)) {
                            const index = defaultArray[0].MembershipProductTypes.findIndex(g => g.membershipProductTypeRefId === e);
                            if (index !== -1) defaultArray[0].MembershipProductTypes.splice(index, 1);
                        }
                    });
                    if (isArrayPopulated(userSelectedArray[0].MembershipProductTypes) && isArrayPopulated(defaultArray[0].MembershipProductTypes)) {
                        userSelectedArray[0].MembershipProductTypes.push(...defaultArray[0].MembershipProductTypes)
                    }
                }
            }
            return userSelectedArray;
        } else {
            if (isArrayPopulated(query)) {
                for (let r of query) {
                    if (r['MembershipProductTypes']) r['MembershipProductTypes'] = JSON.parse(r['MembershipProductTypes']);
                }
            }
            return query
        }
    }

    public async getIDForDeleteProductByTypeIdInTypes(typeId: number, productId: number, organisationId: number): Promise<MembershipProductType[]> {
        const isDefault = 0; //false
        return await this.entityManager.query(
            `select mpt.* from membershipProductType mpt join membershipProduct as m on m.id = mpt.membershipProductId where mpt.isDeleted = 0 and 
            m.isDeleted = 0 and mpt.isDefault = ? and mpt.membershipProductId = ? and mpt.id = ? and m.organisationId = ? `
            , [isDefault, productId, typeId, organisationId]);
    }

}
