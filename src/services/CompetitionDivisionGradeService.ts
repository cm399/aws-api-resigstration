import { Service } from "typedi";
import BaseService from "./BaseService";
import { CompetitionDivisionGrade } from "../models/registrations/CompetitionDivisionGrade";

@Service()
export default class CompetitionDivisionGradeService extends BaseService<CompetitionDivisionGrade> {

    modelName(): string {
        return CompetitionDivisionGrade.name;
    }

    public async createDivisionGrade(competitionDivisionId: any, gradeId: any, userId: any, gradeName: any) {
        try {
            let gradeRefId = gradeId == null ? 0 : gradeId;
            let query = null;
            if(competitionDivisionId == null){
                query = this.entityManager.createQueryBuilder(CompetitionDivisionGrade, 'competitionDivisionGrade')
                query.where('competitionDivisionGrade.competitionDivisionId is null and IFNULL(competitionDivisionGrade.gradeRefId,0) = :gradeRefId and isDeleted = 0', {gradeRefId: gradeRefId });
     
            }
            else {
                query = this.entityManager.createQueryBuilder(CompetitionDivisionGrade, 'competitionDivisionGrade')
                query.where('competitionDivisionGrade.competitionDivisionId= :competitionDivisionId and IFNULL(competitionDivisionGrade.gradeRefId,0)= :gradeRefId and isDeleted = 0', {competitionDivisionId: competitionDivisionId, gradeRefId: gradeRefId });
 
            }

            let competitionDivisionGrade = (await query.getOne());
            if (competitionDivisionGrade == undefined) {
                let cdg = new CompetitionDivisionGrade();
                cdg.id = 0;
                cdg.competitionDivisionId = competitionDivisionId;
                cdg.gradeRefId = gradeRefId;
                if(gradeName!= null)
                    cdg.name = gradeName;
                    
                cdg.createdBy = userId;
             return  await this.createOrUpdate(cdg);
            }
            else{
                return competitionDivisionGrade;
            }
        }
        catch(error){
           return error;
        }
    }
}