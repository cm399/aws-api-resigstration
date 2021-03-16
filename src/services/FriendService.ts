import { Service } from "typedi";
import BaseService from "./BaseService";
import { Friend } from "../models/registrations/Friend";

@Service()
export default class FriendService extends BaseService<Friend> {

    modelName(): string {
        return Friend.name;
    }

    public async findByRegistrationId(registrationId: number){
        try{
            let result = await this.entityManager.query(
                `	select DISTINCT CONCAT(f.firstName , ' ', f.lastName ) as name, f.email,f.id as friendId,
                CONCAT(u.firstName , ' ', u.lastName ) as refererName, u.id as userId,
                c.name as competitionName,c.competitionUniqueKey , 
                cmpd.divisionName ,
                DATE_FORMAT(c.startDate, '%d/%m/%Y') as startDate ,DATE_FORMAT(c.endDate, '%d/%m/%Y') as endDate ,
                JSON_ARRAYAGG(v.name ) as venue,
                o.name as organisationName, o.organisationUniqueKey 
            from wsa_registrations.friend f 
            inner join wsa_competitions.player p 
                on p.id = f.playerId and p.isDeleted = 0
            inner join wsa_registrations.competitionMembershipProductDivision cmpd 
                on cmpd.id = p.competitionMembershipProductDivisionId and cmpd.isDeleted = 0
            inner join wsa_registrations.userRegistration ur 
                on ur.id = p.userRegistrationId and ur.isDeleted = 0
            inner join wsa_registrations.orgRegistrationParticipant orpt 
                on orpt.userRegistrationId = ur.id and ur.isDeleted = 0
            inner join wsa_registrations.orgRegistration org 
                 on org.id = orpt.orgRegistrationId and org.isDeleted = 0
            inner join wsa_registrations.competition c 
                  on c.id = org.competitionId and c.isDeleted = 0
            inner join wsa_users.organisation o 
                  on o.id = org.organisationId and o.isDeleted = 0  
            inner join wsa_registrations.registration r 
                on r.id = orpt.registrationId and r.isDeleted = 0
            inner join wsa_users.user u 
                on u.id = p.userId and u.isDeleted = 0
            inner join wsa_registrations.competitionVenue cv 
                on cv.competitionId = c.id and cv.isDeleted = 0
            inner join wsa_common.venue v 
                on v.id = cv.venueId and v.isDeleted = 0
            where r.id = ? and f.isDeleted = 0 and f.friendRelationshipTypeRefId = 2 group by f.id`,[registrationId]);

            return result;
        }
        catch(error){
            throw error;
        }
    }

    public async deleteByRegistrationId(registrationId: number){
        try{
            let result = await this.entityManager.query(
                ` Update  wsa_registrations.friend f 
                inner join wsa_competitions.player p 
                    on p.id = f.playerId and p.isDeleted = 0
                inner join wsa_registrations.userRegistration ur 
                    on ur.id = p.userRegistrationId and ur.isDeleted 
                inner join wsa_registrations.orgRegistrationParticipant org 
                    on org.userRegistrationId = ur.id and org.isDeleted = 0 
                set f.isDeleted = 0
                where org.registrationId = ? and p.isDeleted = 0 `,[registrationId]);

            return result;
        }
        catch(error){
            throw error;
        }
    }
}