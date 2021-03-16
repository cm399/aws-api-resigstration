import { Service } from "typedi";
import BaseService from "./BaseService";
import { SingleGameRedeem } from "../models/registrations/SingleGameRedeem";
import { paginationData, stringTONumber } from '../utils/Utils';

@Service()
export default class SingleGameRedeemService extends BaseService<SingleGameRedeem> {

    modelName(): string {
        return SingleGameRedeem.name;
    }

    public async singleGameList(competitionId: number, organisationId: number, requestBody: any) : Promise<any> {
        try{
            let responseObject;
            const OFFSET = stringTONumber(requestBody.paging.offset);
            const LIMIT = stringTONumber(requestBody.paging.limit);
            const searchText = requestBody.searchText;
          
            var result = await this.entityManager.query("call wsa_registrations.usp_get_single_game_list(?,?,?,?,?)",
                [organisationId, competitionId, searchText,  LIMIT, OFFSET]);
    
            if (result != null && result[1]!= null) {
                let totalCount = result[0].totalCount;
                responseObject = paginationData(stringTONumber(totalCount), LIMIT, OFFSET)
                responseObject["singleGameData"] = result[1];
    
                return responseObject;
            }
            else{
                responseObject["singleGameData"] = [];
                return responseObject;
            }
        }
        catch(error){
            throw error;
        }
    }

    public async getSingleGameTransactionData(competitionId, organisationId, requestBody: any): Promise<any>{
        try {
            let membershipMappingId = requestBody.membershipProductMappingId;
            let userId = requestBody.userId;
            let divisionId = requestBody.divisionId;
            let registrationId = requestBody.registrationId;
            let result = await this.entityManager.query(`select DISTINCT 
                t.feeAmount, t.gstAmount, t.organisationId, t.feeType, t.paymentFeeTypeRefId, t.paymentOptionRefId
                from wsa_registrations.transactions t 
                inner join wsa_registrations.invoice i 
                    on i.id = t.invoiceId and i.isDeleted = 0
                inner join wsa_registrations.registration r 
                    on r.id = i.registrationId and r.isDeleted = 0
                inner join wsa_registrations.orgRegistrationParticipant orpt 
                    on orpt.registrationId = r.id and orpt.paymentOptionRefId = 1 and orpt.teamRegistrationTypeRefId is null 
                    and orpt.isDeleted = 0
                inner join wsa_registrations.userRegistration ur 
                    on ur.id = orpt.userRegistrationId and ur.isDeleted = 0 and ur.userId = t.participantId 
                where t.participantId = ? and t.competitionId = ?
                    and t.membershipProductMappingId = ?  and t.divisionId = ? 
                    and r.id = ? and t.paymentOptionRefId = 1 and (t.feeType = 'competition' or t.feeType = 'affiliate')`, 
                [userId, competitionId, membershipMappingId, divisionId, registrationId])

            return result;
        } catch (error) {
            throw error;
        }
    }

    public getSingleGameRedeemObj(requestBody, userId, compId, orgId){
        try {
            let redeem = new SingleGameRedeem();
            redeem.id = 0;
            redeem.competitionId = compId;
            redeem.organisationId = orgId;
            redeem.userId = requestBody.userId;
            redeem.membershipProductMappingId = requestBody.membershipProductMappingId;
            redeem.divisionId = requestBody.divisionId;
            redeem.redeemedMatchCount = requestBody.gamesToRedeem;
            redeem.registrationId = requestBody.registrationId;
            redeem.createdBy = userId;

            return redeem;
        } catch (error) {
            
        }
    }
}