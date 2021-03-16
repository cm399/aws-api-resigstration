import { Service } from "typedi";
import BaseService from "./BaseService";
import { OrgRegistrationHardshipCode } from '../models/registrations/OrgRegistrationHardshipCode';

@Service()
export default class OrgRegistrationHardshipCodeService extends BaseService<OrgRegistrationHardshipCode> {

    modelName(): string {
        return OrgRegistrationHardshipCode.name;
    }

    public async findByOrgRegId(orgRegistrationId: number): Promise<OrgRegistrationHardshipCode[]> {
        let query = await this.entityManager.createQueryBuilder(OrgRegistrationHardshipCode, 'orghc')
                    .where('orghc.orgRegistrationId = :orgRegistrationId and orghc.isDeleted = 0',{orgRegistrationId: orgRegistrationId})
                    .getMany();

            return query;
    }

    // public async findByCode(orgRegistrationId: number, code: string): Promise<OrgRegistrationHardshipCode> {
    //     let query = await this.entityManager.createQueryBuilder(OrgRegistrationHardshipCode, 'orghc')
    //                 .where('orghc.orgRegistrationId = :orgRegistrationId and orghc.isDeleted = 0 and code = :code and isActive = 1',
    //                 {orgRegistrationId: orgRegistrationId, code: code})
    //                 .getOne();

    //         return query;
    // }

    public async findByCode(orgRegistrationId: number, code: string, feeTypeRefId: number): Promise<OrgRegistrationHardshipCode[]> {
        let query = await this.entityManager.query(`select cpo.* from wsa_registrations.orgRegistrationHardshipCode orhc 
                    inner join wsa_registrations.orgRegistration org 
                        on org.id = orhc.orgRegistrationId and org.isDeleted = 0
                    inner join wsa_registrations.competition c 
                        on c.id = org.competitionId and c.isDeleted = 0
                    inner join wsa_registrations.competitionPaymentOption cpo 
                        on cpo.competitionId = c.id and cpo.paymentOptionRefId = 9 and cpo.isDeleted = 0
                    where orhc.orgRegistrationId = ? and orhc.code = ? and orhc.isDeleted = 0 and orhc.isActive = 1
                    and cpo.feesTypeRefId = ?`,
                    [orgRegistrationId, code, feeTypeRefId]);

            return query;
    }

    public async updateByCode(orgRegistrationId: number, code: string, registration: any, appliedTo: number): Promise<any>{
        await this.entityManager.query(`update wsa_registrations.orgRegistrationHardshipCode set isActive = 0, updatedBy = ?, updatedOn = ?,
        registrationId = ?, appliedTo = ?
        where orgRegistrationId = ? and code = ?`, [registration.createdBy, new Date(), registration.id, appliedTo, orgRegistrationId, code]);
    }

}
