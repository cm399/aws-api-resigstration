import { Service } from "typedi";
import BaseService from "./BaseService";
import { isArrayPopulated } from "../utils/Utils";
import { CompetitionMembershipProductFee } from '../models/registrations/CompetitionMembershipProductFee';

@Service()
export default class CompetitionMembershipProductFeeService extends BaseService<CompetitionMembershipProductFee> {

    modelName(): string {
        return CompetitionMembershipProductFee.name;
    }

    public async getCompetitionFeeFees(userId: number, competitionUniqueKey: string, organisationId: number, competitionCreatorOrgId: number): Promise<any> {
        console.log("competitionUniqueKey::" + competitionUniqueKey + "organisationId::" + organisationId + "competitionCreatorOrgId::" + competitionCreatorOrgId);
       // await this.entityManager.query(`SET SESSION group_concat_max_len = 8192000;`);
        const query = await this.entityManager.query(
            `SELECT DISTINCT mp1.membershipProductUniqueKey AS membershipProductUniqueKey, mp1.productName AS membershipProductName,
            0 as mCasualFee,0 as mCasualGst, 0 as mSeasonalFee, 0 as mSeasonalGst,
           ( CONCAT('[', (SELECT DISTINCT CAST(GROUP_CONCAT(JSON_OBJECT(
           'feesCreatorId', cmpf.createdBy , 'creatorOrgId', c.organisationId, 'competitionCreatorId', c.createdBy, 'organisationId', cmpf.organisationId,
           'competitionMembershipProductFeeId', cmpf.id, 'competitionMembershipProductTypeId', cmpf.competitionMembershipProductTypeId, 'membershipProductUniqueKey',
           mp.membershipProductUniqueKey, 'competitionMembershipProductDivisionId', cmpf.competitionMembershipProductDivisionId, 'casualFees',cmpf.casualFees,'seasonalFees',
           cmpf.seasonalFees, 'casualGST',cmpf.casualGST ,'seasonalGST',cmpf.seasonalGST, 'teamSeasonalFees', cmpf.teamSeasonalFees, 'teamSeasonalGST', cmpf.teamSeasonalGST,
           'teamCasualFees', cmpf.teamCasualFees, 'teamCasualGST', cmpf.teamCasualGST,
           'membershipTypeName', mpt.name, 'divisionName', cmpd.divisionName,'genderRefId', cmpd.genderRefId, 'isSeasonal', cmpf.isSeasonal, 'isCasual', cmpf.isCasual, 'isTeamSeasonal', cmpf.isTeamSeasonal,
           'isTeamCasual', cmpf.isTeamCasual, 'nominationSeasonalFee', cmpf.nominationSeasonalFee , 'nominationSeasonalGST', cmpf.nominationSeasonalGST, 
            'nominationTeamSeasonalFee', cmpf.nominationTeamSeasonalFee,'nominationTeamSeasonalGST', cmpf.nominationTeamSeasonalGST, 'isPlaying', mpt.isPlaying,
           'teamRegChargeTypeRefId', cmpf.teamRegChargeTypeRefId )) AS CHAR (819200))
           FROM competitionMembershipProductFee AS cmpf INNER JOIN competitionMembershipProductType AS cmpt ON cmpt.id = cmpf.competitionMembershipProductTypeId INNER JOIN
           membershipProductTypeMapping AS mpm ON mpm.id = cmpt.membershipProductTypeMappingId INNER JOIN membershipProductType AS mpt ON mpt.id = mpm.membershipProductTypeId
           INNER JOIN competitionMembershipProduct AS cmp ON cmp.membershipProductId = mpm.membershipProductId INNER JOIN competitionMembershipProductDivision AS cmpd ON
           cmpd.competitionMembershipProductId = cmp.id and (cmpf.competitionMembershipProductDivisionId is null or cmpf.competitionMembershipProductDivisionId = cmpd.id) INNER JOIN membershipProduct AS mp ON mp.id = cmp.membershipProductId INNER JOIN competition AS c ON
           cmpf.competitionMembershipProductTypeId = cmpt.id AND c.id = cmp.competitionId WHERE c.competitionUniqueKey = ? AND
           mp.id = mp1.id AND cmpt.competitionMembershipProductId = cmp.id AND cmp.id = cmp1.id AND
           cmp.membershipProductId = mp.id and mpm.isDeleted = 0 and cmp.isDeleted = 0 and cmpd.isDeleted = 0 and mp.isDeleted = 0 and c.isDeleted = 0
           and cmpf.organisationId = ? and mpm.id = mpf.membershipProductTypeMappingId and cmpf.isDeleted = 0), ']') ) AS fees,
           (CONCAT('[', (SELECT DISTINCT CAST(GROUP_CONCAT(JSON_OBJECT( 'feesCreatorId', cmpf.createdBy ,
           'creatorOrgId', c.organisationId, 'competitionCreatorId', c.createdBy, 'organisationId', cmpf.organisationId, 'competitionMembershipProductFeeId', cmpf.id,
           'competitionMembershipProductTypeId', cmpf.competitionMembershipProductTypeId, 'membershipProductUniqueKey', mp.membershipProductUniqueKey,
           'competitionMembershipProductDivisionId', cmpf.competitionMembershipProductDivisionId, 'casualFees',cmpf.casualFees,'seasonalFees',cmpf.seasonalFees,
           'casualGST',cmpf.casualGST ,'seasonalGST',cmpf.seasonalGST, 'teamSeasonalFees', cmpf.teamSeasonalFees, 'teamSeasonalGST', cmpf.teamSeasonalGST,
           'teamCasualFees', cmpf.teamCasualFees, 'teamCasualGST', cmpf.teamCasualGST,
           'membershipTypeName', mpt.name, 'divisionName', cmpd.divisionName, 'genderRefId', cmpd.genderRefId, 'isSeasonal', cmpf.isSeasonal, 'isCasual', cmpf.isCasual, 'isTeamSeasonal', cmpf.isTeamSeasonal,
           'isTeamCasual', cmpf.isTeamCasual, 'nominationSeasonalFee', cmpf.nominationSeasonalFee , 'nominationSeasonalGST', cmpf.nominationSeasonalGST, 
           'nominationTeamSeasonalFee', cmpf.nominationTeamSeasonalFee,'nominationTeamSeasonalGST', cmpf.nominationTeamSeasonalGST, 'isPlaying', mpt.isPlaying,
           'teamRegChargeTypeRefId', cmpf.teamRegChargeTypeRefId)) AS CHAR (819200))
           FROM competitionMembershipProductFee AS cmpf INNER JOIN competitionMembershipProductType AS cmpt ON cmpt.id = cmpf.competitionMembershipProductTypeId INNER JOIN
           membershipProductTypeMapping AS mpm ON mpm.id = cmpt.membershipProductTypeMappingId INNER JOIN membershipProductType AS mpt ON mpt.id = mpm.membershipProductTypeId
           INNER JOIN competitionMembershipProduct AS cmp ON cmp.membershipProductId = mpm.membershipProductId and cmp.id = cmpt.competitionMembershipProductId INNER JOIN competitionMembershipProductDivision AS cmpd ON
           cmpd.competitionMembershipProductId = cmp.id and (cmpf.competitionMembershipProductDivisionId is null or cmpf.competitionMembershipProductDivisionId = cmpd.id)
           INNER JOIN membershipProduct AS mp ON mp.id = cmp.membershipProductId INNER JOIN competition AS c ON
           cmpf.competitionMembershipProductTypeId = cmpt.id AND c.id = cmp.competitionId WHERE c.competitionUniqueKey = ? AND
           cmpf.organisationId = ? and mp.id = mp1.id AND cmpt.competitionMembershipProductId = cmp.id AND cmp.id = cmp1.id AND
           cmp.membershipProductId = mp.id and mpm.isDeleted = 0 and cmp.isDeleted = 0 and cmpd.isDeleted = 0 and cmpt.isDeleted = 0 and mp.isDeleted = 0 and c.isDeleted = 0
           and cmpf.organisationId = ? and mpm.id = mpf.membershipProductTypeMappingId and cmpf.isDeleted = 0), ']') ) AS childFees
           FROM membershipProduct AS mp1 join membershipProductFees as mpf on mpf.membershipProductId = mp1.id
           and mpf.isDeleted = 0 JOIN competitionMembershipProduct AS cmp1 ON cmp1.membershipProductId = mp1.id
           join competitionMembershipProductType cmpt1 on cmpt1.competitionMembershipProductId  = cmp1.id and cmpt1.isDeleted = 0
           join membershipProductTypeMapping mptm1 on mptm1.id = cmpt1.membershipProductTypeMappingId  and mpf.membershipProductTypeMappingId = mptm1.id and mptm1.isDeleted = 0
           JOIN competition AS c ON cmp1.competitionId = c.id WHERE
            cmp1.isDeleted = 0 and mp1.isDeleted = 0 and c.isDeleted = 0
            AND c.competitionUniqueKey = ? and c.organisationId = ?`
            , [competitionUniqueKey, competitionCreatorOrgId, competitionUniqueKey, organisationId, organisationId,
                competitionUniqueKey, competitionCreatorOrgId]);

        let obj = {
            membershipProductUniqueKey: "",
            membershipProductName: "",
            mCasualFee: 0,
            mCasualGst: 0,
            mSeasonalFee: 0,
            mSeasonalGst: 0,
            fees: [],
            childFees: []
        }
        let arr = [];
        let prodMap = new Map();
        let feeMap = new Map();
        let childMap = new Map();
        if (isArrayPopulated(query)) {
             for (let i of query) {
                if (i['fees']) i['fees'] = JSON.parse(i['fees']);
                if (i['childFees']) i['childFees'] = JSON.parse(i['childFees']);
            }

            let modifiedParentArray = [];
            let modifiedChildArray = [];
            for(let item of query)
            {
                let membershipProductKey = item.membershipProductUniqueKey;
                let prodTemp = prodMap.get(membershipProductKey);


                if(prodTemp == undefined)
                {
                    let obj = {
                        membershipProductUniqueKey: item.membershipProductUniqueKey,
                        membershipProductName: item.membershipProductName,
                        mCasualFee: 0,
                        mCasualGst: 0,
                        mSeasonalFee: 0,
                        mSeasonalGst: 0,
                        fees: [],
                        childFees: []
                    }
                   // console.log("****" + item.fees);
                    if (isArrayPopulated(item.fees)) {
                       // console.log("#####" + item.fees);
                        let tempSeasonal = JSON.parse(JSON.stringify([...item.fees]))
                        let tempCasual = JSON.parse(JSON.stringify([...item.fees]))
                        let tempTeamSeasonal = JSON.parse(JSON.stringify([...item.fees]))
                        let tempTeamCasual = JSON.parse(JSON.stringify([...item.fees]))

                        for (let i of tempSeasonal) {
                            i.feeTypeRefId = 2;
                            delete i.casualFees
                            delete i.casualGST
                            delete i.teamSeasonalFees,
                            delete i.teamSeasonalGST
                            delete i.teamCasualFees
                            delete i.teamCasualGST
                            delete i.nominationTeamSeasonalFee
                            delete i.nominationTeamSeasonalGST
                            i.nominationFees = i.nominationSeasonalFee
                            i.nominationGST = i.nominationSeasonalGST
                            i.Fees = i.seasonalFees
                            i.GST = i.seasonalGST
                        }

                        for (let i of tempCasual) {
                            i.feeTypeRefId = 1;
                            delete i.seasonalFees
                            delete i.seasonalGST
                            delete i.teamSeasonalFees,
                            delete i.teamSeasonalGST
                            delete i.teamCasualFees
                            delete i.teamCasualGST
                            delete i.nominationSeasonalFee
                            delete i.nominationSeasonalGST
                            delete i.nominationTeamSeasonalFee
                            delete i.nominationTeamSeasonalGST
                            i.nominationFees = null
                            i.nominationGST = null
                            i.Fees = i.casualFees
                            i.GST = i.casualGST
                        }

                        for (let i of tempTeamSeasonal) {
                            i.feeTypeRefId = 3;
                            delete i.casualFees
                            delete i.casualGST
                            delete i.seasonalFees
                            delete i.seasonalGST
                            delete i.teamCasualFees
                            delete i.teamCasualGST
                            delete i.nominationSeasonalFee
                            delete i.nominationSeasonalGST
                            i.nominationFees = i.nominationTeamSeasonalFee
                            i.nominationGST = i.nominationTeamSeasonalGST
                            i.Fees = i.teamSeasonalFees
                            i.GST = i.teamSeasonalGST
                        }
                        for (let i of tempTeamCasual) {
                            i.feeTypeRefId = 4;
                            delete i.casualFees
                            delete i.casualGST
                            delete i.seasonalFees
                            delete i.seasonalGST
                            delete i.teamSeasonalFees,
                            delete i.teamSeasonalGST
                            delete i.nominationSeasonalFee
                            delete i.nominationSeasonalGST
                            delete i.nominationTeamSeasonalFee
                            delete i.nominationTeamSeasonalGST
                            i.nominationFees = null
                            i.nominationGST = null
                            i.Fees = i.teamCasualFees
                            i.GST = i.teamCasualGST
                        }
                        modifiedParentArray = [...tempCasual, ...tempSeasonal, ...tempTeamSeasonal, ...tempTeamCasual];
                        obj.fees = modifiedParentArray;
                    }

                    if (isArrayPopulated(item.childFees)) {
                        let tempSeasonal = JSON.parse(JSON.stringify([...item.childFees]))
                        let tempCasual = JSON.parse(JSON.stringify([...item.childFees]))
                        let tempTeamSeasonal = JSON.parse(JSON.stringify([...item.childFees]))
                        let tempTeamCasual = JSON.parse(JSON.stringify([...item.childFees]))

                       for (let i of tempSeasonal) {
                            i.feeTypeRefId = 2;
                            delete i.casualFees
                            delete i.casualGST
                            delete i.teamSeasonalFees,
                            delete i.teamSeasonalGST
                            delete i.teamCasualFees
                            delete i.teamCasualGST
                            delete i.nominationTeamSeasonalFee
                            delete i.nominationTeamSeasonalGST
                            i.nominationFees = i.nominationSeasonalFee
                            i.nominationGST = i.nominationSeasonalGST
                            i.Fees = i.seasonalFees
                            i.GST = i.seasonalGST
                        }

                        for (let i of tempCasual) {
                            i.feeTypeRefId = 1;
                            delete i.seasonalFees
                            delete i.seasonalGST
                            delete i.teamSeasonalFees,
                            delete i.teamSeasonalGST
                            delete i.teamCasualFees
                            delete i.teamCasualGST
                            delete i.nominationSeasonalFee
                            delete i.nominationSeasonalGST
                            delete i.nominationTeamSeasonalFee
                            delete i.nominationTeamSeasonalGST
                            i.nominationFees = null
                            i.nominationGST = null
                            i.Fees = i.casualFees
                            i.GST = i.casualGST
                        }

                        for (let i of tempTeamSeasonal) {
                            i.feeTypeRefId = 3;
                            delete i.casualFees
                            delete i.casualGST
                            delete i.seasonalFees
                            delete i.seasonalGST
                            delete i.teamCasualFees
                            delete i.teamCasualGST
                            delete i.nominationSeasonalFee
                            delete i.nominationSeasonalGST
                            i.nominationFees = i.nominationTeamSeasonalFee
                            i.nominationGST = i.nominationTeamSeasonalGST
                            i.Fees = i.teamSeasonalFees
                            i.GST = i.teamSeasonalGST
                        }
                        for (let i of tempTeamCasual) {
                            i.feeTypeRefId = 4;
                            delete i.casualFees
                            delete i.casualGST
                            delete i.seasonalFees
                            delete i.seasonalGST
                            delete i.teamSeasonalFees
                            delete i.teamSeasonalGST
                            delete i.nominationSeasonalFee
                            delete i.nominationSeasonalGST
                            delete i.nominationTeamSeasonalFee
                            delete i.nominationTeamSeasonalGST
                            i.nominationFees = null
                            i.nominationGST = null
                            i.Fees = i.teamCasualFees
                            i.GST = i.teamCasualGST
                        }

                        modifiedChildArray = [...tempCasual, ...tempSeasonal, ...tempTeamSeasonal, ...tempTeamCasual];
                        obj.childFees = modifiedChildArray;
                    }
                    prodMap.set(membershipProductKey, obj);

                    arr.push(obj);
                }
                else{
                    if (isArrayPopulated(item.fees)) {
                        let tempSeasonal = JSON.parse(JSON.stringify([...item.fees]))
                        let tempCasual = JSON.parse(JSON.stringify([...item.fees]))
                        let tempTeamSeasonal = JSON.parse(JSON.stringify([...item.fees]))
                        let tempTeamCasual = JSON.parse(JSON.stringify([...item.fees]))

                        for (let i of tempSeasonal) {
                            i.feeTypeRefId = 2;
                            delete i.casualFees
                            delete i.casualGST
                            delete i.teamSeasonalFees,
                            delete i.teamSeasonalGST
                            delete i.teamCasualFees
                            delete i.teamCasualGST
                            delete i.nominationTeamSeasonalFee
                            delete i.nominationTeamSeasonalGST
                            i.nominationFees = i.nominationSeasonalFee
                            i.nominationGST = i.nominationSeasonalGST
                            i.Fees = i.seasonalFees
                            i.GST = i.seasonalGST
                        }

                        for (let i of tempCasual) {
                            i.feeTypeRefId = 1;
                            delete i.seasonalFees
                            delete i.seasonalGST
                            delete i.teamSeasonalFees,
                            delete i.teamSeasonalGST
                            delete i.teamCasualFees
                            delete i.teamCasualGST
                            delete i.nominationSeasonalFee
                            delete i.nominationSeasonalGST
                            delete i.nominationTeamSeasonalFee
                            delete i.nominationTeamSeasonalGST
                            i.nominationFees = null
                            i.nominationGST = null
                            i.Fees = i.casualFees
                            i.GST = i.casualGST
                        }

                        for (let i of tempTeamSeasonal) {
                            i.feeTypeRefId = 3;
                            delete i.casualFees
                            delete i.casualGST
                            delete i.seasonalFees
                            delete i.seasonalGST
                            delete i.teamCasualFees
                            delete i.teamCasualGST
                            delete i.nominationSeasonalFee
                            delete i.nominationSeasonalGST
                            i.nominationFees = i.nominationTeamSeasonalFee
                            i.nominationGST = i.nominationTeamSeasonalGST
                            i.Fees = i.teamSeasonalFees
                            i.GST = i.teamSeasonalGST
                        }
                        for (let i of tempTeamCasual) {
                            i.feeTypeRefId = 4;
                            delete i.casualFees
                            delete i.casualGST
                            delete i.seasonalFees
                            delete i.seasonalGST
                            delete i.teamSeasonalFees,
                            delete i.teamSeasonalGST
                            delete i.nominationSeasonalFee
                            delete i.nominationSeasonalGST
                            delete i.nominationTeamSeasonalFee
                            delete i.nominationTeamSeasonalGST
                            i.nominationFees = null
                            i.nominationGST = null
                            i.Fees = i.teamCasualFees
                            i.GST = i.teamCasualGST
                        }

                        modifiedParentArray = [...tempCasual, ...tempSeasonal, ...tempTeamSeasonal, ...tempTeamCasual];
                        let newArr = [...prodTemp.fees, ...modifiedParentArray];
                        prodTemp.fees = newArr;
                    }

                    if (isArrayPopulated(item.childFees)) {
                        let tempSeasonal = JSON.parse(JSON.stringify([...item.childFees]))
                        let tempTeamSeasonal = JSON.parse(JSON.stringify([...item.childFees]))
                        let tempCasual = JSON.parse(JSON.stringify([...item.childFees]))
                        let tempTeamCasual = JSON.parse(JSON.stringify([...item.childFees]))

                        for (let i of tempSeasonal) {
                             i.feeTypeRefId = 2;
                             delete i.casualFees
                             delete i.casualGST
                             delete i.teamSeasonalFees,
                             delete i.teamSeasonalGST
                             delete i.teamCasualFees
                             delete i.teamCasualGST
                             delete i.nominationTeamSeasonalFee
                             delete i.nominationTeamSeasonalGST
                             i.nominationFees = i.nominationSeasonalFee
                             i.nominationGST = i.nominationSeasonalGST
                             i.Fees = i.seasonalFees
                             i.GST = i.seasonalGST
                         }
 
                         for (let i of tempCasual) {
                             i.feeTypeRefId = 1;
                             delete i.seasonalFees
                             delete i.seasonalGST
                             delete i.teamSeasonalFees,
                             delete i.teamSeasonalGST
                             delete i.teamCasualFees
                             delete i.teamCasualGST
                             delete i.nominationSeasonalFee
                            delete i.nominationSeasonalGST
                            delete i.nominationTeamSeasonalFee
                            delete i.nominationTeamSeasonalGST
                            i.nominationFees = null
                            i.nominationGST = null
                             i.Fees = i.casualFees
                             i.GST = i.casualGST
                         }
 
                         for (let i of tempTeamSeasonal) {
                             i.feeTypeRefId = 3;
                             delete i.casualFees
                             delete i.casualGST
                             delete i.seasonalFees
                             delete i.seasonalGST
                             delete i.teamCasualFees
                             delete i.teamCasualGST
                             delete i.nominationSeasonalFee
                             delete i.nominationSeasonalGST
                             i.nominationFees = i.nominationTeamSeasonalFee
                             i.nominationGST = i.nominationTeamSeasonalGST
                             i.Fees = i.teamSeasonalFees
                             i.GST = i.teamSeasonalGST
                         }
                         for (let i of tempTeamCasual) {
                             i.feeTypeRefId = 4;
                             delete i.casualFees
                             delete i.casualGST
                             delete i.seasonalFees
                             delete i.seasonalGST
                             delete i.teamSeasonalFees,
                             delete i.teamSeasonalGST
                             delete i.nominationSeasonalFee
                            delete i.nominationSeasonalGST
                            delete i.nominationTeamSeasonalFee
                            delete i.nominationTeamSeasonalGST
                            i.nominationFees = null
                            i.nominationGST = null
                            i.Fees = i.teamCasualFees
                            i.GST = i.teamCasualGST
                         }
 

                        modifiedChildArray = [...tempCasual, ...tempSeasonal, ...tempTeamSeasonal, ...tempTeamCasual];
                        let newArr = [...prodTemp.childFees, ...modifiedChildArray];
                        prodTemp.childFees = newArr;
                    }
                }
            }
        }
        return arr;
    }

