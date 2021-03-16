import { Service } from "typedi";
import { logger } from "../logger";
import BaseService from "./BaseService";
import { convertUTCDateToLocalDate, feeIsNull, formatValue, isArrayPopulated, isNegativeNumber, isNotNullAndUndefined, isNullOrUndefined, objectIsNotEmpty } from "../utils/Utils";
import AppConstants from "../validation/AppConstants";
import { RegistrationTrack } from "../models/registrations/RegistrationTrack";
import { RegistrationStep, DiscountType } from '../enums/enums';
let moment = require('moment');

@Service()
export default class RegistrationTrackService extends BaseService<RegistrationTrack> {

    modelName(): string {
        return RegistrationTrack.name;
    }
    
    public async findByRegistrationId(registrationId: number, stepsId: number): Promise<any>{
        try{
            let query = await this.entityManager.createQueryBuilder(RegistrationTrack,'regTrack')
                        .where('regTrack.registrationId = :registrationId and regTrack.stepsId = :stepsId and regTrack.isDeleted = 0',
                                {registrationId: registrationId, stepsId: stepsId})
                        .getOne();

           
            return query;
        }
        catch(error){
            throw error;
        }
    }

    public async findByteamMemberRegId(registrationId: number, stepsId: number, teamMemberRegId:string ): Promise<any>{
        try{
            let query = await this.entityManager.createQueryBuilder(RegistrationTrack,'regTrack')
                        .where('regTrack.registrationId = :registrationId and regTrack.stepsId = :stepsId and regTrack.teamMemberRegId = :teamMemberRegId and regTrack.isDeleted = 0',
                                {registrationId: registrationId, stepsId: stepsId, teamMemberRegId: teamMemberRegId})
                        .getOne();

           
            return query;
        }
        catch(error){
            throw error;
        }
    }

    public async findByUserRegistrationId(registrationId: number, stepsId: number, userRegistrationId: number): Promise<any>{
        try{
            let query = await this.entityManager.createQueryBuilder(RegistrationTrack,'regTrack')
                        .where('regTrack.registrationId = :registrationId and regTrack.stepsId = :stepsId and regTrack.isDeleted = 0 and regTrack.userRegistrationId = :userRegistrationId',
                                {registrationId: registrationId, stepsId: stepsId, userRegistrationId: userRegistrationId})
                        .getOne();

           
            return query;
        }
        catch(error){
            throw error;
        }
    }

    public async findByInvoiceId(registrationId: number, stepsId: number, invoiceId: number): Promise<any>{
        try{
            let query = await this.entityManager.createQueryBuilder(RegistrationTrack,'regTrack')
                        .where('regTrack.registrationId = :registrationId and regTrack.stepsId = :stepsId and regTrack.isDeleted = 0 and regTrack.invoiceId = :invoiceId',
                                {registrationId: registrationId, stepsId: stepsId, invoiceId: invoiceId})
                        .getOne();
            return query;
        }
        catch(error){
            throw error;
        }
    }

    public async getRegistrationReview(registrationId: number, regTrackReviewData): Promise<any>{
        try {
    
            if(isNotNullAndUndefined(regTrackReviewData)){
                regTrackReviewData = regTrackReviewData.jsonData;
            }
            //console.log("getRegistrationReview" + JSON.stringify(regTrackReviewData));
            let registrationCreatedBy = 0;
            const query = await this.entityManager.query(`call wsa_registrations.usp_get_registration_review(?)`, [registrationId]);
            let total = {
                subTotal: null,
                gst: null,
                shipping: null,
                charityValue: null,
                targetValue: null,
                total: null,
                transactionFee: null
            }
            let obj = this.getMainObj(total);

            let otherOption = 0;
            let isSchoolRegistration = 0;
            let hasChildRegistered = false;
            if (isArrayPopulated(query) && isArrayPopulated(query[0])) {

                if(isNotNullAndUndefined(regTrackReviewData)){
                    obj.charityRoundUpRefId = regTrackReviewData.charityRoundUpRefId;
                    obj.volunteerInfo = isNullOrUndefined(regTrackReviewData.volunteerInfo) ? regTrackReviewData.volunteerInfo : [];
                    obj.shopProducts = isNullOrUndefined(regTrackReviewData.shopProducts) ? regTrackReviewData.shopProducts : [];
                    obj.yourInfo = isNullOrUndefined(regTrackReviewData.yourInfo) ? regTrackReviewData.yourInfo : null;
                    obj.billingAddress = isNullOrUndefined(regTrackReviewData.billingAddress) ? regTrackReviewData.billingAddress : null;
                    obj.deliveryAddress = isNullOrUndefined(regTrackReviewData.deliveryAddress) ? regTrackReviewData.deliveryAddress : null;
                    obj.shippingOptions = isNullOrUndefined(regTrackReviewData.shippingOptions) ? regTrackReviewData.shippingOptions : null;
                }
                
                let partMap = new Map();
                let memMap = new Map();
                let childMemDiscountMap = new Map();
                let childCompDiscountMap = new Map();
                let memFeesRestrictList =  [];
                hasChildRegistered = this.checkChildRegistered(query[0])
                let sortedList = this.sortParticipants(query[0]);
                for(let item of sortedList){

                    let key = item.competitionId + "#" + item.organisationId + "#" + item.email + "#" +
                                item.firstName + "#" + item.lastName + "#" + item.isTeamRegistration;
                    let participantCompTemp = partMap.get(key);
                    registrationCreatedBy = item.registrationCreatedBy;
                    let fees = item.fees!= null ? JSON.parse(item.fees) : [];
                   
                    let competitionLogo = item.competitionLogo!= null ? JSON.parse(item.competitionLogo): [];
                    let discounts = item.discounts!= null ? JSON.parse(item.discounts) : [];
                    discounts.map((x) =>{
                        x.childDiscounts = isNullOrUndefined(x.childDiscounts) ? JSON.parse(x.childDiscounts): [];
                    })
                    let membershipDiscounts = item.membershipDiscounts!= null ? JSON.parse(item.membershipDiscounts) : [];
                    membershipDiscounts.map((x) =>{
                        x.childDiscounts = isNullOrUndefined(x.childDiscounts) ? JSON.parse(x.childDiscounts): [];
                    })
                    let governmentVouchers = item.governmentVouchers!= null ? JSON.parse(item.governmentVouchers) : [];
                    let paymentOptions = item.paymentOptions!= null ? JSON.parse(item.paymentOptions) : [];
                    paymentOptions = this.sortPaymentOptions(paymentOptions);
                    let paymentMethods = item.paymentMethods!= null ? JSON.parse(item.paymentMethods) : [];
                    let instalmentDates = item.instalmentDates!= null ? JSON.parse(item.instalmentDates) : [];
                    let orgRegistrationSettings = item.orgRegSettings!= null ? JSON.parse(item.orgRegSettings): [];
                    let selectedVal = null;
                    item["hasChildRegistered"] = hasChildRegistered;

                   // console.log("item.dateOfBirth" + JSON.stringify(item.dateOfBirth));
                    //  console.log("GovernmentVoucher" + JSON.stringify(governmentVouchers));

                    let filterdGovernmentVoucher = this.getGovernmentVouchers(governmentVouchers, item.dateOfBirth);
                     //console.log("filterdGovernmentVoucher" + JSON.stringify(filterdGovernmentVoucher));
                    let compLogo =  competitionLogo.find(x=>x);
                    let competitionLogoUrl = null;
                    if(isNotNullAndUndefined(compLogo)){
                        competitionLogoUrl = compLogo.logoUrl;
                    }

                    if(isNotNullAndUndefined(regTrackReviewData)){
                        if(isArrayPopulated(regTrackReviewData.compParticipants)){
                            selectedVal = regTrackReviewData.compParticipants.find(x=>x.competitionUniqueKey == 
                                item.competitionUniqueKey && x.organisationUnqiueKey == 
                                item.organisationUnqiueKey && x.email == item.email && x.isTeamRegistration == item.isTeamRegistration);
                        }
                    }
                
                    if(participantCompTemp == undefined){
                        let compPartObj = this.getCompPartObj(item,competitionLogoUrl, 
                            filterdGovernmentVoucher, instalmentDates, discounts, 
                            membershipDiscounts, fees, paymentMethods);

                        this.checkOrgSettings(orgRegistrationSettings, item, obj.yourInfo, obj);

                        let selectedObj = this.setSelectedObj(selectedVal,compPartObj, fees);

                        compPartObj.teamMembers = this.getTeamMembers(item.teamMembers, selectedObj);
                        compPartObj["allTeamMembers"] =  item.teamMembers;

                        this.getPaymentOptions(paymentOptions, compPartObj, selectedObj, fees);
                      
                        this.getFees(fees,key, item, memMap,discounts, compPartObj, selectedObj, membershipDiscounts,
                            instalmentDates, childMemDiscountMap, childCompDiscountMap, query[3], memFeesRestrictList, query[4]);
                        if(selectedObj.paymentOptionRefId != 5 || selectedObj.isSchoolRegCodeApplied == 0){
                            otherOption = 1;
                        }
                        if(selectedObj.paymentOptionRefId == 5 && selectedObj.isSchoolRegCodeApplied == 1){
                            isSchoolRegistration = 1;
                        }

                        compPartObj.selectedOptions = selectedObj;
                        partMap.set(key, compPartObj);
                        obj.compParticipants.push(compPartObj);
                    }
                    else{
                        this.getFees(fees,key, item, memMap,discounts, participantCompTemp, participantCompTemp.selectedOptions, 
                            membershipDiscounts, instalmentDates,childMemDiscountMap, childCompDiscountMap,
                            query[3], memFeesRestrictList, query[4]);
                    }
                }
            }

            if(otherOption == 0 && isSchoolRegistration == 1){
                obj.isSchoolRegistration = 1;
            }

            if(isArrayPopulated(query[1])){
                let charityData = query[1].find(x=>x);
                obj.charity = charityData.charity!= null ? JSON.parse(charityData.charity).find(x=>x) : null;
                obj.charityRoundUp = charityData.charityRoundUp!= null ? JSON.parse(charityData.charityRoundUp) : [];
                if(isArrayPopulated(obj.charityRoundUp)){
                    let roundUp = {
                        id: 0,
                        description: "No, sorry not at the moment",
                        charityRoundUpRefId: -1
                    }
                    obj.charityRoundUp.push(roundUp);
                }
            }
     
            let instalmentFinalArr = [];
            let teamFinalArr = [];
            let matchCompArr = [];

            let childMemDiscountMapIns = new Map();
            let childCompDiscountMapIns = new Map();
            let memTeamFeesRestrictList =  [];
            let paymentOptionArr = [];
            let securePaymentOptions = [];
            let hardshipOtherOption = 0;
            let hardshipOption = 0;
            let singleGameSelected = 0;
            let teamMap = new Map();
            for(let item of obj.compParticipants)   {
                item["hasChildRegistered"] = hasChildRegistered;
                if(isArrayPopulated(item.membershipProducts)){
                    for(let x of item.membershipProducts){
                        if(item.selectedOptions.isHardshipCodeApplied == 0){
                            if(item.isTeamRegistration == 0 || (item.isTeamRegistration == 1 && x.isPlayer == 1)){
                                let instalmentArr = await this.calculateInstalmentFees(x, item,childCompDiscountMapIns);
                                if(isArrayPopulated(instalmentArr)){
                                    instalmentFinalArr.push(...instalmentArr);
                                }
        
                                item.governmentVoucherAmount = feeIsNull(item.governmentVoucherAmount) + 
                                    feeIsNull(x.governmentVoucherAmount);
                            }
    
                            if(item.isTeamRegistration == 1 && teamMap.get(item.teamName) == undefined){
                                teamMap.set(item.teamName, item);
                                let teamFeeArr = await this.calculateTeamFees(query[2],item,query[3], x, 
                                                    memTeamFeesRestrictList, query[4]);
                                if(isArrayPopulated(teamFeeArr)){
                                    teamFinalArr.push(...teamFeeArr);
                                }
                               // matchCompArr = await this.calculateMatchCompetitionFee(item, x);
                            }
                        }

                        this.addNominationFee(x)
    
                       // this.calculateTotalAmt(x,total, item);
    
                        x.discountsToDeduct = formatValue(x.discountsToDeduct);
                        x.childDiscountsToDeduct = formatValue(x.childDiscountsToDeduct);
                       
                        item.payNow = feeIsNull(item.payNow) + feeIsNull(x.feesToPay);
                        x.feesToPay = formatValue(feeIsNull(x.feesToPay));
                       
    
                        // if(isNotNullAndUndefined(x.fees.membershipFee))
                        //     delete x.fees.membershipFee.mOrgId;
                        // if(isNotNullAndUndefined(x.fees.competitionOrganisorFee))
                        //     delete x.fees.competitionOrganisorFee.cOrgId;
                        // if(isNotNullAndUndefined(x.fees.affiliateFee))
                        //     delete x.fees.affiliateFee.cOrgId;
    
                        delete x.memDiscount;
                        delete x.compDiscount;
                        delete x.affDiscount;
                        delete x.coachFee;
                    }
                }
                else{
                    if(item.isTeamRegistration == 1 && teamMap.get(item.teamName) == undefined){
                        teamMap.set(item.teamName, item);
                        let teamFeeArr = await this.calculateTeamFees(query[2],item,query[3], null, 
                                            memTeamFeesRestrictList, query[4]);
                        if(isArrayPopulated(teamFeeArr)){
                            teamFinalArr.push(...teamFeeArr);
                        }
                    }
                }
                

                item.payNow =  item.payNow < 0 ? "0.00" : formatValue(item.payNow);
                item.payPerInstalment =  item.payPerInstalment < 0 ? '0.00' : formatValue(item.payPerInstalment);
                item.payPerMatch =  item.payPerMatch < 0 ? '0.00' : formatValue(item.payPerMatch);

                delete item.discounts;
                delete item.membershipDiscounts;
                delete item.fees;
                delete item.allTeamMembers;
                //delete item.teamName;
                 // Determine the Secure Payment Options
                 this.getSecurePaymentOptions(item, paymentOptionArr);
                 item.governmentVoucherAmount = formatValue(item.governmentVoucherAmount);
                 if(item.selectedOptions.isHardshipCodeApplied == 1){
                    hardshipOption = 1;
                 }else{
                    hardshipOtherOption = 1;
                 }
                 if(item.selectedOptions.paymentOptionRefId == 1 && item.isTeamRegistration == 1){
                    singleGameSelected = 1;
                 }

                 //delete item.competitionId;
                 delete item.paymentMethods;
            }

            if(hardshipOption == 1 && hardshipOtherOption == 0){
                obj.isHardshipEnabled = 1;
            }

            if(singleGameSelected == 1){
                obj["singleGameSelected"] = 1;
            }

            await this.calculateBorrowedDiscountFees(obj, registrationId, registrationCreatedBy);

            await this.calculateHardshipPayment(obj, registrationId, registrationCreatedBy);

            // NegativeFees Handling
            await this.calculateNegativeFees(obj, registrationId, registrationCreatedBy, total);

            this.calculateTargetValue(total, obj.charityRoundUpRefId)
            this.calculateShopProduct(total, obj);
            this.calculateTransactionFee(total);

            securePaymentOptions = this.getConsolidatedPaymentOptions(paymentOptionArr, obj);
             obj.securePaymentOptions = securePaymentOptions;

            await this.instalmentDateToDBTrack(instalmentFinalArr, registrationId, registrationCreatedBy);
        
            await this.teamDataToDBTrack(teamFinalArr, registrationId, registrationCreatedBy);

            return obj;
            
        } catch (error) {
            logger.error(`Exception occurred in getRegistrationReview ${error}`);
            throw error;
        }
    }

    private getFees (fees, key, item, memMap, discounts, compPartObj, selectedVal, membershipDiscounts,
                            instalmentDates,childMemDiscountMap, childCompDiscountMap, participants, 
                            memFeesRestrictList, memCapList){
        try {

            //console.log("selectedVal" + JSON.stringify(selectedVal));
           
            let memObjArr = [];
            let memDiscount = {
                membershipDiscount: [],
                childMembershipDiscount: null
            }
            let compDiscount = {
                compOrgDiscount: null,
                childCompOrgDiscount: null
            }
            let affDiscount = {
                affiliateDiscount: null,
                childAffiliateDiscount: null
            }
           
            let members = this.getParticipantList(item, selectedVal);

           // console.log("Members" + JSON.stringify(members));
            let payPerMatchMap = new Map();
            for(let member of members){
                let memObj = this.getMemObj(member);
               
                let index = 0;
                let coachFee = null;
                let filteredFees = [];
                if(item.isTeamRegistration == 1){
                    key = key + "#" + member.email;
                   // console.log("key" + key);
                    if(item.competitionMembershipProductTypeIdCoach!= null && member.personRoleRefId != null)
                    {
                        // console.log("fees" + JSON.stringify(fees));
                        // console.log("IdCoach" + item.competitionMembershipProductTypeIdCoach);
                        coachFee = fees.find(x=>x.competitionMembershipProductTypeId == 
                            item.competitionMembershipProductTypeIdCoach);
                        //console.log("!!!!!!!!coachFee@@@@@@@" + JSON.stringify(coachFee));
                        if(coachFee!= null){
                            let checkFee = this.checkMemProductFeesType(coachFee,item,participants,
                                                        selectedVal, memFeesRestrictList, memCapList);
                            if(checkFee.isExists){
                                if(checkFee.paymentFeeTypeRefId == 2){
                                    coachFee.seasonalFee = checkFee.amount;
                                    coachFee.seasonalGST = checkFee.gst;
                                }
                            }
    
                            let coachMemObj = this.addCoach(coachFee, key, item, memMap,compPartObj);
                            memObjArr.push(coachMemObj);
                        }
                    }
                    if(selectedVal.nominationPayOptionRefId == 1){
                        filteredFees = fees.filter(x=>x.competitionMembershipProductTypeId == 
                            member.competitionMembershipProductTypeId && x.isPlayer == 1);
                    }
                    else{
                        filteredFees = fees.filter(x=>x.competitionMembershipProductTypeId == 
                            member.competitionMembershipProductTypeId);
                    }
                    
                }
                else{
                    filteredFees = fees.filter(x=>x.competitionMembershipProductTypeId == 
                            item.competitionMembershipProductTypeId);
                }
             
                if(item.isTeamRegistration == 1 && member.personRoleRefId!= null && 
                    (item.teamRegistrationTypeRefId == 1 &&
                        (member.isRegisteredAsPlayer == 0 && member.personRoleRefId != 4)))
                {
                  continue;
                }

                for(let f of filteredFees){
                   
                    let memKey = key + "#" + f.competitionMembershipProductTypeId + "#" + 
                                    f.divisionId;
                   // console.log("memKey::" + memKey);
                    let memprodTemp = memMap.get(memKey);
                  
                    if(item.isTeamRegistration == 0 || (item.isTeamRegistration == 1 && (
                        member.personRoleRefId!= null || selectedVal.nominationPayOptionRefId == 2 || 
                        (selectedVal.nominationPayOptionRefId == 1 && member.payingFor == 1)) ))
                    {
                        if(index == 0){
                            //console.log("******************" + member.email);
                            let memFeeObj = this.getMemFeeObj(f);
                            if(item.isTeamRegistration == 1 && ((member.personRoleRefId!= null && 
                                member.isRegisteredAsPlayer == 0 && member.personRoleRefId!= 4) || 
                                f.allowTeamRegistrationTypeRefId == 2))
                            {
                                memFeeObj.casualFee = 0;
                                memFeeObj.casualGST = 0;
                                memFeeObj.seasonalFee = 0;
                                memFeeObj.seasonalGST = 0;
                            }
        
                            let checkFee = this.checkMemProductFeesType(f,member,participants, selectedVal,
                                memFeesRestrictList, memCapList);
    
                            console.log("checkFee" + JSON.stringify(checkFee));
                            
                            if(checkFee.isExists){
                                if(checkFee.paymentFeeTypeRefId == 2){
                                    memFeeObj.seasonalFee = checkFee.amount;
                                    memFeeObj.seasonalGST = checkFee.gst;
                                }
                            }
                           
                            memObj.fees.membershipFee = memFeeObj;
    
                            //console.log("memFeeObj" + JSON.stringify(memFeeObj));
                            //console.log("selectedVal selectedDiscounts" + JSON.stringify(selectedVal.selectedDiscounts));
                            this.findMembershipDiscounts(selectedVal,membershipDiscounts, f,  memDiscount);
                        }
                    }

                    if(item.isTeamRegistration == 0 || (item.isTeamRegistration == 1 && f.isPlayer == 1)){
                        let competitionDiscount = null; let childCompetitionDiscount = null;
                        let cDiscount = this.findCompetitionDiscounts(selectedVal,discounts, f );
                        competitionDiscount = cDiscount.competitionDiscount;
                        childCompetitionDiscount = cDiscount.childCompetitionDiscount;
                        let compFee = this.compFeeObj(item, f)
                        
                        if(item.isTeamRegistration == 1){
                            let noOfPlayers = 1;
                            let payingForCount = 1;
                            if(f.allowTeamRegistrationTypeRefId == 1){
                                noOfPlayers = Number(item.noOfPlayers) == 0 ? 1 : Number(item.noOfPlayers);
                                payingForCount = Number(item.payingForCount)
                            }
                            item.noOfPlayers = noOfPlayers;
                            item.payingForCount = payingForCount
        
                            if(f.teamRegChargeTypeRefId == 1){
                                compFee.seasonalFee =  this.getAdjustedVal(f.teamSeasonalFee,  noOfPlayers);
                                compFee.seasonalGST =   this.getAdjustedVal(f.teamSeasonalGST, noOfPlayers);
                            }
                            else{
                                if(selectedVal.paymentOptionRefId == 1 && f.teamRegChargeTypeRefId != 1){
                                    compFee.casualFee =  null;
                                    compFee.casualGST =  null;
                                    if(f.teamRegChargeTypeRefId == 2){
                                        if(payPerMatchMap.get(index) == undefined){
                                            let fee = (feeIsNull(f.teamSeasonalFee) + feeIsNull(f.teamSeasonalGST));
                                            if(selectedVal.nominationPayOptionRefId == 1){
                                                compPartObj.payPerMatch += fee;
                                                payPerMatchMap.set(index, compPartObj.payPerMatch);
                                            }
                                            else{
                                                compPartObj.payPerMatch += 
                                                    ((fee / noOfPlayers) * payingForCount);
                                                    payPerMatchMap.set(index, compPartObj.payPerMatch);
                                            }
                                            
                                        }
                                    }
                                    else{
                                       if(payPerMatchMap.get(index) == undefined){
                                            let fee = (feeIsNull(f.teamSeasonalFee) + feeIsNull(f.teamSeasonalGST));
                                            compPartObj.payPerMatch += (fee * payingForCount);
                                            payPerMatchMap.set(index, compPartObj.payPerMatch);
                                        }
                                    }
                                }
                                else{
                                    compFee.casualFee =  this.getAdjustedVal(f.teamSeasonalFee, noOfPlayers);
                                    compFee.casualGST =  this.getAdjustedVal(f.teamSeasonalGST,  noOfPlayers);
                                }
                            }
                            
                            this.setNominationFee(item, f, selectedVal, noOfPlayers, payingForCount,
                                compFee);
                        }
                        else{
                            if(selectedVal.paymentOptionRefId!= 1){
                                this.setNominationFee(item, f, selectedVal, 1, 1, compFee);
                            }
                            // else{
                            //     compPartObj.payPerMatch = feeIsNull(compPartObj.payPerMatch) + feeIsNull(f.casualFee) + 
                            //                                     feeIsNull(f.casualGST);
                            //     compFee.casualFee = 0;
                            //     compFee.casualGST = 0; 
                            // }
                        }
        
                        if(f.isDirect == 1){
                            // if(item.isTeamRegistration == 1 && selectedVal.paymentOptionRefId == 1 && 
                            //     f.teamRegChargeTypeRefId != 1){
                            //         memObj.fees.competitionOrganisorFee = null;
                            //     }
                            //     else{
                            //         memObj.fees.competitionOrganisorFee = compFee;
                            //     }

                            memObj.fees.competitionOrganisorFee = compFee;
                            compDiscount.compOrgDiscount = competitionDiscount;
                            compDiscount.childCompOrgDiscount = childCompetitionDiscount;
                        }
                        else{
                            // if(item.isTeamRegistration == 1 && selectedVal.paymentOptionRefId == 1 && 
                            //     f.teamRegChargeTypeRefId != 1){
                            //         memObj.fees.affiliateFee = null;
                            //     }
                            //     else{
                            //         memObj.fees.affiliateFee = compFee;
                            //     }

                            memObj.fees.affiliateFee = compFee;
                            affDiscount.affiliateDiscount = competitionDiscount;
                            affDiscount.childAffiliateDiscount = childCompetitionDiscount;
                        }
                    }
                    
                    if(memprodTemp == undefined){
                   
                       // memObj.name = f.membershipProductName + ' ' + f.mTypeName;
                        memObj.membershipProductName = f.membershipProductName;
                        memObj.membershipTypeName = f.mTypeName;
                        memObj.competitionMembershipProductTypeId = f.competitionMembershipProductTypeId;
                        memObj.membershipMappingId = f.membershipMappingId;
                        memObj.divisionId = f.divisionId;
                        memObj.orgRegParticipantId =  member.orgRegParticipantId,
                        memObj.divisionName = f.divisionName;
                        memObj["memDiscount"] = memDiscount;
                        memObj["compDiscount"] = compDiscount;
                        memObj["affDiscount"] = affDiscount;
                        memObj.isPlayer = f.isPlayer;
                        if(isNotNullAndUndefined(coachFee)){
                            memObj["coachFee"] = coachFee;  
                        }
                        memMap.set(memKey, memObj);
                        compPartObj.membershipProducts.push(memObj);
                        memObjArr.push(memObj);
                        if(memObj.fees.membershipFee){
                            let mFee = memObj.fees.membershipFee.seasonalFee;
                            this.addToMemFeesRestrictList(memFeesRestrictList, member, f.membershipMappingId,
                                selectedVal, mFee, f.membershipProductId, item.isTeamRegistration);
                        }
                    }
                    index++;
                }
            }
            
            //console.log("!!!!!!!!!!!!!!!!!!" + JSON.stringify(memObjArr));
            if(isArrayPopulated(memObjArr)){
                for(let memObj of memObjArr){
                 
                    if(selectedVal!= null){
                        // TODO : Need to sort based on FeesToPay
                        this.calculateFee(selectedVal,memObj,instalmentDates, item);
                        this.performDiscountCalculation(memObj,selectedVal,item,childMemDiscountMap, childCompDiscountMap,
                            instalmentDates);
                    }
                  
                }
            }
        } catch (error) {
            logger.error(`Exception occurred in getFees ${error}`);
            throw error;
        }
    }

