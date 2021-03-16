import { Service } from "typedi";
import BaseService from "./BaseService";
import { isArrayPopulated } from '../utils/Utils';
import { CompetitionReg } from '../models/registrations/Competition';
import { OrgRegistration } from '../models/registrations/OrgRegistration';

@Service()
export default class OrgRegistrationService extends BaseService<OrgRegistration> {

    modelName(): string {
        return OrgRegistration.name;
    }

    public async findByCompetitionKey(competitionKey: string): Promise<CompetitionReg> {
        return await this.entityManager.createQueryBuilder().select().from(CompetitionReg, 'c')
            .andWhere("c.competitionUniqueKey = :competitionKey", { competitionKey })
            .andWhere("c.isDeleted = 0")
            .execute();

    }
    public async findOrgRegId(competitionId: number, organisationId: number): Promise<number> {

        let query = this.entityManager.createQueryBuilder(OrgRegistration, 'orgRegistration')
        query.where("orgRegistration.competitionId = :competitionId", { competitionId })
            .andWhere("orgRegistration.organisationId = :organisationId", { organisationId })
            .andWhere("orgRegistration.isDeleted = 0")
        console.log("---------@@@--@@")
        return (await query.getOne()).id;

    }

    public async findOrgReg(competitionId: number, organisationId: number):Promise<OrgRegistration> {

        let query = await this.entityManager.createQueryBuilder(OrgRegistration, 'orgRegistration')
                    .where("orgRegistration.competitionId = :competitionId", { competitionId })
                    .andWhere("orgRegistration.organisationId = :organisationId", { organisationId })
                    .andWhere("orgRegistration.isDeleted = 0")
                    .getOne()
        console.log("---------@@@--@@")
        return query;

    }

    public async getOrgnisationPhotos(organisationId: number){
        try{
            let query = await this.entityManager.query(
                ` SELECT distinct 
                op.id as organisationPhotoId,
                op.photoUrl ,
                r4.name as photoType
                from wsa_users.organisationPhoto op
                inner join wsa_common.reference r4 
                    on r4.id = op.photoTypeRefId and r4.referenceGroupId = 46 and r4.isDeleted = 0
                where op.organisationId = ? and op.isDeleted = 0`,[organisationId]
            );
            return query;
        }
        catch(error){
            throw error;
        }
    }