    public async getIDForDeleteCompFeesByCompetitionId(competitionId: number): Promise<any> {
        return await this.entityManager.query(
            `select id FROM competitionMembershipProductFee WHERE isDeleted = 0 and competitionMembershipProductTypeId in (
            select id FROM competitionMembershipProductType where isDeleted = 0 and competitionMembershipProductId in (
            SELECT id FROM competitionMembershipProduct where isDeleted = 0 and competitionId = ? ))`
            , [competitionId]);
    }

    public async getIDForDeleteCompFeesByCompMemproId(compMemProId: number): Promise<any> {
        return await this.entityManager.query(
            `select id FROM competitionMembershipProductFee WHERE isDeleted = 0 and competitionMembershipProductTypeId
            in (select id from competitionMembershipProductType where isDeleted = 0 and competitionMembershipProductId = ? )`,
            [compMemProId]);
    }

    public async getAllAffiliations(organisationId: number, invitorId: number, organisationTypeRefId: number): Promise<any> {
        if (organisationTypeRefId === 2) {
            //State
            if (invitorId === 3) {
                // in case of Associations
                return await this.entityManager.query(`select a.affiliateOrgId as organisationId from wsa_users.affiliate as a 
                where a.organisationTypeRefId = 3 and a.affiliatedToOrgId = ? and a.isDeleted = 0`, [organisationId]);
            } else if (invitorId === 4) {
                // in case of Clubs
                return await this.entityManager.query(` select a.affiliateOrgId as organisationId from wsa_users.affiliate as a 
                where a.isDeleted = 0 and a.organisationTypeRefId = 4 and a.affiliatedToOrgId in (select a2.affiliateOrgId from 
                wsa_users.affiliate a2 where a2.organisationTypeRefId = 3 and a2.affiliatedToOrgId = ? and a2.isDeleted = 0)`, [organisationId]);
            } else return [];
        } else if (organisationTypeRefId === 3) {
            // Associations
            if (invitorId === 4) {
                // in case of Clubs
                return await this.entityManager.query(`select a.affiliateOrgId as organisationId from wsa_users.affiliate as a 
                where a.organisationTypeRefId = 4 and a.affiliatedToOrgId = ? and a.isDeleted = 0`, [organisationId]);
            } else return [];
        }
    }

