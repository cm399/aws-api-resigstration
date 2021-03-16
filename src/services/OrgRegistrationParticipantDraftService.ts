import { Service } from "typedi";
import BaseService from "./BaseService";
import { OrgRegistrationParticipantDraft } from "../models/registrations/OrgRegistrationParticipantDraft";
import { convertUTCDateToLocalDate, feeIsNull, formatValue, isArrayPopulated, isNotNullAndUndefined, isNullOrUndefined } from "../utils/Utils";
import AppConstants from "../validation/AppConstants";
import { logger } from "../logger";
import moment from "moment";

@Service()
export default class OrgRegistrationParticipantDraftService extends BaseService<OrgRegistrationParticipantDraft> {

    modelName(): string {
        return OrgRegistrationParticipantDraft.name;
    }

    public async deleteOrgRegParticipantDraft(registrationId: number, userId: number, userRegistrationId: number): Promise<any> {
        return await this.entityManager.query(`UPDATE orgRegistrationParticipantDraft SET isDeleted = 1, updatedBy = ?, updatedOn = ? WHERE registrationId = ? and userRegistrationId = ? and isDeleted = 0 `,
         [userId, new Date(), registrationId, userRegistrationId]);
    }

    public async getDeletedProducts(registrationId: number): Promise<any>{
        try{
            return await this.entityManager.query(` select * from wsa_registrations.orgRegistrationParticipantDraft orpd 
            where registrationId = ? and isDeleted = 2`, [registrationId]);
        }
        catch(error){
            throw error;
        }
    }

    public async getVolunteerInfo():Promise<any>{
        return await this.entityManager.query(`select id, description from wsa_common.reference where referenceGroupId = 21 and 
                    isDeleted = 0`);

    }
    
    public async deleteByCompetition(registrationId: number, userId: number, userRegistrationId: number, orgRegistrationId: number): Promise<any> {
        return await this.entityManager.query(`UPDATE orgRegistrationParticipantDraft SET isDeleted = 1, updatedBy = ?, updatedOn = ? WHERE registrationId = ? and userRegistrationId = ? and orgRegistrationId = ? and isDeleted = 0 `,
         [userId, new Date(), registrationId, userRegistrationId, orgRegistrationId]);
    }

    public async findByUserRegistration(registrationId: number, userRegistrationId: number): Promise<any>{
        return await this.entityManager.query(` select * from wsa_registrations.orgRegistrationParticipantDraft orpd 
                where registrationId = ? and userRegistrationId = ? and isDeleted = 0`, [registrationId, userRegistrationId]);
    }

    public async deleteByTeamName(registrationId, userId ,teamName){
        try{
            return await this.entityManager.query(`UPDATE orgRegistrationParticipantDraft orgpd 
            inner join userRegistrationDraft urd on urd.id = orgpd.userRegistrationId 
            SET urd.isDeleted = 1, urd.updatedBy = ?, urd.updatedOn = ? ,
            orgpd.isDeleted = 1, orgpd.updatedBy = ?, orgpd.updatedOn = ? 
            WHERE urd.registrationId = ? and urd.teamName = ?  `,
            [userId, new Date(),userId, new Date(), registrationId, teamName]);
        }
        catch(error){
            throw error;
        }
    }

