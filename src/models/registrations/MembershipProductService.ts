import { Service } from "typedi";
import { logger } from "../../logger";
import BaseService from "../../services/BaseService";
import { isArrayPopulated } from "../../utils/Utils";
import { MembershipProduct } from "./MembershipProduct";

@Service()
export default class MembershipProductService extends BaseService<MembershipProduct> {

    modelName(): string {
        return MembershipProduct.name;
    }

    public async findProductById(productId: string, organisationId: number): Promise<any> {
    //    await this.entityManager.query(`SET SESSION group_concat_max_len = 819200;`)

        const result = await this.entityManager.query(
            `SELECT distinct mp.membershipProductUniqueKey AS membershipProductId, (CASE WHEN (SELECT count(*) from competitionMembershipProduct 
            as cmp join membershipProduct as mp on mp.id = cmp.membershipProductId where mp.membershipProductUniqueKey = ? and mp.isDeleted = 0 
            and cmp.isDeleted = 0 and mp.organisationId = ?) = 0 THEN false ELSE true END ) AS isUsed, mp.yearRefId AS yearRefId, mp.statusRefId AS statusRefId, 
            mp.membershipProductValidityRefId AS ValidityRefId, ref_.name as year, mp.productName AS membershipProductName, ( CONCAT( '[', ( 
            SELECT CAST( GROUP_CONCAT( json_object( 'membershipProductTypeMappingId', mpm.id, 'membershipProductTypeRefId', mpm.membershipProductTypeId, 'allowTeamRegistrationTypeRefId', mpm.allowTeamRegistrationTypeRefId,
            'membershipProductTypeRefName', mpt.name, 'isPlaying',mpt.isPlaying,'isDefault',mpt.isDefault, 'dobFrom', mpm.dobFromDate, 'dobTo', mpm.dobToDate, 'isChildrenCheckNumber', mpm.isChildrenCheckNumber ) ) AS CHAR(819200)) FROM 
            membershipProductTypeMapping as mpm join membershipProduct as mp on mp.id = mpm.membershipProductId Join membershipProductType as mpt on 
            mpt.id = mpm.membershipProductTypeId and mpt.isDeleted = 0 where mp.organisationId = ? and mpm.isDeleted = 0 and mp.isDeleted = 0 and 
            mp.membershipProductUniqueKey = ?), ']' ) ) AS membershipProductTypes FROM membershipProduct as mp join wsa_common.reference as 
            ref_ on ref_.referenceGroupId = ? where mp.membershipProductUniqueKey = ? and mp.organisationId = ? and mp.isDeleted = 0 
            and ref_.sortOrder = mp.yearRefId and ref_.isDeleted = 0`, [productId, organisationId, organisationId, productId, 12, productId, organisationId]);

        for (let r of result) {
            r['membershipProductTypes'] = JSON.parse(r['membershipProductTypes']);
        }
        if (isArrayPopulated(result)) result.map(e => e.isUsed === 1 ? e.isUsed = true : e.isUsed = false)
        return result;
    }

    public async findByDummyMembershipId() {
         let query = await this.entityManager.createQueryBuilder().select().from(MembershipProduct, 'mp')
            .andWhere("mp.organisationId = 0")
            // .andWhere("mp.createdBy = :userId", { userId })
            .addSelect("mp.id")
            .getOne();
        return query.id
    
    }
    public async findProductByUniqueId(productId: string) {
        return await this.entityManager.createQueryBuilder().select().from(MembershipProduct, 'mp')
            .andWhere("mp.membershipProductUniqueKey = :productId", { productId })
            .andWhere("mp.isDeleted = 0")
            .execute();
    }