    private checkChildRegistered(participants){
        try {
            let participant = participants.find(x=>x.registeringYourselfRefId == 2);
            if(participant) return true;
            else return false;
        } catch (error) {
            logger.error(`Exception occurred in checkChildRegistered ${error}`);
            throw error;
        }
    }


    private getParticipantList(item, selectedVal){
        let arr = [];
        try {
            if(item.isTeamRegistration == 1){
                let teamMemberList = item.teamMembers!= null ? JSON.parse(item.teamMembers) : [];
                if(isArrayPopulated(teamMemberList)){
                    for(let teamMem of teamMemberList){
                        if(selectedVal.nominationPayOptionRefId == 1 || 
                            (selectedVal.nominationPayOptionRefId == 2 && teamMem.payingFor == 1)){
                            teamMem["competitionEndDate"] = item.competitionEndDate;
                            teamMem["isTeamRegistration"] = item.isTeamRegistration;
                            arr.push(teamMem);
                        }
                       
                    }
                }
            }
            else{
                arr.push(item);
            }
        } catch (error) {
            logger.error(`Exception occurred in getParticipantList ${error}`);
        }

        return arr;
    }

    private getPaymentOptionRefId(paymentOptionRefId, feesTypeRefId){
        if(feesTypeRefId == 2 || feesTypeRefId == 3){
            if(paymentOptionRefId == 1){
                return 3;
            }
            if(paymentOptionRefId == 5){
                return 4;
            }
            if(paymentOptionRefId == 8){
                return 5;
            }
            if(paymentOptionRefId == 9){
                return 6;
            }
        }
        else{
            return paymentOptionRefId;
        }

        return 0;
    }

    private getGovernmentVouchers(governmentVouchers, dateOfBirth){
        let arr = [];
        try {
            let userAge = (Math.floor((Date.now() - new Date(dateOfBirth).getTime()) / 3.15576e+10));
          
            if(isArrayPopulated(governmentVouchers)){
                governmentVouchers.map((x) => {
                    if(userAge != 0){
                        if(userAge <= 17){
                            //if(x.governmentVoucherRefId == 1){
                                arr.push(x);
                            //}
                        }else if(userAge <= 18){
                            if(x.governmentVoucherRefId == 1) { // NSW Active Kids
                                arr.push(x);
                            }
                        }
                    }
                })
            }

        } catch (error) {
            throw error;
        }

        return arr;
    }

    private getCharityValue(targetValue, charityRoundUpRefId){
        //console.log("targetValue ::" + targetValue + ":::" + charityRoundUpRefId );
        try {
            let chartityValue = 0;
            let finalTargetValue = 0;
            // let val = Math.ceil(targetValue);
            
            // let remainder = val % 10;
            // let quotient = ((val - remainder) / 10) * 10;
 
            if(charityRoundUpRefId == 1){
                //finalTargetValue =  quotient + remainder +  ((remainder % 2) == 0 ? 2 : 1);
                chartityValue = 2;
            }
            else if(charityRoundUpRefId == 2){
                // if(remainder < 5){
                //     finalTargetValue = quotient + 5
                // }
                // else{
                //     finalTargetValue = quotient + 10
                // }
                chartityValue = 5;
            }
            else if(charityRoundUpRefId == 3){
                //finalTargetValue = quotient + 10;
                chartityValue = 10;
            }

            finalTargetValue = feeIsNull(targetValue) + chartityValue;

            return {
                charityValue: chartityValue,
                targetValue: finalTargetValue
            }
        } catch (error) {
            throw error;
        } 
    }

    private getSecurePaymentOptions(item, paymentOptionArr){
        try {
            let isSchoolRegCodeApplied = item.selectedOptions.isSchoolRegCodeApplied;
            let obj = {
                competitionUniqueKey: item.competitionUniqueKey,
                isSchoolRegCodeApplied: isSchoolRegCodeApplied,
                paymentOptions: []
            }
            let paymentMethods = item.paymentMethods.filter(x=>x.competitionId == item.competitionId);
            if(isArrayPopulated(paymentMethods)){
                for(let payment of paymentMethods){
                    if(item.selectedOptions.paymentOptionRefId == AppConstants.WEEKLY_INSTALMENT && 
                        payment.paymentMethodRefId == AppConstants.PAYMENT_METHOD_CH){
                            continue;
                    }
                    // else if(item.selectedOptions.paymentOptionRefId == AppConstants.PAY_AS_YOU_GO && 
                    //     payment.paymentMethodRefId == AppConstants.PAYMENT_METHOD_DD)
                    // {
                    //     continue;
                    // }
                    else{
                        obj.paymentOptions.push(payment)
                    }
                }
            }
            
            paymentOptionArr.push(obj);
        } catch (error) {
            throw error;
        }
    }
    
    private getConsolidatedPaymentOptions(paymentOptionArr, obj){
        try {
            let finalArr = [];
            let tempPaymentOptionArr = [];

            if(isArrayPopulated(paymentOptionArr)){

                for(let x of paymentOptionArr){
                    if((x.isSchoolRegCodeApplied == 1 && obj.isSchoolRegistration == 1) || 
                            feeIsNull(obj.total.targetValue) == 0){
                        continue;
                    }
                    x.paymentOptions.map((y) =>{
                        let d = tempPaymentOptionArr.find(z=>z.competitionUniqueKey == x.competitionUniqueKey);
                        if(d == undefined){
                            tempPaymentOptionArr.push(x);
                        }
                    })
                }

                let paymentMap = new Map();
                let arr = [];
                let i = 1;
                for(let op of tempPaymentOptionArr){
                   for(let j of op.paymentOptions){
                       let key = j.paymentMethodRefId;
                       
                       if(paymentMap.get(key) == undefined){
                            let obj = {
                                securePaymentOptionRefId: j.paymentMethodRefId,
                                ids: []
                            }
                            obj.ids.push(i)
                            paymentMap.set(key, obj);
                            arr.push(obj);
                       }
                       else{
                            let temp = paymentMap.get(key);
                            if(!temp.ids.includes(i)){
                                temp.ids.push(i);
                            }
                       }
                   }
                   i++;
                }

                for(let p of arr){
                    if(p.ids.length == tempPaymentOptionArr.length){
                        let obj = {
                            securePaymentOptionRefId: p.securePaymentOptionRefId,
                        }
                        finalArr.push(obj);
                    }
                }
            }

            return finalArr;
            
        } catch (error) {
           throw error; 
        }
    }

    private calculateFee(selectedVal, memObj, instalmentDates, item){
        try {
            //this.resetFeeForHardship(selectedVal, memObj);
            if(selectedVal.paymentOptionRefId!= null){
                if(selectedVal.paymentOptionRefId <=2){
                    let aCasualFee = isNullOrUndefined(memObj.fees.affiliateFee) ? 
                                     feeIsNull(memObj.fees.affiliateFee.casualFee)  : 0;
                    let aCasualGST = isNullOrUndefined(memObj.fees.affiliateFee) ? 
                                     feeIsNull(memObj.fees.affiliateFee.casualGST) : 0;
                    let cCasualFee = isNullOrUndefined(memObj.fees.competitionOrganisorFee) ? 
                                     feeIsNull(memObj.fees.competitionOrganisorFee.casualFee) : 0;
                    let cCasualGST = isNullOrUndefined(memObj.fees.competitionOrganisorFee) ? 
                                     feeIsNull(memObj.fees.competitionOrganisorFee.casualGST) : 0;
                    let mCasualFee = isNullOrUndefined(memObj.fees.membershipFee) ? 
                                     feeIsNull(memObj.fees.membershipFee.casualFee) : 0;
                    let mCasualGST = isNullOrUndefined(memObj.fees.membershipFee) ? 
                                        feeIsNull(memObj.fees.membershipFee.casualGST): 0;
                    

                    if(selectedVal.paymentOptionRefId == 1){
                        //memObj.feesToPay = feeIsNull(aCasualGST + cCasualGST + mCasualGST);
                        
                        if(isNullOrUndefined(memObj.fees.affiliateFee)){
                            let aVal = this.applyGovernmentVoucher(selectedVal, memObj, aCasualFee, memObj.fees.affiliateFee, AppConstants.competition);
                            let aValGST = this.applyGovernmentVoucher(selectedVal, memObj, aCasualGST, memObj.fees.affiliateFee, AppConstants.competition);
                            memObj.fees.affiliateFee.feesToPay = aCasualFee;  
                            memObj.fees.affiliateFee.feesToPayGST = aCasualGST;  
                            memObj.feesToPay = feeIsNull(memObj.feesToPay) + aCasualFee + aCasualGST;
                        }
                        
                        if(isNullOrUndefined(memObj.fees.competitionOrganisorFee)){
                            let cVal = this.applyGovernmentVoucher(selectedVal, memObj, cCasualFee, memObj.fees.competitionOrganisorFee, AppConstants.competition);
                            let cValGST = this.applyGovernmentVoucher(selectedVal, memObj, cCasualGST, memObj.fees.competitionOrganisorFee, AppConstants.competition);
                            memObj.fees.competitionOrganisorFee.feesToPay = cCasualFee; 
                            memObj.fees.competitionOrganisorFee.feesToPayGST = cCasualGST; 
                            memObj.feesToPay = feeIsNull(memObj.feesToPay) + cCasualFee + cCasualGST;
                        }

                        if(isNullOrUndefined(memObj.fees.membershipFee)){
                            let mVal = this.applyGovernmentVoucher(selectedVal, memObj, mCasualFee, memObj.fees.membershipFee, AppConstants.competition);
                            let mValGST = this.applyGovernmentVoucher(selectedVal, memObj, mCasualGST, memObj.fees.membershipFee, AppConstants.competition);
                            memObj.fees.membershipFee.feesToPay = mCasualFee;  
                            memObj.fees.membershipFee.feesToPayGST = mCasualGST;  
                            memObj.feesToPay = feeIsNull(memObj.feesToPay) + mCasualFee + mCasualGST;
                        } 
                       
                        
                    }
                }
                else
                {
                    {
                        let aSeasonalFee = isNullOrUndefined(memObj.fees.affiliateFee) ? 
                                            feeIsNull(memObj.fees.affiliateFee.seasonalFee) : 0;
                        let aSeasonalGST = isNullOrUndefined(memObj.fees.affiliateFee) ? 
                                            feeIsNull(memObj.fees.affiliateFee.seasonalGST) : 0;
                        let cSeasonalFee =   isNullOrUndefined(memObj.fees.competitionOrganisorFee) ? 
                                            feeIsNull(memObj.fees.competitionOrganisorFee.seasonalFee): 0;
                        let cSeasonalGST =  isNullOrUndefined(memObj.fees.competitionOrganisorFee) ? 
                                            feeIsNull(memObj.fees.competitionOrganisorFee.seasonalGST): 0;
                        let mSeasonalFee =   isNullOrUndefined(memObj.fees.membershipFee) ? 
                                            feeIsNull(memObj.fees.membershipFee.seasonalFee) : 0;
                        let mSeasonalGST =   isNullOrUndefined(memObj.fees.membershipFee) ? 
                                                feeIsNull(memObj.fees.membershipFee.seasonalGST) : 0;
                        let aNominationFeeToPay = isNullOrUndefined(memObj.fees.affiliateFee) ? 
                                            feeIsNull(memObj.fees.affiliateFee.nominationFeeToPay) : 0;
                        let aNominationGSTToPay = isNullOrUndefined(memObj.fees.affiliateFee) ? 
                                            feeIsNull(memObj.fees.affiliateFee.nominationGSTToPay) : 0;
                        let cNominationFeeToPay = isNullOrUndefined(memObj.fees.competitionOrganisorFee) ? 
                                            feeIsNull(memObj.fees.competitionOrganisorFee.nominationFeeToPay) : 0;
                        let cNominationGSTToPay = isNullOrUndefined(memObj.fees.competitionOrganisorFee) ? 
                                            feeIsNull(memObj.fees.competitionOrganisorFee.nominationGSTToPay) : 0;
                        
                        
                        if(selectedVal.paymentOptionRefId == 3 || selectedVal.paymentOptionRefId == 5){
                            //memObj.feesToPay = feeIsNull(( aSeasonalGST + cSeasonalGST + mSeasonalGST));
                            if(isNullOrUndefined(memObj.fees.affiliateFee)){ 
                                let aVal = this.applyGovernmentVoucher(selectedVal, memObj, aSeasonalFee, memObj.fees.affiliateFee, AppConstants.competition);
                                let aValGST = this.applyGovernmentVoucher(selectedVal, memObj, aSeasonalGST, memObj.fees.affiliateFee, AppConstants.competition);
                                memObj.fees.affiliateFee.feesToPay = aSeasonalFee;  
                                memObj.fees.affiliateFee.feesToPayGST = aSeasonalGST;
                                memObj.feesToPay = feeIsNull(memObj.feesToPay) + aSeasonalFee + aSeasonalGST;

                                let aNomVal = this.applyGovernmentVoucher(selectedVal, memObj, aNominationFeeToPay, memObj.fees.affiliateFee, AppConstants.nomination);
                                let aNomValGST = this.applyGovernmentVoucher(selectedVal, memObj, aNominationGSTToPay, memObj.fees.affiliateFee, AppConstants.nomination);
                                memObj.fees.affiliateFee.nominationFeeToPay = aNominationFeeToPay;  
                                memObj.fees.affiliateFee.nominationGSTToPay = aNominationGSTToPay;
                            }
                            if(isNullOrUndefined(memObj.fees.competitionOrganisorFee)){
                                let cVal = this.applyGovernmentVoucher(selectedVal, memObj, cSeasonalFee, memObj.fees.competitionOrganisorFee, AppConstants.competition);
                                let cValGST = this.applyGovernmentVoucher(selectedVal, memObj, cSeasonalGST, memObj.fees.competitionOrganisorFee, AppConstants.competition);
                                memObj.fees.competitionOrganisorFee.feesToPay = cSeasonalFee; 
                                memObj.fees.competitionOrganisorFee.feesToPayGST = cSeasonalGST; 
                                memObj.feesToPay = feeIsNull(memObj.feesToPay) + cSeasonalFee + cSeasonalGST;

                                let cNomVal = this.applyGovernmentVoucher(selectedVal, memObj, cNominationFeeToPay, memObj.fees.competitionOrganisorFee, AppConstants.nomination);
                                let cNomValGST = this.applyGovernmentVoucher(selectedVal, memObj, cNominationGSTToPay, memObj.fees.competitionOrganisorFee, AppConstants.nomination);
                                memObj.fees.competitionOrganisorFee.nominationFeeToPay = cNominationFeeToPay;  
                                memObj.fees.competitionOrganisorFee.nominationGSTToPay = cNominationGSTToPay;
                            }

                            if(isNullOrUndefined(memObj.fees.membershipFee)){
                                let mVal = this.applyGovernmentVoucher(selectedVal, memObj, mSeasonalFee, memObj.fees.membershipFee, AppConstants.competition);
                                let mValGST = this.applyGovernmentVoucher(selectedVal, memObj, mSeasonalGST, memObj.fees.membershipFee, AppConstants.competition);
                                memObj.fees.membershipFee.feesToPay = mSeasonalFee;  
                                memObj.fees.membershipFee.feesToPayGST = mSeasonalGST;  
                                memObj.feesToPay = feeIsNull(memObj.feesToPay) + mSeasonalFee + mSeasonalGST;
                            }
                        }
                        else if(selectedVal.paymentOptionRefId == 4){
                            let totalDates = 0;
                            let paidDates = 0;
                            let dates = this.getInstalmentDatesToPay(instalmentDates, item);
                            totalDates = dates.totalDates;
                            paidDates = dates.paidDates;
                            
                            if(isNullOrUndefined(memObj.fees.affiliateFee)){ 
                                let aVal = totalDates == 0 ? 0 : (this.getAdjustedVal(aSeasonalFee, totalDates) * paidDates);
                                let aValGST = totalDates == 0 ? 0 : (this.getAdjustedVal(aSeasonalGST, totalDates) * paidDates);
                          
                                memObj.fees.affiliateFee.feesToPay = aVal;
                                memObj.fees.affiliateFee.feesToPayGST = aValGST;
                                memObj.feesToPay = feeIsNull( memObj.feesToPay) + memObj.fees.affiliateFee.feesToPay + 
                                                            memObj.fees.affiliateFee.feesToPayGST
                                this.applyGovernmentVoucher(selectedVal, memObj, aVal, memObj.fees.affiliateFee, AppConstants.competition);
                                this.applyGovernmentVoucher(selectedVal, memObj, aValGST, memObj.fees.affiliateFee, AppConstants.competition);
                            
                                // memObj.fees.affiliateFee.nominationFeeToPay = totalDates == 0 ? 0 : (feeIsNull((aNominationFee / totalDates)) * paidDates);
                                // memObj.fees.affiliateFee.nominationGSTToPay = totalDates == 0 ? 0 : (feeIsNull((aNominationGST / totalDates)) * paidDates);
                                // memObj.fees.affiliateFee.nominationFeeToPay = totalDates == 0 ? 0 : (feeIsNull((aNominationFee / totalDates)));
                                // memObj.fees.affiliateFee.nominationGSTToPay = totalDates == 0 ? 0 : (feeIsNull((aNominationGST / totalDates)));

                                let aNomVal = totalDates == 0 ? 0 : aNominationFeeToPay;
                                let aNomValGST = totalDates == 0 ? 0 : aNominationGSTToPay;
                                memObj.fees.affiliateFee.nominationFeeToPay = aNomVal;  
                                memObj.fees.affiliateFee.nominationGSTToPay = aNomValGST;

                                this.applyGovernmentVoucher(selectedVal, memObj, aNomVal, memObj.fees.affiliateFee, AppConstants.nomination);
                                this.applyGovernmentVoucher(selectedVal, memObj, aNomValGST, memObj.fees.affiliateFee, AppConstants.nomination);
                                
                            }

                            if(isNotNullAndUndefined(memObj.fees.competitionOrganisorFee)){

                                let cVal = totalDates == 0 ? 0 : (this.getAdjustedVal(cSeasonalFee, totalDates) * paidDates);
                                let cValGST = totalDates == 0 ? 0 : (this.getAdjustedVal(cSeasonalGST, totalDates) * paidDates);
                              
                                memObj.fees.competitionOrganisorFee.feesToPay = cVal; 
                                memObj.fees.competitionOrganisorFee.feesToPayGST = cValGST; 
                                memObj.feesToPay = feeIsNull( memObj.feesToPay) + memObj.fees.competitionOrganisorFee.feesToPay 
                                            + memObj.fees.competitionOrganisorFee.feesToPayGST;
                                this.applyGovernmentVoucher(selectedVal, memObj, cVal, memObj.fees.competitionOrganisorFee, AppConstants.competition);
                                this.applyGovernmentVoucher(selectedVal, memObj, cValGST, memObj.fees.competitionOrganisorFee, AppConstants.competition);

                               
                                // memObj.fees.competitionOrganisorFee.nominationFeeToPay = totalDates == 0 ? 0 : (feeIsNull((cNominationFee / totalDates)) * paidDates);
                                // memObj.fees.competitionOrganisorFee.nominationGSTToPay = totalDates == 0 ? 0 : (feeIsNull((cNominationGST / totalDates)) * paidDates);
                                // memObj.fees.competitionOrganisorFee.nominationFeeToPay = totalDates == 0 ? 0 : (feeIsNull((cNominationFee / totalDates)));
                                // memObj.fees.competitionOrganisorFee.nominationGSTToPay = totalDates == 0 ? 0 : (feeIsNull((cNominationGST / totalDates)));

                                let cNomVal = totalDates == 0 ? 0 : cNominationFeeToPay;
                                let cNomValGST = totalDates == 0 ? 0 : cNominationGSTToPay;
                                memObj.fees.competitionOrganisorFee.nominationFeeToPay = cNomVal;  
                                memObj.fees.competitionOrganisorFee.nominationGSTToPay = cNomValGST;
                                this.applyGovernmentVoucher(selectedVal, memObj, cNomVal, memObj.fees.competitionOrganisorFee, AppConstants.nomination);
                                this.applyGovernmentVoucher(selectedVal, memObj, cNomValGST, memObj.fees.competitionOrganisorFee, AppConstants.nomination);
                                

                            }
                            
                            if(isNotNullAndUndefined(memObj.fees.membershipFee)){
                                // let mVal = totalDates == 0 ? 0 : (feeIsNull((mSeasonalFee / totalDates)) * paidDates);
                                // let mValGST = totalDates == 0 ? 0 : (feeIsNull((mSeasonalGST / totalDates)) * paidDates);
                                let mVal = totalDates == 0 ? 0 : mSeasonalFee;
                                let mValGST = totalDates == 0 ? 0 : mSeasonalGST;
                              
                                memObj.fees.membershipFee.feesToPay = mVal;  
                                memObj.fees.membershipFee.feesToPayGST = mValGST; 
                                memObj.feesToPay = feeIsNull( memObj.feesToPay) + memObj.fees.membershipFee.feesToPay +  memObj.fees.membershipFee.feesToPayGST;
                                this.applyGovernmentVoucher(selectedVal, memObj, mVal, memObj.fees.membershipFee, AppConstants.competition);
                                this.applyGovernmentVoucher(selectedVal, memObj, mValGST, memObj.fees.membershipFee, AppConstants.competition);
                               
                            }

                            //console.log("memObj.feesToPay" + memObj.feesToPay);
                        }
                    }
                }
            }
        } catch (error) {
            logger.error(`Exception occurred in calculateFee ${error}`);
            throw error;
        }
    }

