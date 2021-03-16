import { Service } from "typedi";
import BaseService from "./BaseService";
import { isArrayPopulated } from "../utils/Utils";
import { CompetitionMembershipProduct } from "../models/registrations/CompetitionMembershipProduct";
import { CompetitionMembershipProductDivision } from '../models/registrations/CompetitionMembershipProductDivision';

@Service()
export default class CompetitionMembershipProductDivisionService extends BaseService<CompetitionMembershipProductDivision> {

    modelName(): string {
        return CompetitionMembershipProductDivision.name;
    }

    public async getCompetitionFeeDivision(competitionUniqueKey: string, organisationId: number): Promise<any> {
     //   await this.entityManager.query(`SET SESSION group_concat_max_len = 819200`);
        const query = await this.entityManager.query(
            `SELECT DISTINCT CONCAT('[', (SELECT DISTINCT CAST(GROUP_CONCAT(JSON_OBJECT('membershipProductName', mp1.productName, 
            'membershipProductUniqueKey', mp1.membershipProductUniqueKey, 'competitionMembershipProductId', cmp1.id, 'divisions', 
            (CONCAT('[', (SELECT DISTINCT CAST(GROUP_CONCAT(JSON_OBJECT('competitionMembershipProductDivisionId', cmpd.id, 
            'competitionMembershipProductId', cmpd.competitionMembershipProductId, 'divisionName', cmpd.divisionName, 'genderRefId', cmpd.genderRefId,
            'membershipProductUniqueKey', mp.membershipProductUniqueKey, 'fromDate', cmpd.fromDate, 'toDate', cmpd.toDate)) 
            AS CHAR (819200)) FROM competitionMembershipProductDivision AS cmpd JOIN competitionMembershipProduct AS cmp ON 
            cmp.id = cmpd.competitionMembershipProductId JOIN competition AS c ON c.id = cmp.competitionId JOIN membershipProduct 
            AS mp ON mp.id = cmp.membershipProductId WHERE cmpd.isDeleted = 0 and cmp.isDeleted = 0 
            and c.isDeleted = 0 and mp.isDeleted = 0 AND mp.id = mp1.id AND c.competitionUniqueKey = ? ), 
            ']')))) AS CHAR (819200)) FROM membershipProduct AS mp1 JOIN competitionMembershipProduct AS cmp1 ON 
            cmp1.membershipProductId = mp1.id JOIN competition AS c ON c.id = cmp1.competitionId WHERE c.competitionUniqueKey = ? 
             and c.isDeleted = 0 and mp1.isDeleted = 0 and cmp1.isDeleted = 0 ), ']') 
            AS competitionFeeDivision FROM competition AS c WHERE c.competitionUniqueKey = ? 
            and c.isDeleted = 0`, [ competitionUniqueKey, competitionUniqueKey, competitionUniqueKey]);

        if (isArrayPopulated(query)) {
            for (let r of query) {
                if (r['competitionFeeDivision']) {
                    r['competitionFeeDivision'] = JSON.parse(r['competitionFeeDivision']);
                    if (isArrayPopulated(r['competitionFeeDivision'])) {
                        for (let s of r['competitionFeeDivision']) {
                            if (s['divisions']) s['divisions'] = JSON.parse(s['divisions']);
                        }
                    }
                }
            }
        }

        if (isArrayPopulated(query) && isArrayPopulated(query[0].competitionFeeDivision)) {
            const filterArray = query[0].competitionFeeDivision.filter((thing, index) =>
                index === query[0].competitionFeeDivision.findIndex(obj => JSON.stringify(obj) === JSON.stringify(thing)))
            query.map(s => s.competitionFeeDivision = filterArray)
            return query
        } else return query;

    }


