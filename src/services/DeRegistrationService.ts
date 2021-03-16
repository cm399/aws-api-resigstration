import { Service } from "typedi";

import BaseService from "./BaseService";
import {
    isArrayPopulated,
    isNotNullAndUndefined,
    isNullOrUndefined,
    isNullOrZero,
    paginationData,
    stringTONumber
} from "../utils/Utils";
import AppConstants from "../validation/AppConstants";
import { DeRegister } from "../models/registrations/DeRegister";

@Service()
export default class DeRegistrationService extends BaseService<DeRegister> {

    modelName(): string {
        return DeRegister.name;
    }

    public async getDeRegister(requestBody: any, registrationId: number, comptitionId: number, organisationId: number) {
        try {
            const userId = requestBody.userId ? requestBody.userId : 0;
            const teamId = requestBody.teamId ? requestBody.teamId : 0;
            const divisionId = requestBody.divisionId ? requestBody.divisionId : 0;
            const membershipMappingId = requestBody.membershipMappingId ? requestBody.membershipMappingId : 0;

            let result = await this.entityManager.query(`call wsa_registrations.usp_get_deregister(?,?,?,?,?,?,?)`, 
            [userId, registrationId, teamId, comptitionId, organisationId, divisionId, membershipMappingId])

            let finalObj = {};
            let obj = {
                competitionId: 0, 
                organisationId: 0,
                divisionId: 0, 
                membershipMappingId: 0,
                registrationId: 0, 
                userId: 0,
                firstName: null,
                lastName: null,
                organisationName: null,
                competitionName: null,
                divisionName: null,
                membershipProduct: null,
                membershipType: null,
                teamName: null,
                mobileNumber: null,
                email: null,
                membershipTypes: []
            };

            if(isArrayPopulated(result) && isArrayPopulated(result[0])){
                let records = result[0];
                let memMap = new Map();
                if(teamId!= 0 && userId == 0){
                    let record = records.find(x=>x);
                    finalObj = Object.assign(obj, record);
                }
                else{
                    if(records && records.length == 1){
                        let record = records.find(x=>x);
                        finalObj = Object.assign(obj, record);
                    }
                    else{
                        for(let item of records){
                            let memTemp = memMap.get(item.membershipMappingId)
                            let memObj = {
                                membershipMappingId: item.membershipMappingId,
                                membershipProduct: item.membershipProduct,
                                membershipType: item.membershipType
                            }
                            if(memTemp == undefined){
                                obj.membershipTypes.push(memObj);
                                memMap.set(item.membershipMappingId, memObj);
                                obj = Object.assign(obj, item);
                            }
                            else{
                                obj.membershipTypes.push(memObj);
                            }
                        }

                        finalObj = Object.assign(finalObj, obj);
                    }
                }
            }

          /*  if (isArrayPopulated(result) && isArrayPopulated(result[0])) {
                let userMap = new Map();
                let orgMap = new Map();
                let compMap = new Map();
                let memMap = new Map();
                let divMap = new Map();
                let teamMap = new Map();
                let tTeamMap = new Map();

                for (let item of result[0]) {
                    let key = item.userId;
                    let tKey = item.teamId;
                    let orgKey = key + "#" + item.organisationUniqueKey;
                    let compKey = orgKey + "#" + item.competitionUniqueKey;
                    let memKey = compKey + "#" + item.membershipProductTypeMappingId;
                    let teamKey = memKey + "#" + item.teamId;
                    let divKey = memKey + "#" + item.divisionId;

                    let userTemp = userMap.get(key);
                    let tTeamTemp = tTeamMap.get(tKey);

                    let orgObj = {
                        organisationId: item.organisationUniqueKey,
                        organisationName: item.organisationName,
                        competitions: []
                    }

                    let compObj = {
                        competitionId: item.competitionUniqueKey,
                        competitionName: item.compititionName,
                        membershipTypes: []
                    }

                    let memberObj = {
                        membershipMappingId: item.membershipProductTypeMappingId,
                        typeName: item.typeName,
                        productName: item.productName,
                        registrationId: item.registrationId,
                        teams: [],
                        divisions: []
                    }

                    let teamObj = {
                        registrationId: item.registrationId,
                        teamId: item.teamId,
                        teamName: item.teamName
                    }

                    let divisionObj = {
                        registrationId: item.registrationId,
                        divisionId: item.divisionId,
                        divisionName: item.divisionName
                    }

                    if (item.teamMembers) {
                        item.teamMembers = JSON.parse(item.teamMembers)
                    }

                    if (item.teamId != null) {
                        if (isArrayPopulated(item.teamMembers)) {
                            if (tTeamTemp == undefined) {
                                let teamMainObj = {
                                    userId: item.teamId,
                                    userName: item.teamName,
                                    mobileNumber: item.mobileNumber,
                                    email: item.email,
                                    isTeam: 1,
                                    organisations: [],
                                    teamMembers: []
                                }
                                // teamObj.organisations.push(orgObj);
                                teamMainObj.teamMembers.push(...item.teamMembers)
                                if (item.teamId != null) {
                                    memberObj.teams.push(teamObj);
                                    teamMap.set(teamKey, teamObj);
                                }
                                if (!isNullOrZero(item.divisionId)) {
                                    memberObj.divisions.push(divisionObj);
                                    divMap.set(divKey, divisionObj);
                                }
                                if (item.typeName != null)
                                    compObj.membershipTypes.push(memberObj);
                                orgObj.competitions.push(compObj);
                                teamMainObj.organisations.push(orgObj);

                                tTeamMap.set(tKey, teamMainObj);
                                orgMap.set(orgKey, orgObj);
                                compMap.set(compKey, compObj);
                                memMap.set(memKey, memberObj);

                                arr.push(teamMainObj);
                            } else {
                                let orgTemp = orgMap.get(orgKey);
                                if (orgTemp == undefined) {
                                    tTeamTemp.organisations.push(orgObj);

                                    if (item.teamId != null) {
                                        memberObj.teams.push(teamObj);
                                        teamMap.set(teamKey, teamObj);
                                    }

                                    if (!isNullOrZero(item.divisionId)) {
                                        memberObj.divisions.push(divisionObj);
                                        divMap.set(divKey, divisionObj);
                                    }
                                    if (item.typeName != null)
                                        compObj.membershipTypes.push(memberObj);
                                    orgObj.competitions.push(compObj);
                                    orgMap.set(orgKey, orgObj);
                                    compMap.set(compKey, compObj);
                                    memMap.set(memKey, memberObj);
                                } else {
                                    let compTemp = compMap.get(compKey);

                                    if (compTemp == undefined) {
                                        orgTemp.competitions.push(compObj);

                                        if (item.teamId != null) {
                                            memberObj.teams.push(teamObj);
                                            teamMap.set(teamKey, teamObj);
                                        }
                                        if (!isNullOrZero(item.divisionId)) {
                                            memberObj.divisions.push(divisionObj);
                                            divMap.set(divKey, divisionObj);
                                        }
                                        if (item.typeName != null)
                                            compObj.membershipTypes.push(memberObj);
                                        compMap.set(compKey, compObj);
                                        memMap.set(memKey, memberObj);
                                    } else {
                                        let memTemp = memMap.get(memKey);
                                        if (memTemp == undefined) {
                                            if (item.teamId != null) {
                                                memberObj.teams.push(teamObj);
                                                teamMap.set(teamKey, teamObj);
                                            }
                                            if (!isNullOrZero(item.divisionId)) {
                                                memberObj.divisions.push(divisionObj);
                                                divMap.set(divKey, divisionObj);
                                            }
                                            if (item.typeName != null)
                                                compTemp.membershipTypes.push(memberObj);
                                            memMap.set(memKey, memberObj);
                                        } else {
                                            if (item.teamId != null) {
                                                if (teamMap.get(teamKey) == undefined) {
                                                    memTemp.teams.push(teamObj);
                                                    teamMap.set(teamKey, teamObj);
                                                }
                                            }
                                            if (!isNullOrZero(item.divisionId)) {
                                                if (divMap.get(divKey) == undefined) {
                                                    memTemp.divisions.push(divisionObj);
                                                    divMap.set(divKey, divisionObj)
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    } else {
                        if (userTemp == undefined) {
                            let userObj = {
                                userId: item.userId,
                                userName: item.userName,
                                mobileNumber: item.mobileNumber,
                                email: item.email,
                                organisations: [],
                                isTeam: 0
                            }

                            if (item.teamId != null) {
                                memberObj.teams.push(teamObj);
                                teamMap.set(teamKey, teamObj);
                            }
                            if (!isNullOrZero(item.divisionId)) {
                                memberObj.divisions.push(divisionObj);
                                divMap.set(divKey, divisionObj);
                            }
                            if (item.typeName != null)
                                compObj.membershipTypes.push(memberObj);
                            orgObj.competitions.push(compObj);
                            userObj.organisations.push(orgObj);

                            userMap.set(key, userObj);
                            orgMap.set(orgKey, orgObj);
                            compMap.set(compKey, compObj);
                            memMap.set(memKey, memberObj);

                            arr.push(userObj);
                            // arr = [...arr, ...teamArr]
                        } else {
                            let orgTemp = orgMap.get(orgKey);
                            if (orgTemp == undefined) {
                                userTemp.organisations.push(orgObj);

                                if (item.teamId != null) {
                                    memberObj.teams.push(teamObj);
                                    teamMap.set(teamKey, teamObj);
                                }

                                if (!isNullOrZero(item.divisionId)) {
                                    memberObj.divisions.push(divisionObj);
                                    divMap.set(divKey, divisionObj);
                                }
                                if (item.typeName != null)
                                    compObj.membershipTypes.push(memberObj);
                                orgObj.competitions.push(compObj);
                                orgMap.set(orgKey, orgObj);
                                compMap.set(compKey, compObj);
                                memMap.set(memKey, memberObj);
                            } else {
                                let compTemp = compMap.get(compKey);

                                if (compTemp == undefined) {
                                    orgTemp.competitions.push(compObj);

                                    if (item.teamId != null) {
                                        memberObj.teams.push(teamObj);
                                        teamMap.set(teamKey, teamObj);
                                    }
                                    if (!isNullOrZero(item.divisionId)) {
                                        memberObj.divisions.push(divisionObj);
                                        divMap.set(divKey, divisionObj);
                                    }
                                    if (item.typeName != null)
                                        compObj.membershipTypes.push(memberObj);
                                    compMap.set(compKey, compObj);
                                    memMap.set(memKey, memberObj);
                                } else {
                                    let memTemp = memMap.get(memKey);
                                    if (memTemp == undefined) {
                                        if (item.teamId != null) {
                                            memberObj.teams.push(teamObj);
                                            teamMap.set(teamKey, teamObj);
                                        }
                                        if (!isNullOrZero(item.divisionId)) {
                                            memberObj.divisions.push(divisionObj);
                                            divMap.set(divKey, divisionObj);
                                        }
                                        if (item.typeName != null)
                                            compTemp.membershipTypes.push(memberObj);
                                        memMap.set(memKey, memberObj);
                                    } else {
                                        if (item.teamId != null) {
                                            if (teamMap.get(teamKey) == undefined) {
                                                memTemp.teams.push(teamObj);
                                                teamMap.set(teamKey, teamObj);
                                            }
                                        }
                                        if (!isNullOrZero(item.divisionId)) {
                                            if (divMap.get(divKey) == undefined) {
                                                memTemp.divisions.push(divisionObj);
                                                divMap.set(divKey, divisionObj)
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            } */
            return finalObj;
        } catch (error) {
            throw error;
        }
    }

