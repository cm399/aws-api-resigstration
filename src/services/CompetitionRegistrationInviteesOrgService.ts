import { Service } from "typedi";
import BaseService from "./BaseService";
import { CompetitionRegistrationInviteesOrg } from '../models/registrations/CompetitionRegistrationInviteesOrg';

@Service()
export default class CompetitionRegistrationInviteesOrgService extends BaseService<CompetitionRegistrationInviteesOrg> {

    modelName(): string {
        return CompetitionRegistrationInviteesOrg.name;
    }

    public async findByRegInviteesId(competitionRegistrationInviteesId: number): Promise<CompetitionRegistrationInviteesOrg[]> {
        try{
            let query = await this.entityManager.createQueryBuilder(CompetitionRegistrationInviteesOrg, 'crio')
            query.where('crio.competitionRegistrationInviteesId= :competitionRegistrationInviteesId and crio.isDeleted = 0', {competitionRegistrationInviteesId: competitionRegistrationInviteesId})
            return (query.getMany());
        }catch(error){
            throw error;
        }
    }
}