    public async getCompetitionFeeDivisionForComp(competitionUniqueKey: string, organisationId: number): Promise<any> {
        try{
            const query = await this.entityManager.query(
                ` SELECT DISTINCT CONCAT('[', (SELECT DISTINCT CAST(GROUP_CONCAT(JSON_OBJECT('membershipProductName', mp1.productName, 
                'membershipProductUniqueKey', mp1.membershipProductUniqueKey, 'competitionMembershipProductId', cmp1.id, 'divisions', 
                (CONCAT('[', (SELECT DISTINCT CAST(GROUP_CONCAT(JSON_OBJECT('competitionDivisionId', cd.id, 'competitionMembershipProductDivisionId', cd.competitionMembershipProductDivisionId,
                'competitionMembershipProductId', cd.competitionMembershipProductId, 'divisionName', cd.divisionName, 'genderRefId', cd.genderRefId,
                'membershipProductUniqueKey', mp.membershipProductUniqueKey, 'fromDate', cd.fromDate, 'toDate', cd.toDate)) 
                AS CHAR (819200))FROM wsa_competitions.competitionDivision AS cd JOIN competitionMembershipProduct AS cmp ON 
                cmp.id = cd.competitionMembershipProductId JOIN competition AS c ON c.id = cmp.competitionId JOIN membershipProduct 
                AS mp ON mp.id = cmp.membershipProductId WHERE cd.isDeleted = 0 and cmp.isDeleted = 0 
                and c.isDeleted = 0 and mp.isDeleted = 0 AND mp.id = mp1.id AND c.competitionUniqueKey = ? ), 
                ']')))) AS CHAR (819200)) FROM membershipProduct AS mp1 JOIN competitionMembershipProduct AS cmp1 ON 
                cmp1.membershipProductId = mp1.id JOIN competition AS c ON c.id = cmp1.competitionId WHERE c.competitionUniqueKey = ? 
                 and c.isDeleted = 0 and mp1.isDeleted = 0 and cmp1.isDeleted = 0 ), ']') 
                AS competitionFeeDivision FROM competition AS c WHERE c.competitionUniqueKey = ?
                and c.isDeleted = 0`, [ competitionUniqueKey, competitionUniqueKey, competitionUniqueKey]);
            
                if (isArrayPopulated(query)) {
                    for (let r of query) {
                        if (r['competitionFeeDivision']) {
                            r['competitionFeeDivision'] = JSON.parse(r['competitionFeeDivision']);
                            if (isArrayPopulated(r['competitionFeeDivision'])) {
                                for (let s of r['competitionFeeDivision']) {
                                    if (s['divisions']) s['divisions'] = JSON.parse(s['divisions']);
                                }
                            }
                        }
                    }
                }
        
                if (isArrayPopulated(query) && isArrayPopulated(query[0].competitionFeeDivision)) {
                    const filterArray = query[0].competitionFeeDivision.filter((thing, index) =>
                        index === query[0].competitionFeeDivision.findIndex(obj => JSON.stringify(obj) === JSON.stringify(thing)))
                    query.map(s => s.competitionFeeDivision = filterArray)
                    return query
                } else return query;
        

        }
        catch(error){
            throw error;
        }
    }


    public async findByCompetition(competitionId: number): Promise<CompetitionMembershipProductDivision[]>{
        try{
            let query = await this.entityManager.createQueryBuilder(CompetitionMembershipProductDivision, 'cmpd')
                        .innerJoin(CompetitionMembershipProduct, 'cmp', 'cmp.id = cmpd.competitionMembershipProductId and cmp.isDeleted = 0')
                        .where('cmp.competitionId = :competitionId and cmpd.isDeleted = 0',{competitionId: competitionId})
                        .getMany()
                        
                return query;
        }
        catch(error){
            throw error;
        }
    }
    public async checkCompMemProDivisionsPreviousData(competitionMemProductId: number): Promise<any> {
        return await this.entityManager.query(
            `SELECT id FROM competitionMembershipProductDivision WHERE isDeleted = 0 and competitionMembershipProductId = ?`, [competitionMemProductId]);
    }

    public async getIDForDeleteCompDivisionbyCompetitionId(competitionId: number): Promise<any> {
        return await this.entityManager.query(
            `select id from competitionMembershipProductDivision where isDeleted = 0 and competitionMembershipProductId 
            in (select id from competitionMembershipProduct where isDeleted = 0 and competitionId = ? )`, [competitionId]);
    }

    public async getIDForDeleteCompDivisionbyCompMemProId(compMemProId: number): Promise<any> {
        return await this.entityManager.query(`select id FROM competitionMembershipProductDivision WHERE isDeleted = 0 and competitionMembershipProductId in (?)`, [compMemProId]);
    }
}