    public async getDeRegisterOrgRegistrationIds(competitonId: number, requestBody: any): Promise<any> {
        try {
            let userId = requestBody.userId;
            let membershipMappingId = requestBody.membershipMappingId;
            let teamId = isNullOrUndefined(requestBody.teamId) ? requestBody.teamId : -1;

            let result = await this.entityManager.query(`
            select distinct org.id as orgRegistrationId from wsa_registrations.orgRegistration org 
            inner join wsa_registrations.orgRegistrationParticipant orp 
                    on orp.orgRegistrationId = org.id and orp.isDeleted = 0
            inner join wsa_registrations.userRegistration ur 
                on ur.id = orp.userRegistrationId and ur.isDeleted = 0
            left join wsa_competitions.team t 
                    on t.id = ur.teamId and t.isDeleted = 0
            left join wsa_competitions.player p 
                on p.userId = ur.userId and p.competitionId = org.competitionId and p.organisationId = org.organisationId 
                and p.isDeleted = 0
            left join wsa_competitions.nonPlayer np 
                on np.userId = ur.userId and np.competitionId = org.competitionId and np.organisationId = org.organisationId and 
                np.isDeleted = 0
            left join wsa_registrations.competitionMembershipProductType cmpt 
                on cmpt.id = np.competitionMembershipProductTypeId or cmpt.id =  np.competitionMembershipProductTypeId
                and cmpt.isDeleted = 0
            where ur.userId = ? and org.competitionId = ? and cmpt.membershipProductTypeMappingId = ?
            and case when ? = -1 then 1 else t.id = ? end`,
                [userId, competitonId, membershipMappingId, teamId, teamId]);

            return result;
        } catch (error) {
            throw error;
        }
    }

