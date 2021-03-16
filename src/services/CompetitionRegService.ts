import { Service } from "typedi";
import { logger } from "../logger";
import BaseService from "./BaseService";
import { isArrayPopulated } from "../utils/Utils";
import { CompetitionReg } from "../models/registrations/Competition";

@Service()
export default class CompetitionRegService extends BaseService<CompetitionReg> {

    modelName(): string {
        return CompetitionReg.name;
    }

    public async getCompetitionFeeListing(OFFSET: number, LIMIT: number, yearID: number, orgTypeId: number, ORG__ID: number, search: string, sortBy:string=undefined, sortOrder:'ASC'|'DESC'=undefined): Promise<any> {
        try {
            let invRefId = 1;
            if (orgTypeId === 3) invRefId = 2;
            else if (orgTypeId === 4) invRefId = 3;
            console.log("######"+yearID+","+ ORG__ID +","+orgTypeId+ ","+ invRefId + ","+ search+ ","+ LIMIT+ "," + OFFSET)
            let result = await this.entityManager.query("CALL wsa_registrations.usp_competitionfee_listing(?, ?, ?, ?, ?, ?, ?,?,?)", [yearID, ORG__ID, orgTypeId, invRefId, search, LIMIT, OFFSET,sortBy, sortOrder]);

            if (isArrayPopulated(result[0])) {
                result[0].map(e => {
                    e.isUsed === 1 ? e.isUsed = true : e.isUsed = false
                    e.parentCreator === 1 ? e.parentCreator = true : e.parentCreator = false
                    return e;
                });
            }

            return { count: result[1][0].totalCount, data: result[0] };
        } catch (error) {
            throw error;
        }
    }

    public async findCompetitionFeeDetailsByUniqueKey(competitionUniqueKey: string): Promise<CompetitionReg> {
        return await this.entityManager.createQueryBuilder().select().from(CompetitionReg, 'c')
            .andWhere("c.competitionUniqueKey = :competitionUniqueKey", { competitionUniqueKey })
            .andWhere("c.isDeleted = 0")
            .execute();
    }