    public async getRegistrationReview(registrationId: number, teamMemberRegId: any,  regTrackReviewData): Promise<any>{
        try {
            if(isNotNullAndUndefined(regTrackReviewData)){
                regTrackReviewData = regTrackReviewData.jsonData;
            }

            let registrationCreatedBy = 0;
            const query = await this.entityManager.query(`call wsa_registrations.usp_get_team_participant_review(?,?)`, [registrationId, teamMemberRegId]);
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
            let securePaymentOptions = [];
            let paymentOptionArr = [];
            let transArr = [];

            if (isArrayPopulated(query) && isArrayPopulated(query[0])) {
                let registeringPerson = query[1].find(x=>x);

                if(isNotNullAndUndefined(regTrackReviewData)){
                    obj.yourInfo = isNullOrUndefined(regTrackReviewData.yourInfo) ? regTrackReviewData.yourInfo : null;
                }
                else{
                    obj.yourInfo = this.setYourInfo(registeringPerson)
                }

                let compMap = new Map();
                let memFeesRestrictList =  [];
               
                let index = 0;
                for(let item of query[0]){
                   
                    let fees = item.fees!= null ? JSON.parse(item.fees) : [];
                    let competitionLogo = item.competitionLogo!= null ? JSON.parse(item.competitionLogo): [];
                    let paymentOptions = item.paymentOptions!= null ? JSON.parse(item.paymentOptions) : [];
                    paymentOptions = this.sortPaymentOptions(paymentOptions);
                    let paymentMethods = item.paymentMethods!= null ? JSON.parse(item.paymentMethods) : [];
                    let selectedVal = null;

                    let compLogo =  competitionLogo.find(x=>x);
                    let competitionLogoUrl = null;
                    if(isNotNullAndUndefined(compLogo)){
                        competitionLogoUrl = compLogo.logoUrl;
                    }

                    if(isNotNullAndUndefined(regTrackReviewData)){
                        if(isArrayPopulated(regTrackReviewData.compParticipants)){
                            selectedVal = regTrackReviewData.compParticipants.find(x=>x.competitionUniqueKey == 
                                item.competitionUniqueKey && x.organisationUnqiueKey == 
                                item.organisationUnqiueKey);
                        }
                    }

                    let compPartTemp = compMap.get(0);
                    if(compPartTemp == undefined){
                        
                        let compPartObj = this.getCompPartObj(item,competitionLogoUrl, fees, paymentMethods, registeringPerson);
                        let selectedObj = this.setSelectedObj(selectedVal,compPartObj, fees);
                        compPartObj.selectedOptions = selectedObj;
                        this.getFees(fees, item, compPartObj, selectedObj, query[2], memFeesRestrictList, query[3], transArr);
                        obj.compParticipants.push(compPartObj);
                        compMap.set(0, compPartObj);
                    }
                    else{
                        this.getFees(fees, item, compPartTemp, compPartTemp.selectedOptions, query[2], memFeesRestrictList, query[3], transArr);
                    }

                    index++;
                }

                

                for(let item of obj.compParticipants)   {
                    if(isArrayPopulated(item.membershipProducts)){
                        for(let x of item.membershipProducts){
                            this.calculateTotalAmt(x,total);
                            x.feesToPay = formatValue(feeIsNull(x.feesToPay));
        
                            if(isNotNullAndUndefined(x.fees.membershipFee))
                                delete x.fees.membershipFee.mOrgId;
                        }
                    }
                   
                    this.getSecurePaymentOptions(item, paymentOptionArr);

                     delete item.competitionId;
                     delete item.paymentMethods;
                     delete item.fees;
                }
            }

            this.calculateTargetValue(total);
            securePaymentOptions = this.getConsolidatedPaymentOptions(paymentOptionArr, obj);
            obj.securePaymentOptions = securePaymentOptions;
            await this.teamDataToDBTrack(transArr, registrationId, registrationCreatedBy, teamMemberRegId);

            return obj;
        } catch (error) {
            throw error;
        }
    }

    private getFees (fees, item, compPartObj, selectedVal, participants, memFeesRestrictList,
        memCapList, transArr){
        try {
        
            let memObj = this.getMemObj(item);
        
            let f = fees.find(x=>x.competitionMembershipProductTypeId == 
                item.competitionMembershipProductTypeId);
            console.log("******************" + item.email);
           
            let memFeeObj = this.getMemFeeObj(f);
            let checkFee = this.checkMemProductFeesType(f,item,participants, memFeesRestrictList, memCapList);

            console.log("checkFee" + JSON.stringify(checkFee));
            
            if(checkFee.isExists){
                if(checkFee.paymentFeeTypeRefId == 2){
                    memFeeObj.seasonalFee = checkFee.amount;
                    memFeeObj.seasonalGST = checkFee.gst;
                }
            }
            
            memObj.fees.membershipFee = memFeeObj;
            memObj.membershipProductName = f.membershipProductName;
            memObj.membershipTypeName = f.mTypeName;
            memObj.competitionMembershipProductTypeId = f.competitionMembershipProductTypeId;
            memObj.membershipMappingId = f.membershipMappingId;
            memObj.divisionId = f.divisionId;
            memObj.orgRegParticipantId =  item.orgRegParticipantId,
            memObj.divisionName = f.divisionName;
            memObj.isPlayer = f.isPlayer;
            this.calculateFee(selectedVal,memObj);
            if(item.payingFor == 1){
                compPartObj.membershipProducts.push(memObj);
            }
            else{
                let mTran = this.getTransactionObj(item, memObj);
                transArr.push(mTran);
            }
        } catch (error) {
            logger.error(`Exception occurred in getFees ${error}`);
            throw error;
        }
    }

