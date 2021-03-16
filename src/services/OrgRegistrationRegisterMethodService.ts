import { Service } from "typedi";
import BaseService from "./BaseService";
import { OrgRegistrationRegisterMethod } from '../models/registrations/OrgRegistrationRegisterMethod';

@Service()
export default class OrgRegistrationRegisterMethodService extends BaseService<OrgRegistrationRegisterMethod> {

    modelName(): string {
        return OrgRegistrationRegisterMethod.name;
    }

    public async checkPreviousMethods(registrationId: number): Promise<any> {
        return await this.entityManager.query(
            `select * from orgRegistrationRegisterMethod where orgRegistrationId = ? and isDeleted = 0`, [registrationId]);
    }
}