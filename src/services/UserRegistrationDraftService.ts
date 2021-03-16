import { Service } from "typedi";
import BaseService from "./BaseService";
import { UserRegistrationDraft } from "../models/registrations/UserRegistrationDraft";

@Service()
export default class UserRegistrationDraftService extends BaseService<UserRegistrationDraft> {

    modelName(): string {
        return UserRegistrationDraft.name;
    }

    public async deleteUserRegistationDraft(registrationId: number, userId: number): Promise<any> {
        return await this.entityManager.query(`UPDATE userRegistrationDraft SET isDeleted = 1, updatedBy = ?, updatedOn = ? WHERE registrationId = ? and isDeleted = 0`, [userId, new Date(), registrationId]);
    }

    public async getParticipantData(participantId: string): Promise<UserRegistrationDraft> {
        try {
            let query = await this.entityManager.createQueryBuilder(UserRegistrationDraft, 'urd')
                        .where(`urd.userRegUniqueKey = :participantId and isDeleted = 0`, {participantId: participantId})
                        .getOne();
              return query;
        } catch (error) {
            throw error;
        }
    }

    public async findByUniqueKey(userRegUniqueKey: string): Promise<UserRegistrationDraft> {
        try {
          let query = await this.entityManager.createQueryBuilder(UserRegistrationDraft, 'urd')
            .where('urd.userRegUniqueKey = :userRegUniqueKey  and urd.isDeleted = 0',
              { userRegUniqueKey: userRegUniqueKey })
            .getOne()
          return query;
        }
        catch (error) {
          throw error;
        }
      }

  public async findByRegistrationId(registrationId: number): Promise<UserRegistrationDraft[]>{
    try{
          let query = await this.entityManager.createQueryBuilder(UserRegistrationDraft, 'urd')
                      .where('urd.registrationId = :registrationId  and urd.isDeleted = 0',{ registrationId: registrationId })
                      .getMany();

    return query;
    }
    catch(error){
      throw error;
    }
  }

  public async findByteamMemberRegId(teamMemberRegId: string): Promise<UserRegistrationDraft[]>{
    try{
          let query = await this.entityManager.createQueryBuilder(UserRegistrationDraft, 'urd')
                      .where('urd.teamMemberRegId = :teamMemberRegId  and urd.isDeleted = 0',{ teamMemberRegId: teamMemberRegId })
                      .getMany();

    return query;
    }
    catch(error){
      throw error;
    }
  }


  public async deleteUserRegDraft(userId,parentId){
    try{
            await this.entityManager.query(
              `update  wsa_registrations.userRegistrationDraft urd 
              set urd.isDeleted = 1, updatedBy = ?, updatedOn = ?
              where urd.parentId = ?`,[userId, new Date(), parentId]);

             await this.entityManager.query(
              `update  wsa_registrations.orgRegistrationParticipantDraft  orpd
               set isDeleted = 1, updatedBy = ?, updatedOn = ?
               where orpd.parentId = ?`,[userId, new Date(), parentId]);

    }
    catch(error){
      throw error;
    }
  }
  
    public async findByTeamMemberRegId(teamMemberRegId: string):Promise<UserRegistrationDraft[]>{
      try{
        let query = await this.entityManager.createQueryBuilder(UserRegistrationDraft, 'urd')
        .where('urd.teamMemberRegId = :teamMemberRegId  and urd.isDeleted = 0',{ teamMemberRegId: teamMemberRegId })
        .getMany();
        return query
      }
      catch(error){
        throw error;
      }
    }

    public async deleteUserRegDraftByTeamMemRegId(userId, teamMemberRegId){
      try{
        await this.entityManager.query(
          `update  wsa_registrations.userRegistrationDraft urd 
          inner join wsa_registrations.orgRegistrationParticipantDraft orpd
              on urd.id = orpd.userRegistrationId and orpd.isDeleted = 0
          set urd.isDeleted = 1, orpd.updatedBy = ?, orpd.updatedOn = ?,
              orpd.isDeleted = 1, orpd.updatedBy = ?, orpd.updatedOn = ?
          where urd.teamMemberRegId = ?`,[userId, new Date(), userId, new Date(), teamMemberRegId]);

        }
        catch(error){
          throw error;
        }
    }

}