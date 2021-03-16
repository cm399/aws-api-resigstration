import { Service } from "typedi";
import BaseService from "./BaseService";
import { MembershipCapProduct } from "../models/registrations/MembershipCapProduct";

@Service()
export default class MembershipCapProductService extends BaseService<MembershipCapProduct> {

    modelName(): string {
        return MembershipCapProduct.name;
    }

    public async getMembershipCapProductData(membershipCapId: number): Promise<MembershipCapProduct[]> {
        try {
            let query = await this.entityManager.createQueryBuilder(MembershipCapProduct,'mcp')
                    .where('mcp.membershipCapId = :membershipCapId and mcp.isDeleted = 0',{membershipCapId:membershipCapId})
                    .getMany();

            return query;
        }
        catch(err) {
            throw err;
        }
    }

    public async membershipCapProductDelete(membershipCapId: number, updatedBy : number): Promise<MembershipCapProduct[]> {
        try {
            let query = await this.entityManager.query(`update membershipCapProduct mcp
                set mcp.isDeleted = 1, mcp.updatedBy =  ?, mcp.updatedOn = ?
                where mcp.membershipCapId = ? and mcp.isDeleted = 0`
                ,[updatedBy,new Date(),membershipCapId]);

            return query;
        }
        catch(err) {
            throw err;
        }
    }

}