    public async getExistingDeRegister(competitionId: number, organisationId: number, requestBody: any, registrationId: number) {
        try {
            let membershipMappingId = requestBody.membershipMappingId;
            let userId = requestBody.userId;
            let divisionId = isNullOrUndefined(requestBody.divisionId) ? requestBody.divisionId : -1;
            let team = isNullOrUndefined(requestBody.teamId) ? requestBody.teamId : -1;
            let result = await this.entityManager.query(`select * from wsa_registrations.deRegister 
                where competitionId = ? and organisationId = ? and membershipMappingId = ?
            and userId = ? and (case when ? = -1 then 1 else teamId = ? end) and 
            (case when ? = -1 then 1 else divisionId = ? end) and registrationId = ? and isDeleted = 0`,
                [competitionId, organisationId, membershipMappingId, userId, team, team, divisionId, divisionId, registrationId]);

            return result;
        } catch (error) {
            throw error;
        }

    }

    public async getRegistrationDashboard(
        organisationId: number,
        requestBody: any,
        sortBy: string = undefined,
        sortOrder: 'ASC' | 'DESC' = undefined
    ): Promise<any> {
        try {
            let limit = requestBody.paging.limit;
            let offset = requestBody.paging.offset;
            let yearRefId = requestBody.yearRefId;
            let competitionId = requestBody.competitionId;
            let regChangeTypeRefId = requestBody.regChangeTypeRefId;
            let result = await this.entityManager.query(
                `call wsa_registrations.usp_registration_change_dashboard(?,?,?,?,?,?,?,?)`,
                [organisationId, yearRefId, competitionId, regChangeTypeRefId, limit, offset, sortBy, sortOrder]
            );
            let responseObject;
            if (result != null) {
                let totalCount = result[0].find(x => x).totalCount;
                responseObject = paginationData(stringTONumber(totalCount), limit, offset);
                if (isArrayPopulated(result[1])) {
                    // let transactions = isArrayEmpty(result[3]) ? result[3] : [];
                    result[1].map((x) => {
                        // x.affiliateApproved = (isNullOrUndefined(x.affiliateApproved) && x.affiliateApproved != "N/A") ? JSON.parse(x.affiliateApproved.toString()) : null;
                        // x.compOrganiserApproved = (isNullOrUndefined(x.compOrganiserApproved) && x.compOrganiserApproved != "N/A") ? JSON.parse(x.compOrganiserApproved.toString()) : null;
                        // x.stateApproved = isNullOrUndefined(x.stateApproved) && x.stateApproved != "N/A" ? JSON.parse(x.stateApproved.toString()) : null;

                        // x.compOrgApprovedStatus = isNullOrUndefined(x.compOrgApprovedStatus) ? Number(x.compOrgApprovedStatus) : null;
                        // x.affiliateApprovedStatus = isNullOrUndefined(x.affiliateApprovedStatus) ? Number(x.affiliateApprovedStatus) : null;
                        // x.stateApprovedStatus = isNullOrUndefined(x.stateApprovedStatus) ? Number(x.stateApprovedStatus) : null;
                        // let compOrg = transactions.find(y => y.id == x.id && y.feeType == "competition");
                        // let affOrg = transactions.find(y => y.id == x.id && y.feeType == "affiliate");
                        // let stateOrg = transactions.find(y => y.id == x.id && y.feeType == "membership");
                        // if (!isNullOrUndefined(affOrg)) {
                        //     x.affiliateApproved = "N/A"
                        // } else if (!isNullOrUndefined(x.affiliateApproved)) {
                        //     x.affiliateApproved = "P"
                        // } else {
                        //     x.affiliateApproved = JSON.parse(x.affiliateApproved.toString())
                        // }

                        // if (!isNullOrUndefined(compOrg) || x.affiliateApprovedStatus == 3) {
                        //     x.compOrganiserApproved = "N/A"
                        // } else if (!isNullOrUndefined(x.compOrganiserApproved)) {
                        //     x.compOrganiserApproved = "P"
                        // } else {
                        //     x.compOrganiserApproved = JSON.parse(x.compOrganiserApproved.toString())
                        // }

                        // if (!isNullOrUndefined(stateOrg)) {
                        //     x.stateApproved = "N/A"
                        // } else if (x.affiliateApprovedStatus == 3 || x.compOrgApprovedStatus == 3) {
                        //     if (x.affiliateApprovedStatus == 1 && x.compOrgApprovedStatus == 3) {
                        //         if (!isNullOrUndefined(x.stateApproved)) {
                        //             x.stateApproved = "P"
                        //         } else if (x.stateApprovedStatus == 3 || x.stateApprovedStatus == 1 || x.stateApprovedStatus == 2) {
                        //             x.stateApproved = JSON.parse(x.stateApproved.toString())
                        //         } else {
                        //             x.stateApproved = "N/A"
                        //         }
                        //     } else if (x.stateApprovedStatus == 3) {
                        //         x.stateApproved = JSON.parse(x.stateApproved.toString())
                        //     } else {
                        //         x.stateApproved = "N/A"
                        //     }
                        // } else if (!isNullOrUndefined(x.stateApproved)) {
                        //     x.stateApproved = "P"
                        // } else {
                        //     x.stateApproved = JSON.parse(x.stateApproved.toString())
                        // }

                        if (isArrayPopulated(x.statusTrackData)) {
                            let affOrgData = x.statusTrackData.find(y => y.regChangeTypeRefId == 1 && y.orgRefTypeId == 1);
                            if (isNotNullAndUndefined(affOrgData)) {
                                if (affOrgData.statusRefId == 0) {
                                    x["affiliateApproved"] = "P"
                                } else if (affOrgData.statusRefId == -1 || affOrgData.affiliateApproved == -1) {
                                    x["affiliateApproved"] = "N/A";
                                } else {
                                    x["affiliateApprovedStatus"] = affOrgData.statusRefId;
                                }
                            } else {
                                x["affiliateApproved"] = "N/A";
                            }

                            let compOrgData = x.statusTrackData.find(y => y.regChangeTypeRefId == 1 && y.orgRefTypeId == 2);
                            if (isNotNullAndUndefined(compOrgData)) {
                                if (compOrgData.statusRefId == 0) {
                                    x["compOrganiserApproved"] = "P";
                                } else if (compOrgData.statusRefId == -1) {
                                    x["compOrganiserApproved"] = "N/A";
                                } else {
                                    x["compOrgApprovedStatus"] = compOrgData.statusRefId;
                                }
                            } else {
                                x["compOrganiserApproved"] = "N/A";
                            }

                            let statetOrgData = x.statusTrackData.find(y => y.regChangeTypeRefId == 1 && y.orgRefTypeId == 3);
                            if (isNotNullAndUndefined(statetOrgData)) {
                                if (statetOrgData.statusRefId == 0) {
                                    x["stateApproved"] = "P"
                                } else if (statetOrgData.statusRefId == -1) {
                                    x["stateApproved"] = "N/A"
                                } else {
                                    x["stateApprovedStatus"] = statetOrgData.statusRefId;
                                }
                            } else {
                                x["stateApproved"] = "N/A";
                            }
                        }

                        if (x.regChangeTypeRefId == AppConstants.TRANSFER) {
                            x["tCompOrgApproved"] = "";
                            x["tAffApproved"] = "";
                            x["tCompOrgStatus"] = 0;
                            x["tAffStatus"] = 0;
                            if (isArrayPopulated(x.statusTrackData)) {
                                let compOrgData = x.statusTrackData.find(y => y.regChangeTypeRefId == 2 && y.orgRefTypeId == 11);
                                if (isNullOrUndefined(compOrgData)) {
                                    if (compOrgData.statusRefId == 0) {
                                        x["tCompOrgApproved"] = "P";
                                    } else if (compOrgData.statusRefId == -1) {
                                        x["tCompOrgApproved"] = "N/A";
                                    } else {
                                        x["tCompOrgStatus"] = compOrgData.statusRefId;
                                    }
                                } else {
                                    x["tCompOrgApproved"] = "N/A";
                                }

                                let affData = x.statusTrackData.find(y => y.regChangeTypeRefId == 2 && y.orgRefTypeId == 12);
                                if (isNullOrUndefined(affData)) {
                                    if (affData.statusRefId == 0) {
                                        x["tAffApproved"] = "P";
                                    } else if (affData.statusRefId == -1) {
                                        x["tAffApproved"] = "N/A";
                                    } else {
                                        x["tAffStatus"] = affData.statusRefId;
                                    }
                                } else {
                                    x["tAffApproved"] = "N/A";
                                }
                            }
                        }
                    })
                    responseObject["registrationChanges"] = result[1];
                }

                if (isArrayPopulated(result[2])) {
                    responseObject["competitions"] = result[2];
                }
            }

            return responseObject;
        } catch (error) {
            throw error;
        }
    }

