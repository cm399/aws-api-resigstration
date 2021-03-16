import { Service } from "typedi";
import BaseService from "./BaseService";
import { OrgRegistrationMembershipProductType } from '../models/registrations/OrgRegistrationMembershipProductType';

@Service()
export default class OrgRegistrationMembershipProductTypeService extends BaseService<OrgRegistrationMembershipProductType> {

    modelName(): string {
        return OrgRegistrationMembershipProductType.name;
    }

    public async checkPreviousTypes(orgRegId: number): Promise<any> {
        return await this.entityManager.query(
            `select * from orgRegistrationMembershipProductType where orgRegistrationId = ? and isDeleted = 0`, [orgRegId]);
    }
}