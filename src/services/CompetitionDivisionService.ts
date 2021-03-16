import { Service } from "typedi";
import BaseService from "./BaseService";
import { CompetitionDivision } from '../models/registrations/CompetitionDivision';

@Service()
export default class CompetitionDivisionService extends BaseService<CompetitionDivision> {

    modelName(): string {
        return CompetitionDivision.name;
    }

    public async checkCompMemProDivisionsPreviousData(competitionMemProductId: number): Promise<any> {
        return await this.entityManager.query(
            `SELECT id FROM wsa_competitions.competitionDivision WHERE isDeleted = 0 and competitionMembershipProductId = ?`, [competitionMemProductId]);
    }

    public async findTeamByDivision(competitionDivisionId :number, userId: number){
        try{
            let query = await this.entityManager.query(
                ` update wsa_competitions.team t 
                    set t.competitionDivisionId = NULL , t.competitionDivisionGradeId = NULL, 
                    t.gradeRefId = (case when t.gradeRefId = 0 then 0 else NULL end),
                    t.isActive = 1,
                    t.updatedBy = ? , t.updatedOn = CURRENT_TIMESTAMP() 
                    where t.competitionDivisionId = ?  and t.isDeleted = 0`,[userId,competitionDivisionId] );
                    return query;
        }
        catch(error){
                throw error;
        }
    }

    public async findPlayerByDivision(competitionDivisionId :number, userId: number){
        try{
            let query = await this.entityManager.query(
                `   update wsa_competitions.player p 
                    set p.competitionDivisionId = NULL, p.updatedBy = ? , p.updatedOn = CURRENT_TIMESTAMP() 
                    where p.competitionDivisionId = ?  and p.isDeleted = 0`,[userId,competitionDivisionId] );
                    return query;
        }
        catch(error){
                throw error;
        }
    }

    public async findBycmpd(competitionMembershipProductDivisionId): Promise<CompetitionDivision>{
        try{
            let query = await this.entityManager.createQueryBuilder(CompetitionDivision, 'cd')
                        .where('cd.competitionMembershipProductDivisionId = :competitionMembershipProductDivisionId and cd.isDeleted = 0',{competitionMembershipProductDivisionId: competitionMembershipProductDivisionId})
                        .getOne();

                return query;
        }
        catch(error){

        }
    }
   
}