    public async getCompetitionFeeDetails(competitionUniqueKey: string, organisationId: number, competitionCreatorOrgUniqueKey: string): Promise<any> {
      //  await this.entityManager.query(`SET SESSION group_concat_max_len = 819200;`)
        const query = await this.entityManager.query(
            `SELECT DISTINCT c.statusRefId as statusRefId, c.createdBy as competitionCreator, c.competitionUniqueKey AS competitionUniqueKey, c.registrationRestrictionTypeRefId,
            c.name AS competitionName, c.description AS description, c.competitionTypeRefId AS competitionTypeRefId, c.yearRefId as yearRefId, 
            c.competitionFormatRefId AS competitionFormatRefId, c.hasRegistration , c.startDate AS startDate, c.endDate as endDate, c.isSeasonalUponReg, c.finalTypeRefId,
            c.isTeamSeasonalUponReg, c.seasonalSchoolRegCode, c.teamSeasonalSchoolRegCode, clogo.id as competitionLogoId, clogo.logoUrl as 
            competitionLogoUrl, clogo.isDefault as logoIsDefault, c.noOfRounds AS noOfRounds, (case when ( select count(*) from competitionLogo 
            where isDeleted = 0 and logoUrl is not null)<> 0 then true else false end) as isLogoUsed, (case when ( select 
            count(*) from orgRegistration as org join competition as c on c.id = org.competitionId where c.isDeleted = 0 and org.isDeleted = 0 and 
            c.competitionUniqueKey = ? )<> 0 then true else false end) as isUsed, c.roundInDays AS roundInDays, c.heroImageUrl as heroImageUrl,
            c.roundInHours AS roundInHours, c.roundInMins AS roundInMins, c.registrationCloseDate AS registrationCloseDate, c.minimumPlayers 
            AS minimunPlayers, c.maximumPlayers AS maximumPlayers, (CONCAT('[', (SELECT DISTINCT cast(GROUP_CONCAT(JSON_OBJECT('competitionVenueId', 
            cv.id, 'venueId', v.id)) as char(819200)) FROM competitionVenue as cv join wsa_common.venue as v on v.id = cv.venueId WHERE 
            cv.isDeleted = 0 and cv.isFinal = 0 and cv.competitionId = c.id and c.competitionUniqueKey = ?), ']')) AS venues, 
            (CONCAT('[', (SELECT DISTINCT cast(GROUP_CONCAT(JSON_OBJECT('competitionNonPlayingDatesId', cnpd.id, 'name', cnpd.name, 
            'nonPlayingDate', cnpd.nonPlayingDate)) as char(819200)) FROM competitionNonPlayingDates as cnpd WHERE  
            cnpd.isDeleted = 0 and c.isDeleted = 0 and cnpd.competitionId = c.id), ']')) AS nonPlayingDates, (CONCAT( '[' , (SELECT DISTINCT 
            cast(GROUP_CONCAT(JSON_OBJECT( 'id', ol.id,'organisationId', ol.organisationId , 'logoUrl', ol.logoUrl )) as char(819200)) FROM 
            wsa_users.organisationLogo as ol WHERE c.organisationId = ol.organisationId and c.isDeleted = 0 and ol.isDeleted = 0) , ']' )) AS 
            organisationLogo, (CONCAT('[', (SELECT cast(GROUP_CONCAT(JSON_OBJECT( 'inviteesId', cri.id, 'registrationInviteesRefId', 
            cri.registrationInviteesRefId )) as char(819200)) FROM competitionRegistrationInvitees as cri WHERE cri.isDeleted = 0 
            and cri.competitionId = c.id), ']')) AS invitees , (CONCAT('[', (SELECT cast(GROUP_CONCAT(JSON_OBJECT( 'competitionInviteesOrgId',crio.id,
            'organisationId',crio.organisationId,'organisationUniqueKey', o.organisationUniqueKey ,'competitionRegistrationInviteesId',
            crio.competitionRegistrationInviteesId))as char(819200)) 
            from wsa_registrations.competitionRegistrationInviteesOrg crio 
            inner join wsa_registrations.competitionRegistrationInvitees cri2
            on cri2.id = crio.competitionRegistrationInviteesId and cri2.isDeleted = 0
            inner join wsa_registrations.competition c 
            on c.id = cri2.competitionId and c.isDeleted = 0
            inner join wsa_users.organisation o 
            on o.id = crio.organisationId and o.isDeleted = 0
            where c.competitionUniqueKey = ? and crio.isDeleted = 0
            ) , ']')) As inviteesOrg
             FROM competition AS c left join competitionLogo as clogo on clogo.competitionId = c.id 
            and clogo.isDeleted = 0 where c.competitionUniqueKey = ? and c.isDeleted = 0 `
            , [competitionUniqueKey, competitionUniqueKey, competitionUniqueKey, competitionUniqueKey]);

        if (isArrayPopulated(query)) {
            for (let r of query) {
                r['competitionCreatorOrgUniqueKey'] = competitionCreatorOrgUniqueKey;
                if (r['nonPlayingDates']) {
                    r['nonPlayingDates'] = JSON.parse(r['nonPlayingDates']);
                } else {
                    r['nonPlayingDates'] = [];
                }
                if (r.invitees) {
                    r.invitees = JSON.parse(r.invitees);
                    if (isArrayPopulated(r.invitees)) {
                        if(r.inviteesOrg){
                            r.inviteesOrg = JSON.parse(r.inviteesOrg);
                            if(isArrayPopulated(r.inviteesOrg)){
                                r.invitees.map( (d) => d['inviteesOrg'] = r.inviteesOrg.filter(x=> x.competitionRegistrationInviteesId == d.inviteesId) )
                            }
                        }
                        for (let i of r.invitees) {
                            if (i['subInvitees']) i['subInvitees'] = JSON.parse(i['subInvitees'])
                          
                        }
                    }
                } else {
                    r['invitees'] = [];
                }
                if (r.venues) {
                    r['venues'] = JSON.parse(r['venues']);
                } else {
                    r['venues'] = []
                }
                if (r['organisationLogo']) {
                    r['organisationLogo'] = JSON.parse(r['organisationLogo']);
                    if (isArrayPopulated(r['organisationLogo'])) {
                        r['organisationLogo'] = r['organisationLogo'][0];
                    }
                } else {
                    r['organisationLogo'] = { logoUrl: null, id: 0 };
                }
            }

            query.map(e => {
                e.logoIsDefault === 1 ? e.logoIsDefault = true : e.logoIsDefault = false
                e.isLogoUsed === 1 ? e.isLogoUsed = true : e.isLogoUsed = false
                e.isUsed === 1 ? e.isUsed = true : e.isUsed = false
                return e;
            });
        }
        return query;
    }

