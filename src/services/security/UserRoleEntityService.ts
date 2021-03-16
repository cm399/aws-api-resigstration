import { Service } from "typedi";
import { UserRoleEntity } from "../../models/security/UserRoleEntity";
import BaseService from "../BaseService";

@Service()
export default class UserRoleEntityService extends BaseService<UserRoleEntity> {

    modelName(): string {
        return UserRoleEntity.name;
    }

    public async findByUser(userId: number): Promise<UserRoleEntity[]> {
        return this.entityManager.createQueryBuilder(UserRoleEntity, 'ure')
            .leftJoinAndSelect('ure.role', 'r')
            .leftJoinAndSelect('ure.entityType', 'et')
            .andWhere('ure.userId = :userId', {userId})
            .getMany();
    }

    public async findExisting(userId: number, entityId: number, entityTypeId: number, roleId: number): Promise<UserRoleEntity>{
        try{
            let query = await this.entityManager.createQueryBuilder(UserRoleEntity, 'ure')
            .where('ure.userId = :userId and ure.entityId = :entityId and ure.entityTypeId= :entityTypeId and ure.roleId = :roleId and ure.isDeleted = 0',
            {userId: userId, entityId: entityId, entityTypeId: entityTypeId, roleId: roleId})
            .getOne()
            return query;
        }catch(error){
            throw error;
        }
    }
    public async findUserRegistrationParticipants(organisationId: number, orgRegistrationId: number){
        try{
            let result = await this.entityManager.query("call wsa_registrations.usp_user_registration_invite_mail(?,?)",
            [organisationId, orgRegistrationId]);
            return result[0] ;
        }catch(error){
            throw error;
        }
    }

    public async findByEntityId(entityId: number): Promise<UserRoleEntity[]> {
        return this.entityManager.createQueryBuilder(UserRoleEntity, 'ure')
            .leftJoinAndSelect('ure.user', 'u')
            .leftJoinAndSelect('ure.entityType', 'et')
            .andWhere('ure.entityId = :entityId and ure.isDeleted = 0 and u.isDeleted = 0 and et.isDeleted = 0', {entityId})
            .getMany();
    }

  
}