    public async getAllAnyOrgInvitees(inviteeId: number): Promise<any> {
        return await this.entityManager.query(`select crio.* from wsa_registrations.competitionRegistrationInviteesOrg crio
                where crio.competitionRegistrationInviteesId = ? and crio.isDeleted = 0 `, [inviteeId]);
    }

    public async findDivisionsOfSpecificFees(competitionMembershipTypeId: number, organisationId: number): Promise<CompetitionMembershipProductFee[]> {
        return await this.entityManager.query(`select cmpf.* from competitionMembershipProductFee cmpf where cmpf.competitionMembershipProductTypeId = ?
        and cmpf.organisationId = ? and cmpf.isDeleted = 0`, [competitionMembershipTypeId, organisationId]);
    }

    public async findFeesTypeOfSpecificFees(competitionMembershipFeeId: number, competitionMembershipTypeId: number): Promise<CompetitionMembershipProductFee[]> {
        return await this.entityManager.query(`select cmpf.* from competitionMembershipProductFee cmpf where cmpf.competitionMembershipProductTypeId = ?
        and cmpf.id = ? and cmpf.isDeleted = 0`, [competitionMembershipTypeId, competitionMembershipFeeId]);
    }

    // public async deleteFeesOfPreviousDivisionsOfParentAndChild(orgId: number, divisionId: number, competitionMembershipTypeId: number): Promise<CompetitionMembershipProductFee[]> {
    //     return await this.entityManager.query(`update competitionMembershipProductFee set isDeleted = 1 where competitionMembershipProductTypeId = ? and organisationId = ? `, [competitionMembershipTypeId, orgId]);
    // }