    public async getCompetitionsFromYear(yearID: number, organisationId: number): Promise<any> {
        return await this.entityManager.query(
            `select distinct * from ( select distinct c.id as id, c.name as competitionName, c.competitionUniqueKey 
            as competitionId from competition as c join competitionRegistrationInvitees cri on cri.competitionId = c.id 
            where c.yearRefId = ? and c.organisationId = ? and c.isDeleted = 0 and cri.registrationInviteesRefId = 5 
            and cri.isDeleted = 0 and c.statusRefId = 2 union all select distinct c.id as id, c.name as competitionName, 
            c.competitionUniqueKey as competitionId from competition as c join competitionRegistrationInvitees cri on 
            cri.competitionId = c.id where c.yearRefId = ? and c.isDeleted = 0 and (cri.registrationInviteesRefId = 2 or 
            cri.registrationInviteesRefId = 3) and cri.isDeleted = 0 and c.statusRefId = 2 and c.organisationId = (select 
            a.affiliatedToOrgId from wsa_users.affiliate as a where a.affiliateOrgId = ?) ) as a ORDER by competitionName 
            asc`, [yearID, organisationId, yearID, organisationId]);
    }

    public async findByUniquekey(competitionUniquekey: string): Promise<number> {
        let query = this.entityManager.createQueryBuilder(CompetitionReg, 'competition')
        query.where('competition.competitionUniqueKey= :competitionUniquekey and isDeleted = 0', { competitionUniquekey })
        return (await query.getOne()).id;
    }

    public async findCompByUniquekey(competitionUniquekey: string): Promise<CompetitionReg> {
        let query = this.entityManager.createQueryBuilder(CompetitionReg, 'competition')
        query.where('competition.competitionUniqueKey= :competitionUniquekey and isDeleted = 0', { competitionUniquekey })
        return await query.getOne();
    }

    public async getMembershipProductByOrganisation(organisationId: number, yearRefId: number) {
        try {
            logger.info("Membership Product ORGANISATION :" + organisationId)
           // await this.entityManager.query(`SET SESSION group_concat_max_len = 819200;`)
            const query = await this.entityManager.query(
                `SELECT CONCAT('[', (SELECT CAST(GROUP_CONCAT(JSON_OBJECT('competitionMembershipProductId', NULL, 'membershipProductUniqueKey', 
                mp1.membershipProductUniqueKey, 'membershipProductName', mp1.productName, 'membershipProductTypes', (CONCAT('[', 
                (SELECT CAST(GROUP_CONCAT(JSON_OBJECT( 'competitionMembershipProductId', NULL, 'competitionMembershipProductTypeId', NULL, 
                'membershipProductTypeMappingId', mpm.id, 'membershipProductTypeName', mpt.name, 'isPlaying', mpt.isPlaying ,'isDefault',mpt.isDefault)) AS CHAR (819200)) FROM membershipProductTypeMapping 
                AS mpm JOIN membershipProductType AS mpt ON mpm.membershipProductTypeId = mpt.id and mpt.isDeleted = 0 JOIN membershipProduct AS mp 
                ON mpm.membershipProductId = mp.id WHERE mpm.isDeleted = 0 and mp.isDeleted = 0 AND mp1.id = mpm.membershipProductId), ']')))) 
                AS CHAR (819200)) FROM membershipProduct AS mp1 WHERE mp1.organisationId = ? and mp1.yearRefId = ? and mp1.isDeleted = 0 and mp1.statusRefId = 2 ), ']') 
                AS membershipProducts ` , [organisationId, yearRefId]);

            if (isArrayPopulated(query)) {
                logger.info("Membership Product" + JSON.stringify(query));
                for (let r of query) {
                    logger.info("Membership Product" +  JSON.stringify(r));
                    if (r['membershipProducts']) {
                        r['membershipProducts'] = JSON.parse(r['membershipProducts']);
                        if (isArrayPopulated(r['membershipProducts'])) {
                            for (let q of r['membershipProducts']) {
                                if (q['membershipProductTypes']) q['membershipProductTypes'] = JSON.parse(q['membershipProductTypes']);
                            }
                        }
                    }
                }
            }
             //console.log("@@@@@@------"+ query + JSON.stringify(query[0]))
            return query;

        } catch (error) {
            throw error
        }
    }

