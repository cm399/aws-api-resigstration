import { Service } from "typedi";
import BaseService from "./BaseService";
import { MembershipCap } from "../models/registrations/MembershipCap";

@Service()
export default class MembershipCapService extends BaseService<MembershipCap> {

    modelName(): string {
        return MembershipCap.name;
    }

    public async getMembershipCapData(organisationId: number, yearRefId: number): Promise<MembershipCap[]> {
        try {
            let query = await this.entityManager.createQueryBuilder(MembershipCap, 'mc')
                        .where('mc.organisationId = :organisationId and mc.isDeleted = 0 and yearRefId = :yearRefId',
                        {organisationId:organisationId, yearRefId: yearRefId})
                        .getMany();

            return query;
        }
        catch (e) {
            throw e;
        }
    }

    public async getMembershipCapWithYearRefId(organisationId: number, yearRefId: number): Promise<MembershipCap[]> {
        try {
            let query = await this.entityManager.createQueryBuilder(MembershipCap, 'mc')
                        .where('mc.organisationId = :organisationId and mc.isDeleted = 0 and mc.yearRefId = :yearRefId'
                        ,{organisationId:organisationId, yearRefId:yearRefId})
                        .getMany();

return query;
        }
        catch (e) {
            throw e;
        }
    }

    public async membershipCapDelete(membershipCapId: number, updatedBy : number): Promise<MembershipCap[]> {
        try {
            let query = await this.entityManager.query(`update membershipCap mc
                set mc.isDeleted = 1, mc.updatedBy = ?, mc.updatedOn = ?
                where mc.id = ? and mc.isDeleted = 0`
                ,[updatedBy,new Date(),membershipCapId]);

            return query;
        }
        catch(err) {
            throw err;
        }
    }

}
