import { Service } from "typedi";
import BaseService from "./BaseService";
import { Affiliate } from "../models/security/Affiliate";
import { isArrayPopulated } from "../utils/Utils";

@Service()
export default class AffiliateService extends BaseService<Affiliate> {
    modelName(): string {
        return Affiliate.name;
    }

    public async getAffilitedToOrg(organisationId: number) {
        try {
            let affilitedToOrg = 0;
            let query = await this.entityManager.createQueryBuilder(Affiliate, 'affiliate')
            .andWhere("affiliate.affiliateOrgId = :organisationId", { organisationId })
            .andWhere("affiliate.isDeleted = 0")
            .getOne();
            if(query!= null && query!= undefined){
                affilitedToOrg = query.affiliatedToOrgId;
            }
            return affilitedToOrg;
        } catch(error) {
            throw error;
        }
    }

    public async getAllAssociations(organisationId: string, invitedTo: number, search: string): Promise<any> {
        return await this.entityManager.query('call wsa_users.usp_organisation_affiliations(?,?,?)', [organisationId, invitedTo, search]);
    }

    public async getTermAndConditionOrganisation(registrationId: number): Promise<any> {
        try {
            
            let query = await this.entityManager.query(` 
            select DISTINCT  o.id, o.organisationUniqueKey, o.termsAndConditionsRefId, o.termsAndConditions, o.name
                from 
                (
                select DISTINCT 
                    a.affiliateOrgId, a.affiliatedToOrgId
                    from wsa_registrations.registration r 
                    inner join wsa_registrations.orgRegistrationParticipantDraft orp 
                        on orp.registrationId = r.id and orp.isDeleted = 0 
                    inner join wsa_registrations.orgRegistration org 
                        on org.id = orp.orgRegistrationId and org.isDeleted = 0
                    inner join wsa_users.organisation o 
                        on o.id = org.organisationId and o.isDeleted = 0
                    inner join wsa_users.affiliate a 
                        on (a.affiliateOrgId in (case when o.organisationTypeRefId = 3 then  o.id 
                                when o.organisationTypeRefId = 4 then (select a2.affiliatedToOrgId from wsa_users.affiliate a2 
                                        where  a2.affiliateOrgId = o.id and a2.organisationTypeRefId = 4 and a2.isDeleted = 0)
                                else o.id end ) or a.affiliateOrgId = org.organisationId) and a.isDeleted = 0 
                    where r.id = ? and r.isDeleted = 0 
                ) as tt 
                inner join wsa_users.organisation o 
                on (o.id = tt.affiliateOrgId or o.id = tt.affiliatedToOrgId) and o.isDeleted = 0
                WHERE o.termsAndConditions IS NOT NULL and o.termsAndConditions != ""`,[registrationId]);

            return query;

        } catch (error) {
            throw error;
        }
    }

    public async getTermAndConditionOrganisationForInvite(userRegId: number): Promise<any> {
        try {
            let query = await this.entityManager.query(`
                    select DISTINCT o.id, o.organisationUniqueKey, o.name, 
                    o.termsAndConditionsRefId, o.termsAndConditions
                    from
                    (select DISTINCT a.affiliateOrgId, a.affiliatedToOrgId
                        from wsa_registrations.userRegistration ur
                        inner join wsa_registrations.orgRegistrationParticipant orgp
                            on orgp.userRegistrationId = ur.id and orgp.isDeleted = 0
                        inner join wsa_registrations.orgRegistration org
                            on org.id = orgp.orgRegistrationId and org.isDeleted = 0
                        inner join wsa_users.organisation o
                            on o.id = org.organisationId and o.isDeleted = 0
                        inner join wsa_users.affiliate a 
                            on(a.affiliateOrgId in (case when o.organisationTypeRefId = 3 then  o.id 
                                when o.organisationTypeRefId = 4 then (select a2.affiliatedToOrgId from wsa_users.affiliate a2 
                                        where  a2.affiliateOrgId = o.id and a2.organisationTypeRefId = 4 and a2.isDeleted = 0)
                                else o.id end ) or a.affiliateOrgId = org.organisationId)
                        where ur.id = ? and ur.isDeleted = 0 ) as tc
                    inner join wsa_users.organisation o 
                    on (o.id = tc.affiliateOrgId or o.id = tc.affiliatedToOrgId) and o.isDeleted = 0
                    WHERE o.termsAndConditions IS NOT NULL and o.termsAndConditions != ""`,[userRegId]);

            return query;
        }
        catch (err) {
            throw err;
        }
    }

    public async getStateOrganisation(organisationId: number, organisationTypeRefId: number): Promise<any>{
        try {
            let query = null;
            let response = null;
            if(organisationTypeRefId == 3){
                query = await this.entityManager.query(`
                    select o.* from wsa_users.affiliate a 
                        inner join wsa_users.organisation o 
                            on o.id = a.affiliateOrgId and o.isDeleted = 0
                        where o.id = ? `,[organisationId]);

            }
            else if(organisationTypeRefId == 4){
                query = await this.entityManager.query(`
                    select  o.*
                        from wsa_users.affiliate a 
                        inner join wsa_users.organisation o 
                            on o.id = a.affiliateOrgId and o.isDeleted = 0
                        where o.id = (select a2.affiliatedToOrgId from wsa_users.affiliate a2 
                                where a2.affiliateOrgId = ? and a2.organisationTypeRefId = 4 
                        and a2.isDeleted = 0) `,[organisationId]);
            }

            if(isArrayPopulated(query)){
                response = query.find(x=>x);
            }
            return query;
        } 
        catch (error) {
            throw error;
        }
    } 
}