    public async getRegistrationChangeReview(organisationId: number, requestBody: any): Promise<any> {
        try {
            let deRegisterId = requestBody.deRegisterId;
            let result = await this.entityManager.query(
                `call wsa_registrations.usp_registration_change_review(?,?)`,
                [organisationId, deRegisterId]
            );
            let response = null;
            if (isArrayPopulated(result) && isArrayPopulated(result[0])) {
                result[0].map((x) => {
                    if (isNullOrUndefined(x.approvals)) {
                        x.approvals = JSON.parse(x.approvals);
                    }

                    if (isNullOrUndefined(x.invoices)) {
                        x.invoices = JSON.parse(x.invoices);
                    }
                });

                for (let item of result[0]) {
                    let isShowButton = 0;
                    let approvals = [];
                    item["isShowButton"] = 0;
                    if (isArrayPopulated(item.approvals)) {
                        approvals = item.approvals;
                    }

                    if (isArrayPopulated(item.statusTrackData)) {
                        let orgStatusTrackData = item.statusTrackData.filter(x => x.orgId == organisationId && x.feeType != null);
                        if (isArrayPopulated(orgStatusTrackData)) {
                            let arr = [];
                            if (isArrayPopulated(item.invoices)) {
                                for (let inv of item.invoices) {
                                    let obj = orgStatusTrackData.find(x => x.feeType == inv.feeType);
                                    if (obj) {
                                        arr.push(inv);
                                    }
                                }
                            }

                            item.invoices = arr;
                        }

                        item.statusTrackData.sort((a, b) => (a.orgRefTypeId > b.orgRefTypeId) ? 1 : -1);
                        let statusTrackData = item.statusTrackData.filter(x => x.regChangeTypeRefId == 1);

                        // statusTrackData.sort((a, b) => (a.orgRefTypeId > b.orgRefTypeId) ? 1 : -1);
                        // let declinedApproval = isArrayEmpty(approvals) ? approvals.find(x => x.refundTypeRefId == AppConstants.DECLINED) : null;
                        let firstDeclinedStatus = null;
                        let declinedApproval = null;
                        if (item.regChangeTypeRefId == AppConstants.TRANSFER) {
                            if (isArrayPopulated(statusTrackData)) {
                                declinedApproval = statusTrackData.find(x => x.statusRefId == AppConstants.DECLINED);
                            }
                        } else {
                            declinedApproval = isArrayPopulated(statusTrackData) ? (statusTrackData[0].statusRefId == AppConstants.DECLINED ? statusTrackData[0] : null) : null;
                        }

                        if (isNullOrUndefined(declinedApproval)) {
                            firstDeclinedStatus = AppConstants.DECLINED;
                        }

                        for (let tr of statusTrackData) {
                            if (tr.statusRefId == 0) {
                                if (tr.orgId == organisationId && firstDeclinedStatus != AppConstants.DECLINED) {
                                    isShowButton = 1;
                                    item["orgRefTypeId"] = tr.orgRefTypeId;
                                } else {
                                    isShowButton = 0;
                                }
                                item["isShowButton"] = isShowButton;
                                break;
                            }
                        }
                    }
                    if (item.regChangeTypeRefId == AppConstants.TRANSFER) {
                        if (isArrayPopulated(item.statusTrackData)) {
                            let statusTrackFilter = item.statusTrackData.find(x => x.regChangeTypeRefId == 1 && x.statusRefId == 0);
                            if (!isNullOrUndefined(statusTrackFilter)) {
                                let statusTrackFilter = item.statusTrackData.find(x => x.regChangeTypeRefId == 2 && x.statusRefId == 0 && x.orgId == organisationId);
                                if (isNullOrUndefined(statusTrackFilter)) {
                                    item["isShowButton"] = 2;
                                    item["orgRefTypeId"] = statusTrackFilter.orgRefTypeId;
                                }
                            }
                        }
                    }
                }

                response = result[0].find(x => x);
            }

            return response;
        } catch (error) {
            throw error;
        }
    }

