import { Service } from "typedi";
import BaseService from "./BaseService";
import { CompetitionVenue } from '../models/registrations/CompetitionVenue';

@Service()
export default class CompetitionVenueService extends BaseService<CompetitionVenue> {

    modelName(): string {
        return CompetitionVenue.name;
    }

    public async checkCompVenuesPreviousData(competitionId: number) {
        return await this.entityManager.query(`select id FROM competitionVenue WHERE competitionId = ? and isDeleted = 0 and isFinal = 0`, [competitionId]);
    }

    // public async deleteVenuesPreviousData(venueId: number, competitionId: number, userId: number) {
    //     return await this.entityManager.query(`delete FROM competitionVenue WHERE competitionId = ? and createdBy = ? and id = ?`, [competitionId, userId, venueId]);
    // }

    public async getIDForDeleteCompVenuesByCompId(competitionId: number): Promise<any> {
        return await this.entityManager.query(`select id from competitionVenue where competitionId = ? and isDeleted = 0 and isFinal = 0`, [competitionId]);
    }

    
    public async getVenuesByCompetitionId(competitionId: number): Promise<any> {
        return await this.entityManager.query(`select distinct v.* from competitionVenue as cv 
        join wsa_common.venue as v on v.id = cv.venueId 
        where cv.isDeleted = 0 and v.isDeleted = 0 and cv.competitionId = ?`, [competitionId]);
    }
    
public async getVenuesByCompetition(competitionId: number, organisationId: number, roundStart: any, roundFinish: any): Promise<any> {
    let query = null;
    if(competitionId == -1){
        query = await this.entityManager.query(
            `select distinct v.* from competitionVenue as cv 
                join wsa_common.venue as v on v.id = cv.venueId 
                inner join wsa_registrations.competition c on c.id = cv.competitionId and c.isdeleted = 0
                inner join wsa_competitions.round r on r.competitionId = c.id and r.isDeleted = 0
                where cv.isDeleted = 0 and v.isDeleted = 0 and c.organisationId = ?
                and (DATE_FORMAT(r.roundStart,'%Y-%m-%d') >= ? and   DATE_FORMAT(r.roundFinish,'%Y-%m-%d') <= ?)`, [organisationId, roundStart, roundFinish]);

        // query = await this.entityManager.query(
        //     `select distinct v.* from competitionVenue as cv 
        //         join wsa_common.venue as v on v.id = cv.venueId 
        //         inner join wsa_registrations.competition c on c.id = cv.competitionId and c.isdeleted = 0
        //         where cv.isDeleted = 0 and v.isDeleted = 0 and c.organisationId = ? `, [organisationId]);
    }
    else{
        query = await this.entityManager.query(
            `select distinct v.* from competitionVenue as cv 
        join wsa_common.venue as v on v.id = cv.venueId 
        where cv.isDeleted = 0 and v.isDeleted = 0 
         and cv.competitionId = ?`, [competitionId]);

        //  query = await this.entityManager.query(
        //     `select distinct v.* from competitionVenue as cv 
        // join wsa_common.venue as v on v.id = cv.venueId 
        // inner join wsa_registrations.competition c on c.id = cv.competitionId and c.isdeleted = 0
        // where cv.isDeleted = 0 and v.isDeleted = 0 
        //  and c.organisationId = ?`, [organisationId]);
    }
      return query;
    }
}