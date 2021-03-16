import { Service } from "typedi";
import { Approval } from "../models/registrations/Approval";
import BaseService from "./BaseService";

@Service()
export default class ApprovalService extends BaseService<Approval> {
    modelName(): string {
        return Approval.name;
    }

    public async getApprovalData(deRegistrationId: number) :Promise<any>{
        try{
            let result = await this.entityManager.query(`select ap.* from wsa_registrations.approval ap 
            inner join wsa_registrations.approvalRefund ar 
                    on ar.approvalId = ap.id and ar.isDeleted = 0 where ap.deRegisterId = ?
                    and ap.isDeleted = 0`, [deRegistrationId]);
            return result;
        }
        catch(error){
            throw error;
        }
    }
}