    private performDiscountCalculation(memObj, selectedVal, item,childMemDiscountMap, childCompDiscountMap, instalmentDates){
           // console.log("memDiscount" + JSON.stringify(memDiscount) + "compDiscount::" + JSON.stringify(compDiscount) + "Aff::" + JSON.stringify(affDiscount));
        try {
            let memDiscount = memObj.memDiscount;
            let compDiscount = memObj.compDiscount;
            let affDiscount = memObj.affDiscount;

            let noOfPlayers = 1;
            let payingForCount = 1;
            if(item.isTeamRegistration == 1){
                noOfPlayers = item.noOfPlayers;
                payingForCount = item.payingForCount;
            }
            else if(selectedVal.paymentOptionRefId == 4){
                let dates = this.getInstalmentDatesToPay(instalmentDates, item);
                noOfPlayers = dates.totalDates;
                payingForCount = dates.paidDates;
            }

            let childDiscountVal = null;
            let nomChildDiscountVal = null;
            let extraDiscountVal = 0;
            let extraChildDiscountVal = 0;
            let sourceBorrowedOrgId = null;
            let sourceChildBorrowedOrgId = null;
            if(isNotNullAndUndefined( memObj.fees.affiliateFee) && isNotNullAndUndefined(affDiscount) && isNotNullAndUndefined(affDiscount.childAffiliateDiscount)){
                
                let childDiscount = this.getChildDiscountValue(affDiscount.childAffiliateDiscount, memObj.fees.affiliateFee,item, childCompDiscountMap, "Comp", 0, null);
                //console.log("childDiscount" + JSON.stringify(childDiscount));
                childDiscountVal = this.getAdjustedVal(childDiscount.childDiscountsToDeduct, noOfPlayers);
                memObj.childDiscountsToDeduct += feeIsNull(childDiscountVal);
                extraChildDiscountVal = childDiscount.remainingDiscount;
                memObj.fees.affiliateFee.childDiscountsToDeduct = childDiscountVal;
                if(extraChildDiscountVal > 0){
                    sourceChildBorrowedOrgId = memObj.fees.affiliateFee.cOrgId;
                }
                
                let nomChildDiscount = this.getChildDiscountValue(affDiscount.childAffiliateDiscount, memObj.fees.affiliateFee,item, childCompDiscountMap, "Nom", 
                                extraChildDiscountVal, childDiscount.childDiscount);
                nomChildDiscountVal = this.getAdjustedVal(nomChildDiscount.childDiscountsToDeduct, noOfPlayers);
                memObj.childDiscountsToDeduct += feeIsNull(nomChildDiscountVal);
                extraChildDiscountVal = nomChildDiscount.remainingDiscount;
                memObj.fees.affiliateFee["nomChildDiscountsToDeduct"] = nomChildDiscountVal;
                
            }

            if(isNotNullAndUndefined(memObj.fees.affiliateFee) && isNotNullAndUndefined(affDiscount) && isArrayPopulated(affDiscount.affiliateDiscount)){
                for(let dis of affDiscount.affiliateDiscount){
                    let feeToDiscount = feeIsNull(memObj.fees.affiliateFee.feesToPay) + feeIsNull(memObj.fees.affiliateFee.feesToPayGST) - 
                                            feeIsNull(memObj.fees.affiliateFee.governmentVoucherAmount);
                    let discount = this.getDiscountValue(dis, selectedVal, feeToDiscount,childDiscountVal, 0);
                  //  console.log("discount$$$$$" + JSON.stringify(discount));
                    let discountVal = this.getAdjustedVal(discount.discountsToDeduct, noOfPlayers);
                    memObj.discountsToDeduct += discountVal;
                    extraDiscountVal = discount.remainingDiscount;
                    memObj.fees.affiliateFee.discountsToDeduct = feeIsNull(memObj.fees.affiliateFee.discountsToDeduct) + discountVal;
                   // console.log("extraDiscountVal" + extraDiscountVal);
                    if(extraDiscountVal > 0){
                        sourceBorrowedOrgId = memObj.fees.affiliateFee.cOrgId;
                    }

                    {
                        let feeToDiscount = feeIsNull(memObj.fees.affiliateFee.nominationFeeToPay) + 
                            feeIsNull(memObj.fees.affiliateFee.nominationGSTToPay) -
                            feeIsNull(memObj.fees.affiliateFee.nominationGVAmount);
                        let discount = this.getDiscountValue(dis, selectedVal, feeToDiscount, nomChildDiscountVal, extraDiscountVal);
                        //console.log("discountVal" + discountVal);
                        let discountVal = this.getAdjustedVal(discount.discountsToDeduct, noOfPlayers);
                        memObj.discountsToDeduct += discountVal;
                        extraDiscountVal = discount.remainingDiscount;
                        memObj.fees.affiliateFee["nomDiscountsToDeduct"] = feeIsNull(memObj.fees.affiliateFee["nomDiscountsToDeduct"]) +  discountVal;
                    }
                }
            }

            // if(extraDiscountVal > 0){
            //     let feeToDiscount = feeIsNull(memObj.fees.affiliateFee.nominationFeeToPay) + 
            //                 feeIsNull(memObj.fees.affiliateFee.nominationGSTToPay) -
            //                 feeIsNull(memObj.fees.affiliateFee.nominationGVAmount);
            //     let discount = this.getDiscountValue(null, selectedVal, feeToDiscount, nomChildDiscountVal, extraDiscountVal);
            //     //console.log("discountVal" + discountVal);
            //     let discountVal = this.getAdjustedVal(discount.discountsToDeduct, noOfPlayers);
            //     memObj.discountsToDeduct += discountVal;
            //     extraDiscountVal = discount.remainingDiscount;
            //     memObj.fees.affiliateFee["nomDiscountsToDeduct"] = feeIsNull(memObj.fees.affiliateFee["nomDiscountsToDeduct"]) +  discountVal;
            //     // let borrowedDiscount = this.getBorrowedDiscountObj(discountVal, sourceBorrowedOrgId, memObj.fees.affiliateFee.cOrgId, 
            //     //     memObj, AppConstants.nomination, item, selectedVal);
            //     // memObj.fees.affiliateFee["nomBorrowedDiscount"] = borrowedDiscount;
            // }

            childDiscountVal = null;
            nomChildDiscountVal = null;
            if(isNotNullAndUndefined(memObj.fees.competitionOrganisorFee)){
                //console.log("Before::" + JSON.stringify(compDiscount.childCompOrgDiscount));
                if(isNotNullAndUndefined(compDiscount) && isNotNullAndUndefined(compDiscount.childCompOrgDiscount))
                {
                    let childDiscount = this.getChildDiscountValue(compDiscount.childCompOrgDiscount, memObj.fees.competitionOrganisorFee,
                        item, childCompDiscountMap, "Comp", extraChildDiscountVal, null);
                    childDiscountVal = this.getAdjustedVal(childDiscount.childDiscountsToDeduct, noOfPlayers);
                    memObj.childDiscountsToDeduct += feeIsNull(childDiscountVal);
                    extraChildDiscountVal = childDiscount.remainingDiscount;
                    memObj.fees.competitionOrganisorFee.childDiscountsToDeduct = childDiscountVal;
                    if(extraChildDiscountVal > 0){
                        sourceChildBorrowedOrgId = memObj.fees.competitionOrganisorFee.cOrgId;
                    }
                    
                    let nomChildDiscount = this.getChildDiscountValue(compDiscount.childCompOrgDiscount, memObj.fees.competitionOrganisorFee,
                                item, childCompDiscountMap, "Nom", extraChildDiscountVal, childDiscount.childDiscount);
                    nomChildDiscountVal = this.getAdjustedVal(nomChildDiscount.childDiscountsToDeduct, noOfPlayers);
                    memObj.childDiscountsToDeduct += feeIsNull(nomChildDiscountVal);
                    if(extraChildDiscountVal > 0){
                        let borrowedDiscount = this.getBorrowedDiscountObj(nomChildDiscountVal, sourceChildBorrowedOrgId, memObj.fees.competitionOrganisorFee.cOrgId, 
                            memObj, AppConstants.nomination, item, selectedVal);
                        memObj.fees.competitionOrganisorFee["nomChildBorrowedDiscount"] = borrowedDiscount;
                    }
                    extraChildDiscountVal = nomChildDiscount.remainingDiscount;
                    memObj.fees.competitionOrganisorFee["nomChildDiscountsToDeduct"] = nomChildDiscountVal;
                    
                }
                else if(extraChildDiscountVal > 0){
                    let childDiscount = this.getChildDiscountValue(null, memObj.fees.competitionOrganisorFee,
                        item, childCompDiscountMap, "Comp", extraChildDiscountVal, null);
                    childDiscountVal = this.getAdjustedVal(childDiscount.childDiscountsToDeduct, noOfPlayers);
                    memObj.childDiscountsToDeduct += feeIsNull(childDiscountVal);
                    extraChildDiscountVal = childDiscount.remainingDiscount;
                    memObj.fees.competitionOrganisorFee.childDiscountsToDeduct = childDiscountVal;
                    if(extraChildDiscountVal > 0){
                        sourceChildBorrowedOrgId = memObj.fees.competitionOrganisorFee.cOrgId;
                        let borrowedDiscount = this.getBorrowedDiscountObj(childDiscountVal, sourceChildBorrowedOrgId, memObj.fees.competitionOrganisorFee.cOrgId, 
                            memObj, AppConstants.competition, item, selectedVal);
                        memObj.fees.competitionOrganisorFee["childBorrowedDiscount"] = borrowedDiscount;
                    }
    
                    if(extraChildDiscountVal > 0){
                        let nomChildDiscount = this.getChildDiscountValue(null, memObj.fees.competitionOrganisorFee,
                            item, childCompDiscountMap, "Nom", extraChildDiscountVal, null);
                        nomChildDiscountVal = this.getAdjustedVal(nomChildDiscount.childDiscountsToDeduct, noOfPlayers);
                        memObj.childDiscountsToDeduct += feeIsNull(nomChildDiscountVal);
                        if(nomChildDiscountVal > 0){
                            let borrowedDiscount = this.getBorrowedDiscountObj(nomChildDiscountVal, sourceChildBorrowedOrgId, memObj.fees.competitionOrganisorFee.cOrgId, 
                                memObj, AppConstants.nomination, item, selectedVal);
                            memObj.fees.competitionOrganisorFee["nomChildBorrowedDiscount"] = borrowedDiscount;
                        }
                        extraChildDiscountVal = nomChildDiscount.remainingDiscount;
                        memObj.fees.competitionOrganisorFee["nomChildDiscountsToDeduct"] = nomChildDiscountVal;
                    }
                   
                }
            }

            if(isNotNullAndUndefined(memObj.fees.competitionOrganisorFee))
            {
                if(isNotNullAndUndefined(compDiscount) && isArrayPopulated(compDiscount.compOrgDiscount)){
                    for(let dis of compDiscount.compOrgDiscount){
                        let feeToDiscount = feeIsNull(memObj.fees.competitionOrganisorFee.feesToPay) + 
                                            feeIsNull(memObj.fees.competitionOrganisorFee.feesToPayGST) -
                                            feeIsNull(memObj.fees.competitionOrganisorFee.governmentVoucherAmount);
                        let discount = this.getDiscountValue(dis, selectedVal, feeToDiscount, childDiscountVal, extraDiscountVal);
                        //console.log("discountVal" + discountVal);
                        let discountVal = this.getAdjustedVal(discount.discountsToDeduct, noOfPlayers);
                        memObj.discountsToDeduct += discountVal;
                        extraDiscountVal = discount.remainingDiscount;
                        memObj.fees.competitionOrganisorFee.discountsToDeduct = feeIsNull(memObj.fees.competitionOrganisorFee.discountsToDeduct) +  discountVal;
                        console.log("extraDiscountVal" + extraDiscountVal);
                        console.log("memObj.fees.competitionOrganisorFee" + JSON.stringify(memObj.fees.competitionOrganisorFee));
                        if(extraDiscountVal > 0){
                            sourceBorrowedOrgId = memObj.fees.competitionOrganisorFee.cOrgId;
                        }
                        console.log("sourceBorrowedOrgId" + sourceBorrowedOrgId);
                        {
                            let feeToDiscount = feeIsNull(memObj.fees.competitionOrganisorFee.nominationFeeToPay) + 
                                    feeIsNull(memObj.fees.competitionOrganisorFee.nominationGSTToPay) -
                                    feeIsNull(memObj.fees.competitionOrganisorFee.nominationGVAmount);
                            let discount = this.getDiscountValue(dis, selectedVal, feeToDiscount, nomChildDiscountVal, extraDiscountVal);
                            //console.log("discountVal" + discountVal);
                            let discountVal = this.getAdjustedVal(discount.discountsToDeduct, noOfPlayers);
                            memObj.discountsToDeduct += discountVal;

                            if(extraDiscountVal > 0){
                                let borrowedDiscount = this.getBorrowedDiscountObj(discountVal, sourceBorrowedOrgId, memObj.fees.competitionOrganisorFee.cOrgId, 
                                    memObj, AppConstants.nomination, item, selectedVal);
                                memObj.fees.competitionOrganisorFee["nomBorrowedDiscount"] = borrowedDiscount;
                            }

                            extraDiscountVal = discount.remainingDiscount;
                            memObj.fees.competitionOrganisorFee["nomDiscountsToDeduct"] = feeIsNull(memObj.fees.competitionOrganisorFee["nomDiscountsToDeduct"]) +  discountVal;
                            
                           
                        }
                    }
                }
                else if(extraDiscountVal > 0){
                    let feeToDiscount = feeIsNull(memObj.fees.competitionOrganisorFee.feesToPay) + 
                                feeIsNull(memObj.fees.competitionOrganisorFee.feesToPayGST) -
                                feeIsNull(memObj.fees.competitionOrganisorFee.governmentVoucherAmount);
                    let discount = this.getDiscountValue(null, selectedVal, feeToDiscount, childDiscountVal, extraDiscountVal);
                    //console.log("discountVal" + discountVal);
                    let discountVal = this.getAdjustedVal(discount.discountsToDeduct, noOfPlayers);
                    memObj.discountsToDeduct += discountVal;
                    if(extraDiscountVal > 0){
                        let borrowedDiscount = this.getBorrowedDiscountObj(discountVal, sourceBorrowedOrgId, memObj.fees.competitionOrganisorFee.cOrgId, 
                            memObj, AppConstants.competition, item, selectedVal);
                        memObj.fees.competitionOrganisorFee["borrowedDiscount"] = borrowedDiscount;
                    }
                    extraDiscountVal = discount.remainingDiscount;
                    memObj.fees.competitionOrganisorFee.discountsToDeduct = feeIsNull(memObj.fees.competitionOrganisorFee.discountsToDeduct) +  discountVal;
                   

                    {
                        let feeToDiscount = feeIsNull(memObj.fees.competitionOrganisorFee.nominationFeeToPay) + 
                        feeIsNull(memObj.fees.competitionOrganisorFee.nominationGSTToPay) -
                        feeIsNull(memObj.fees.competitionOrganisorFee.nominationGVAmount);
                        let discount = this.getDiscountValue(null, selectedVal, feeToDiscount, nomChildDiscountVal, extraDiscountVal);
                        //console.log("discountVal" + discountVal);
                        let discountVal = this.getAdjustedVal(discount.discountsToDeduct, noOfPlayers);
                        memObj.discountsToDeduct += discountVal;
                        if(extraDiscountVal > 0){
                            let borrowedDiscount = this.getBorrowedDiscountObj(discountVal, sourceBorrowedOrgId, memObj.fees.competitionOrganisorFee.cOrgId, 
                                memObj, AppConstants.nomination, item, selectedVal);
                            memObj.fees.competitionOrganisorFee["nomBorrowedDiscount"] = borrowedDiscount;
                        }
                        extraDiscountVal = discount.remainingDiscount;
                        memObj.fees.competitionOrganisorFee["nomDiscountsToDeduct"] = feeIsNull(memObj.fees.competitionOrganisorFee["nomDiscountsToDeduct"]) +  discountVal;
                    }
                }
            }

            childDiscountVal = null;
            nomChildDiscountVal = null;
            if(isNotNullAndUndefined(memObj.fees.membershipFee)) {
                if(isNotNullAndUndefined(memDiscount) && isNotNullAndUndefined(memDiscount.childMembershipDiscount)){
                // console.log("**************")
                    let childDiscount = this.getChildDiscountValue(memDiscount.childMembershipDiscount, memObj.fees.membershipFee,
                        item, childMemDiscountMap, "Mem", extraChildDiscountVal, null);
                    memObj.childDiscountsToDeduct += feeIsNull(childDiscount.childDiscountsToDeduct);
                    extraChildDiscountVal = childDiscount.remainingDiscount;
                    memObj.fees.membershipFee.childDiscountsToDeduct = childDiscount.childDiscountsToDeduct;
                    
                }
                else if(extraChildDiscountVal > 0){
                    let childDiscount = this.getChildDiscountValue(null, memObj.fees.membershipFee,
                        item, childMemDiscountMap, "Mem", extraChildDiscountVal, null);
                    memObj.childDiscountsToDeduct += feeIsNull(childDiscount.childDiscountsToDeduct);
                    extraChildDiscountVal = childDiscount.remainingDiscount;
                    memObj.fees.membershipFee.childDiscountsToDeduct = childDiscount.childDiscountsToDeduct; 
                }
            }

            if(isNotNullAndUndefined(memObj.fees.membershipFee)){

                if(isNotNullAndUndefined(memDiscount) && isArrayPopulated(memDiscount.membershipDiscount))
                {
                    // console.log("memObj.fees.membershipFee.feesToPay" + memObj.fees.membershipFee.feesToPay);
                    for(let dis of memDiscount.membershipDiscount){
                        let feeToDiscount = feeIsNull(memObj.fees.membershipFee.feesToPay) + feeIsNull(memObj.fees.membershipFee.feesToPayGST) - 
                                                feeIsNull(memObj.fees.membershipFee.governmentVoucherAmount);
                        let discount = this.getDiscountValue(dis, selectedVal, feeToDiscount, childDiscountVal, extraDiscountVal);
                        memObj.discountsToDeduct += discount.discountsToDeduct;
                        extraDiscountVal = discount.remainingDiscount;
                        memObj.fees.membershipFee.discountsToDeduct = feeIsNull(memObj.fees.membershipFee.discountsToDeduct) +  discount.discountsToDeduct;
                    }
                }
                else if (extraDiscountVal > 0){
                    let feeToDiscount = feeIsNull(memObj.fees.membershipFee.feesToPay) + feeIsNull(memObj.fees.membershipFee.feesToPayGST) - 
                                                feeIsNull(memObj.fees.membershipFee.governmentVoucherAmount);
                    let discount = this.getDiscountValue(null, selectedVal, feeToDiscount, childDiscountVal, extraDiscountVal);
                    memObj.discountsToDeduct += discount.discountsToDeduct;
                    extraDiscountVal = discount.remainingDiscount;
                    memObj.fees.membershipFee.discountsToDeduct = feeIsNull(memObj.fees.membershipFee.discountsToDeduct) +  discount.discountsToDeduct; 
                    console.log("discount.discountsToDeduct" + discount.discountsToDeduct);
                    if(discount.discountsToDeduct > 0){
                        let borrowedDiscount = this.getBorrowedDiscountObj(discount.discountsToDeduct, sourceBorrowedOrgId, memObj.fees.membershipFee.mOrgId, 
                            memObj, AppConstants.membership, item, selectedVal);
                        console.log("#######" + JSON.stringify(borrowedDiscount));
                        memObj.fees.membershipFee["borrowedDiscount"] = borrowedDiscount;
                    }
                }
            }
        } catch (error) {
            logger.error(`Exception occurred in performDiscountCalculation:: ${error}`);
            throw error;
        }
    }