    // public async getMembershipProductDetailsInCompetitionFee(userId: number): Promise<any> {
    //   //  await this.entityManager.query(`SET SESSION group_concat_max_len = 819200`);
    //     const query = await this.entityManager.query(
    //         `SELECT DISTINCT ( SELECT DISTINCT (CONCAT('[', CAST(GROUP_CONCAT(JSON_OBJECT('competitionMembershipProductId', NULL, 'membershipProductUniqueKey', 
    //         mp1.membershipProductUniqueKey, 'membershipProductName', mp1.productName, 'membershipProductTypes', (SELECT DISTINCT (CONCAT('[', CAST(GROUP_CONCAT( 
    //         JSON_OBJECT('competitionMembershipProductId', NULL, 'competitionMembershipProductTypeId', NULL, 'membershipProductTypeMappingId', mpm.id, 
    //         'membershipProductTypeName', mpt.name)) AS CHAR (819200)), ']')) FROM membershipProductTypeMapping AS mpm JOIN membershipProductType AS mpt ON 
    //         mpm.membershipProductTypeId = mpt.id and mpt.isDeleted = 0 JOIN membershipProduct AS mp ON mpm.membershipProductId = mp.id WHERE mpm.createdBy = ? 
    //         and mpm.isDeleted = 0 AND mp.createdBy = ? and mp.isDeleted = 0 AND mp1.id = mpm.membershipProductId))) AS CHAR (819200)), ']')) FROM 
    //         membershipProduct AS mp1 WHERE mp1.createdBy = ? and mp1.isDeleted = 0) AS membershipProducts` , [userId, userId, userId]);

    //     if (isArrayEmpty(query)) {
    //         for (let r of query) {
    //             if (r['membershipProducts']) {
    //                 r['membershipProducts'] = JSON.parse(r['membershipProducts']);
    //                 if (isArrayEmpty(r['membershipProducts'])) {
    //                     for (let q of r['membershipProducts']) {
    //                         if (q['membershipProductTypes']) q['membershipProductTypes'] = JSON.parse(q['membershipProductTypes']);
    //                     }
    //                 }
    //             }
    //         }
    //     }
    //     return query;
    // }

    public async updateStatus(competitionKey: string, statusRefId: number): Promise<any> {
        return await this.entityManager.query(`UPDATE competition SET statusRefId = ? WHERE competitionUniqueKey = ? and isDeleted = 0`, [statusRefId, competitionKey]);
    }

    public async getIDForDeleteCompbyCompId(competitionId: number): Promise<any> {
        return await this.entityManager.query(`select id from competition where id = ? and isDeleted = 0`, [competitionId]);
    }

    public async checkCompetitionUsed(competitionId: number): Promise<any> {
        const query = await this.entityManager.query(
            `select (case when (select id from orgRegistration where competitionId = ? and isDeleted = 0 limit 1) 
            then true else false end) as isUsedOrgRegEntity, (case when (select id from wsa_competitions.venueConstraint where 
            competitionId = ? and isDeleted = 0 limit 1) then true else false end) as isUsedVenueConstraintEntity`
            , [competitionId, competitionId]);

        if (isArrayPopulated(query)) {
            query.map(e => {
                e.isUsedOrgRegEntity = (e.isUsedOrgRegEntity == 0) ? (e.isUsedOrgRegEntity = false) : (e.isUsedOrgRegEntity = true);
                e.isUsedVenueConstraintEntity = (e.isUsedVenueConstraintEntity == 0) ? (e.isUsedVenueConstraintEntity = false) : (e.isUsedVenueConstraintEntity = true);
                return e;
            })
        }
        return query;
    }

    public async findCompetitionFeeDetailsByUniqueKeyAndYearId(competitionUniqueKey: string, yearID: number): Promise<CompetitionReg> {
        return await this.entityManager.createQueryBuilder().select().from(CompetitionReg, 'c')
            .andWhere("c.competitionUniqueKey = :competitionUniqueKey", { competitionUniqueKey })
            .andWhere("c.yearRefId = :yearID", { yearID })
            .andWhere("c.isDeleted = 0")
            .execute();
    }

    public async getDivisionsByCompetition(competitionId: number, yearID: number, organisationId: number): Promise<any> {
        return await this.entityManager.query(
            `	SELECT cmpd.id as competitionMembershipProductDivisionId, cmpd.divisionName as divisionName, cmpd.genderRefId as genderRefId FROM wsa_competitions.competitionDivision as cmpd 
            join competitionMembershipProduct as cmp on cmp.id = cmpd.competitionMembershipProductId join competition as c on c.id = cmp.competitionId 
            WHERE cmp.competitionId = ? and c.yearRefId = ? and cmpd.isDeleted = 0 
            and cmp.isDeleted = 0 and c.isDeleted = 0   
            union  
            (SELECT  null as competitionMembershipProductDivisionId, 'Unassigned' as divisionName,0 as genderRefId
            from wsa_competitions.team t
            where t.competitionDivisionId is NULL and t.isDeleted = 0 and t.competitionId = ?
            and t.isActive = 1 and t.organisationId = ? LIMIT 1)
            UNION
            (SELECT  null as competitionMembershipProductDivisionId, 'Unassigned' as divisionName,0 as genderRefId
            from wsa_competitions.player p
            where p.isDeleted = 0 and p.competitionDivisionId is NULL and p.competitionId = ?
            and p.organisationId = ? LIMIT 1)
            `, [competitionId, yearID, competitionId,organisationId, competitionId,organisationId]);
    }