    public async getCompetitionFeeParentFees(organisationId: number, competitionUniqueKey: string): Promise<any> {
        return await this.entityManager.query(`select cmpf.competitionMembershipProductTypeId as competitionMembershipProductTypeId, cmpf.competitionMembershipProductDivisionId
        as competitionMembershipProductDivisionId, cmpf.createdBy as createdBy, cmpf.isSeasonal, cmpf.isCasual, cmpf.isTeamSeasonal, cmpf.isTeamCasual from competitionMembershipProductFee cmpf where cmpf.competitionMembershipProductTypeId in (
        select cmpt.id FROM competitionMembershipProductType cmpt where cmpt.competitionMembershipProductId in (select cmp.id from competitionMembershipProduct cmp join
        competition as c on c.id = cmp.competitionId where c.competitionUniqueKey = ? and c.isDeleted = 0 and cmp.isDeleted = 0 and c.organisationId = ? )
        and cmpt.isDeleted = 0) and cmpf.isDeleted = 0 and cmpf.organisationId = ?`, [competitionUniqueKey,organisationId,organisationId]);
    }

    public async getCompetitionFeesDetailsForPayment(competitionUniqueKey: string, organisationId: number): Promise<any> {
        return await this.entityManager.query(
        `select distinct cmpf.*, c.organisationId as compCreatorOrgId, a.organisationTypeRefId as orgTypeRefId,
        a1.organisationTypeRefId as compCreatorOrgTypeRefId from competitionMembershipProductFee as cmpf
        join wsa_users.organisation as o on o.id = cmpf.organisationId and o.isDeleted = 0
        join wsa_users.affiliate as a on o.id = a.affiliateOrgId and a.isDeleted = 0
        join competitionMembershipProductType as cmpt on cmpt.id = cmpf.competitionMembershipProductTypeId and cmpt.isDeleted = 0
        join orgRegistrationMembershipProductType as ormpt on ormpt.competitionMembershipProductTypeId = cmpt.id and ormpt.isDeleted = 0
        join competitionMembershipProduct as cmp on cmp.id = cmpt.competitionMembershipProductId and cmp.isDeleted = 0
        join competition as c on cmp.competitionId = c.id and c.isDeleted = 0
        join wsa_users.affiliate as a1 on c.organisationId = a1.affiliateOrgId and a1.isDeleted = 0
        where c.competitionUniqueKey = ? and o.id = ?`, [competitionUniqueKey, organisationId]);
    }


    public async deleteRemovedAffiliateTeams(competitionId , orgString, userId){
        try{
            await this.entityManager.query(
                `update wsa_competitions.team t
                set t.isDeleted = 1, t.updatedOn = CURRENT_TIMESTAMP(), t.updatedBy = ?
              where t.competitionId = ? and t.isDeleted = 0
              and not FIND_IN_SET(t.organisationId , ?)`,[userId, competitionId, orgString] );
        }
        catch(error){
            throw error;
        }
    }

    public async updateTeamFeesForAffiliates(competitionMembershipProductTypeId , isTeamSeasonal, teamRegChargeTypeRefId, userId){
        try{
            await this.entityManager.query(
                `update competitionMembershipProductFee as cmpf
                    set cmpf.updatedOn = CURRENT_TIMESTAMP(), cmpf.updatedBy = ? ,
                    cmpf.isTeamSeasonal = ? , cmpf.teamRegChargeTypeRefId = ? 
                    where cmpf.competitionMembershipProductTypeId  = ? and cmpf.isDeleted = 0`,
                    [userId, isTeamSeasonal, teamRegChargeTypeRefId, competitionMembershipProductTypeId]);
        }
        catch(error){
            throw error;
        }
    }


}