    public async findOrganisationRegistrationByOrganisationId(year: number, competitionID: number, organisationId: number): Promise<any> {
        //await this.entityManager.query(`SET SESSION group_concat_max_len = 819200`);
        const result = await this.entityManager.query(
            `SELECT distinct orgreg.id AS orgRegistrationId,orgreg.dobPreferenceLessThan, orgreg.dobPreferenceMoreThan, orgreg.inviteTypeRefId, orgreg.genderRefId,
            orgreg.canInviteSend, orgreg.inviteYearRefId, c1.competitionUniqueKey as inviteCompetitionId,
             orgreg.yearRefId AS yearRefId, c.competitionUniqueKey AS competitionUniqueKeyId, 
            orgreg.organisationId AS organisationId, orgreg.statusRefId AS statusRefId, orgreg.registrationOpenDate AS registrationOpenDate, 
            orgreg.registrationCloseDate AS registrationCloseDate, orgreg.replyName AS replyName, orgreg.trainingDaysAndTimes AS trainingDaysAndTimes, 
            orgreg.trainingVenueId AS trainingVenueId, orgreg.specialNote AS specialNote, orgreg.replyRole AS replyRole, orgreg.replyEmail AS replyEmail, 
            orgreg.replyPhone AS replyPhone, ((SELECT DISTINCT (CONCAT('[', CAST(GROUP_CONCAT(JSON_OBJECT('membershipProductId', mp.membershipProductUniqueKey, 
            'membershipProductTypeId', ormpt.competitionMembershipProductTypeId,'divisionId', cmpd.id, 'orgRegMemProTypeId',ormpt.id, 'divisionName', 
            cmpd.divisionName, 'genderRefId', cmpd.genderRefId, 'registrationLock', ormpt.registrationLock,'registrationTeamLock', ormpt.registrationTeamLock,
            'registrationCap', ormpt.registrationCap,'teamRegistrationCap', ormpt.teamRegistrationCap, 'membershipProductTypeMappingId',mpm.id,
            'isIndividualRegistration', ormpt.isIndividualRegistration, 'isTeamRegistration', ormpt.isTeamRegistration, 'isPlaying', mpt.isPlaying )) AS CHAR (819200)), ']')) FROM 
            orgRegistrationMembershipProductType as ormpt join competitionMembershipProductDivision as cmpd on cmpd.id = ormpt.competitionMembershipProductDivisionId 
            and cmpd.isDeleted = 0 join competitionMembershipProductType as cmpt on cmpt.id = ormpt.competitionMembershipProductTypeId and cmpt.isDeleted = 0 
            join membershipProductTypeMapping as mpm on cmpt.membershipProductTypeMappingId = mpm.id and mpm.isDeleted = 0 
            join orgRegistration as orgreg on ormpt.orgRegistrationId = orgreg.id and orgreg.isDeleted = 0 
            join competitionMembershipProduct as cmp on cmp.membershipProductId = mpm.membershipProductId and cmp.isDeleted = 0 
            and cmp.competitionId  = orgreg.competitionId
            join membershipProduct as mp on mp.id = mpm.membershipProductId and mp.isDeleted = 0 
            Join membershipProductType as mpt on mpt.id = mpm.membershipProductTypeId and mpt.isDeleted = 0 
            WHERE cmp.competitionId = c.id and 
            ormpt.isDeleted = 0 and cmp.competitionId = ? and orgreg.yearRefId = ? AND orgreg.organisationId = ? and c.yearRefId = orgreg.yearRefId )) AS membershipProductTypes, 
            (SELECT DISTINCT (CONCAT('[', CAST(GROUP_CONCAT(JSON_OBJECT('id',orghc.id,'code', orghc.code, 'orgRegistrationId', orghc.orgRegistrationId, 'isActive', orghc.isActive )) AS 
            CHAR (819200)), ']')) FROM orgRegistrationHardshipCode AS orghc WHERE orghc.isDeleted = 0 and orghc.orgRegistrationId = orgreg.id) AS hardShipCodes, 
            (SELECT DISTINCT (CONCAT('[', CAST(GROUP_CONCAT(JSON_OBJECT('registrationMethodId',orm.id,'registrationMethodRefId', orm.registrationMethodRefId)) AS 
            CHAR (819200)), ']')) FROM orgRegistrationRegisterMethod AS orm WHERE orm.isDeleted = 0 and orm.orgRegistrationId = orgreg.id) AS registerMethods, 
            (SELECT DISTINCT (CONCAT('[', GROUP_CONCAT(JSON_OBJECT( 'registrationSettingsId', ors.id, 'registrationSettingsRefId', ors.registrationSettingsRefId)), 
            ']')) FROM orgRegistrationSettings AS ors WHERE ors.isDeleted = 0 and ors.orgRegistrationId = orgreg.id) AS registrationSettings, (SELECT DISTINCT 
            (CONCAT('[', GROUP_CONCAT(JSON_OBJECT( 'orgRegistrationDisclaimerLinkId', ord.id, 'disclaimerLink', ord.disclaimerLink, 'disclaimerText', 
            ord.disclaimerText)), ']')) FROM orgRegistrationDisclaimerLink AS ord WHERE ord.isDeleted = 0 and ord.orgRegistrationId = orgreg.id) AS 
            registrationDisclaimer, (SELECT DISTINCT (CONCAT('[',GROUP_CONCAT(JSON_OBJECT('organisationPhotoId',op.id , 'photoUrl', op.photoUrl,'photoType', r4.name )),']'))
            from wsa_users.organisationPhoto op inner join wsa_common.reference r4 on r4.id = op.photoTypeRefId and r4.referenceGroupId = 46 and r4.isDeleted = 0
            where op.organisationId = orgreg.organisationId and op.isDeleted = 0) as organisationPhotos FROM orgRegistration AS orgreg 
            JOIN competition AS c ON c.id = orgreg.competitionId left join competition c1 on c1.id = orgreg.inviteCompetitionId and c1.isDeleted = 0 WHERE orgreg.isDeleted = 0 and 
            c.isDeleted = 0 and c.yearRefId = orgreg.yearRefId and c.yearRefId = ? AND orgreg.competitionId = ? AND orgreg.organisationId = ?`
            , [competitionID, year, organisationId, year, competitionID, organisationId]);

        if (isArrayPopulated(result)) {
            for (let i of result) {
                let membershipProductTypeArray = [];
                if (i['membershipProductTypes']) {
                    i['membershipProductTypes'] = JSON.parse(i['membershipProductTypes'])
                } else {
                    i['membershipProductTypes'] = []
                }

                i['membershipProductTypes'].map((mpt) =>{
                    if(mpt.isIndividualRegistration == 1){
                        let newObj = JSON.parse(JSON.stringify(mpt));
                        newObj["isIndividualRegistration"] = 1;
                        newObj["isTeamRegistration"] = 0;
                        newObj["registrationLock"] = newObj.registrationLock;
                        newObj["registrationCap"] = mpt.registrationCap;
                        membershipProductTypeArray.push(newObj)
                    }

                    if(mpt.isTeamRegistration == 1){
                        let newObj = JSON.parse(JSON.stringify(mpt));
                        newObj["isIndividualRegistration"] = 0;
                        newObj["isTeamRegistration"] = 1;
                        newObj["registrationLock"] = newObj.registrationTeamLock;
                        newObj["teamRegistrationCap"] = mpt.teamRegistrationCap;
                        membershipProductTypeArray.push(newObj)
                    }
                })

                i['membershipProductTypes'] = membershipProductTypeArray;
                
                if (i['statusRefId'] == 0) i['membershipProductTypes'] = []

                if (i['registerMethods']) {
                    i['registerMethods'] = JSON.parse(i['registerMethods'])
                } else {
                    i['registerMethods'] = []
                }
                if (i['registrationSettings']) {
                    i['registrationSettings'] = JSON.parse(i['registrationSettings'])
                } else {
                    i['registrationSettings'] = []
                }
                if (i['hardShipCodes']) {
                    i['hardShipCodes'] = JSON.parse(i['hardShipCodes'])
                } else {
                    i['hardShipCodes'] = []
                }
                if (i['registrationDisclaimer']) {
                    i['registrationDisclaimer'] = JSON.parse(i['registrationDisclaimer'])
                } else {
                    i['registrationDisclaimer'] = []
                }
                if (i['organisationPhotos']) {
                    i['organisationPhotos'] = JSON.parse(i['organisationPhotos'])
                } else {
                    i['organisationPhotos'] = []
                }


                if (i['registrationOpenDate'] === null) i['registrationOpenDate'] = ''
                if (i['registrationCloseDate'] === null) i['registrationCloseDate'] = ''
                if (i['specialNote'] === null) i['specialNote'] = ''
                if (i['replyName'] === null) i['replyName'] = ''
                if (i['replyRole'] === null) i['replyRole'] = ''
                if (i['replyEmail'] === null) i['replyEmail'] = ''
                if (i['replyPhone'] === null) i['replyPhone'] = ''
                if (i['trainingDaysAndTimes'] === null) i['trainingDaysAndTimes'] = ''

                i['userRegistrationUrl'] = ""
                if (i['registerMethods']) {
                    for (let r of i['registerMethods']) {
                        if (r['subOptions']) r['subOptions'] = JSON.parse(r['subOptions'])
                    }
                }
            }
        }

        return result;
    }