    private getDiscountValue(discount, selectedVal, feeAmt, childDiscountVal, extraDiscountVal){
        try{
            console.log("getDiscountValue::" + JSON.stringify(discount));
            let discountsToDeduct = 0;
            let feesToPay = 0;
            let remainingDiscount = 0;
            let amount = discount ? Number(discount.amount) : extraDiscountVal;
            if(childDiscountVal!= null && childDiscountVal!= 0){
                feesToPay = feeIsNull(feeAmt) - feeIsNull(childDiscountVal);
            }
            else{
                feesToPay = feeAmt;
            }
          //  console.log("feesToPay" + feesToPay);
            // if(selectedVal.paymentOptionRefId == 5 && selectedVal.isSchoolRegCodeApplied == 1){
            //     discountsToDeduct = 0;
            // }
            if((discount && discount.discountTypeId == 1) || extraDiscountVal > 0){
                let feesVal = feeIsNull(feesToPay);
                let disVal = feeIsNull(amount);
                if(feesVal > 0){
                    if(disVal > feesVal){
                        discountsToDeduct = feesVal;
                        remainingDiscount = (disVal - feesVal);
                        if(discount)
                            discount["amount"] = remainingDiscount;
                    }
                    else{
                        discountsToDeduct = disVal;
                        if(discount)
                            discount["amount"] = 0;
                    }
                }
                else{
                    remainingDiscount = disVal;
                }
               // discountsToDeduct =  feeIsNull(feeAmt) > 0 ?   (Number(discount.amount)) : 0;
            }
            else{
                if(selectedVal.paymentOptionRefId!= null){
                    if(feeIsNull(feesToPay) > 0){
                        if(selectedVal.paymentOptionRefId > 2){
                            discountsToDeduct = (feeIsNull(feesToPay) * (this.getAdjustedVal(amount, 100))) ;
                        }
                        else{
                            if(selectedVal.paymentOptionRefId == 2){
                                discountsToDeduct = (feeIsNull(feesToPay) * feeIsNull(selectedVal.gameVoucherValue)) * (this.getAdjustedVal(amount,100));
                            }
                            else{
                                discountsToDeduct = feeIsNull(feesToPay) * (this.getAdjustedVal(amount, 100));
                            }
                        }
                    }
                }
            }
            return {discountsToDeduct: discountsToDeduct, remainingDiscount: remainingDiscount};
        }
        catch(error){
            logger.error(`Exception occurred in getDiscountValue ${error}`);
            throw error;
        }
        
       
    }

    private getChildDiscountValue(discount, fee, item, childDiscountMap, key, extraDiscountVal, appliedDiscount){
        try {
            console.log("discount" + JSON.stringify(discount) + "key::" + key);
            console.log("appliedDiscount" + JSON.stringify(appliedDiscount));
            console.log("registeringYourselfRefId" + JSON.stringify(item.registeringYourselfRefId));
            console.log("item.hasChildRegistered" + JSON.stringify(item.hasChildRegistered));

            let childDiscountsToDeduct = null;
            let remainingDiscount = 0;
            let registeringYourselfRefId = item.registeringYourselfRefId;
            let childDiscount = appliedDiscount ? appliedDiscount : null;
            //if(participantAge <= 18){
            if((registeringYourselfRefId == 2  || (registeringYourselfRefId == 1 && item.hasChildRegistered))){
                console.log("%%%%%%%%%%%%%%%%%")
                if(childDiscount == null && discount && isArrayPopulated(discount.childDiscounts)){
                    for(let i of  discount.childDiscounts){
                        if(key == "Mem"){
                            if(childDiscountMap.get(i.membershipProductTypeChildDiscountId) == undefined){
                                childDiscount = i;
                                childDiscountMap.set(i.membershipProductTypeChildDiscountId,key)
                                break; 
                            }
                        }
                        else if(key == "Comp" || key == "Nom"){
                            if(childDiscountMap.get(i.competitionTypeChildDiscountId) == undefined){
                                childDiscount = i;
                                childDiscountMap.set(i.competitionTypeChildDiscountId,key)
                                break; 
                            }
                        }
                    }
                }
                console.log("%%%%%%" + JSON.stringify(childDiscount));
                let feeDiscount = 0;
                let gstDiscount = 0;
                let feeAmt = 0;
                if(key == "Nom"){
                    feeAmt = (feeIsNull(fee.nominationFeeToPay) + feeIsNull(fee.nominationGSTToPay)) - feeIsNull(fee.nominationGVAmount); 
                }
                else{
                    feeAmt = (feeIsNull(fee.feesToPay) + feeIsNull(fee.feesToPayGST)) - feeIsNull(fee.governmentVoucherAmount); 
                }
                
                let discountAmt = childDiscount ? feeIsNull(childDiscount.amount) : extraDiscountVal;  
                
                console.log("discountAmt" + discountAmt);
                if( (discount && discount.discountTypeId == DiscountType.Amount && isNullOrUndefined(childDiscount)) 
                                || extraDiscountVal > 0){
                    if(feeAmt > 0){
                        if(discountAmt > feeAmt){
                            feeDiscount = feeAmt;
                            remainingDiscount = (discountAmt - feeAmt);
                            if(childDiscount){
                                childDiscount["amount"] = remainingDiscount;
                            }

                        }
                        else{
                            feeDiscount = discountAmt;
                            if(childDiscount){
                                childDiscount["amount"] = 0;
                            }
                        }
                    }
                }
                else if(isNullOrUndefined(childDiscount) && (discount && discount.discountTypeId == DiscountType.Percentage)){
                    if(feeAmt > 0){
                        if(key == "Nom"){
                            feeDiscount = ((feeIsNull(fee.nominationFeeToPay) - feeIsNull(fee.nominationGVAmount)) * (this.getAdjustedVal(childDiscount.amount, 100)));
                            gstDiscount = ((feeIsNull(fee.nominationGSTToPay) - feeIsNull(fee.nominationGVAmount)) * (this.getAdjustedVal(childDiscount.amount, 100)));
                        }
                        else{
                            feeDiscount = ((feeIsNull(fee.feesToPay) - feeIsNull(fee.governmentVoucherAmount)) * (this.getAdjustedVal(childDiscount.amount, 100)));
                            gstDiscount = ((feeIsNull(fee.feesToPayGST) - feeIsNull(fee.governmentVoucherAmount)) * (this.getAdjustedVal(childDiscount.amount, 100)));
                        }
                    }
                }
                
                childDiscountsToDeduct = feeDiscount + gstDiscount;
                
            }
            return {childDiscountsToDeduct: childDiscountsToDeduct, remainingDiscount: remainingDiscount, childDiscount: childDiscount};
        } catch (error) {
            logger.error(`Exception occurred in getChildDiscountValue: ${error}`);
            throw error;
        }
    }

    private findMembershipDiscounts (selectedVal, membershipDiscounts, f, memDiscount ){
        try {
            if(selectedVal!= null && selectedVal.selectedDiscounts != null)
        {
            let membDiscounts = membershipDiscounts.filter(x=>x.membershipMappingId == 
                f.membershipMappingId && x.organisationId == f.mOrganisationId);
            if(isArrayPopulated(membDiscounts)){
                let discounts = selectedVal.selectedDiscounts.filter(y=> y.membershipMappingId == f.membershipMappingId);
                let childDiscount = membDiscounts.find(x=>x.membershipProductTypediscountTypeId == 3);
                memDiscount.childMembershipDiscount = childDiscount;

                if(isArrayPopulated(discounts)){
                    for(let dis of discounts){
                        let membershipDiscount = membDiscounts.find(y=> y.code == dis.discountCode);
                        if(isNotNullAndUndefined(membershipDiscount)){
                            memDiscount.membershipDiscount.push(membershipDiscount);
                        }
                    }
                   
                }
            }
        }
        } catch (error) {
            logger.error(`Exception occurred in findMembershipDiscounts ${error}`);
            throw error;
        }
    }

    private findCompetitionDiscounts(selectedVal, discounts, f)
    {
        try {
            let childCompetitionDiscount = null;
            let competitionDiscount = [];
            if(selectedVal!= null && selectedVal.selectedDiscounts != null)
            {
                let compDiscounts = discounts.filter(x=>x.competitionMembershipProductTypeId == 
                    f.competitionMembershipProductTypeId && x.organisationId == f.cOrganisationId);
                if(isArrayPopulated(compDiscounts)){
                    let discountsArr = selectedVal.selectedDiscounts.
                        filter(y=> y.competitionMembershipProductTypeId == 
                            f.competitionMembershipProductTypeId);
                     childCompetitionDiscount = compDiscounts.find(x=>x.competitionTypediscountTypeId == 3);
                    if(isArrayPopulated(discountsArr)){
                        for(let dis of discountsArr){
                            let compDis = compDiscounts.find(x=>x.code == dis.discountCode);
                            if(isNotNullAndUndefined(compDis)){
                                competitionDiscount.push(compDis);
                            }
                        }
                    }
                }
            }
            return {childCompetitionDiscount, competitionDiscount}
        } catch (error) {
           logger.error(`Exception occurred in findCompetitionDiscounts: ${error}`); 
        }
    }

    private getInstalmentChildDiscountValue(discount, fee, item, childDiscountMap, key, memObj){
        try {
            let childDiscountsToDeduct = null;
            //let participantAge = getAge(item.dateOfBirth);
            let registeringYourselfRefId = item.registeringYourselfRefId;
            if(registeringYourselfRefId == 2 || (registeringYourselfRefId == 1 && item.hasChildRegistered)){
                if(isArrayPopulated(discount.childDiscounts)){
                    let childDiscount = null;
                    for(let i of  discount.childDiscounts){
                        if(key == "Mem"){
                            if(childDiscountMap.get(i.membershipProductTypeChildDiscountId) == undefined){
                                childDiscount = i;
                                childDiscountMap.set(i.membershipProductTypeChildDiscountId,1)
                                break; 
                            }
                        }
                        else if(key == "Comp"){
                            if(childDiscountMap.get(i.competitionTypeChildDiscountId) == undefined){
                                childDiscount = i;
                                childDiscountMap.set(i.competitionTypeChildDiscountId,1)
                            }
                            break;
                        }
                    }
                   // console.log("((((((((((" + JSON.stringify(childDiscount) + "*****" +fee );
                    if(isNullOrUndefined(childDiscount)){
                        if(discount.discountTypeId == DiscountType.Amount){
                            childDiscountsToDeduct = feeIsNull(childDiscount.amount);
                        }
                        else if(discount.discountTypeId == DiscountType.Percentage){
                            childDiscountsToDeduct = (feeIsNull(fee) * (this.getAdjustedVal(childDiscount.amount, 100)));
                        }
                    }
                }
            }
            return childDiscountsToDeduct;
        } catch (error) {
            logger.error(`Exception occurred in getChildDiscountValue: ${error}`);
            throw error;
        }
    }

    private getBorrowedDiscountObj(discountAmt, sourceOrgId, targetOrgId, mem, feeType, item, selectedVal){
        try {
            let trxn = {
                firstName: mem.firstName,
                lastName: mem.lastName,
                mobileNumber: mem.mobileNumber,
                email: mem.email,
                feeAmount:  discountAmt,
                feeType: feeType,
                membershipProductMappingId: mem.membershipMappingId,
                competitionId:  item.competitionId,
                organisationId : targetOrgId,
                divisionId: mem.divisionId,
                sourceOrgId: sourceOrgId,
                paymentOptionRefId: selectedVal.paymentOptionRefId,
                membershipTypeName: mem.membershipTypeName
            }

            return trxn;
        } catch (error) {
            logger.error(`Exception occurred in prepareBorrowedDiscount ${error}`);
        }
    }

    private sortParticipants(participants){
        try {
            participants.sort((a, b) => (b.registeringYourselfRefId < a.registeringYourselfRefId) ? 1 : -1)

            return participants;
        } catch (error) {
            throw error;
        }
    }

    private getInstalmentDatesToPay(instalmentDates, item){
        try {
            let totalDates = 0;
            let paidDates = 0;
            let futureDates = [];
            if(item.isTeamRegistration == 1){
                if(item.isTeamSeasonalUponReg == 1){
                    totalDates += 1;
                    paidDates += 1;
                }
            }
            else{
                if(item.isSeasonalUponReg == 1){
                    totalDates += 1;
                    paidDates += 1;
                }
            }

            if(isArrayPopulated(instalmentDates)){
                totalDates += instalmentDates.length;
                instalmentDates.map((x) =>{
                    if(moment(x.instalmentDate).isBefore(moment())){
                        paidDates += 1;
                    }
                    else{
                        futureDates.push(x.instalmentDate);
                    }
                })
            }

            return {
                totalDates,
                paidDates,
                futureDates
            }
        } catch (error) {
            throw error;
        }
    }

    private getPaymentOptions(paymentOptions, compPartObj, selectedObj, fees){
        // let payMap = new Map();
        // let gameMap = new Map();
        for(let op of paymentOptions){
            let opt = this.getPaymentOptionRefId(op.paymentOptionRefId, op.feesTypeRefId);
            if(opt!= 0){

                let pObj = 
                {
                    "feesTypeRefId": op.feesTypeRefId,
                    "paymentOptionRefId": opt
                }

                compPartObj.paymentOptions.push(pObj);

                // let subObj = {
                //     "paymentOptionRefId": op.paymentOptionRefId
                // }
                
                // if(payMap.get(opt) == undefined){
                //     let pObj = 
                //     {
                //         "feesTypeRefId": op.feesTypeRefId,
                //         "paymentOptionRefId": opt,
                //         "subOptions":[]
                //     }
                //     pObj.subOptions.push(subObj);

                //     compPartObj.paymentOptions.push(pObj);
                //     payMap.set(opt, pObj);
                // }
                // else{
                //     let objTemp = payMap.get(opt);
                //     objTemp.subOptions.push(subObj);
                // }

                // if((op.feesTypeRefId == 1 || op.feesTypeRefId == 3) && op.paymentOptionRefId >= 4 && 
                //     op.paymentOptionRefId <= 15)
                // {
                //     if(gameMap.get(op.description) == undefined){
                //         compPartObj.gameVouchers.push(op.description);
                //         gameMap.set(op.description, op.description);
                //     }
                // }
            }
        }

        if(selectedObj.paymentOptionRefId == 5 && selectedObj.isSchoolRegCodeApplied == 0){
            let option3 = compPartObj.paymentOptions.find(x=> x.feesTypeRefId == 3 && 
                x.paymentOptionRefId == 3);
            if(isNotNullAndUndefined(option3)){
                let schoolOption = compPartObj.paymentOptions.find(x=> x.feesTypeRefId == 3 && 
                    x.paymentOptionRefId == 5);
                if(isNotNullAndUndefined(schoolOption)){
                    if(isArrayPopulated(option3.subOptions)){
                        schoolOption.subOptions.push(...option3.subOptions);
                    }
                }
            }

            let option2 = compPartObj.paymentOptions.find(x=> x.feesTypeRefId == 2 && 
                x.paymentOptionRefId == 3);
            if(isNotNullAndUndefined(option2)){
                let schoolOption = compPartObj.paymentOptions.find(x=> x.feesTypeRefId == 3 && 
                    x.paymentOptionRefId == 5);
                if(isNotNullAndUndefined(schoolOption)){
                    if(isArrayPopulated(option2.subOptions)){
                        schoolOption.subOptions.push(...option2.subOptions);
                    }
                }
            }
        }

        if(selectedObj.paymentOptionRefId == null){
            selectedObj.paymentOptionRefId = (isArrayPopulated(compPartObj.paymentOptions) ? 
            compPartObj.paymentOptions[0].paymentOptionRefId: null);

            if(selectedObj.paymentOptionRefId == 1){
                this.setTeamRegChargeType(fees, selectedObj);
            }
        }
    }

    private setSelectedObj(selectedVal, compPartObj, fees)
    {
        try {
            let selectedObj = {
                "paymentOptionRefId": null,
                "gameVoucherValue": null,
                "selectedGovernmentVouchers":[],
                "vouchers": [],
                "selectedSchoolRegCode": null,
                "isSchoolRegCodeApplied": 0,
                "isHardshipCodeApplied": 0,
                "selectedDiscounts":[],
                "discountCodes": [],
                "nominationPayOptionRefId": null,
                "teamRegChargeTypeRefId": null
            }
    
           
            if(isNotNullAndUndefined(selectedVal)){
                selectedObj.selectedDiscounts = selectedVal.selectedOptions.selectedDiscounts;
                selectedObj.discountCodes = selectedVal.selectedOptions.discountCodes;
                selectedObj.gameVoucherValue = selectedVal.selectedOptions.gameVoucherValue;
                (selectedVal.selectedOptions.selectedGovernmentVouchers || []).map((item, index) =>{
                    item["remainingAmount"] = item.balance;
                    item["redeemAmount"] = 0;
                });
                selectedObj.selectedGovernmentVouchers = selectedVal.selectedOptions.selectedGovernmentVouchers;
               
                selectedObj.vouchers = selectedVal.selectedOptions.vouchers;
                selectedObj.selectedSchoolRegCode = selectedVal.selectedOptions.selectedSchoolRegCode;
                selectedObj.isSchoolRegCodeApplied = selectedVal.selectedOptions.isSchoolRegCodeApplied;
                selectedObj.isHardshipCodeApplied = selectedVal.selectedOptions.isHardshipCodeApplied ? 
                                    selectedVal.selectedOptions.isHardshipCodeApplied : 0;
                if(selectedVal.selectedOptions.paymentOptionRefId == null){
                    selectedObj.paymentOptionRefId = (isArrayPopulated(compPartObj.paymentOptions) ? 
                    compPartObj.paymentOptions[0].paymentOptionRefId: null)
                }
                else{
                    selectedObj.paymentOptionRefId = selectedVal.selectedOptions.paymentOptionRefId;
                }
    
                selectedObj.nominationPayOptionRefId = selectedVal.selectedOptions.nominationPayOptionRefId ? 
                                selectedVal.selectedOptions.nominationPayOptionRefId : 1;
                //selectedObj.nominationPayOptionRefId = 1;
                selectedObj.teamRegChargeTypeRefId = selectedVal.teamRegChargeTypeRefId;
                if(selectedObj.paymentOptionRefId == 1){
                    this.setTeamRegChargeType(fees,selectedObj);
                 }
            }
            else{
                console.log("###!!!" + JSON.stringify(compPartObj.paymentOptions));
                selectedObj.paymentOptionRefId = (isArrayPopulated(compPartObj.paymentOptions) ? 
                    compPartObj.paymentOptions[0].paymentOptionRefId: null)
                   
                if(selectedObj.paymentOptionRefId == 1){
                   this.setTeamRegChargeType(fees,selectedObj);
                }
                else{
                    if(compPartObj.noOfPlayers == compPartObj.payingForCount){
                        selectedObj.nominationPayOptionRefId = 1;
                    }
                    else{
                        selectedObj.nominationPayOptionRefId = 2;
                    }
                }
            }

            return selectedObj;
        } catch (error) {
            logger.error(`Exception occurred in setSelectedObj ${error}`);
            throw error;
        }
        

        
    }

    private setTeamRegChargeType(fees, selectedObj){
        try {
            //console.log("fee" + JSON.stringify(fees));

            let fee = fees.find(x=> x.teamRegChargeTypeRefId!= null && x.teamRegChargeTypeRefId!= 1);
            if(fee){
                if(fee.teamRegChargeTypeRefId == 2){
                    selectedObj.nominationPayOptionRefId = 1;
                    selectedObj.teamRegChargeTypeRefId = 2;
                }
                else if(fee.teamRegChargeTypeRefId == 3){
                    selectedObj.nominationPayOptionRefId = 2;
                    selectedObj.teamRegChargeTypeRefId = 3;
                }
            }
        } catch (error) {
            logger.error(`Exception occurred in setTeamRegChargeType ${error}`);
        }
    }