    private calculateFee(selectedVal, memObj){
        try {
            if(selectedVal.paymentOptionRefId!= null){
                if(selectedVal.paymentOptionRefId == 1){
                    let mCasualFee = isNullOrUndefined(memObj.fees.membershipFee) ? 
                                     feeIsNull(memObj.fees.membershipFee.casualFee) : 0;
                    let mCasualGST = isNullOrUndefined(memObj.fees.membershipFee) ? 
                                        feeIsNull(memObj.fees.membershipFee.casualGST): 0;
                    
                    if(isNullOrUndefined(memObj.fees.membershipFee)){
                        memObj.fees.membershipFee.feesToPay = mCasualFee;  
                        memObj.fees.membershipFee.feesToPayGST = mCasualGST;  
                        memObj.feesToPay = feeIsNull(memObj.feesToPay) + mCasualFee + mCasualGST;
                    } 
                }
            }
        } catch (error) {
            logger.error(`Exception occurred in calculateFee ${error}`);
            throw error;
        }
    }

    private checkMemProductFeesType(fee, item, participants, memFeesRestrictList, memCapList){
        try {
            //console.log("!!!!item!!!!" + JSON.stringify(item));
            // console.log("participants" + JSON.stringify(participants));
            // console.log("memCapList" + JSON.stringify(memCapList));
            // console.log("memFeesRestrictList" + JSON.stringify(memFeesRestrictList));
            let isExists = false;
            let amount = 0;
            let gst = 0;
            let membershipMappingId = fee.membershipMappingId;
            let orgId = fee.mOrgId;
            let memFee = feeIsNull(fee.mSeasonalFee);
            let memGst = feeIsNull(fee.mSeasonalGST);
            let paymentFeeTypeRefId = AppConstants.SEASONAL_FEE;

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
                    if(isNotNullAndUndefined(obj.expiryDate)){
                        if(moment(item.competitionEndDate).isSameOrBefore(obj.expiryDate)){
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
                   // console.log("response" + JSON.stringify(response));
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
                    console.log("####Else####")
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
                // console.log("capBalance::"+ capBalance);
                 let feeDifference = capBalance - memFee;
                // console.log("feeDifference" + feeDifference)
                 amount = feeDifference <= 0 ? capBalance : memFee;
                // console.log("@@@amount" + amount)
                 let gstPercentage = (feeIsNull(memGst) / feeIsNull(memFee)) * 100;
                // console.log("@@@gstPercentage" + gstPercentage)
                 gst = (amount * gstPercentage) / 100;
                // console.log("@@@gst" + gst)
             }

         return {amount, gst};
        } catch (error) {
            logger.error(`Exception occurred in membershipCapCalculation ${error}`);
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
        try {
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
        } catch (error) {
            logger.error(`Exception occurred in checkExistingMembershipCap ${error}`);
            throw error;
        }
        return response;
    }

    private sortPaymentOptions(paymentOptions){
        try {
            paymentOptions.sort((a, b) => (b.sortOrder < a.sortOrder) ? 1 : -1)

            return paymentOptions;
        } catch (error) {
            logger.error(`Exception occurred in sortPaymentOptions ${error}`);
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

    private getMainObj(total){
        let obj = {
            compParticipants: [],
            isSchoolRegistration: 0,
            total: total,
            securePaymentOptions: [],
            yourInfo: null,
            isHardshipEnabled: 0,
            charityRoundUpRefId: -1
        }

        return obj;
    }

    private getCompPartObj(item, competitionLogoUrl,fees, paymentMethods, registeringPerson){
        let compPartObj = {
            "isTeamRegistration": Number(item.isTeamRegistration),
            "participantId": item.userRegUniqueKey,
            "userId": registeringPerson.userId,
            "firstName": registeringPerson.firstName,
            "lastName":registeringPerson.lastName,
            "mobileNumber": registeringPerson.mobileNumber,
            "email": registeringPerson.email,
            "competitionName": item.competitionName,
            "organisationName": item.organisationName,
            "competitionLogoUrl": competitionLogoUrl,
            "competitionUniqueKey": item.competitionUniqueKey,
            "organisationUniqueKey": item.organisationUniqueKey,
            "membershipProducts": [],
            "paymentOptions":[],
            "paymentMethods": paymentMethods,
            "selectedOptions": null,
            "fees": fees,
            "teamName": item.teamName,
            "totalMembers": item.totalMembers,
            "competitionId": item.competitionId,
            "competitionEndDate": item.competitionEndDate,
            "governmentVoucherAmount": 0,
            "nominationGVAmount": 0,
            "orgRegistrationId": item.orgRegistrationId
        }

        return compPartObj;
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
                if(selectedVal.selectedOptions.paymentOptionRefId == null){
                    selectedObj.paymentOptionRefId = (isArrayPopulated(compPartObj.paymentOptions) ? 
                    compPartObj.paymentOptions[0].paymentOptionRefId: null)
                }
                else{
                    selectedObj.paymentOptionRefId = selectedVal.selectedOptions.paymentOptionRefId;
                }
    
                selectedObj.nominationPayOptionRefId = selectedVal.selectedOptions.nominationPayOptionRefId ? 
                                selectedVal.selectedOptions.nominationPayOptionRefId : 1;
                selectedObj.teamRegChargeTypeRefId = selectedVal.teamRegChargeTypeRefId;
                if(selectedObj.paymentOptionRefId == 1){
                    this.setTeamRegChargeType(fees,selectedObj);
                 }
            }
            else{
                console.log("###!!!" + JSON.stringify(compPartObj.paymentOptions));
                selectedObj.paymentOptionRefId = AppConstants.PAY_AS_YOU_GO;
                this.setTeamRegChargeType(fees,selectedObj);
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

    private getTransactionObj(item, memObj){
        let trxnMembership = {
            firstName: memObj.firstName,
            lastName: memObj.lastName,
            mobileNumber: memObj.mobileNumber,
            email: memObj.email,
            teamName: item.teamName,
            feeAmount:  memObj.feesToPay,
            gstAmount: memObj.feesToPayGST,
            discountAmount: 0,
            feeType: AppConstants.membership,
            membershipProductMappingId: memObj.membershipMappingId,
            competitionId:  item.competitionId,
            organisationId : item.organisationId,
            divisionId: memObj.divisionId,
            nominationFeeToPay: 0,
            nominationGSTToPay: 0
        }   

        return trxnMembership;
    }

    private setYourInfo(registeringPerson){
        try {
            let userObj = {
                userId: 0,
                firstName: registeringPerson.firstName,
                lastName: registeringPerson.lastName,
                email: registeringPerson.email,
                mobileNumber: registeringPerson.mobileNumber
            }

            return userObj;
        } catch (error) {
            throw error;
        }
    }

    private calculateTotalAmt(mem, total){
        let fee = 0;
        let gst = 0;
        fee = (isNullOrUndefined(mem.fees.membershipFee) ? feeIsNull(mem.fees.membershipFee.feesToPay) : 0);

        gst = (isNullOrUndefined(mem.fees.membershipFee) ? feeIsNull(mem.fees.membershipFee.feesToPayGST) : 0);

        total.subTotal = feeIsNull(total.subTotal)  + feeIsNull(fee);
        total.gst = feeIsNull(total.gst) + feeIsNull(gst);

        total.subTotal = feeIsNull(total.subTotal) - feeIsNull(mem.discountsToDeduct) - feeIsNull(mem.childDiscountsToDeduct) - 
            feeIsNull(mem.governmentVoucherAmount);

    }

    private calculateTargetValue(total)
    {
        let targetTotal = feeIsNull(total.gst) + feeIsNull(total.subTotal);
        total.targetValue = formatValue(targetTotal);
        total.charityValue = "0.00";
        total.gst = formatValue(total.gst);
        total.subTotal = formatValue(total.subTotal);
        total.shipping = formatValue(total.shipping);
        total.total =  total.targetValue;
        total.transactionFee = formatValue(total.transactionFee);
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

    private getSecurePaymentOptions(item, paymentOptionArr){
        try {
            console.log("item" + JSON.stringify(item));
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
                    else{
                        obj.paymentOptions.push(payment)
                    }
                }
            }
            
            paymentOptionArr.push(obj);
        } catch (error) {
            logger.error(`Exception occurred in getSecurePaymentOptions ${error}`);
            throw error;
        }
    }

    private async teamDataToDBTrack(transArr, registrationId, registrationCreatedBy, teamMemberRegId) {
        try {
            if (isArrayPopulated(transArr)) {
                let trackData = await this.entityManager.query(
                    `select * from  wsa_registrations.registrationTrack  where registrationId = ? and stepsId = 12 and isDeleted = 0 and teamMemberRegId = ?`,
                    [registrationId, teamMemberRegId]
                );
                if (isArrayPopulated(trackData)) {
                    await this.entityManager.query(
                        `Update wsa_registrations.registrationTrack set jsonData = ? where registrationId = ? and stepsId = 12 and teamMemberRegId = ?`,
                        [JSON.stringify(transArr), registrationId, teamMemberRegId]
                    );
                } else {
                    await this.entityManager.query(
                        `insert into wsa_registrations.registrationTrack(registrationId, stepsId,jsonData,createdBy,teamMemberRegId ) values(?,?,?,?,?)`,
                        [registrationId, 12, JSON.stringify(transArr), registrationCreatedBy, teamMemberRegId]
                    );
                }
            } else {
                await this.entityManager.query(
                    `Update wsa_registrations.registrationTrack set isDeleted = 1 where registrationId = ? and stepsId = 12 and teamMemberRegId = ?`,
                    [registrationId, teamMemberRegId]
                );
            }
        } catch (error) {
            logger.error(`Exception occurred in teamDataToDBTrack ${error}`);
            throw error;
        }
    }
}