    public async getDivisionsForFinalTeamGrading(competitionId: number, yearID: number): Promise<any> {
        return await this.entityManager.query(
            `	SELECT cmpd.id as competitionMembershipProductDivisionId, cmpd.divisionName as divisionName, cmpd.genderRefId as genderRefId FROM wsa_competitions.competitionDivision as cmpd 
            join competitionMembershipProduct as cmp on cmp.id = cmpd.competitionMembershipProductId join competition as c on c.id = cmp.competitionId 
            WHERE cmp.competitionId = ? and c.yearRefId = ? and cmpd.isDeleted = 0 
            and cmp.isDeleted = 0 and c.isDeleted = 0   
            union  
            (SELECT  null as competitionMembershipProductDivisionId, 'Unassigned' as divisionName,0 as genderRefId
            from wsa_competitions.team t
            where t.competitionDivisionId is NULL and t.isDeleted = 0 and t.competitionId = ?
            and t.isActive = 1  LIMIT 1)
            `, [competitionId, yearID, competitionId]);
    }

    public async getCompetitionsByYear(organisationId: number, yearID: number, listedCompetitions: 'owned' | 'participating'): Promise<any> {
        const query = await this.entityManager.query(`call wsa_registrations.usp_get_competitions(?,?,?)`, [listedCompetitions, yearID, organisationId]);
        if (isArrayPopulated(query)) {
            if (listedCompetitions === 'owned') {
                const result = Object.assign({});
                result.published = query[0];
                result.all = query[1];
                return result
            } else if (listedCompetitions === 'participating') {
                return query[0];
            }
        } else {
            return query;
        }
    }

    public async getAffiliatedCompetitionsFromYear(organisationId: number, yearID: number): Promise<any> {
        const query= await this.entityManager.query(`call wsa_registrations.usp_get_participating_competitions(?,?)`, [yearID, organisationId]);
        if (isArrayPopulated(query) && isArrayPopulated(query[0])) {
            return query[0];
        } else {
            return [];
        }
    }

    public async getCompetitionFeeParentDetails(organisationId: number, competitionKey: string): Promise<any> {
        return await this.entityManager.query(`select * from competition where competitionUniqueKey = ? and organisationId = ? and isDeleted = 0`, [competitionKey,organisationId]);
    }

    public async getCompetitionDetailsForPayment(competitionUniqueKey: string, organisationUniqueKey: string): Promise<any> {
        return await this.entityManager.query(`select c.*,inv.registrationInviteesRefId as invitedTo from competition as c 
        join competitionRegistrationInvitees as inv on inv.competitionId = c.id and inv.isDeleted = 0
        where c.competitionUniqueKey = ? and c.isDeleted = 0`,[competitionUniqueKey,organisationUniqueKey]);
    }

    public async getCompetitionsForRegistrationWizard(yearId: number, organisationUniqueKey: string): Promise<any> {
        const query = await this.entityManager.query(`call wsa_registrations.usp_get_registrationwizard_list(?,?)`, [yearId, organisationUniqueKey]);
        if (isArrayPopulated(query) && isArrayPopulated(query[0])) {
            return query[0].map(e => {
                e.competitionStatus = e.competitionStatusId == 2 ? 'Publish' : (e.competitionStatusId == 1 ? 'Draft' : null);
                e.isDirect = e.isDirect == 1 ? true : false
                return e;
            })
        } else {
            return []
        }
    }

    public async findByOrganisationId(competitionId: number, organisationId: number): Promise<CompetitionReg> {
        let query = this.entityManager.createQueryBuilder(CompetitionReg, 'competition')
        query.where('competition.id= :competitionId and competition.organisationId = :organisationId and isDeleted = 0', {competitionId, organisationId})
        return (await query.getOne());
    }

    public async updateCompetitionStatus(competitionKey: string, statusRefId: number, userId: number): Promise<any> {
        return await this.entityManager.query(`UPDATE competition SET drawsPublish = ?, updatedBy = ?, updatedOn = ? WHERE competitionUniqueKey = ? and isDeleted = 0`, [statusRefId, userId, new Date(), competitionKey]);
    }
}