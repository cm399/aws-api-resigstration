import { Service } from "typedi";
import BaseService from "./BaseService";
import { MembershipFeeCap } from "../models/registrations/MembershipFeeCap";

@Service()
export default class MembershipFeeCapService extends BaseService<MembershipFeeCap> {

    modelName(): string {
        return MembershipFeeCap.name;
    }

    public async getMembershipFeeCapData(membershipCapId: number): Promise<MembershipFeeCap[]> {
        try {
            let query = await this.entityManager.createQueryBuilder(MembershipFeeCap,'mfc')
                        .where('mfc.membershipCapId = :membershipCapId and mfc.isDeleted = 0',{membershipCapId : membershipCapId})
                        .getMany();

            return query;
        }
        catch(err) {
            throw err;
        }
    }

    public async membershipFeeCapDelete(membershipCapId: number, updatedBy : number): Promise<MembershipFeeCap[]> {
        try {
            let query = await this.entityManager.query(`update membershipFeeCap mfc
                                    set mfc.isDeleted = 1, mfc.updatedBy =  ?, mfc.updatedOn = ?
                                    where mfc.membershipCapId = ? and mfc.isDeleted = 0`
                                    ,[updatedBy,new Date(),membershipCapId]);

            return query;
        }
        catch(err) {
            throw err;
        }
    }
}