    public async getTransactionData(competitionId: number, membershipMappingId: number, organisationId: number, userId: number): Promise<any> {
        try {
            let result = await this.entityManager.query(`select case when t2.feeType = 'membership' then 3 
                        when t2.feeType = 'competition' then 1 else 2 end as orgRefTypeId,
                        COALESCE(sum(COALESCE(t2.feeAmount,0) + COALESCE(t2.gstAmount,0) - 
                        coalesce(t2.discountAmount, 0) - coalesce(t2.familyDiscountAmount, 0)),0) as fee
                                    from wsa_registrations.transactions t2 
                                    where t2.competitionId = ? 
                        and t2.membershipProductMappingId = ? and t2.isDeleted = 0
                        and t2.organisationId = ? and t2.participantId = ?
                        group by t2.feeType`, [competitionId, membershipMappingId, organisationId, userId])

            return result;
        } catch (error) {
            throw error;
        }
    }

    public async deletePlayer(userId: number, userRegistrationId: number, divisionId: number, updatedBy: number): Promise<any> {
        try {
            await this.entityManager.query(`Update wsa_competitions.player set isDeleted = 1, 
            updatedBy = ?, updatedOn = ? where userRegistrationId = ? and userId = ?
            and competitionDivisionId = ? and isDeleted = 0`,
                [updatedBy, new Date(), userRegistrationId, userId, divisionId])
        } catch (error) {
            throw error;
        }
    }