    public async getOrgregListing(OFFSET: number, LIMIT: number, yearId: number, organisationId: number, sortBy:string=undefined, vSortOrder:'ASC'|'DESC'=undefined): Promise<any> {
        try {
            let result = await this.entityManager.query("CALL wsa_registrations.usp_orgreg_listing(?, ?, ?, ?, ?, ?)", [yearId, organisationId, LIMIT, OFFSET, sortBy, vSortOrder]);
            if (isArrayPopulated(result[0])) {
                result[0].map(e => (e.status === 2)? (e.status = 'Published'):(e.status = 'Draft'));
            }
            return { count: result[1][0].totalCount, data: result[0] };
        } catch (error) {
            throw error;
        }
    }

    public async findDivisionDates(competitionId: number){
        try{
            let result = await this.entityManager.query(`
            SELECT 
                MIN(DATE_FORMAT(cmpd.fromDate, '%Y-%m-%d')) as fromDate,
                MAX(DATE_FORMAT(cmpd.toDate, '%Y-%m-%d')) as toDate,
                MIN(cmpd.genderRefId) as minGenderRefId, 
                MAX(cmpd.genderRefId) as maxGenderRefId,
                (select COUNT(*) from wsa_registrations.competitionMembershipProductDivision cmpd1 
                	where cmpd1.competitionMembershipProductId = cmp.id and cmpd1.genderRefId is null
                	and cmpd1.isDeleted = 0) as genderCount
                from wsa_registrations.competitionMembershipProductDivision cmpd 
                inner join wsa_registrations.competitionMembershipProduct cmp 
                    on cmp.id = cmpd.competitionMembershipProductId and cmpd.isDeleted = 0
                inner join wsa_registrations.competition c 
                    on c.id = cmp.competitionId and c.isDeleted  = 0
                    where c.id = ? `,[competitionId]);
        
        return result[0];
            
        }
        catch(error){
            throw error;
        }
    }

    public async updatOrgRegistration(userId: number, competitionId: number, organisationId: number)
    {
        try
        {
            await  this.entityManager.createQueryBuilder(OrgRegistration, 'orgRegistration')
            .update(OrgRegistration)
            .set({ isDeleted: 1, updatedBy: userId, updatedOn: new Date() })
            .andWhere("orgRegistration.organisationId = :organisationId "+
                            " and orgRegistration.competitionId = :competitionId",
                        { organisationId: organisationId,  
                        competitionId: competitionId})
            .execute();
        }
        catch(error)
        {
            throw error;
        }
    }

    public async getOrgRegDetailsByCompetitionIdAndOrganisationId(competitionUniqueKey: string, organisationUniqueKey: string): Promise<any> {
        return await this.entityManager.query(`select orgreg.* from orgRegistration as orgreg 
         join wsa_users.organisation as o on orgreg.organisationId = o.id 
         join competition as c on c.id = orgreg.competitionId 
         where c.competitionUniqueKey = ? and o.organisationUniqueKey = ? and 
         c.isDeleted = 0 and orgreg.isDeleted = 0 and o.isDeleted = 0`, 
         [competitionUniqueKey, organisationUniqueKey]);
     }
}