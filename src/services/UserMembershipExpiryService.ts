import { Service } from "typedi";
import BaseService from "./BaseService";
import { UserMembershipExpiry } from "../models/registrations/UserMembershipExpiry";

@Service()
export default class UserMembershipExpiryService extends BaseService<UserMembershipExpiry> {

    modelName(): string {
        return UserMembershipExpiry.name;
    }

    public async getExistingMembership(userId: number, membershipMappingId: number) : Promise<any>{
        try {
            let query = await this.entityManager.query(`select * from wsa_registrations.userMembershipExpiry where 
                    userId = ? and membershipProductMappingId = ? and isActive = 1 and isDeleted = 0`,
                    [userId, membershipMappingId]);
            return query;
        } catch (error) {
            throw error;
        }
    }

    public async updateExistingMembership(registrationId: number) : Promise<any>{
        try {
            let query = await this.entityManager.query(`update wsa_registrations.userMembershipExpiry set isActive = 0 where registrationId = ?
            and  isDeleted = 0`, [registrationId]);
            return query;
        } catch (error) {
            throw error;
        }
    }
}