    public async deleteNonPlayer(userId: number, userRegistrationId: number, membershipProductMappingId: number, updatedBy: number, competitionId: number): Promise<any> {
        try {
            let compMembershipProductType = await this.getCompMembershipProductTypeId(membershipProductMappingId, competitionId);
            let compMembershipProductTypeId = 0;
            if (isArrayPopulated(compMembershipProductType)) {
                compMembershipProductTypeId = compMembershipProductType[0].id;
            }
            await this.entityManager.query(`Update wsa_competitions.nonPlayer set isDeleted = 1, 
            updatedBy = ?, updatedOn = ? where userRegistrationId = ? and userId = ?
            and competitionMembershipProductTypeId = ? and isDeleted = 0`,
                [updatedBy, new Date(), userRegistrationId, userId, compMembershipProductTypeId])
        } catch (error) {
            throw error;
        }
    }
    public async updateLivescorePlayerStatus(userId: number, userRegistrationId: number, divisionId: number, updatedBy: number): Promise<any> {
        try {
            console.log('updateLivescorePlayerStatus-  userRegistrationId :: '+ userRegistrationId +' USERID ' +userId + ' divisionId ' + divisionId)
            await this.entityManager.query(`Update wsa.player p1
            inner join  wsa_competitions.player p
                on p.id = p1.sourcePlayerId and p.isDeleted = 0
            set  p1.deleted_at = ?
            where p.userRegistrationId = ? and p.userId = ?
            and p.competitionDivisionId = ? and p1.deleted_at is null`,
                [ new Date(), userRegistrationId, userId, divisionId])
        } catch (error) {
            throw error;
        }
    }

    public async updatePlayerStatus(userId: number, userRegistrationId: number, divisionId: number, updatedBy: number): Promise<any> {
        try {
            await this.entityManager.query(`Update wsa_competitions.player set statusRefId = 3, 
            updatedBy = ?, updatedOn = ? where userRegistrationId = ? and userId = ?
            and competitionDivisionId = ? and isDeleted = 0`,
                [updatedBy, new Date(), userRegistrationId, userId, divisionId])
        } catch (error) {
            throw error;
        }
    }

    public async updateNonPlayerStatus(userId: number, userRegistrationId: number, membershipProductMappingId: number, updatedBy: number, competitionId: number): Promise<any> {
        try {
            let compMembershipProductType = await this.getCompMembershipProductTypeId(membershipProductMappingId, competitionId);
            let compMembershipProductTypeId = 0;
            if (isArrayPopulated(compMembershipProductType)) {
                compMembershipProductTypeId = compMembershipProductType[0].id;
            }
            console.log('cmptId :'+compMembershipProductTypeId)
            await this.entityManager.query(`Update wsa_competitions.nonPlayer set statusRefId = 3, 
            updatedBy = ?, updatedOn = ? where userRegistrationId = ? and userId = ?
            and competitionMembershipProductTypeId = ? and isDeleted = 0`,
                [updatedBy, new Date(), userRegistrationId, userId, compMembershipProductTypeId])

            await this.entityManager.query(`Update wsa_users.userRoleEntity set statusRefId = 3, 
            updatedBy = ?, updatedOn = ? where entitytypeId = 1 and userId = ?
            and entityId = ? and isDeleted = 0`,
                [updatedBy, new Date(),  userId, competitionId])

            await this.entityManager.query(`Update wsa_users.userRoleEntity ure
            inner join wsa_competitions.nonPlayer np 
                on ure.userId = np.userId and np.userRegistrationId = ? and np.isDeleted = 0 
            inner join wsa_registrations.competition c
                on np.competitionId = c.id and c.isDeleted = 0
            inner join wsa.competition cl
                on cl.uniqueKey = c.competitionUniqueKey and cl.deleted_at is null
            inner join wsa.competitionOrganisation co 
                on co.competitionId = cl.id and co.orgId = np.organisationId and ure.entityId = co.id and co.deleted_at is null
            set ure.statusRefId = 3,  ure.updatedBy = ?, ure.updatedOn = ? 
            where ure.entitytypeId = 6 and ure.userId = ? and c.id = ?  and ure.isDeleted = 0`,
                [userRegistrationId, updatedBy, new Date(),  userId, competitionId])

        } catch (error) {
            throw error;
        }
    }

    public async checkUserRegistrationExists(userRegistrationId: number): Promise<any> {
        try {
            let result = await this.entityManager.query(`
            select id from wsa_competitions.nonPlayer np where userRegistrationId = ? and isDeleted = 0 
            UNION select id from wsa_competitions.player p where userRegistrationId = ? and isDeleted = 0`
                , [userRegistrationId, userRegistrationId]);
            return result;
        } catch (error) {
            throw error;
        }
    }

    public async deleteUserRegistration(userRegistrationId: number, updatedBy: number, competitionId: number, userId: number): Promise<any> {
        try {
            let isExists = await this.checkUserRegistrationExists(userRegistrationId);
            if (!isArrayPopulated(isExists)) {
                await this.entityManager.query(`update wsa_registrations.userRegistration 
                set isDeleted = 1, updatedBy = ?, updatedOn = ? where id = ? `,
                    [updatedBy, new Date(), userRegistrationId]);

                await this.deleteUserRoleEntity(userId, competitionId, updatedBy);
            }
        } catch (error) {
            throw error;
        }
    }

    public async deleteUserRoleEntity(userId, competitionId: number, updatedBy: number): Promise<any> {
        try {
            await this.entityManager.query(`update wsa_users.userRoleEntity set isDeleted = 1, updatedBy = ?,
            updatedOn = ? where userId = ? and entityId = ? `, [updatedBy, new Date(), userId, competitionId]);
        } catch (error) {
            throw error;
        }
    }