    private async calculateTeamFees(teamMembers, item, participants, memObj, memTeamFeesRestrictList, memCapList){
        try {
             //console.log("teamMembers::" + JSON.stringify(teamMembers));
            //  console.log("item.fees" + JSON.stringify(item.fees));
            let transArr = [];
            let fees = item.fees;
            // let discounts = item.discounts;
            // let membershipDiscounts = item.membershipDiscounts;
            let selectedVal = item.selectedOptions;

            if(isArrayPopulated(teamMembers)){
                let filteredTeamMembers = teamMembers.filter(x=>x.teamName == item.teamName);
                 //console.log("filteredTeamMembers" + JSON.stringify(filteredTeamMembers));
                // console.log("selectedVal.nominationPayOptionRefId" + selectedVal.nominationPayOptionRefId);
                if(isArrayPopulated(filteredTeamMembers)){
                    for(let team of filteredTeamMembers){
                        let payingFor = team.payingFor;
                        if(selectedVal.nominationPayOptionRefId == 1){
                            payingFor = 1;
                        }
                        let mFee = 0; let mGST = 0; let cFee = 0;
                        let cGST = 0; let aFee = 0; let aGST = 0;
                        let mDiscountVal = 0; let cDiscountVal = 0; let aDiscountVal = 0;
                        let nominationFee = 0; let nominationGST = 0;
                        let compFee = fees.find(x=>x.competitionMembershipProductTypeId == 
                            team.competitionMembershipProductTypeId && x.cOrganisationId == team.compOrgUniqueKey &&
                            x.allowTeamRegistrationTypeRefId == 1);
                        let compFees = fees.filter(x=>x.competitionMembershipProductTypeId == 
                            team.competitionMembershipProductTypeId && x.cOrganisationId == team.compOrgUniqueKey &&
                            x.allowTeamRegistrationTypeRefId == 1);
                        // console.log("compFees" + JSON.stringify(compFees));
                        // console.log("@@@@@compFee::" + JSON.stringify(compFee));
                        
                        let extraDiscount = 0;
                        if(team.isPlayer == 1 && payingFor == 0){
                            let affFee = fees.find(x=>x.competitionMembershipProductTypeId == 
                                team.competitionMembershipProductTypeId && x.cOrganisationId == team.affiliateOrgUniqueKey &&
                                x.allowTeamRegistrationTypeRefId == 1);
                            if(isNotNullAndUndefined(affFee)){
                                nominationFee = this.getAdjustedVal(this.getFutureNominationFee(affFee.nominationTeamSeasonalFee,selectedVal), item.noOfPlayers);
                                nominationGST =  this.getAdjustedVal(this.getFutureNominationFee(affFee.nominationTeamSeasonalGST, selectedVal), item.noOfPlayers);
                                if(affFee.teamRegChargeTypeRefId == 1){
                                    aFee = this.getAdjustedVal(affFee.teamSeasonalFee, item.noOfPlayers);
                                    aGST = this.getAdjustedVal(affFee.teamSeasonalGST, item.noOfPlayers);
                                    if(memObj){
                                        if(isNotNullAndUndefined(memObj.affDiscount) && isArrayPopulated(memObj.affDiscount.affiliateDiscount)){
                                            for(let dis of memObj.affDiscount.affiliateDiscount){
                                                let feeToDiscount = aFee + aGST;
                                                let discount = this.getDiscountValue(dis, selectedVal, feeToDiscount,
                                                    0, 0);
                                                let discountVal = this.getAdjustedVal(discount.discountsToDeduct, item.noOfPlayers);
                                                aDiscountVal += discountVal;
                                                extraDiscount = discount.remainingDiscount;
                                            }
                                        }
                                    }
                                    if(aFee){
                                        let aTrans = this.getTransactionObj(aFee,aGST, aDiscountVal,"affiliate", team.competitionId,
                                        team.affiliateOrgId,compFee.membershipMappingId,team, affFee.divisionId, nominationFee, nominationGST);
                                        transArr.push(aTrans);
                                    }
                                }
                                else{
                                    if(nominationFee){
                                        let aTrans = this.getTransactionObj(0,0, 0,"affiliate", team.competitionId,
                                        team.affiliateOrgId,compFee.membershipMappingId,team, affFee.divisionId, nominationFee, nominationGST);
                                        transArr.push(aTrans);
                                    }
                                }
                            }
                        }
                       
                       if(selectedVal.nominationPayOptionRefId == 1 || 
                        (selectedVal.nominationPayOptionRefId == 2 && payingFor == 0)){
                        if(isNotNullAndUndefined(compFee)){
                            cFee = this.getAdjustedVal(compFee.teamSeasonalFee, item.noOfPlayers);
                            cGST = this.getAdjustedVal(compFee.teamSeasonalGST, item.noOfPlayers); 
                           
                            nominationFee = this.getAdjustedVal(this.getFutureNominationFee(compFee.nominationTeamSeasonalFee,selectedVal), item.noOfPlayers);
                            nominationGST = this.getAdjustedVal(this.getFutureNominationFee(compFee.nominationTeamSeasonalGST, selectedVal), item.noOfPlayers);
                            
                            if((selectedVal.nominationPayOptionRefId == 1 && team.payingFor == 0) || 
                                (selectedVal.nominationPayOptionRefId == 2 && payingFor == 0)){
                                let checkFee = this.checkMemProductFeesType(compFee, team, participants, selectedVal,
                                    memTeamFeesRestrictList, memCapList);
                                //console.log('checkFee' + JSON.stringify(checkFee));
                                if(checkFee.isExists){
                                    if(checkFee.paymentFeeTypeRefId == 2){
                                        mFee = checkFee.amount;
                                        mGST = checkFee.gst; 
                                    }
                                }
                                else{
                                    if(selectedVal.paymentOptionRefId == 1){
                                        mFee = feeIsNull(compFee.mCasualFee);
                                        mGST = feeIsNull(compFee.mCasualGST);
                                    }
                                    else{
                                        mFee = feeIsNull(compFee.mSeasonalFee);
                                        mGST = feeIsNull(compFee.mSeasonalGST);
                                    }
                                }
                                
                                if(memObj){
                                    if(isNotNullAndUndefined(memObj.memDiscount) && 
                                            isArrayPopulated(memObj.memDiscount.membershipDiscount)){
                                        for(let dis of memObj.memDiscount.membershipDiscount){
                                            let feeToDiscount = mFee + mGST;
                                            let discount = this.getDiscountValue(dis, selectedVal, feeToDiscount,0, extraDiscount);
                                            mDiscountVal += discount.discountsToDeduct;
                                            extraDiscount = discount.remainingDiscount;
                                        }
                                    }
                                    else if(extraDiscount > 0){
                                        let feeToDiscount = mFee + mGST;
                                        let discount = this.getDiscountValue(null, selectedVal, feeToDiscount,0, extraDiscount);
                                        mDiscountVal += discount.discountsToDeduct;
                                        extraDiscount = discount.remainingDiscount; 
                                    }
                                }
    
                                let divisionId = null;
                                if(team.isPlayer){
                                    divisionId = compFee.divisionId;
                                }
    
                                //console.log("************" + mFee);
                                
                                if(mFee){
                                    let mTran = this.getTransactionObj(mFee,mGST, mDiscountVal,"membership", team.competitionId,
                                    compFee.mOrgId,compFee.membershipMappingId,team, divisionId, 0, 0);
                                    transArr.push(mTran);
    
                                    // Insert into 
                                    if(checkFee.isExists){
                                        this.addToMemFeesRestrictList(memTeamFeesRestrictList,item,team.membershipProductTypeMappingId,
                                            selectedVal, mFee, compFee.membershipProductId, item.isTeamRegistration);
                                    }
                                    
                                }
                            }
                            

                            if(team.isPlayer == 1 && payingFor == 0 ){
                                if(compFee.teamRegChargeTypeRefId == 1){
                                    if(memObj){
                                        if(isNotNullAndUndefined(memObj.compDiscount) && isArrayPopulated(memObj.compDiscount.compOrgDiscount)){
                                            for(let dis of memObj.compDiscount.compOrgDiscount){
                                                let feeToDiscount = cFee + cGST;
                                                let discount = this.getDiscountValue(dis, selectedVal, feeToDiscount,
                                                    0, extraDiscount);
                                                let discountVal = this.getAdjustedVal(discount.discountsToDeduct, item.noOfPlayers);
                                                cDiscountVal += discountVal;
                                                extraDiscount = discount.remainingDiscount;
                                            }
                                        }
                                        else if(extraDiscount > 0){
                                            let feeToDiscount = cFee + cGST;
                                            let discount = this.getDiscountValue(null, selectedVal, feeToDiscount,
                                                0, extraDiscount);
                                            let discountVal = this.getAdjustedVal(discount.discountsToDeduct, item.noOfPlayers);
                                            cDiscountVal += discountVal;
                                            extraDiscount = discount.remainingDiscount;
                                        }
                                        
                                    }
                                    
                                    if(cFee){
                                        let cTrans = this.getTransactionObj(cFee,cGST, cDiscountVal,"competition", team.competitionId,
                                        team.compOrgId,compFee.membershipMappingId,team, compFee.divisionId, nominationFee, nominationGST);
                                        transArr.push(cTrans);
                                    }
                                }
                                else{
                                    if(nominationFee){
                                        let cTrans = this.getTransactionObj(0,0, 0,"competition", team.competitionId,
                                        team.compOrgId,compFee.membershipMappingId,team, compFee.divisionId, nominationFee, nominationGST);
                                        transArr.push(cTrans);
                                    }
                                }
                            }
                          }
                       }
                    }
                }
            }
           
            return transArr;
        } catch (error) {
            logger.error(`Exception occurred in calculateTeamFees ${error}`);
            throw error;
        }
    }

    private async teamDataToDBTrack(transArr,  registrationId, registrationCreatedBy){
        try {
           // console.log("transArr"+ JSON.stringify(transArr));
                    /// Insert into DB
            const stepId = RegistrationStep.TeamInviteTrackStep;
            if(isArrayPopulated(transArr)){
                let trackData = await this.entityManager.query(`select * from  wsa_registrations.registrationTrack  where registrationId = ? and stepsId = ? and isDeleted = 0`,
                            [registrationId, stepId]);
                if(isArrayPopulated(trackData)){
                    //console.log("************");
                    await this.entityManager.query(`Update wsa_registrations.registrationTrack set jsonData = ? where registrationId = ? and stepsId = ?`,
                    [JSON.stringify(transArr), registrationId, stepId]);
                }
                else{
                   // console.log("$$$$$$$$");
                    await this.entityManager.query(`insert into wsa_registrations.registrationTrack(registrationId, stepsId,jsonData,createdBy) values(?,?,?,?)`,
                    [registrationId,stepId, JSON.stringify(transArr), registrationCreatedBy]);
                }
            }
            else{
                await this.entityManager.query(`Update wsa_registrations.registrationTrack set isDeleted = 1 where registrationId = ? and stepsId = ?`,
                [registrationId, stepId]);
            }
        } catch (error) {
            logger.error(`Exception occurred in teamDataToDBTrack ${error}`);
            throw error;
        }
    }

    private async calculateInstalmentFees(memObj, item, childCompDiscountMapIns){
        let transArr = [];
        try {
            let noOfPlayers =  isNullOrUndefined(item.noOfPlayers) ? item.noOfPlayers : 1;
            let payingForCount =  isNullOrUndefined(item.payingForCount) ? item.payingForCount : 1;

            let selectedVal = item.selectedOptions;
            let instalmentDates = item.instalmentDates;
            if(selectedVal!= null && selectedVal.paymentOptionRefId == 4){
                let totalDates = 0; let paidDates = 0;
                let futureDates = [];
                let dates = this.getInstalmentDatesToPay(instalmentDates, item);
                totalDates = dates.totalDates;
                paidDates = dates.paidDates;
                futureDates = dates.futureDates;
                let remainingDays = totalDates - paidDates;
                //console.log("dates::" + JSON.stringify(dates));
                let members = [];
                let obj = {
                    firstName: memObj.firstName,
                    lastName: memObj.lastName,
                    mobileNumber: memObj.mobileNumber,
                    email: memObj.email,
                    onlyCompetition: 0
                }
                members.push(obj);

                

                // if(item.isTeamRegistration == 1){
                //     let filteredTeamMembers = teamMembers.filter(x=>x.teamName == item.teamName && 
                //         x.payingFor == 1 && x.isPlayer == 1);
                //     if(isArrayPopulated(filteredTeamMembers)){
                //        filteredTeamMembers.map((y) =>{
                //         let obj = {
                //             firstName: y.firstName,
                //             lastName: y.lastName,
                //             mobileNumber: y.mobileNumber,
                //             email: y.email,
                //             onlyCompetition: 1
                //         }
                //         members.push(obj);
                //        });
                //     }
                // }

               // console.log("******** Member::" + JSON.stringify(members));
                for(let member of members){
                    for(let i = 0; i < remainingDays; i++){
                        let fee = 0; let gst = 0; let discountAmt = 0; let familydiscount = 0;
                        let nominationFee = 0; let nominationGST = 0;
                      //  console.log("futureDates" + JSON.stringify(futureDates));
                         let instalmentDate = futureDates[i];
                       // console.log("instalmentDate" + JSON.stringify(instalmentDate));
                        let extraDiscount = 0;
                        if(isNullOrUndefined(memObj.fees.affiliateFee)){
                            let feeObj = memObj.fees.affiliateFee;
                            let aSeasonalFee = isNullOrUndefined(feeObj) ? feeIsNull(feeObj.seasonalFee) : 0;
                            let aSeasonalGST = isNullOrUndefined(feeObj) ? feeIsNull(feeObj.seasonalGST) : 0;
                            let redeemAmount = 0;
                            // let aNominationFee = isNullOrUndefined(feeObj) ? feeIsNull(feeObj.nominationFee) : 0;
                            // let aNominationGst = isNullOrUndefined(feeObj) ? feeIsNull(feeObj.nominationGST) : 0;
                            fee = this.getAdjustedVal(aSeasonalFee, totalDates);
                            let gvObj = this.applyGVFutureInstalment(selectedVal, memObj, fee);
                            //fee = gvObj.fee;
                            redeemAmount = gvObj.redeemAmount ? gvObj.redeemAmount : 0;
                            gst = this.getAdjustedVal(aSeasonalGST, totalDates);
                            let gvGSTObj = this.applyGVFutureInstalment(selectedVal, memObj, gst);
                            redeemAmount = redeemAmount + (gvGSTObj.redeemAmount ? gvGSTObj.redeemAmount : 0);
                            //gst = gvGSTObj.fee;
                            // nominationFee = aNominationFee / totalDates;
                            // nominationGST = aNominationGst / totalDates;
                            let childDiscountVal = 0;
                            if(isNotNullAndUndefined(memObj.affDiscount) && isNotNullAndUndefined(memObj.affDiscount.childAffiliateDiscount)){
                                let feeToDiscount = fee + gst - redeemAmount;
                                childDiscountVal = this.getInstalmentChildDiscountValue(memObj.affDiscount.childAffiliateDiscount, feeToDiscount,
                                    item, childCompDiscountMapIns, "Comp", memObj);
                                 childDiscountVal = this.getAdjustedVal(childDiscountVal, totalDates);
                                familydiscount = childDiscountVal;
                            }
                           // console.log("$$$$" + JSON.stringify(memObj.affDiscount.affiliateDiscount));
                            if(isNotNullAndUndefined(memObj.affDiscount) && isArrayPopulated(memObj.affDiscount.affiliateDiscount)){
                                for(let dis of memObj.affDiscount.affiliateDiscount){
                                    let feeToDiscount = fee + gst - redeemAmount;
                                    let discount = this.getDiscountValue(dis, selectedVal, feeToDiscount,
                                        childDiscountVal,  0);
                                    let discountVal = this.getAdjustedVal(discount.discountsToDeduct, totalDates);
                                    discountAmt += discountVal;
                                    extraDiscount = discount.remainingDiscount;
                                }
                            }
                            
                            if(fee){
                                if(i == 0){
                                    item.payPerInstalment = feeIsNull(item.payPerInstalment) + fee + gst - discountAmt - familydiscount - redeemAmount;
                                }
                                
                                let trans = this.getInstalmentTransactionObj(fee,gst, discountAmt, familydiscount,"affiliate", 
                                item.competitionId,feeObj.cOrgId,feeObj.membershipMappingId,member, instalmentDate,
                                selectedVal.paymentOptionRefId, memObj.divisionId, redeemAmount, nominationFee, nominationGST);
                                transArr.push(trans);
                            }
                         
                        }
                        discountAmt = 0
                        if(isNullOrUndefined(memObj.fees.competitionOrganisorFee)){
                            let feeObj = memObj.fees.competitionOrganisorFee;
                            let cSeasonalFee =   feeIsNull(feeObj.seasonalFee);
                            let cSeasonalGST =  feeIsNull(feeObj.seasonalGST);
                            let redeemAmount = 0;
                            // let cNominationFee = isNullOrUndefined(feeObj) ? feeIsNull(feeObj.nominationFee) : 0;
                            // let cNominationGst = isNullOrUndefined(feeObj) ? feeIsNull(feeObj.nominationGST) : 0;
                            fee = this.getAdjustedVal(cSeasonalFee, totalDates);
                            let gvObj = this.applyGVFutureInstalment(selectedVal, memObj, fee);
                            //fee = gvObj.fee;
                            redeemAmount = gvObj.redeemAmount ? gvObj.redeemAmount : 0;
                            gst = this.getAdjustedVal(cSeasonalGST, totalDates);
                            let gvGSTObj = this.applyGVFutureInstalment(selectedVal, memObj, gst);
                            redeemAmount = redeemAmount + (gvGSTObj.redeemAmount ? gvGSTObj.redeemAmount : 0);
                            //gst = gvGSTObj.fee;
                            // nominationFee = cNominationFee / totalDates;
                            // nominationGST = cNominationGst / totalDates;
                            let childDiscountVal = 0;
                            
                            if(isNotNullAndUndefined(memObj.compDiscount) && isNotNullAndUndefined(memObj.compDiscount.childCompOrgDiscount)){
                                let feeToDiscount = fee + gst - redeemAmount;
                                childDiscountVal = this.getInstalmentChildDiscountValue(memObj.compDiscount.childCompOrgDiscount, feeToDiscount,
                                    item, childCompDiscountMapIns, "Comp", memObj);
                                childDiscountVal = this.getAdjustedVal(childDiscountVal, totalDates);
                                familydiscount = childDiscountVal;
                            }
                           // console.log("$$$$" + JSON.stringify(memObj.compDiscount.compOrgDiscount));
                            if(isNotNullAndUndefined(memObj.compDiscount) && isArrayPopulated(memObj.compDiscount.compOrgDiscount)){
                                for(let dis of memObj.compDiscount.compOrgDiscount){
                                    let feeToDiscount = fee + gst - redeemAmount;
                                    let discount = this.getDiscountValue(dis, selectedVal, feeToDiscount,
                                        childDiscountVal, extraDiscount);
                                    let discountVal = this.getAdjustedVal(discount.discountsToDeduct, totalDates);
                                    discountAmt += discountVal;
                                    extraDiscount = discount.remainingDiscount;
                                }
                            }
                            else if(extraDiscount > 0){
                                let feeToDiscount = fee + gst - redeemAmount;
                                let discount = this.getDiscountValue(null, selectedVal, feeToDiscount,
                                    childDiscountVal, extraDiscount);
                                let discountVal = this.getAdjustedVal(discount.discountsToDeduct, totalDates);
                                discountAmt += discountVal;
                                extraDiscount = discount.remainingDiscount;
                            }
                           
                            if(fee){
                                if(i == 0){
                                    item.payPerInstalment = feeIsNull(item.payPerInstalment) + fee + gst - discountAmt - familydiscount - redeemAmount;
                                }
                                let trans = this.getInstalmentTransactionObj(fee,gst, discountAmt, familydiscount,"competition", 
                                item.competitionId,feeObj.cOrgId,feeObj.membershipMappingId,member, instalmentDate,
                                selectedVal.paymentOptionRefId, memObj.divisionId, redeemAmount, nominationFee, nominationGST);
                                transArr.push(trans);
                            }
                        }
                        discountAmt = 0
                        /*if(isNullOrUndefined(memObj.fees.membershipFee) && member.onlyCompetition == 0){
                            let feeObj = memObj.fees.membershipFee;
                            //console.log("$$$" + JSON.stringify(feeObj));
                            let mSeasonalFee =   feeIsNull(feeObj.seasonalFee);
                            let mSeasonalGST =   feeIsNull(feeObj.seasonalGST);
                            fee = feeIsNull(mSeasonalFee) / totalDates;
                            let gvObj = this.applyGVFutureInstalment(selectedVal, memObj, fee);
                            fee = gvObj.fee;
                            gst = feeIsNull(mSeasonalGST) / totalDates;
                            let gvGSTObj = this.applyGVFutureInstalment(selectedVal, memObj, gst);
                            gst = gvGSTObj.fee;
                            
                            let childDiscountVal = 0;
                            //console.log("%%%%%%%%%%" + JSON.stringify(memObj.memDiscount.childMembershipDiscount));
                            if(isNotNullAndUndefined(memObj.memDiscount.childMembershipDiscount)){
                                let feeToDiscount = fee + gst;
                                childDiscountVal = this.getInstalmentChildDiscountValue(memObj.memDiscount.childMembershipDiscount, feeToDiscount,
                                    item, childMemDiscountMapIns, "Mem", memObj);
                                //console.log("childDiscountVal" + childDiscountVal);
                                childDiscountVal = childDiscountVal / totalDates;
                                familydiscount = childDiscountVal;
                            }
                            
                            if(isArrayPopulated(memObj.memDiscount.membershipDiscount)){
                                for(let dis of memObj.memDiscount.membershipDiscount){
                                    let feeToDiscount = fee + gst;
                                    let discountVal = this.getDiscountValue(dis, selectedVal, feeToDiscount,
                                        childDiscountVal, 1, 1);
                                    discountVal = discountVal / totalDates;
                                    discountAmt +=  discountVal;
                                }
                            }
                           
                            let trans = this.getInstalmentTransactionObj(fee, gst, discountAmt, familydiscount,"membership", 
                                    item.competitionId,feeObj.mOrgId,feeObj.membershipMappingId,member, instalmentDate,
                                    selectedVal.paymentOptionRefId, memObj.divisionId, gvObj, 0, 0);
                            transArr.push(trans); 
                        }
                        */
    
                        // if(isNotNullAndUndefined(memObj.coachFee)){
                        //     let fee = this.getAdjustedVal(memObj.coachFee.mCasualFee, totalDates);
                        //     let gst = this.getAdjustedVal(memObj.coachFee.mCasualGST, totalDates);
                           
                        //     if(fee){
                        //         let trans = this.getInstalmentTransactionObj(fee,gst, discountAmt, familydiscount,"membership", 
                        //         item.competitionId,memObj.coachFee.mOrgId,memObj.coachFee.membershipMappingId,member, instalmentDate,
                        //         selectedVal.paymentOptionRefId, null, null, 0, 0);
                        //         transArr.push(trans);
                        //     }
                        // }
                    }
                }
            }

            return transArr
            
        } catch (error) {
            logger.error(`Exception occurred in calculateInstalmentFees ${error}`);
            throw error;
        }
    }

