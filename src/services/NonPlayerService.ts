import { Service } from "typedi";
import BaseService from "./BaseService";
import { NonPlayer } from "../models/registrations/NonPlayer";
import { isArrayPopulated } from "../utils/Utils";

@Service()
export default class NonPlayerService extends BaseService<NonPlayer> {

    modelName(): string {
        return NonPlayer.name;
    }

    public async findExistingNonPlayer(userId: number, competitionId: number, organisationId: number, competitionMembershipProductTypeId: number ): Promise<NonPlayer>{
        try{
            let query = await this.entityManager.createQueryBuilder(NonPlayer , 'np')
                        .where('np.userId = :userId and np.competitionId = :competitionId and np.organisationId = :organisationId and competitionMembershipProductTypeId = :competitionMembershipProductTypeId',
                                {userId: userId, competitionId: competitionId, organisationId: organisationId, competitionMembershipProductTypeId: competitionMembershipProductTypeId})
                        .getOne();

            return query;
        }
        catch(error){
            throw error;
        }

    }

    public async updateStatusByRegistrationId(registrationId: number, statusRefId: number){
        try{
            let result = await this.entityManager.query(
                ` update wsa_competitions.nonPlayer np 
                inner join wsa_registrations.userRegistration ur 
                    on ur.id = np.userRegistrationId and ur.isDeleted = 0
                inner join wsa_registrations.orgRegistrationParticipant org 
                    on org.userRegistrationId = ur.id and org.isDeleted = 0 
                set np.statusRefId = ?
                where org.registrationId = ? and np.isDeleted = 0 `,[statusRefId, registrationId]);

            return result;
        }
        catch(error){
            throw error;
        }
    }

    public async findByUserRegistrationIdAndStatus(userRegistrationId:number): Promise<Boolean>{
        try{
            let query = await this.entityManager.query(` SELECT * FROM wsa_competitions.nonPlayer np where np.userRegistrationId = ? and np.statusRefId = 3 and np.isDeleted = 0;`,[userRegistrationId]);
            return  isArrayPopulated(query);
        }
        catch(error){
            throw error;
        }

    }
}