    public async deleteTransaction(invoiceId: number, userId: number, competitionId: number, membershipProductMappingId: number,
                                   feeType: string, updatedBy: number, divisionId: number): Promise<any> {
        try {
            let result = null;
            if (divisionId = 0) {
                result = await this.entityManager.query(`update wsa_registrations.transactions t 
                set isDeleted = 1, updatedBy = ?, updatedOn = ?
                where invoiceId = ?  and participantId = ? and membershipProductMappingId = ?
                and competitionId = ? and isDeleted = 0 `,
                    [updatedBy, new Date(), invoiceId, userId, membershipProductMappingId, feeType, competitionId]);
            } else {
                result = await this.entityManager.query(`update wsa_registrations.transactions t 
                set isDeleted = 1, updatedBy = ?, updatedOn = ?
                where invoiceId = ?  and participantId = ? and membershipProductMappingId = ?
                and competitionId = ? and isDeleted = 0 and t.divisionId = ?  `,
                    [updatedBy, new Date(), invoiceId, userId, membershipProductMappingId, feeType, competitionId, divisionId]);
            }

            return result;
        } catch (error) {

        }
    }

    public async deleteInstalmetnTransaction(invoiceId: number, userId: number,
                                             competitionId: number, membershipProductMappingId: number, feeType: string,
                                             updatedBy: number, divisionId: number): Promise<any> {
        try {
            let result = null;
            if (divisionId == 0) {
                result = await this.entityManager.query(`update wsa_registrations.transactions 
                set isDeleted = 1, updatedBy = ?, updatedOn = ?
                where invoiceRefId = ?  and participantId = ? and membershipProductMappingId = ?
                and competitionId = ? and feeType = ? and isDeleted = 0 and instalmentDate is not null and statusRefId = 1`,
                    [updatedBy, new Date(), invoiceId, userId, membershipProductMappingId, competitionId, feeType]);
            } else {
                result = await this.entityManager.query(`update wsa_registrations.transactions
                set isDeleted = 1, updatedBy = ?, updatedOn = ?
                where invoiceRefId = ?  and participantId = ? and membershipProductMappingId = ?
                and competitionId = ? and isDeleted = 0 and divisionId = ? and feeType = ?  and instalmentDate is not null and statusRefId = 1`,
                    [updatedBy, new Date(), invoiceId, userId, membershipProductMappingId, competitionId, divisionId, feeType]);
            }

            return result;
        } catch (error) {

        }
    }

    private async getCompMembershipProductTypeId(membershipMappingId: number, competitionId: number): Promise<any> {
        try {
            let query = await this.entityManager.query(`select cmpt.* from wsa_registrations.competitionMembershipProductType cmpt 
            inner join wsa_registrations.competitionMembershipProduct cmp 
                on cmp.id = cmpt.competitionMembershipProductId and cmp.isDeleted = 0
            inner join wsa_registrations.membershipProductTypeMapping mptm 
                on mptm.membershipProductId = cmp.membershipProductId and mptm.isDeleted = 0
                and cmpt.membershipProductTypeMappingId = mptm.id
            where mptm.id = ? and cmp.competitionId = ? and cmpt.isDeleted = 0 `,
                [membershipMappingId, competitionId]);
            return query;
        } catch (error) {
            throw error;
        }
    }

    public async getTransferCompetitions(requestBody: any, competitionId: number): Promise<any> {
        try {
            let arr = [];
            let membershipMappingId = requestBody.membershipMappingId;
            let result = await this.entityManager.query(`
                    select DISTINCT c.competitionUniqueKey, c.name, o.organisationUniqueKey as organisationId, 
                    o.name as organisationName
                    from wsa_registrations.competition c 
                    inner join wsa_registrations.orgRegistration org 
                        on org.competitionId = c.id and org.isDeleted = 0
                    inner join wsa_registrations.competitionMembershipProduct cmp 
                        on cmp.competitionId = org.competitionId and cmp.isDeleted = 0
                    inner join wsa_registrations.competitionMembershipProductType cmpt 
                        on cmpt.competitionMembershipProductId = cmp.id and cmpt.isDeleted = 0
                    inner join wsa_users.organisation o 
                        on o.id = org.organisationId and o.isDeleted = 0
                    where cmpt.membershipProductTypeMappingId = ? and org.statusRefId = 2 and c.hasRegistration = 1 and c.id <> ?`,
                [membershipMappingId, competitionId]);

            if (isArrayPopulated(result)) {
                let orgMap = new Map();
                for (let item of result) {
                    let key = item.organisationId;
                    let orgTemp = orgMap.get(key);
                    let compObj = {
                        competitionId: item.competitionUniqueKey,
                        competitionName: item.name
                    }
                    if (orgTemp == undefined) {
                        let obj = {
                            organisationId: item.organisationId,
                            organisationName: item.organisationName,
                            competitions: []
                        }
                        obj.competitions.push(compObj);
                        orgMap.set(key, obj);
                        arr.push(obj)
                    } else {
                        orgTemp.competitions.push(compObj);
                    }
                }
            }
            return arr;
        } catch (error) {
            throw error;
        }
    }

