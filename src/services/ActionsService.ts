import { Service } from "typedi";
import { Actions } from "../models/common/Actions";
import BaseService from "./BaseService";
import { isArrayPopulated } from "../utils/Utils";

@Service()
export default class ActionsService extends BaseService<Actions> {
    modelName(): string {
        return Actions.name;
    }

    public async createAction11(competitionOrgId, membershipProductId,userId ){
        try{

            let affiliateOrgArray = await this.findOrganisationIds(competitionOrgId);

            let actionArray = [];

            if(isArrayPopulated(affiliateOrgArray)){
                for(let aff of affiliateOrgArray){
                    let action = new Actions()
                    action.id = 0;
                    action.actionMasterId = 11;
                    action.organisationId = aff.affiliateOrgId;
                    action.statusRefId = 1;
                    action.competitionOrgId = competitionOrgId;
                    action.membershipProductId = membershipProductId;
                    action.createdBy = userId;

                    actionArray.push(action);
                }
                return actionArray;
                
            }
           
        }
        catch(error){
            throw error;
        }
    }

    public async createAction1(affiliateOrgArray ,competitionOrgId, competitionId,userId){
        try{

            let actionArray = [];

            if(isArrayPopulated(affiliateOrgArray)){
                for(let aff of affiliateOrgArray){
                    let action = new Actions()
                    action.id = 0;
                    action.actionMasterId = 1;
                    action.organisationId = aff.organisationId;
                    action.statusRefId = 1;
                    action.competitionOrgId = competitionOrgId;
                    action.competitionId = competitionId;
                    action.createdBy = userId;

                    actionArray.push(action);
                }
                return actionArray;
                
            }
        }
        catch(error){
            throw error;
        }
    }

    public async createAction3(organisationId, competitionId,userId){
        try{

            let action = new Actions()
            action.id = 0;
            action.actionMasterId = 3;
            action.organisationId = organisationId;
            action.statusRefId = 1;
            action.competitionOrgId = organisationId;
            action.competitionId = competitionId;
            action.createdBy = userId;

            return action;
        }
        catch(error){
            throw error;
        }
    }


    public async findOrganisationIds(organisationId){
        try{
            let query = await this.entityManager.query(
                `with temp1 as
                (
                    select a.affiliateOrgId 
                    from wsa_users.affiliate a 
                    where affiliatedToOrgId = ? and a.isDeleted = 0
                ),
                temp2 as
                (
                    select a.affiliateOrgId 
                    from wsa_users.affiliate a 
                    inner join temp1 t1
                    on a.affiliatedToOrgId = t1.affiliateOrgId and a.isDeleted = 0
                ),
                temp3 as
                (
                    select a.affiliateOrgId 
                    from wsa_users.affiliate a 
                    inner join temp2 t2
                    on a.affiliatedToOrgId = t2.affiliateOrgId and a.isDeleted = 0
                ),
                temp4 as
                (
                    select * from temp1 
                    union 
                    select * from temp2
                    union 
                    select * from temp3
                )
                select affiliateOrgId from temp4`,[organisationId]);

                return query;
        }
        catch(error){
            throw error;
        }
    }

    public async checkMembershipActionPresent(membershipProductId: number): Promise<Actions> {
        try {
            let query = this.entityManager.createQueryBuilder(Actions, 'actions')
            query.where('actions.membershipProductId= :membershipProductId and actions.actionMasterId = 11 and isDeleted = 0', {membershipProductId})
            return (await query.getOne());
        } catch (error) {
            throw error;
        }
    }

    public async createAction15(competitionOrgId, competitionId,userId ){
        try{
            await this.deleteActionExisting(competitionId, userId);
            let affiliateOrgArray = await this.findInvitedOrganisationIds(competitionId);
            let actionArray = [];

            if(isArrayPopulated(affiliateOrgArray)){
                for(let aff of affiliateOrgArray){
                    if(aff.organisationId == competitionOrgId) {
                        continue;
                    }
                    let action = new Actions()
                    action.id = 0;
                    action.actionMasterId = 15;
                    action.organisationId = aff.organisationId;
                    action.statusRefId = 1;
                    action.competitionOrgId = competitionOrgId;
                    action.competitionId = competitionId;
                    action.createdBy = userId;

                    actionArray.push(action);
                }

                return actionArray;
                
            }
           
        }
        catch(error){
            throw error;
        }
    }

    public async findInvitedOrganisationIds(competitionId) {
        try {
            let query = await this.entityManager.query(
                `select distinct cmpf.organisationId 
                from wsa_registrations.competitionMembershipProductFee cmpf
                inner join wsa_registrations.competitionMembershipProductType cmpt 
                    on cmpt.id = cmpf.competitionMembershipProductTypeId and cmpt.isDeleted = 0
                inner join  wsa_registrations.competitionMembershipProduct cmp 
                    on cmpt.competitionMembershipProductId  = cmp.id and cmp.isDeleted = 0
                where cmp.competitionId  = ? and cmpf.isDeleted = 0`,[competitionId]
            );

            return query;
        }catch(error) {
            throw error;
        }
    }

    public async deleteActionExisting(competitionId, userId) {
        try{
            await this.entityManager.query(
                `update wsa_common.actions  
                    set isDeleted = 1,updatedOn = current_timestamp(), updatedBy = ?
                where competitionId = ? and isDeleted = 0`,[userId, competitionId]
            );
        }catch(error) {
            throw error;
        }
    }
}