    private async instalmentDateToDBTrack(transArr, registrationId, registrationCreatedBy){
        try {
           // console.log("************ Instalment Future Date Arr " + JSON.stringify(transArr));
                const stepId = RegistrationStep.FutureInstalmentTrackStep;
                if(isArrayPopulated(transArr)){
                    let trackData = await this.entityManager.query(`select * from  wsa_registrations.registrationTrack  where registrationId = ? and stepsId = ? and isDeleted = 0`,
                                [registrationId, stepId]);
                    if(isArrayPopulated(trackData)){
                       
                        await this.entityManager.query(`Update wsa_registrations.registrationTrack set jsonData = ? where registrationId = ? and stepsId = ?`,
                        [JSON.stringify(transArr), registrationId, stepId]);
                    }
                    else{
                        //console.log("$$$$$$$$");
                        await this.entityManager.query(`insert into wsa_registrations.registrationTrack(registrationId, stepsId,jsonData,createdBy) values(?,?,?,?)`,
                        [registrationId,stepId, JSON.stringify(transArr), registrationCreatedBy]);
                    }
                }
                else{
                    await this.entityManager.query(`Update wsa_registrations.registrationTrack set isDeleted = 1 where registrationId = ? and stepsId = ?`,
                    [registrationId, stepId]);
                }
        } catch (error) {
            logger.error(`Exception occurred in instalmentDateToDBTrack ${error}`);
            throw error;
        }
    }

    private getInstalmentTransactionObj(feeAmt, gstAmt, discountAmt, familyDiscountAmt,
            feeType, competitionId, organsiationId, membershipMappingId, item, instalmentDate,
            paymentOptionRefId, divisionId, redeemAmount, nominationFee, nominationGST)
    {
        let trxnMembership = {
            firstName: item.firstName,
            lastName: item.lastName,
            mobileNumber: item.mobileNumber,
            email: item.email,
            feeAmount:  feeAmt,
            gstAmount: gstAmt,
            discountAmount: discountAmt,
            familyDiscountAmount: familyDiscountAmt,
            feeType: feeType,
            membershipProductMappingId: membershipMappingId,
            competitionId: competitionId,
            organisationId: organsiationId,
            instalmentDate: instalmentDate,
            paymentOptionRefId: paymentOptionRefId,
            divisionId: divisionId,
            governmentVoucherAmount: redeemAmount,
            nominationFeeToPay: nominationFee,
            nominationGSTToPay: nominationGST,
            paymentFeeTypeRefId: this.getPaymentFeeTypeRefId(paymentOptionRefId, 1)
        }   

        return trxnMembership;
    }

    private getTransactionObj(feeAmt, gstAmt, discountAmt, feeType, competitionId, organsiationId, 
        membershipMappingId, team, divisionId, nominationFee, nominationGST){
        let trxnMembership = {
            firstName: team.firstName,
            lastName: team.lastName,
            mobileNumber: team.mobileNumber,
            email: team.email,
            teamName: team.teamName,
            feeAmount:  feeAmt,
            gstAmount: gstAmt,
            discountAmount: discountAmt,
            feeType: feeType,
            membershipProductMappingId: membershipMappingId,
            competitionId:  competitionId,
            organisationId : organsiationId,
            divisionId: divisionId,
            nominationFeeToPay: nominationFee,
            nominationGSTToPay: nominationGST
        }   

        return trxnMembership;
    }

    private checkMemProductFeesType(fee, item, participants, selectedVal,
        memFeesRestrictList, memCapList){
        try {
          //  console.log("!!!!item!!!!" + JSON.stringify(item));
            //console.log("participants" + JSON.stringify(participants));
           // console.log("memCapList" + JSON.stringify(memCapList));
            //console.log("memFeesRestrictList" + JSON.stringify(memFeesRestrictList));
            let isExists = false;
            let amount = 0;
            let gst = 0;
            let membershipMappingId = fee.membershipMappingId;
            let orgId = fee.mOrgId;
           
            let memFee = feeIsNull(fee.mSeasonalFee);
            let memGst = feeIsNull(fee.mSeasonalGST);
            //console.log("memGst" + memGst);
           
            let paymentFeeTypeRefId = this.getPaymentFeeTypeRefId(selectedVal.paymentOptionRefId, item.isTeamRegistration);

            // console.log("fee.membershipProductId" + fee.membershipProductId);
            // console.log("item.dateOfBirth" + item.dateOfBirth);

            let capFee =  memCapList.find(x=>
                (x.membershipProductId == null || x.membershipProductId == fee.membershipProductId) && 
                    moment(item.dateOfBirth).isBetween(x.dobFrom, x.dobTo) &&
                    x.organisationId == orgId);
           //console.log("capFee" + JSON.stringify(capFee));

            if(isArrayPopulated(participants)){
                let obj = null;
                let objList = participants.filter(x=>x.firstName == item.firstName && 
                            x.lastName == item.lastName && x.email == item.email && 
                            x.mobileNumber == item.mobileNumber && 
                            x.membershipProductId == fee.membershipProductId &&
                           // x.membershipProductTypeMappingId == membershipMappingId &&
                            x.paymentFeeTypeRefId == paymentFeeTypeRefId &&
                            x.feeType == "membership");
                //console.log("objList" + JSON.stringify(objList));
                
                if(isArrayPopulated(objList)){
                    let fee = 0;
                    let expiryDate = null;
                    for(let f of objList){
                        fee = fee + feeIsNull(f.amount);
                        expiryDate = f.expiryDate;
                    }
                    obj = {
                        amount: fee,
                        expiryDate: convertUTCDateToLocalDate(expiryDate)
                    }
                }    
                // console.log("Obj" + JSON.stringify(obj));
                // console.log("@@@@@" + item.competitionEndDate);
                if(isNotNullAndUndefined(obj)){
                    //console.log("((((((((((((");
                    if(isNotNullAndUndefined(obj.expiryDate)){
                        //console.log(")))))))))))");
                        if(moment(item.competitionEndDate).isSameOrBefore(obj.expiryDate)){
                            //console.log("!!!!!!!!!!!!!!!!!!!");
                            if(capFee){
                               let capAmount = this.membershipCapCalculation(obj, memFee, memGst, capFee);
                               isExists = true;
                               amount = capAmount.amount;
                               gst = capAmount.gst;
                            }
                            else{
                                isExists = true;
                                amount = 0;
                                gst = 0;
                            }
                        }
                        else{
                            //console.log("@@@@@Else@@@@@")
                            isExists = false;
                            amount = memFee;
                            gst = memGst;
                        }
                    }
                }
            }
            else{
                if(capFee){
                    let response = this.checkExistingMembershipCap(memFeesRestrictList, item,
                        fee, paymentFeeTypeRefId, memFee, memGst, capFee);
                   //console.log("response" + JSON.stringify(response));
                    if(!response.isExists){
                        let capAmount = this.membershipCapCalculation(null, memFee, memGst, capFee);
                        //console.log("capAmount" + JSON.stringify(capAmount));
                        isExists = true;
                        amount = capAmount.amount;
                        gst = capAmount.gst;
                    } 
                    else{
                        isExists = response.isExists;
                        amount = response.amount;
                        gst = response.gst;
                    }
                }
                else{
                    //console.log("####Else####")
                    isExists = false;
                    amount = memFee;
                    gst = memGst;
                }
            }

            if(!isExists && isArrayPopulated(memFeesRestrictList)){
                if(capFee){
                    let response = this.checkExistingMembershipCap(memFeesRestrictList, item,
                        fee, paymentFeeTypeRefId, memFee, memGst, capFee);
                    
                    isExists = response.isExists;
                    amount = response.amount;
                    gst = response.gst;
                }
                else{
                    let memFeesList = memFeesRestrictList.filter(x=>x.firstName == item.firstName && 
                        x.lastName == item.lastName && x.email == item.email && 
                        x.mobileNumber == item.mobileNumber && 
                        x.membershipMappingId == membershipMappingId &&
                        x.paymentFeeTypeRefId == paymentFeeTypeRefId);
                        //console.log("memFeesList~~~~~~~~" + JSON.stringify(memFeesList));
                    if(isArrayPopulated(memFeesList)){
                        isExists = true;
                        amount = 0;
                        gst = 0;
                    }
                    else{
                        isExists = false;
                        amount = memFee;
                        gst = memGst;
                    }
                }
            }
            //}
            //console.log("isExists" + isExists);
            return {isExists, paymentFeeTypeRefId, amount, gst};
        } catch (error) {
            logger.error(`Exception occurred in checkMemProductFeesType ${error}`);
            throw error;
        }
    }

    private checkExistingMembershipCap(memFeesRestrictList, item, fee, paymentFeeTypeRefId, 
        memFee, memGst, capFee){
        let response = {
            isExists: false,
            amount: memFee,
            gst: memGst
        }
        let memFeesList = memFeesRestrictList.filter(x=>x.firstName == item.firstName && 
            x.lastName == item.lastName && x.email == item.email && 
            x.mobileNumber == item.mobileNumber && 
            x.membershipProductId == fee.membershipProductId &&
            x.paymentFeeTypeRefId == paymentFeeTypeRefId && 
            x.isFullApplied == 0);
            //console.log("memFeesList~~~~~~~~" + JSON.stringify(memFeesList));
        if(isArrayPopulated(memFeesList)){
            let fee = 0;
            for(let f of memFeesList){
                fee = fee + feeIsNull(f.amount);
            }
            let obj = {
                amount: fee
            }
            //console.log("$$$$$" + JSON.stringify(obj));
            let capAmount = this.membershipCapCalculation(obj, memFee, memGst, capFee);
            //console.log("!!!!!!!!!!!capAmount#######" + JSON.stringify(capAmount));
            response.isExists = true;
            response.amount = capAmount.amount;
            response.gst = capAmount.gst;
        }

        return response;
    }

    private membershipCapCalculation(obj, memFee, memGst, capFee){
        try {
           // console.log("membershipCapCalculation" + memGst + "###" + memFee);
            let amount = 0;
            let gst = 0;
             if(capFee){
                 let capAmount = feeIsNull(capFee.amount);
                 //console.log("capAmount" + capAmount);
                 let capBalance = capAmount - feeIsNull(obj ? obj.amount : 0);
                 capBalance = capBalance <= 0 ? 0 : capBalance;
                 //console.log("capBalance::"+ capBalance);
                 let feeDifference = capBalance - memFee;
                 //console.log("feeDifference" + feeDifference)
                 amount = feeDifference <= 0 ? capBalance : memFee;
                // console.log("@@@amount" + amount)
                 let gstPercentage = (feeIsNull(memGst) / feeIsNull(memFee)) * 100;
                 //console.log("@@@gstPercentage" + gstPercentage)
                 gst = gstPercentage ? (amount * gstPercentage) / 100 : 0;
                 //console.log("@@@gst" + gst)
             }

         return {amount, gst};
        } catch (error) {
            logger.error(`Exception occurred in membershipCapCalculation ${error}`);
            throw error;
        }
    }

    private getPaymentFeeTypeRefId(paymentOptionRefId, isTeamRegistration){
        if(paymentOptionRefId <=2 && isTeamRegistration == 0){
            return AppConstants.CASUAL_FEE;
        }
        else{
            return AppConstants.SEASONAL_FEE;
        }
    }

    private addToMemFeesRestrictList(memFeesRestrictList, item, membershipMappingId,selectedVal, fee,
        membershipProductId, isTeamRegistration){
        try {
            let obj = {
                firstName: item.firstName,
                lastName: item.lastName,
                mobileNumber: item.mobileNumber,
                email: item.email,
                membershipMappingId: membershipMappingId,
                paymentFeeTypeRefId: this.getPaymentFeeTypeRefId(selectedVal.paymentOptionRefId, isTeamRegistration),
                amount: fee,
                membershipProductId: membershipProductId,
                isFullApplied: fee == 0 ? 1 : 0
            }

            memFeesRestrictList.push(obj);
        } 
        catch (error) {
            throw error;
        }
    }

    private  addCoach(coachFee, key, item, memMap,compPartObj){
        try {
            let memObj = this.getMemObj(item);
            let memKey = key + "#" + coachFee.competitionMembershipProductTypeId + "#" + 
            coachFee.divisionId;
            memObj.membershipProductName = coachFee.membershipProductName;
            memObj.membershipTypeName = coachFee.mTypeName;
            memObj.competitionMembershipProductTypeId = coachFee.competitionMembershipProductTypeId;
            memObj.membershipMappingId = coachFee.membershipMappingId;
            memObj.divisionId = null;
            memObj.orgRegParticipantId =  item.orgRegParticipantId,
            memObj.divisionName = null;
            memObj["memDiscount"] = null;
            memObj["compDiscount"] = null;
            memObj["affDiscount"] = null;
            memObj.isPlayer = coachFee.isPlayer;

            if(item.personRoleRefId == 2 && coachFee.allowTeamRegistrationTypeRefId == 1){
                let memFeeObj = this.getMemFeeObj(coachFee);
                memObj.fees.membershipFee = memFeeObj;
            }
            
            memMap.set(memKey, memObj);
            compPartObj.membershipProducts.push(memObj);
            return memObj;
        } catch (error) {
            logger.error(`Exception occurred in addCoach ${error}`);
        }
    }

    private getMemObj(member){
        let memObj = {
            // "name":"",
             "firstName": member.firstName,
             "lastName": member.lastName,
             "email": member.email,
             "mobileNumber": member.mobileNumber,
             "membershipProductName": "",
             "membershipTypeName": "",
             "membershipMappingId": null,
             "competitionMembershipProductTypeId": null,
             "feesToPay": 0,
             "orgRegParticipantId": null,
             "discountsToDeduct" : null,
             "childDiscountsToDeduct":null,
             "governmentVoucherAmount": null,
             "divisionId": null,
             "divisionName": null,
             "isPlayer": null,
             "fees":{
                 "membershipFee": null,
                 "competitionOrganisorFee": null,
                 "affiliateFee": null
             }
         }

         return memObj;
    }

    private compFeeObj(item, f){
        let compFee = {
            casualFee: item.isTeamRegistration == 0 ? f.casualFee : 0,
            casualGST: item.isTeamRegistration == 0 ? f.casualGST : 0,
            seasonalFee: item.isTeamRegistration == 0 ? f.seasonalFee : f.teamSeasonalFee,
            seasonalGST: item.isTeamRegistration == 0 ? f.seasonalGST : f.teamSeasonalGST,
            nominationFee: 0,
            nominationGST: 0,
            nominationFeeToPay: 0,
            nominationGSTToPay: 0,
            organisationId: f.cOrganisationId,
            name: f.cOrganisationName, 
            emailId: f.cOrganiationEmailId,
            phoneNo: f.cOrganiationPhoneNo,
            feesToPay: 0,
            feesToPayGST: 0,
            discountsToDeduct: 0,
            childDiscountsToDeduct: 0,
            governmentVoucherAmount: 0,
            nominationGVAmount: 0,
            nomChildDiscountsToDeduct: 0,
            cOrgId: f.cOrgId,
            membershipMappingId: f.membershipMappingId
        }

        return compFee;
    }

    private getMemFeeObj(f) {
        let memFeeObj = {
            casualFee:  f.mCasualFee,
            casualGST: f.mCasualGST,
            seasonalFee: f.mSeasonalFee,
            seasonalGST: f.mSeasonalGST,
            organisationId: f.mOrganisationId,
            name: f.mOrganisationName, 
            emailId: f.mOrganisationEmailId,
            phoneNo: f.mOrganisationPhoneNo,
            membershipMappingId: f.membershipMappingId,
            feesToPay: 0,
            feesToPayGST: 0,
            discountsToDeduct: 0,
            childDiscountsToDeduct: 0,
            governmentVoucherAmount: 0,
            mOrgId: f.mOrgId
        }

        return memFeeObj;
    }

    private getCompPartObj(item, competitionLogoUrl, filterdGovernmentVoucher, 
        instalmentDates, discounts, membershipDiscounts, fees, paymentMethods){
        let compPartObj = {
            "isTeamRegistration": Number(item.isTeamRegistration),
            "participantId": item.userRegUniqueKey,
            "userId": item.userId,
            "firstName": item.firstName,
            "lastName":item.lastName,
            "mobileNumber": item.mobileNumber,
            "email": item.email,
            "dateOfBirth": item.dateOfBirth,
            "gender": item.gender,
            "photoUrl": item.photoUrl,
            "registeringYourselfRefId": item.registeringYourselfRefId,
            "competitionName": item.competitionName,
            "organisationName": item.organisationName,
            "competitionLogoUrl": competitionLogoUrl,
            "competitionUniqueKey": item.competitionUniqueKey,
            "organisationUniqueKey": item.organisationUniqueKey,
            "membershipProducts": [],
            "governmentVouchers": filterdGovernmentVoucher,
            "paymentOptions":[],
            "paymentMethods": paymentMethods,
            "gameVouchers":[],
            "instalmentDates":instalmentDates,
            "selectedOptions": null,
            "noOfPlayers": item.noOfPlayers,
            "payingForCount": item.payingForCount,
            "competitionMembershipProductTypeIdCoach": item.competitionMembershipProductTypeIdCoach,
            "isSeasonalUponReg": item.isSeasonalUponReg,
            "isTeamSeasonalUponReg": item.isTeamSeasonalUponReg,
            "discounts": discounts,
            "membershipDiscounts": membershipDiscounts,
            "fees": fees,
            "teamName": item.teamName,
            "totalMembers": item.totalMembers,
            "competitionId": item.competitionId,
            "competitionEndDate": item.competitionEndDate,
            "governmentVoucherAmount": 0,
            "nominationGVAmount": 0,
            "orgRegistrationId": item.orgRegistrationId,
            "teamMembers": null,
            "payPerInstalment": 0,
            "payNow": 0,
            "payPerMatch": 0,
            "tShirtSizeRefId": item.tShirtSizeRefId
        }

        return compPartObj;
    }

    private getMainObj(total){
        let obj = {
            charityRoundUpRefId: -1,
            charity:null,
            charityRoundUp: [],
            compParticipants: [],
            isSchoolRegistration: 0,
            total: total,
            volunteerInfo: [],
            shopProducts: [],
            securePaymentOptions: [],
            yourInfo: null,
            billingAddress: null,
            deliveryAddress: null,
            shippingOptions: [],
            isHardshipEnabled: 0,
            hasClubVolunteer: 0
        }

        return obj;
    }

    private setNominationFee(item, fee, selectedVal, noOfPlayers, payingForCount, compFee){
        let nFee = this.getNomiationFee(selectedVal,fee,item,"fee");
        let nGst = this.getNomiationFee(selectedVal,fee,item,"gst");
        let nominationFee = 0;
        let nominationGST = 0;
        // if(selectedVal.nominationPayOptionRefId == 1){
        //     nominationFee = nFee;
        //     nominationGST = nGst;
        // }
        // else{
        //     nominationFee = (nFee / noOfPlayers) * payingForCount;
        //     nominationGST = (nGst / noOfPlayers) * payingForCount;
        // }

        nominationFee = this.getAdjustedVal(nFee, noOfPlayers);
        nominationGST = this.getAdjustedVal(nGst, noOfPlayers);

        compFee.nominationFee = nFee;
        compFee.nominationGST = nGst;
        compFee.nominationFeeToPay = nominationFee;
        compFee.nominationGSTToPay = nominationGST;
    }

    private getNomiationFee(selectedVal, fee, item, flag){
        let nominationVal = 0;
        //if(selectedVal.paymentOptionRefId != 1){
            if(fee.isPlayer == 1){
                if(item.isTeamRegistration == 0){
                    if(flag == "fee"){
                        nominationVal = feeIsNull(fee.nominationSeasonalFee);
                    }
                    else{
                        nominationVal = feeIsNull(fee.nominationSeasonalGST);   
                    }
                   
                }
                else{
                    if(flag == "gst"){
                        nominationVal = feeIsNull(fee.nominationTeamSeasonalGST); 
                    }
                    else{
                        nominationVal = feeIsNull(fee.nominationTeamSeasonalFee); 
                    }
                }
            }
        //}

        return nominationVal;
    }

    private getFutureNominationFee(fee, selectedVal){
        if(selectedVal.nominationPayOptionRefId == 2){
            return fee;
        }
        else{
            return 0;
        }
    }

