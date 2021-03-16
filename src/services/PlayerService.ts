import { Service } from "typedi";
import BaseService from "./BaseService";
import { Player } from "../models/registrations/Player";
import { isArrayPopulated } from "../utils/Utils";
import { AnyAaaaRecord } from "dns";

@Service()
export default class PlayerService extends BaseService<Player> {

    modelName(): string {
        return Player.name;
    }

    
    public async findExistingPlayer(userId: number, competitionId: number, organisationId: number, competitionMembershipProductDivisionId: number ): Promise<Player>{
        try{
            let query = await this.entityManager.createQueryBuilder(Player , 'pl')
                        .where('pl.userId = :userId and pl.competitionId = :competitionId and pl.organisationId = :organisationId and competitionMembershipProductDivisionId = :competitionMembershipProductDivisionId',
                                {userId: userId, competitionId: competitionId, organisationId: organisationId, competitionMembershipProductDivisionId: competitionMembershipProductDivisionId})
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
                ` update wsa_competitions.player p 
                inner join wsa_registrations.userRegistration ur 
                    on ur.id = p.userRegistrationId and ur.isDeleted = 0 
                inner join wsa_registrations.orgRegistrationParticipant org 
                    on org.userRegistrationId = ur.id and org.isDeleted = 0 
                set p.statusRefId = ?
                where org.registrationId = ? and p.isDeleted = 0 `,[statusRefId, registrationId]);

            return result;
        }
        catch(error){
            throw error;
        }
    }

    public async updateLivescorePlayerStatusByRegistrationId(registrationId: number){
        try{
            let result = await this.entityManager.query(
                ` update wsa.player p1
                inner join wsa_competitions.player p 
                    on p.id = p1.sourcePlayerId and p.isDeleted = 0
                inner join wsa_registrations.userRegistration ur 
                    on ur.id = p.userRegistrationId and ur.isDeleted = 0 
                inner join wsa_registrations.orgRegistrationParticipant org 
                    on org.userRegistrationId = ur.id and org.isDeleted = 0 
                set p1.deleted_at = current_timestamp()
                where org.registrationId = ? and p1.deleted_at is null `,[ registrationId]);

            return result;
        }
        catch(error){
            throw error;
        }
    }
    
    public async findByUserRegistrationIdAndStatus(userRegistrationId:number): Promise<Boolean>{
        try{
            let query = await this.entityManager.query(`SELECT * FROM wsa_competitions.player p where p.userRegistrationId = ? and statusRefId = 3 and isDeleted= 0`,[userRegistrationId]);
            return  isArrayPopulated(query);
        }
        catch(error){
            throw error;
        }

    }
}