    public async getIDForDeleteProductByProductId(productId: number, organisationId: number): Promise<MembershipProduct> {
        return await this.entityManager.createQueryBuilder().select().from(MembershipProduct, 'mp')
            .andWhere("mp.id = :productId", { productId })
            .andWhere("mp.organisationId = :organisationId", { organisationId })
            .andWhere("mp.isDeleted = 0")
            .execute();
    }

   
    public async getProductsNameWithTypes(competitionID: string): Promise<any> {
      //  await this.entityManager.query(`SET SESSION group_concat_max_len = 819200`)
        const query = await this.entityManager.query(
            `select distinct mp.productName as membershipProductName, mp.membershipProductUniqueKey as membershipProductId,
            (CONCAT( '[', ( SELECT distinct CAST( GROUP_CONCAT( json_object('isPlaying', mpt.isPlaying , 'divisionName', (case when mpt.isPlaying = 0 then null else cmpd.divisionName end), 'divisionId', 
            cmpd.id, 'genderRefId', cmpd.genderRefId, 'registrationLock', 0, 'membershipProductTypeId', cmpt.id, 'membershipProductTypeName', mpt.name, 'membershipProductId', 
            mp1.membershipProductUniqueKey, 'membershipProductTypeMappingId', mpm.id,  'allowTeamRegistrationTypeRefId', mpm.allowTeamRegistrationTypeRefId, 
            'isTeamSeasonal', cmpf1.isTeamSeasonal, 'isSeasonal', cmpf1.isSeasonal, 'isCasual', cmpf1.isCasual,  'isTeamCasual', cmpf1.isTeamCasual
            ) ) AS CHAR(819200)) FROM competitionMembershipProductDivision 
            as cmpd join competitionMembershipProduct as cmp on cmp.id = cmpd.competitionMembershipProductId and cmp.isDeleted = 0 join membershipProduct 
            as mp1 on cmp.membershipProductId = mp1.id and mp1.isDeleted = 0 join membershipProductTypeMapping mpm on mpm.membershipProductId = mp1.id and 
            mpm.isDeleted = 0 join competitionMembershipProductType as cmpt on cmpt.competitionMembershipProductId = cmp.id and cmpt.isDeleted = 0 and 
            cmpt.membershipProductTypeMappingId = mpm.id join competitionMembershipProductFee cmpf1 on cmpf1.competitionMembershipProductTypeId = cmpt.id and cmpf1.isDeleted = 0
            and (cmpf1.competitionMembershipProductDivisionId = cmpd.id or cmpf1.competitionMembershipProductDivisionId is null)
            join competition as c on c.id = cmp.competitionId and c.isDeleted = 0 and c.organisationId  = cmpf1.organisationId 
            Join membershipProductType 
            as mpt on mpt.id = mpm.membershipProductTypeId and mpt.isDeleted = 0 where cmpd.isDeleted = 0 and c.competitionUniqueKey = ? and mp.id = mp1.id 
            ), ']' ) ) as membershipProductTypes from membershipProduct as mp join competitionMembershipProduct as cmp on cmp.membershipProductId = mp.id 
            and cmp.isDeleted = 0 join competition as c on c.id = cmp.competitionId and c.isDeleted = 0 where mp.isDeleted = 0 and mp.statusRefId = 2 and 
            c.competitionUniqueKey = ?`, [competitionID, competitionID]);

        for (let r of query) {
            if (r['membershipProductTypes']) {
                r['membershipProductTypes'] = JSON.parse(r['membershipProductTypes']);
                if (isArrayPopulated(r['membershipProductTypes'])) {
                    r['membershipProductTypes'].map(e => e.registrationLock === 0 ? e.registrationLock = false : e.registrationLock = true)
                    let membershipProductTypeArray = [];
                    let membTypeMap = new Map();
                    let membTypeMapTeam = new Map();
                    for(let mpt of r['membershipProductTypes']){
                        if(mpt.isPlaying == 1){
                            if((mpt.isCasual == 1 || mpt.isSeasonal == 1)){
                                let newObj = JSON.parse(JSON.stringify(mpt));
                                newObj["isIndividualRegistration"] = 1; 
                                newObj["isTeamRegistration"] = 0; 
                                newObj["registrationType"] = "Individual"; 
                                membershipProductTypeArray.push(newObj);
                            }
                            if((mpt.isTeamSeasonal == 1 || mpt.isTeamCasual == 1) && mpt.allowTeamRegistrationTypeRefId != null){
                                let newObj = JSON.parse(JSON.stringify(mpt));
                                newObj["isIndividualRegistration"] = 0; 
                                newObj["isTeamRegistration"] = 1; 
                                newObj["registrationType"] = "Team"; 
                                membershipProductTypeArray.push(newObj);
                            }
                        }
                        else{
                            if(membTypeMap.get(mpt.membershipProductTypeMappingId) == undefined){
                                if((mpt.isCasual == 1 || mpt.isSeasonal == 1)){
                                    let newObj = JSON.parse(JSON.stringify(mpt));
                                    newObj["isIndividualRegistration"] = 1; 
                                    newObj["isTeamRegistration"] = 0; 
                                    newObj["registrationType"] = "Individual"; 
                                    membershipProductTypeArray.push(newObj);
                                    membTypeMap.set(mpt.membershipProductTypeMappingId, mpt);
                                }
                               // membershipProductTypeArray.push(mpt);
                            }
                            if(membTypeMapTeam.get(mpt.membershipProductTypeMappingId) == undefined){
                                if((mpt.isTeamSeasonal == 1 || mpt.isTeamCasual == 1) && mpt.allowTeamRegistrationTypeRefId != null){
                                    let newObj = JSON.parse(JSON.stringify(mpt));
                                    newObj["isIndividualRegistration"] = 0; 
                                    newObj["isTeamRegistration"] = 1; 
                                    newObj["registrationType"] = "Team"; 
                                    membershipProductTypeArray.push(newObj);
                                    membTypeMapTeam.set(mpt.membershipProductTypeMappingId, mpt);
                                }
                            }
                        }
                    }

                    membershipProductTypeArray.map((x) => {
                        delete x.isSeasonal;
                        delete x.isCasual;
                        delete x.isTeamSeasonal;
                        delete x.isTeamCasual;
                    });

                    r['membershipProductTypes'] = membershipProductTypeArray;
                    
                }
            }
        }
        return query;
    }

    public async UpdateProductStatus(organisationId: number, membershipProductId: number, statusRefId: number): Promise<MembershipProduct> {
        return await this.entityManager.query(
            `update membershipProduct set statusRefId = ? where organisationId = ? and id = ?`, [statusRefId, organisationId, membershipProductId]
        )
    }

    public async findByOrganisationId(organisationId: number, yearRefId: number){
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
}