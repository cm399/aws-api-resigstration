import { Service } from "typedi";
import BaseService from "./BaseService";
import { OrgRegistrationSettings } from '../models/registrations/OrgRegistrationSettings';

@Service()
export default class OrgRegistrationSettingsService extends BaseService<OrgRegistrationSettings> {

    modelName(): string {
        return OrgRegistrationSettings.name;
    }

    public async checkPreviousSettings(orgRegId: number): Promise<any> {
        return await this.entityManager.query(`select * from orgRegistrationSettings where orgRegistrationId = ? and isDeleted = 0`, [orgRegId]);
    }
}