    private calculateTotalAmt(mem, total, comp){
        let fee = 0;
        let gst = 0;
        let hasGovernmentVoucherApplied = 0;
        let hasHardshipCode = 0;
        let discount = 0;
        let childDiscount = 0;
        let gvAmt = 0;

        if(!((comp.selectedOptions.paymentOptionRefId == 5 && comp.selectedOptions.isSchoolRegCodeApplied == 1) || 
            (comp.selectedOptions.isHardshipCodeApplied == 1) )){
            fee = ( (isNullOrUndefined(mem.fees.membershipFee) ? feeIsNull(mem.fees.membershipFee.feesToPay) : 0) + 
                    (isNullOrUndefined(mem.fees.competitionOrganisorFee) ? feeIsNull(mem.fees.competitionOrganisorFee.feesToPay) : 0) + 
                    (isNullOrUndefined(mem.fees.affiliateFee) ?  feeIsNull(mem.fees.affiliateFee.feesToPay) : 0) + 
                    (isNullOrUndefined(mem.fees.competitionOrganisorFee) ? feeIsNull(mem.fees.competitionOrganisorFee.nominationFeeToPay) : 0) +
                    (isNullOrUndefined(mem.fees.affiliateFee) ?  feeIsNull(mem.fees.affiliateFee.nominationFeeToPay) : 0));

            gst = ((isNullOrUndefined(mem.fees.membershipFee) ? feeIsNull(mem.fees.membershipFee.feesToPayGST) : 0) + 
                        (isNullOrUndefined(mem.fees.competitionOrganisorFee) ? feeIsNull(mem.fees.competitionOrganisorFee.feesToPayGST) : 0) + 
                    (isNullOrUndefined(mem.fees.affiliateFee) ?  feeIsNull(mem.fees.affiliateFee.feesToPayGST) : 0) +
                    (isNullOrUndefined(mem.fees.competitionOrganisorFee) ? feeIsNull(mem.fees.competitionOrganisorFee.nominationGSTToPay) : 0) +
                    (isNullOrUndefined(mem.fees.affiliateFee) ?  feeIsNull(mem.fees.affiliateFee.nominationGSTToPay) : 0));
            
            discount = feeIsNull(mem.discountsToDeduct);
            childDiscount = feeIsNull(mem.childDiscountsToDeduct);
            gvAmt = feeIsNull(mem.governmentVoucherAmount);
        }

        if(comp.selectedOptions.selectedGovernmentVouchers!= null && comp.selectedOptions.selectedGovernmentVouchers.length > 0){
            hasGovernmentVoucherApplied = 1;
        }

        if(comp.selectedOptions.discountCodes!= null && comp.selectedOptions.discountCodes.length > 0){
            let hardshipCode =  comp.selectedOptions.discountCodes.find(x=>x.isHardshipCode == 1);
            if(hardshipCode)
                hasHardshipCode = 1;
        }

        total.subTotal = feeIsNull(total.subTotal)  + feeIsNull(fee);
        total.gst = feeIsNull(total.gst) + feeIsNull(gst);

        console.log("discount" + JSON.stringify(discount));

        total.subTotal = feeIsNull(total.subTotal) - discount - childDiscount - gvAmt;
        console.log("subTotal" + JSON.stringify(total.subTotal));

        //if( (hasGovernmentVoucherApplied  || hasHardshipCode)  && total.subTotal < 0){
        if(total.subTotal < 0){
            total.gst = feeIsNull(total.gst) + total.subTotal;
            total.subTotal = 0;
        }
    }

    private addNominationFee(mem){
        if(isNullOrUndefined(mem.fees.competitionOrganisorFee)){
            let fee = feeIsNull(mem.fees.competitionOrganisorFee.nominationFeeToPay) + 
            feeIsNull(mem.fees.competitionOrganisorFee.nominationGSTToPay);
            mem.feesToPay = feeIsNull(mem.feesToPay) + fee;
        }

        if(isNullOrUndefined(mem.fees.affiliateFee)){
            let fee = feeIsNull(mem.fees.affiliateFee.nominationFeeToPay) + 
            feeIsNull(mem.fees.affiliateFee.nominationGSTToPay);
            mem.feesToPay = feeIsNull(mem.feesToPay) + fee;
        }
    }

    private calculateTargetValue(total, charityRoundUpRefId)
    {
        let targetTotal = feeIsNull(total.gst) + feeIsNull(total.subTotal);
        if(charityRoundUpRefId > 0 && targetTotal > 0){
            let charityCalcResult = this.getCharityValue(targetTotal, charityRoundUpRefId);
            total.targetValue = formatValue(charityCalcResult.targetValue);
            total.charityValue = formatValue(charityCalcResult.charityValue);
        }
        else{
            total.targetValue = formatValue(targetTotal);
            total.charityValue = "0.00";
        } 
  
        total.gst = formatValue(total.gst);
        total.subTotal = formatValue(total.subTotal);
        total.shipping = formatValue(total.shipping);
    }

    private calculateShopProduct(total, obj){

        if(isArrayPopulated(obj.shopProducts)){
            if(obj.isSchoolRegistration){
                obj.isSchoolRegistration = 0;
            }
            for(let item of obj.shopProducts){
                let amount = item.amount;
                let tax = item.tax;
                total.subTotal = feeIsNull(total.subTotal) + feeIsNull(amount);
                total.gst = feeIsNull(total.gst) + feeIsNull(tax);
                total.targetValue = feeIsNull(total.targetValue) +  feeIsNull(amount) 
                + feeIsNull(tax);
            }

            total.gst = formatValue(total.gst);
            total.subTotal = formatValue(total.subTotal);
            total.targetValue = formatValue(total.targetValue);
        }
    }

    private calculateTransactionFee(total){
        let transactionFee = 0;
        total.transactionFee = formatValue(transactionFee);
        total.total =  total.targetValue;
        let targetValue = feeIsNull(total.targetValue) + feeIsNull(transactionFee);
        total.targetValue = formatValue(targetValue)
    }

    private applyGovernmentVoucher(selectedVal, memObj, fee, feeObj, feeType){
        try {
            let feeVal = 0;
            if(isArrayPopulated(selectedVal.selectedGovernmentVouchers) && memObj.isPlayer == 1){
                for(let gvrnm of selectedVal.selectedGovernmentVouchers){
                    if(gvrnm.remainingAmount > 0 && fee > 0){
                        if(fee >= gvrnm.remainingAmount){
                            fee = fee - gvrnm.remainingAmount;
                            memObj.governmentVoucherAmount = feeIsNull(memObj.governmentVoucherAmount) + 
                                                gvrnm.remainingAmount;
                            if(feeType == AppConstants.competition){
                                feeObj.governmentVoucherAmount = feeIsNull(feeObj.governmentVoucherAmount) + 
                                gvrnm.remainingAmount;
                            }
                            else{
                                feeObj.nominationGVAmount = feeIsNull(feeObj.nominationGVAmount) + 
                                gvrnm.remainingAmount;
                            }
                            
                            gvrnm.redeemAmount = feeIsNull(gvrnm.redeemAmount) +  gvrnm.remainingAmount;
                            gvrnm.remainingAmount = 0;
                        }
                        else if(fee < gvrnm.remainingAmount){
                            gvrnm.remainingAmount = gvrnm.remainingAmount - fee;
                            memObj.governmentVoucherAmount = feeIsNull(memObj.governmentVoucherAmount) + fee;
                            if(feeType == AppConstants.competition){
                                feeObj.governmentVoucherAmount = feeIsNull(feeObj.governmentVoucherAmount) + fee;
                            }
                            else{
                                feeObj.nominationGVAmount = feeIsNull(feeObj.nominationGVAmount) + fee; 
                            }
                            
                            gvrnm.redeemAmount = feeIsNull(gvrnm.redeemAmount) +  fee;
                            fee = 0;
                        }
                    }
                }
            }
            //console.log("applyGovernmentVoucher::" + JSON.stringify(fee));
            return fee;
        } catch (error) {
            logger.error(`Exception occurred in applyGovernmentVoucher ${error}`);
            throw error;
        }
    }

    private applyGVFutureInstalment(selectedVal, memObj, fee){
        try {
            let redeemAmount = 0
            if(isArrayPopulated(selectedVal.selectedGovernmentVouchers) && memObj.isPlayer == 1){
                for(let gvrnm of selectedVal.selectedGovernmentVouchers){
                    if(gvrnm.remainingAmount > 0){
                        if(fee >= gvrnm.remainingAmount){
                            fee = fee - gvrnm.remainingAmount;
                            gvrnm.redeemAmount = feeIsNull(gvrnm.redeemAmount) +  gvrnm.remainingAmount;
                            redeemAmount += gvrnm.remainingAmount;
                            gvrnm.remainingAmount = 0;
                        }
                        else if(fee < gvrnm.remainingAmount){
                            gvrnm.remainingAmount = gvrnm.remainingAmount - fee;
                            gvrnm.redeemAmount = feeIsNull(gvrnm.redeemAmount) +  fee;
                            redeemAmount += fee;
                            fee = 0;
                        }
                    }
                }
            }
           // console.log("applyGovernmentVoucher::" + JSON.stringify(fee));
            return {redeemAmount};
        } catch (error) {
            logger.error(`Exception occurred in applyGovernmentVoucher ${error}`);
            throw error;
        }
    }

    private resetFeeForHardship(selectedVal, memObj){
        try {
            if(selectedVal){
                if(selectedVal.isHardshipCodeApplied == 1){
                    if(isNullOrUndefined(memObj.fees.affiliateFee)){
                        memObj.fees.affiliateFee.casualFee = 0;
                        memObj.fees.affiliateFee.casualGST = 0;
                        memObj.fees.affiliateFee.seasonalFee = 0;
                        memObj.fees.affiliateFee.seasonalGST = 0;
                    }
                    if(isNullOrUndefined(memObj.fees.competitionOrganisorFee)){
                        memObj.fees.competitionOrganisorFee.casualFee = 0;
                        memObj.fees.competitionOrganisorFee.casualGST = 0;
                        memObj.fees.competitionOrganisorFee.seasonalFee = 0;
                        memObj.fees.competitionOrganisorFee.seasonalGST = 0;
                    }

                    if(isNullOrUndefined(memObj.fees.membershipFee)){
                        memObj.fees.membershipFee.casualFee = 0;
                        memObj.fees.membershipFee.casualGST = 0;
                        memObj.fees.membershipFee.seasonalFee = 0;
                        memObj.fees.membershipFee.seasonalGST = 0;
                    }
                }
            }
        } catch (error) {
           logger.error(`Exception occurred in resetFeeForHardship ${error}`);
           throw error; 
        }
    }

    private getTeamMembers(teamMembers, selectedVal){
        try {

            let result = {
                payingForList: [],
                notPayingForList: []
            }
            let teamMemberList = teamMembers!= null ? JSON.parse(teamMembers) : [];
            //console.log("teamMemberList" + JSON.stringify(teamMemberList));
            if(isArrayPopulated(teamMemberList)){
               
                let nameMap = new Map();
                for(let item of teamMemberList){
                    //console.log("item" + JSON.stringify(item));
                    let payingFor = selectedVal.nominationPayOptionRefId == 2 ? item.payingFor : 1;
                    let payKey = payingFor;
                    let key = item.membershipProductTypeName + "#" + payKey;
                    let nameTemp = nameMap.get(key);
                    //console.log("Key" + key);
                    
                    if(nameTemp == undefined){
                        if(item.personRoleRefId!= null){
                            if(item.personRoleRefId == 2){
                                let obj = {
                                    membershipProductTypeName: "Coach",
                                    name: "("+ item.name + ", "
                                }
                                result.payingForList.push(obj);
                                if(item.isRegisteredAsPlayer == 1){
                                    let obj = {
                                        membershipProductTypeName: item.membershipProductTypeName ? item.membershipProductTypeName : "Player",
                                        name: "("+ item.name + ", "
                                    }
                                    result.payingForList.push(obj);
                                }
                            }
                            else{
                                if(item.isRegisteredAsPlayer == 1 || item.personRoleRefId == 4){
                                    let obj = {
                                        membershipProductTypeName: item.membershipProductTypeName ? item.membershipProductTypeName : "Player",
                                        name: "("+ item.name + ", "
                                    }
                                    result.payingForList.push(obj);
                                }
                            }
                        }
                        else{
                            let obj = {
                                membershipProductTypeName: item.membershipProductTypeName,
                                name: "("+ item.name + ", "
                            }
                            nameMap.set(key, obj);
                            if(payingFor == 1){
                                result.payingForList.push(obj);
                            }
                            else{
                                result.notPayingForList.push(obj);
                            }
                        }
                    }
                    else{
                        if(item.personRoleRefId!= null){
                            if(item.personRoleRefId == 2){
                                let nameC = nameMap.get("Coach" + "#" + payKey);
                                if(nameC){
                                    nameC.name = nameC.name + item.name + ", ";
                                }
                                else{
                                    let obj = {
                                        membershipProductTypeName: "Coach",
                                        name: "("+ item.name + ", "
                                    }
                                    result.payingForList.push(obj);
                                }
                                
                                if(item.isRegisteredAsPlayer == 1){
                                    let nameP = nameMap.get("Player" + "#" + payKey);
                                    if(nameP){
                                        nameP.name = nameP.name + item.name + ", ";
                                    }
                                }
                            }
                            else{
                                if(item.isRegisteredAsPlayer == 1 || item.personRoleRefId == 4){
                                    nameTemp.name = nameTemp.name + item.name + ", ";
                                }
                            }
                        }
                        else{
                            nameTemp.name = nameTemp.name + item.name + ", ";
                        }
                        
                    }
                }

                //console.log("^^^^^" + JSON.stringify(result.payingForList));
                (result.payingForList || []).map((item) =>{
                    item.name = item.name.slice(0,(item.name.length-2));
                    item.name = item.name + ")";
                });

                (result.notPayingForList || []).map((item) =>{
                    item.name = item.name.slice(0,(item.name.length - 2));
                    item.name = item.name + ")";
                });
            }
            return result;
        } catch (error) {
            logger.error(`Exception occurred in getTeamMembers ${error}`);   
            throw error;
        }
    }

    private checkOrgSettings(orgRegistrationSettings, item, yourInfo, obj){
        try {
            if(isArrayPopulated(orgRegistrationSettings)){
                let orgReg = orgRegistrationSettings.find(x=>x.orgRegistrationId == item.orgRegistrationId);
                if(isNotNullAndUndefined(orgReg)){
                    if(yourInfo!= null){
                        if(yourInfo.email == item.email){
                            obj.hasClubVolunteer = 1;
                        }
                    }
                    else{
                        obj.hasClubVolunteer = 1;
                    }
                }
            }
        } catch (error) {
            logger.error(`Exception occurred in checkOrgSettings ${error}`);
            throw error;
        }
    }

    private getAdjustedVal(actualVal, divisor){
        // console.log("actualVal" + actualVal);
        // console.log("divisor" + divisor);
       let fee = feeIsNull(feeIsNull(actualVal) / divisor);

       let calcVal = (fee * divisor);
    //    console.log("fee" + fee);
    //    console.log("calcVal" + calcVal);
       if(calcVal != feeIsNull(actualVal)){
            let difVal = feeIsNull(actualVal) - calcVal;
           // console.log("difVal" + difVal);
            if(difVal > 0){
                fee = feeIsNull(fee + (difVal));
            }
            //console.log("fee" + fee);
        }

        return fee;
    }

    private sortPaymentOptions(paymentOptions){
        try {
            paymentOptions.sort((a, b) => (b.sortOrder < a.sortOrder) ? 1 : -1)

            return paymentOptions;
        } catch (error) {
            logger.error(`Exception occurred in sortPaymentOptions ${error}`);
        }
    }

    private async calculateNegativeFees(obj, registrationId, registrationCreatedBy, total){
        try {
            let trans = [];
            if(isArrayPopulated(obj.compParticipants)){
                for(let item of obj.compParticipants){
                    for(let mem of item.membershipProducts){
                        console.log("mem.feesToPay@!!!!!" + JSON.stringify(mem.feesToPay));
                        const membershipData = isNotNullAndUndefined(mem.fees.membershipFee) ? mem.fees.membershipFee : Object.assign({});
                        const compOrgData = isNotNullAndUndefined(mem.fees.competitionOrganisorFee) ? mem.fees.competitionOrganisorFee : Object.assign({});
                        const affiliateData = isNotNullAndUndefined(mem.fees.affiliateFee) ? mem.fees.affiliateFee : Object.assign({});
                        const compOrgDataJson = JSON.stringify(compOrgData);
                        const membershipDataJson = JSON.stringify(membershipData);
                        if(objectIsNotEmpty(affiliateData)){
                            let aFeeToPay = affiliateData.feesToPay;
                            let aFeeToPayGst = affiliateData.feesToPayGST;
                            let aNomFee = affiliateData.nominationFeeToPay;
                            let aNomGst = affiliateData.nominationGSTToPay;

                            let totalAffNegativeVal = this.calculateTotalSourceNegativeVal(affiliateData);
                            let obj = {
                                totalNegativeValPaid: 0
                            }
                            if(isNegativeNumber(aFeeToPay) || isNegativeNumber(aFeeToPayGst) || 
                                isNegativeNumber(aNomFee) || isNegativeNumber(aNomGst)){
                                let fee = this.calculateNegativeFee(affiliateData, "feesToPay", compOrgData, membershipData, membershipDataJson, compOrgDataJson, obj, "comp");
                                let gst = this.calculateNegativeFee(affiliateData, "feesToPayGST", compOrgData, membershipData, membershipDataJson, compOrgDataJson, obj, "comp");
                                let nomFee =  this.calculateNegativeFee(affiliateData, "nominationFeeToPay", compOrgData, null, membershipDataJson, compOrgDataJson, obj, "nom");
                                let nomGst = this.calculateNegativeFee(affiliateData, "nominationGSTToPay", compOrgData, null, membershipDataJson, compOrgDataJson, obj, "nom");
                                //console.log("@@@@@@@@@@@@@@"+fee + "$$" + gst + "$$" + nomFee + "$$" + nomGst);
                                if(fee || gst || nomFee || nomGst){
                                    let transaction = this.createNegativeTransaction(mem, AppConstants.competition,fee,gst, nomFee, nomGst, compOrgData.cOrgId, item, affiliateData.cOrgId);
                                    trans.push(transaction);
                                }
                                
                                let mfee = this.calculateNegativeFee(affiliateData, "feesToPay", membershipData, compOrgData, membershipDataJson, compOrgDataJson, obj, "mem");
                                let mgst = this.calculateNegativeFee(affiliateData, "feesToPayGST", membershipData, compOrgData, membershipDataJson, compOrgDataJson, obj, "mem");
                                //console.log("@@@@@@@@@@@@@@"+mfee + "$$" + mgst);
                                if(mfee || mgst){
                                    let mtransaction = this.createNegativeTransaction(mem, AppConstants.membership,mfee,mgst, 0, 0, membershipData.mOrgId, item, affiliateData.cOrgId);
                                    trans.push(mtransaction);
                                }
    
                                //console.log("###################"+aFeeToPay + "$$" + aFeeToPayGst + "$$" + aNomFee + "$$" + aNomGst);
                                //if(fee || gst || nomFee || nomGst || mfee || mgst){
                                    if(isNegativeNumber(aFeeToPay))  {
                                        affiliateData.feesToPay = 0;
                                        let feeVal = ((fee < 0 ? 0 : fee) + (mfee < 0 ? 0 : mfee));
                                        aFeeToPay = feeVal <  (aFeeToPay * -1) ? (feeVal * -1) : (aFeeToPay);
                                    }
                                    else{
                                        aFeeToPay = 0; 
                                    }
                                    if(isNegativeNumber(aFeeToPayGst))  {
                                        affiliateData.feesToPayGST = 0;
                                        let gstVal = ((gst < 0 ? 0 : gst) + (mgst < 0 ? 0 : mgst));
                                        aFeeToPayGst = gstVal <  (aFeeToPayGst * -1) ? (gstVal * -1) : (aFeeToPayGst);
                                    }
                                    else{
                                        aFeeToPayGst = 0; 
                                    }
                                    if(isNegativeNumber(aNomFee)) {
                                        affiliateData.nominationFeeToPay = 0;
                                        let nomVal = ((nomFee < 0 ? 0 : nomFee));
                                        aNomFee = nomVal <  (aNomFee * -1) ? (nomVal * -1) : (aNomFee);
                                    }
                                    else{
                                        aNomFee = 0; 
                                    }
                                    
                                    if(isNegativeNumber(aNomGst)) {
                                        affiliateData.nominationGSTToPay = 0;
                                        let nomGstVal = ((nomGst < 0 ? 0 : nomGst));
                                        aNomGst = nomGstVal <  (aNomGst * -1) ? (nomGstVal * -1) : (aNomGst);
                                    } 
                                    else{
                                        aNomGst = 0; 
                                    }

                                    //console.log("@@@@@@@@@@@@@@"+aFeeToPay + "$$" + aFeeToPayGst + "$$" + aNomFee + "$$" + aNomGst);
                                    
                                    let transaction = this.createNegativeTransaction(mem, AppConstants.affiliate,aFeeToPay,aFeeToPayGst, aNomFee, aNomGst, affiliateData.cOrgId, item, null);
                                    trans.push(transaction);
                                //}
                                console.log("totalAffNegativeVal" + totalAffNegativeVal);
                                 console.log("obj.totalNegativeValPaid" + obj.totalNegativeValPaid);
                                 console.log("mem.feesToPay@!" + mem.feesToPay)
                                 let negValToPay =  (obj.totalNegativeValPaid > 0 ? obj.totalNegativeValPaid : obj.totalNegativeValPaid * -1)
                                 if(negValToPay > 0){
                                    let valToAdd = (totalAffNegativeVal * -1 ) - negValToPay;
                                    console.log("mem.feesToPay" + JSON.stringify(mem.feesToPay));
                                    console.log("valToAdd" + JSON.stringify(valToAdd));
                                    if(!isNegativeNumber(valToAdd)){
                                        mem.feesToPay  = feeIsNull(mem.feesToPay) + valToAdd;
                                    }
                                 }
                                // console.log("mem.feesToPay@@" + mem.feesToPay)
                            }
                        }
                        else if(objectIsNotEmpty(compOrgData)){
                            let cFeeToPay = compOrgData.feesToPay;
                            let cFeeToPayGst = compOrgData.feesToPayGST;
                            let cNomFee = compOrgData.nominationFeeToPay;
                            let cNomGst = compOrgData.nominationGSTToPay;
                            let totalNegativeVal = this.calculateTotalSourceNegativeVal(compOrgData);
                            let obj = {
                                totalNegativeValPaid: 0
                            }

                            if(isNegativeNumber(cFeeToPay) || isNegativeNumber(cFeeToPayGst) || 
                                isNegativeNumber(cNomFee) || isNegativeNumber(cNomGst)){
                                
                                let mfee = this.calculateNegativeFee(compOrgData, "feesToPay", membershipData, null, null, membershipDataJson, obj, "mem");
                                let mgst = this.calculateNegativeFee(compOrgData, "feesToPayGST", membershipData, null, null, membershipDataJson, obj, "mem");
                                //console.log("@@@@@@@@@@@@@@"+mfee + "$$" + mgst);
                                if(mfee || mgst){
                                    let mtransaction = this.createNegativeTransaction(mem, AppConstants.membership,mfee,mgst, 0, 0, membershipData.mOrgId, item, compOrgData.cOrgId);
                                    trans.push(mtransaction);
                                }
    
                                //if(fee || gst || nomFee || nomGst || mfee || mgst){
                                    if(isNegativeNumber(cFeeToPay)){
                                        compOrgData.feesToPay = 0;
                                        let feeVal = (mfee < 0 ? 0 : mfee);
                                        cFeeToPay = feeVal <  (cFeeToPay * -1) ? (feeVal * -1) : (cFeeToPay);
                                    }
                                    else{
                                        cFeeToPay = 0;
                                    }

                                    if(isNegativeNumber(cFeeToPayGst))  {
                                        compOrgData.feesToPayGST = 0;
                                         let gstVal = (mgst < 0 ? 0 : mgst);
                                        cFeeToPayGst = gstVal <  (cFeeToPayGst * -1) ? (gstVal * -1) : (cFeeToPayGst);
                                    }
                                    else{
                                        cFeeToPayGst = 0;
                                    }
                                    
                                    let transaction = this.createNegativeTransaction(mem, AppConstants.competition,cFeeToPay,cFeeToPayGst, cNomFee, cNomGst, compOrgData.cOrgId, item, null);
                                    trans.push(transaction);
                                //}

                                let negValToPay =  (obj.totalNegativeValPaid > 0 ? obj.totalNegativeValPaid : obj.totalNegativeValPaid * -1)
                                 if(negValToPay > 0){
                                    let valToAdd = (totalNegativeVal * -1 ) - negValToPay;
                                    if(!isNegativeNumber(valToAdd)){
                                        mem.feesToPay  = feeIsNull(mem.feesToPay) + valToAdd;
                                    }
                                 }
                            }
                        }

                        this.calculateTotalAmt(mem,total, item);
                        mem.feesToPay = formatValue(feeIsNull(mem.feesToPay));

                        if(isNotNullAndUndefined(mem.fees.membershipFee))
                            delete mem.fees.membershipFee.mOrgId;
                        if(isNotNullAndUndefined(mem.fees.competitionOrganisorFee))
                            delete mem.fees.competitionOrganisorFee.cOrgId;
                        if(isNotNullAndUndefined(mem.fees.affiliateFee))
                            delete mem.fees.affiliateFee.cOrgId;
    
                    }

                    delete item.competitionId;
                }
            }

            //console.log("trans" + JSON.stringify(trans));
            await this.trackSave(trans, registrationId, registrationCreatedBy, RegistrationStep.NegativeFeeTrackStep);
        } catch (error) {
            logger.error(`Exception occurred in calculateNegativeFees ${error}`);
            throw error;
        }
    }

