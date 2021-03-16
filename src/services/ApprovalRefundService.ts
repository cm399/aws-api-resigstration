import { Service } from "typedi";
import BaseService from "./BaseService";
import { ApprovalRefund } from "../models/registrations/ApprovalRefund";

@Service()
export default class ApprovalRefundService extends BaseService<ApprovalRefund> {
    modelName(): string {
        return ApprovalRefund.name;
    }

    public async getApprovalRefunds(deRegisterId: number): Promise<any> {
        try {
            let result = await this.entityManager.query(`
            select ar.*,a.declineReasonRefId, a.payingOrgId, a.receivingOrgId, ar.transactionId, dr.organisationId, dr.userId
            from wsa_registrations.approvalRefund ar 
            inner join wsa_registrations.approval a 
                on a.id = ar.approvalId and a.isDeleted = 0
            inner join wsa_registrations.deRegister dr 
                on dr.id = a.deRegisterId and dr.isDeleted = 0
            where dr.id = ? and dr.isDeleted = 0 and (a.declineReasonRefId is null or a.declineReasonRefId = 0)`, 
            [deRegisterId]);

            return result;
        } catch (error) {
            throw error;
        }
    }

    public async getApprovalRefundsByTransactionId(transactionId: number): Promise<any> {
        try {
            let result = await this.entityManager.query(`
                SELECT * from wsa_registrations.approvalRefund ar 
                where ar.transactionId = ? and ar.isDeleted = 0`
                ,[transactionId]);

            return result ? result.find(x => x) : {} ;
        } catch (error) {
            throw error;
        }
    }

    public async getDataForEmail(deRegisterId: number): Promise<any>{
        try{
            let result = await this.entityManager.query(`
            select ar.*,a.declineReasonRefId, a.payingOrgId, o.name as organisationName,a.receivingOrgId ,
            case when a.declineReasonRefId = 3 then a.otherInfo else 
            (select rs.description from wsa_common.reference rs 
                where rs.referenceGroupId = 77 and rs.isDeleted = 0 and rs.id = a.declineReasonRefId ) end as reason
            from wsa_registrations.approvalRefund ar 
            inner join wsa_registrations.approval a 
                on a.id = ar.approvalId and a.isDeleted = 0
            inner join wsa_registrations.deRegister dr 
                on dr.id = a.deRegisterId and dr.isDeleted = 0
            inner join wsa_users.organisation o 
                on o.id = payingOrgId and o.isDeleted = 0
            where dr.id = ? and dr.isDeleted = 0 `, 
            [deRegisterId]);

            return result;
        }
        catch(error){
            throw error;
        }
    }
    
}