    public async getDeRegisterTransactionData(deRegister: DeRegister, divisionId: number, membershipProdDivisionId: number): Promise<any> {
        try {
            let result = await this.entityManager.query(`select t.feeType,
                        case when t.feeType = 'membership' then 3 
                            when t.feeType = 'competition' then 2 
                            when t.feeType = 'nomination' then 4 
                            else 1 end as orgRefTypeId,
                            o.organisationUniqueKey, o.id as orgId
                    from wsa_registrations.transactions t 
                    inner join wsa_registrations.invoice iv 
                        on  (iv.id = t.invoiceId or iv.id = t.invoiceRefId) and iv.registrationId = ? and iv.isDeleted = 0 
                    inner join wsa_users.organisation o 
                                on o.id = t.organisationId and o.isDeleted = 0
                    where t.competitionId = ? and t.participantId = ? and t.membershipProductMappingId = ?
                        and ((t.divisionId is null or t.divisionId = 0)  
                        or (case when t.statusRefId = 1  then t.divisionId = ? else t.divisionId = ? end)) 
                        and t.transactionTypeRefId = 2
                        and t.isDeleted = 0
                    group by  t.feeType, t.organisationId 
                    union
                    select t.feeType,
                        case when t.feeType = 'membership' then 3 
                            when t.feeType = 'competition' then 2 
                            when t.feeType = 'nomination' then 4 
                            else 1 end as orgRefTypeId,
                            o.organisationUniqueKey, o.id as orgId
                    from wsa_registrations.transactions t 
                    inner join wsa_registrations.invoice iv 
                        on  (iv.id = t.invoiceRefId) and iv.registrationId = ? and iv.isDeleted = 0 
                    inner join wsa_users.organisation o 
                                on o.id = t.organisationId and o.isDeleted = 0
                    where t.competitionId = ? and t.participantId = ? and t.membershipProductMappingId = ?
                        and ((t.divisionId is null or t.divisionId = 0)  or t.divisionId = ? )
                        and t.isDeleted = 0  and t.instalmentDate is not null and t.statusRefId = 1
                    group by  t.feeType, t.organisationId `,
                [deRegister.registrationId, deRegister.competitionId, deRegister.userId, deRegister.membershipMappingId, membershipProdDivisionId,
                    divisionId, deRegister.registrationId, deRegister.competitionId, deRegister.userId, deRegister.membershipMappingId,
                    membershipProdDivisionId
                ])

                console.log(`result ${result}`);
            return result;
        } catch (error) {
            throw error;
        }
    }

    public async getDeRegisterData(competitionId: number, organisationId: number, membershipMappingId: any, userId: number, divisionId: any) {
        try {
            let result = await this.entityManager.query(` select * from wsa_registrations.deRegister 
                where competitionId = ? and organisationId = ? and membershipMappingId = ?
                and userId = ? and (case when ? = 0 then 1 else divisionId = ? end) 
                 and isDeleted = 0 `,
                [competitionId, organisationId, membershipMappingId, userId, divisionId, divisionId]);

            return result;
        } catch (error) {
            throw error;
        }
    }

    public async getOrgRegistrationParticipantData(registrationId:number){
        try {
            let result = await this.entityManager.query(` SELECT * FROM wsa_registrations.orgRegistrationParticipant orp where orp.registrationId = ?
                 and isDeleted = 0 `,
                [registrationId]);
            return result;
        } catch (error) {
            throw error;
        }
    }

    public async updatePlayerStatusRefIds(userRegistrationId:number){
        try {
            let result = await this.entityManager.query(` UPDATE wsa_competitions.player Set statusRefId = 3 where userRegistrationId = ?
                 and isDeleted = 0 `,
                [userRegistrationId]);
            return result;
        } catch (error) {
            throw error;
        }
    }

    public async getRegistrationTeamMembers(teamId: number, registrationId: number, userId: number): Promise<any>{
        try {
            let result = await this.entityManager.query(`
            select p.competitionId, p.organisationId, p.competitionDivisionId as divisionId,p.userRegistrationId, 
            cmpt.membershipProductTypeMappingId as membershipMappingId,
            orp.registrationId, p.userId
            from wsa_registrations.userRegistration ur 
            inner join wsa_registrations.orgRegistrationParticipant orp 
                on orp.userRegistrationId = ur.id and orp.isDeleted = 0
            inner join wsa_competitions.player p 
                on p.userRegistrationId = ur.id and p.isDeleted = 0
            inner join wsa_registrations.competitionMembershipProduct cmp 
                on cmp.competitionId = p.competitionId and cmp.isDeleted = 0
            inner join wsa_registrations.competitionMembershipProductType cmpt 
                on cmpt.competitionMembershipProductId = cmp.id and cmpt.isDeleted = 0
                and cmpt.id = p.competitionMembershipProductTypeId 
            where orp.registrationId = ? and ur.teamId = ? and 
            (case when ? = 0 then 1 else  p.userId = ? end)
            
            union
            
            select np.competitionId, np.organisationId, 0 as divisionId,np.userRegistrationId,
            cmpt.membershipProductTypeMappingId as membershipMappingId,
            orp.registrationId, np.userId 
            from wsa_registrations.userRegistration ur 
            inner join wsa_registrations.orgRegistrationParticipant orp 
                on orp.userRegistrationId = ur.id and orp.isDeleted = 0
            inner join wsa_competitions.nonPlayer np 
                on np.userRegistrationId = ur.id and np.isDeleted = 0
            inner join wsa_registrations.competitionMembershipProduct cmp 
                on cmp.competitionId = np.competitionId and cmp.isDeleted = 0
            inner join wsa_registrations.competitionMembershipProductType cmpt 
                on cmpt.competitionMembershipProductId = cmp.id and cmpt.isDeleted = 0
                and cmpt.id = np.competitionMembershipProductTypeId 
            where orp.registrationId = ? and ur.teamId = ? and 
            (case when ? = 0 then 1 else  np.userId = ? end)`,[registrationId, teamId, userId,userId,registrationId, teamId, userId,userId]);

            return result;
        } catch (error) {
            throw error;
        }
    }
}