    private calculateTotalSourceNegativeVal(fee){
        let total = 0;
        total += isNegativeNumber(fee.feesToPay) ? fee.feesToPay : 0;
        total += isNegativeNumber(fee.feesToPayGST) ? fee.feesToPayGST : 0;
        total += isNegativeNumber(fee.nominationFeeToPay) ? fee.nominationFeeToPay : 0;
        total += isNegativeNumber(fee.nominationGSTToPay) ? fee.nominationGSTToPay : 0;

        return total;
    }

    private calculateNegativeFee(feeObj1, key, feeObj2, feeObj3, feeObj4, feeObj5, obj, mode){
        try {
            let totalFeesToPay = 0;
            let nFee = 0;
            let negativeFees = feeObj1[key];
            console.log("mode" + mode);
            if(isNegativeNumber(negativeFees)){
                if(objectIsNotEmpty(feeObj2)){
                    let feeObj = null;
                    let finalVal = 0;
                    if(mode == "comp" || mode == "mem"){
                        if(mode == "comp"){
                            feeObj = JSON.parse(feeObj5);
                        }
                        else{
                            feeObj = JSON.parse(feeObj4);
                        }

                        // let disVal = feeIsNull(feeObj["governmentVoucherAmount"]) + feeIsNull(feeObj["childDiscountsToDeduct"]) + 
                        //                 feeIsNull(feeObj["discountsToDeduct"]);
                        let disVal = 0;
                        console.log("Comp disVal " + disVal);
                        console.log("FeeVal " + feeObj[key]);
                        let val = feeObj[key] - disVal;
                        console.log("Comp val " + val);
                        if(val > 0){
                            finalVal = val;
                        }
                        else{
                            finalVal = feeObj[key];
                        }
                    }
                    else if(mode == "nom"){
                        feeObj = JSON.parse(feeObj5);
                        // let disVal = feeIsNull(feeObj["nominationGVAmount"]) + feeIsNull(feeObj["nomChildDiscountsToDeduct"]) + 
                        //             feeIsNull(feeObj["nomDiscountsToDeduct"]);
                        let disVal = 0;
                        console.log("Nom disVal " + disVal);
                        console.log("FeeVal " + feeObj[key]);
                        let val = feeObj[key] - disVal;
                        if(val > 0){
                            finalVal = val;
                        }
                        else{
                            finalVal = feeObj[key];
                        }
                    }
                    totalFeesToPay += finalVal;
                }
                if(objectIsNotEmpty(feeObj3)){
                    let feeObj = null;
                    let finalVal = 0;
                    if(mode == "mem" || mode == "comp"){
                        if(mode == "comp"){
                            feeObj = JSON.parse(feeObj4);
                        }
                        else{
                            feeObj = JSON.parse(feeObj5);
                        }
                  
                        // let disVal = feeIsNull(feeObj["governmentVoucherAmount"]) + feeIsNull(feeObj["childDiscountsToDeduct"]) + 
                        //             feeIsNull(feeObj["discountsToDeduct"]);
                        let disVal = 0;
                        console.log("Mem disVal " + disVal);
                        console.log("FeeVal " + feeObj[key]);
                        let val = feeObj[key] - disVal;
                        console.log("Mem val " + val);
                        if(val > 0){
                            finalVal = val;
                        }
                        else{
                            finalVal = feeObj[key];
                        }
                    }
                    totalFeesToPay += finalVal;
                }
                 console.log("negativeFees " + negativeFees);
                 console.log("totalFeesToPay " + totalFeesToPay);
                 console.log("key" + key);
                
    
                if(objectIsNotEmpty(feeObj2)){
                   
                    let disVal = 0;
                    let finalVal = 0;
                    // if(mode == "nom"){
                    //     disVal = feeIsNull(feeObj2["nominationGVAmount"]) + feeIsNull(feeObj2["nomChildDiscountsToDeduct"]) + 
                    //     feeIsNull(feeObj2["nomDiscountsToDeduct"]);
                    // }
                    // else{
                    //     disVal = feeIsNull(feeObj2["governmentVoucherAmount"]) + feeIsNull(feeObj2["childDiscountsToDeduct"]) + 
                    //     feeIsNull(feeObj2["discountsToDeduct"]);
                    // }
                    console.log("%%%disVal " + disVal);
                    let diffVal = feeObj2[key] - disVal;
                    
                    console.log("diffVal val " + diffVal);
                    if(diffVal > 0)
                    {
                        finalVal = diffVal;
                        console.log("finalVal " + finalVal);
                        let divVal = (totalFeesToPay && feeIsNull(finalVal)) ?  (feeIsNull(finalVal) / feeIsNull(totalFeesToPay)) : 0;
                        console.log("divVal" + divVal);
                        nFee =  divVal * negativeFees;
                        console.log("nFee" + nFee);
                        let appliedFee = feeObj2[key] + nFee;
                        console.log("appliedFee" + appliedFee);
                        if(isNegativeNumber(appliedFee)){
                           // console.log(")))))))))" + feeIsNull(feeObj2[key]));
                            obj.totalNegativeValPaid += feeIsNull(finalVal);
                            nFee = finalVal;
                            feeObj2[key] = 0;
                        }
                        else{
                            console.log("!!!!!!!!" + feeIsNull(nFee));
                            obj.totalNegativeValPaid += feeIsNull(nFee);
                            feeObj2[key] = feeIsNull(appliedFee);
                        }
                    }
                }
            }
            else{
                //mem.feesToPay = feeIsNull(mem.feesToPay) + feeObj1[key];
            }

           return isNegativeNumber(nFee) ? nFee * -1 : nFee;
            
        } catch (error) {
            logger.error(`Exception occurred in calculateNegativeFee ${error}`);
            throw error;
        }
    }

    private createNegativeTransaction(mem, feeType, feeAmt, gstAmt, nominationFee, nominationGST, organsiationId, item,
        sourceOrgId){
        try {

            let trxn = {
                firstName: mem.firstName,
                lastName: mem.lastName,
                mobileNumber: mem.mobileNumber,
                email: mem.email,
                feeAmount:  feeAmt,
                gstAmount: gstAmt,
                discountAmount: 0,
                feeType: feeType,
                membershipProductMappingId: mem.membershipMappingId,
                competitionId:  item.competitionId,
                organisationId : organsiationId,
                divisionId: mem.divisionId,
                nominationFeeToPay: nominationFee,
                nominationGSTToPay: nominationGST,
                sourceOrgId: sourceOrgId,
                paymentOptionRefId: item.selectedOptions.paymentOptionRefId,
                membershipTypeName: mem.membershipTypeName
            }   

            return trxn;
        } catch (error) {
            logger.error(`Exception occurred in createNegativeTransaction ${error}`);
            throw error;
        }
    }

    private async calculateHardshipPayment(obj, registrationId, registrationCreatedBy){
        try {
            let transArr = [];
            if(isArrayPopulated(obj.compParticipants)){
                for(let item of obj.compParticipants){
                    if(item.selectedOptions.isHardshipCodeApplied)
                    for(let mem of item.membershipProducts){
                        const membershipData = isNotNullAndUndefined(mem.fees.membershipFee) ? mem.fees.membershipFee : Object.assign({});
                        const compOrgData = isNotNullAndUndefined(mem.fees.competitionOrganisorFee) ? mem.fees.competitionOrganisorFee : Object.assign({});
                        const affiliateData = isNotNullAndUndefined(mem.fees.affiliateFee) ? mem.fees.affiliateFee : Object.assign({});
                        
                        if(item.selectedOptions.discountCodes!= null && item.selectedOptions.discountCodes.length > 0){
                            let hardshipCode =  item.selectedOptions.discountCodes.find(x=>x.isHardshipCode == 1);
                            if(hardshipCode){
                                if(objectIsNotEmpty(affiliateData)){
                                   let trans =  this.calculateHardhipValue(affiliateData, compOrgData, membershipData, mem, item, AppConstants.affiliate);
                                   if(isArrayPopulated(trans)){
                                       transArr.push(...trans);
                                   }
                                }
                                else if(objectIsNotEmpty(compOrgData)){
                                    let trans = this.calculateHardhipValue(compOrgData, compOrgData, membershipData, mem, item, AppConstants.competition);
                                    if(isArrayPopulated(trans)){
                                        transArr.push(...trans);
                                    }
                                }
                            }
                        }
                    }
                }

                await this.trackSave(transArr, registrationId, registrationCreatedBy, RegistrationStep.HardshipFeeTrackStep);
            }

        } catch (error) {
            logger.error(`Exception occurred in calculateHardshipPayment ${error}`);
            throw error;
        }
    }

    private calculateHardhipValue(feeObj1, feeObj2, feeObj3, mem, item, feeType){
        try {
            let transArr = [];
            let fee = 0;
            let gst = 0;
            let discountAmount = 0;
            let nominationFeeToPay = 0;
            let nominationGSTToPay = 0;
            let flag = 0;
            if(objectIsNotEmpty(feeObj2)){
                if(feeObj1.organisationId != feeObj2.organisationId){
                    let transaction = this.getHardshipTransObj(mem, AppConstants.competition,item, feeObj2, feeObj2.cOrgId, feeObj1.cOrgId);
                    fee += feeIsNull(feeObj2.feesToPay);
                    gst += feeIsNull(feeObj2.feesToPayGST);
                    discountAmount += feeIsNull(feeObj2.discountsToDeduct);
                    nominationFeeToPay += feeIsNull(feeObj2.nominationFeeToPay);
                    nominationGSTToPay += feeIsNull(feeObj2.nominationGSTToPay);
                    transArr.push(transaction);
                    flag = 1;
                }
            }
            if(objectIsNotEmpty(feeObj3)){
                if(feeObj1.organisationId != feeObj3.organisationId){
                    let transaction = this.getHardshipTransObj(mem, AppConstants.membership,item, feeObj3, feeObj3.mOrgId, feeObj1.cOrgId);
                    fee += feeIsNull(feeObj3.feesToPay);
                    gst += feeIsNull(feeObj3.feesToPayGST);
                    discountAmount += feeIsNull(feeObj3.discountsToDeduct);
                    nominationFeeToPay += feeIsNull(feeObj3.nominationFeeToPay);
                    nominationGSTToPay += feeIsNull(feeObj3.nominationGSTToPay);
                    transArr.push(transaction);
                    flag = 1;
                }
            }

            if(flag){
                //console.log("FeeObj1" + JSON.stringify(feeObj1));
                let discountsToDeduct = (feeIsNull(feeObj1.feesToPay) + feeIsNull(feeObj1.feesToPayGST) 
                - feeIsNull(feeObj1.discountsToDeduct) + feeIsNull(feeObj1.nominationFeeToPay)
                + feeIsNull(feeObj1.nominationGSTToPay));
                let gvAmt = feeIsNull(feeObj1.governmentVoucherAmount) + feeIsNull(feeObj1.nominationGVAmount);
                //console.log("discountsToDeduct" + JSON.stringify(discountsToDeduct));

                mem.feesToPay = feeIsNull(mem.feesToPay);//  + discountsToDeduct;
                mem.discountsToDeduct = feeIsNull(mem.discountsToDeduct); //+  (discountsToDeduct);
                //mem.governmentVoucherAmount = feeIsNull(mem.governmentVoucherAmount);
                mem.feesToPay = formatValue(mem.feesToPay);   
                mem.discountsToDeduct = formatValue(mem.discountsToDeduct);   
                mem.governmentVoucherAmount = formatValue(mem.governmentVoucherAmount);
                
               
                // feeObj1.feesToPay =  0;
                // feeObj1.feesToPayGST = 0;
                //feeObj1.discountsToDeduct = discountsToDeduct;
                // feeObj1.nominationFeeToPay = 0;
                // feeObj1.nominationGSTToPay = 0;
              
                let feeObj = {
                    feesToPay: fee * -1,  feesToPayGST: gst * -1, 
                    discountsToDeduct: discountAmount * -1, nominationFeeToPay: nominationFeeToPay * -1,
                    nominationGSTToPay: nominationGSTToPay * -1
                }

                let transaction = this.getHardshipTransObj(mem, feeType, item, feeObj, feeObj1.cOrgId, null);
                transArr.push(transaction);
            }

            return transArr;

        } catch (error) {
            logger.error(`Exception occurred in calculateHardhipValue ${error}`);
            throw error;
        }
    }   

    private getHardshipTransObj(mem, feeType, item, feeObj2, organisationId, sourceOrgId){
        try {
            let trxn = {
                firstName: mem.firstName,
                lastName: mem.lastName,
                mobileNumber: mem.mobileNumber,
                email: mem.email,
                feeAmount:  feeObj2.feesToPay,
                gstAmount: feeObj2.feesToPayGST,
                discountAmount: feeObj2.discountsToDeduct,
                feeType: feeType,
                membershipProductMappingId: mem.membershipMappingId,
                competitionId:  item.competitionId,
                organisationId : organisationId,
                divisionId: mem.divisionId,
                nominationFeeToPay: feeObj2.nominationFeeToPay ? feeObj2.nominationFeeToPay : 0,
                nominationGSTToPay: feeObj2.nominationGSTToPay ? feeObj2.nominationGSTToPay : 0,
                sourceOrgId: sourceOrgId,
                paymentOptionRefId: item.selectedOptions.paymentOptionRefId,
                membershipTypeName: mem.membershipTypeName,
                childDiscountsToDeduct: feeObj2.childDiscountsToDeduct

            } 

            return trxn;
        } catch (error) {
            logger.error(`Exception occurred in getHardshipTransObj ${error}`);
            throw error;
        }
    }

    private async calculateBorrowedDiscountFees(obj, registrationId, registrationCreatedBy){
        try {
            console.log("calculateBorrowedDiscountFees");
            let trans = [];
            if(isArrayPopulated(obj.compParticipants)){
                for(let item of obj.compParticipants){
                    for(let mem of item.membershipProducts){
                        const membershipData = isNotNullAndUndefined(mem.fees.membershipFee) ? mem.fees.membershipFee : Object.assign({});
                        const compOrgData = isNotNullAndUndefined(mem.fees.competitionOrganisorFee) ? mem.fees.competitionOrganisorFee : Object.assign({});
                        const affiliateData = isNotNullAndUndefined(mem.fees.affiliateFee) ? mem.fees.affiliateFee : Object.assign({});
                        let totalDiscount = 0;
                        let borrowedObject = null;
                        let feeType = null;

                        if(objectIsNotEmpty(compOrgData)){
                            let borrowedObj = compOrgData.borrowedDiscount;
                            if(borrowedObj){
                                if(borrowedObj.sourceOrgId!= null && borrowedObj.sourceOrgId != borrowedObj.organisationId){
                                    totalDiscount += borrowedObj.feeAmount;
                                    trans.push(borrowedObj);
                                    borrowedObject = borrowedObj;
                                }
                                
                            }

                            let nowBorrowedObj = compOrgData.nomBorrowedDiscount;
                            if(nowBorrowedObj){
                                if(nowBorrowedObj.sourceOrgId!= null && nowBorrowedObj.sourceOrgId != nowBorrowedObj.organisationId)
                                {
                                    totalDiscount += nowBorrowedObj.feeAmount;
                                    trans.push(nowBorrowedObj);
                                    borrowedObject = nowBorrowedObj;
                                }
                            }

                            let nomChildBorrowedObj = compOrgData.nomChildBorrowedDiscount;
                            if(nomChildBorrowedObj){
                                if(nomChildBorrowedObj.sourceOrgId!= null && nomChildBorrowedObj.sourceOrgId != nomChildBorrowedObj.organisationId)
                                {
                                    totalDiscount += nomChildBorrowedObj.feeAmount;
                                    trans.push(nomChildBorrowedObj);
                                    borrowedObject = nomChildBorrowedObj;
                                }
                            }
                            feeType = AppConstants.competition;
                        }

                        if(objectIsNotEmpty(membershipData)){
                            let borrowedObj = membershipData.borrowedDiscount;
                            if(borrowedObj){
                                if(borrowedObj.sourceOrgId!= null && borrowedObj.sourceOrgId != borrowedObj.organisationId)
                                {
                                    totalDiscount += borrowedObj.feeAmount;
                                    trans.push(borrowedObj);
                                    borrowedObject = borrowedObj;
                                }
                            }
                        }

                        if(objectIsNotEmpty(affiliateData)){
                            let nowBorrowedObj = affiliateData.nomBorrowedDiscount;
                            if(nowBorrowedObj){
                                if(nowBorrowedObj.sourceOrgId!= null && nowBorrowedObj.sourceOrgId != nowBorrowedObj.organisationId)
                                {
                                    totalDiscount += nowBorrowedObj.feeAmount;
                                    trans.push(nowBorrowedObj);
                                    borrowedObject = nowBorrowedObj;
                                }
                            }

                            let nowChildBorrowedObj = affiliateData.nomChildBorrowedDiscount;
                            if(nowChildBorrowedObj){
                                if(nowChildBorrowedObj.sourceOrgId!= null && nowChildBorrowedObj.sourceOrgId != nowChildBorrowedObj.organisationId)
                                {
                                    totalDiscount += nowChildBorrowedObj.feeAmount;
                                    trans.push(nowChildBorrowedObj);
                                    borrowedObject = nowChildBorrowedObj;
                                }
                            }

                            feeType = AppConstants.affiliate;
                        }

                        if(objectIsNotEmpty(borrowedObject)){
                            let feeAmt = totalDiscount * -1;
                            let aTransaction = this.prepareBorrowedTransaction(borrowedObject, feeAmt, affiliateData.cOrgId, feeType);
                           // console.log("aTransaction" + JSON.stringify(aTransaction));
                            trans.push(aTransaction);
                        }
                    }
                }
            }

           // console.log("trans" + JSON.stringify(trans));
            await this.trackSave(trans, registrationId, registrationCreatedBy, RegistrationStep.DiscountFeeTrackStep);
        } catch (error) {
            logger.error(`Exception occurred in calculateBorrowedDiscountFees ${error}`);
            throw error;
        }
    }

    private prepareBorrowedTransaction(obj, totalDiscount, sourceOrgId, feeType){
        try {
            let feeObj = JSON.parse(JSON.stringify(obj));
            console.log("feeObj" + JSON.stringify(feeObj));
            feeObj["feeAmount"] = totalDiscount;
            feeObj["sourceOrgId"] = sourceOrgId;
            feeObj["organisationId"] = null;
            feeObj["feeType"] = feeType;

            return feeObj;

        } catch (error) {
            throw error;
        }
    }

    private async trackSave(transArr, registrationId, registrationCreatedBy, stepsId){
        try {
           // console.log("************ Instalment Future Date Arr " + JSON.stringify(transArr));
                if(isArrayPopulated(transArr)){
                    let trackData = await this.entityManager.query(`select * from  wsa_registrations.registrationTrack  where registrationId = ? and stepsId = ? and isDeleted = 0`,
                                [registrationId, stepsId]);
                    if(isArrayPopulated(trackData)){
                       
                        await this.entityManager.query(`Update wsa_registrations.registrationTrack set jsonData = ? where registrationId = ? and stepsId = ?`,
                        [JSON.stringify(transArr), registrationId, stepsId]);
                    }
                    else{
                        //console.log("$$$$$$$$");
                        await this.entityManager.query(`insert into wsa_registrations.registrationTrack(registrationId, stepsId,jsonData,createdBy) values(?,?,?,?)`,
                        [registrationId,stepsId, JSON.stringify(transArr), registrationCreatedBy]);
                    }
                }
                else{
                    await this.entityManager.query(`Update wsa_registrations.registrationTrack set isDeleted = 1 where registrationId = ? and stepsId = ?`,
                    [registrationId, stepsId]);
                }
        } catch (error) {
            logger.error(`Exception occurred in trackSave ${error}`);
            throw error;
        }
    }

}