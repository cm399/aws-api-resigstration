import { Service } from "typedi";
import BaseService from "./BaseService";
import { OrgRegistrationDisclaimerLink } from '../models/registrations/OrgRegistrationDisclaimerLink';

@Service()
export default class OrgRegistrationDisclaimerLinkService extends BaseService<OrgRegistrationDisclaimerLink> {

    modelName(): string {
        return OrgRegistrationDisclaimerLink.name;
    }

    public async checkPreviousDisclaimer(registrationId: number): Promise<any> {
        return await this.entityManager.query(
            `select * from orgRegistrationDisclaimerLink where orgRegistrationId = ? and isDeleted = 0`, [registrationId]);
    }

}