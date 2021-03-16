import { Service } from "typedi";
import { logger } from "../logger";
import BaseService from "./BaseService";
import { feeIsNull, formatValue, isArrayPopulated, isNotNullAndUndefined, isNullOrUndefined } from "../utils/Utils";
import { UserRegistration } from "../models/registrations/UserRegistration";
import AppConstants from "../validation/AppConstants";
let moment = require('moment');

@Service()
export default class UserRegistrationService extends BaseService<UserRegistration> {

    modelName(): string {
        return UserRegistration.name;
    }

    public async deleteByRegistrationId(registrationId: number){
        try{
            let result = await this.entityManager.query(
                ` update wsa_registrations.userRegistration ur 
                inner join wsa_registrations.orgRegistrationParticipant orp 
                    on orp.userRegistrationId = ur.id and orp.isDeleted = 0
                set ur.isDeleted = 1
                where orp.registrationId = ? and ur.isDeleted = 0 `,[registrationId]);

            return result;
        }
        catch(error){
            throw error;
        }
    }

    public async findByRegistrationKey(userRegUniqueKey: string): Promise<any> {
        try {
            let response = null;
          let query = await this.entityManager.query(`select r.id as registrationId, ur.id as userRegId, r.createdBy  as regCreatedBy,
                                                ur.userRegUniqueKey, ur.userId
                                        from wsa_registrations.registration r 
                                    inner join wsa_registrations.orgRegistrationParticipant orp 
                                        on orp.registrationId = r.id and orp.isDeleted = 0 
                                    inner join wsa_registrations.userRegistration ur   
                                        on ur.id = orp.userRegistrationId and ur.isDeleted = 0
                                    where ur.userRegUniqueKey = ? and r.isDeleted = 0`,[userRegUniqueKey]);

        if(isArrayPopulated(query)){
            response = query.find(x=>x);
        }
          return response;
        }
        catch (error) {
          throw error;
        }
    }

    public async findByUserId(userId: number, registrationId: number): Promise<any> {
        try {
          let query = await this.entityManager.query(`select ur.* from 
          wsa_registrations.userRegistration ur 
          inner join wsa_registrations.orgRegistrationParticipant orp 
              on orp.userRegistrationId = ur.id and orp.isDeleted = 0
          where orp.registrationId = ? and ur.userId = ? and ur.isDeleted = 0`, 
          [registrationId, userId]);
          return query;
        }
        catch (error) {
          throw error;
        }
      }

      public async getParticipantData(participantId: string): Promise<any> {
        try {
            let query = await this.entityManager.query(`
                    select urr.participantData from wsa_registrations.userRegistration ur 
                    inner join wsa_registrations.userRegistrationDraft urr 
                        on ur.userRegDraftId = urr.id and urr.isDeleted = 0 
                    where ur.userRegUniqueKey = ? and ur.isDeleted = 0`,[participantId])
              return query;
        } catch (error) {
            throw error;
        }
    }
    public async findByRegistrationId(registrationId: number){
        try{
            let query = await this.entityManager.query(`
            select ur.* , orp.paymentOptionRefId from wsa_registrations.userRegistration ur 
            inner join wsa_registrations.orgRegistrationParticipant orp 
                on orp.userRegistrationId = ur.id and orp.isDeleted = 0 
            where orp.registrationId = ? and ur.isDeleted = 0`,[registrationId])
      return query;
    
        return query;
        }
        catch(error){
          throw error;
        }
      }
    
    public async getUserRegistrationReview(userRegId: number, regTrackReviewData): Promise<any>{
        try {
           // console.log("**************" + JSON.stringify(regTrackReviewData));
            if(isNotNullAndUndefined(regTrackReviewData)){
                regTrackReviewData = regTrackReviewData.jsonData;
            }
            let registrationCreatedBy = 0;
            let registrationId = 0;
            let registrationUniqueKey = null;
            const query = await this.entityManager.query(`call wsa_registrations.usp_get_team_registration_review(?)`, [userRegId]);
           
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
           
            let partMap = new Map();
            let memMap = new Map();

           // console.log("regTrackReviewData" + JSON.stringify(regTrackReviewData));

            if(isNotNullAndUndefined(regTrackReviewData)){
                obj.charityRoundUpRefId = regTrackReviewData.charityRoundUpRefId;
                obj.shopProducts = isNullOrUndefined(regTrackReviewData.shopProducts) ? regTrackReviewData.shopProducts : [];
                obj.yourInfo = isNullOrUndefined(regTrackReviewData.yourInfo) ? regTrackReviewData.yourInfo : null;
                obj.billingAddress = isNullOrUndefined(regTrackReviewData.billingAddress) ? regTrackReviewData.billingAddress : null;
                obj.deliveryAddress = isNullOrUndefined(regTrackReviewData.deliveryAddress) ? regTrackReviewData.deliveryAddress : null;
                obj.shippingOptions = isArrayPopulated(regTrackReviewData.shippingOptions) ? regTrackReviewData.shippingOptions : null;
            }
            if(isArrayPopulated(query[0])){
                let filteredResult = this.getFilteredResult(query[0]);
                for(let item of filteredResult){
                    registrationCreatedBy = item.registrationCreatedBy;
                    obj.registrationId = item.registrationUniqueKey;
                    registrationId = item.registrationId;
                    let paymentOptions = item.paymentOptions!= null ? JSON.parse(item.paymentOptions) : [];
                    let paymentMethods = item.paymentMethods!= null ? JSON.parse(item.paymentMethods) : [];
                    let instalmentDates = item.instalmentDates!= null ? JSON.parse(item.instalmentDates) : [];
                    let competitionLogo = item.competitionLogo!= null ? JSON.parse(item.competitionLogo): [];
                    let fees = item.fees!= null ? item.fees: null;
                    let governmentVouchers = item.governmentVouchers!= null ? JSON.parse(item.governmentVouchers) : [];
                    let filterdGovernmentVoucher = this.getGovernmentVouchers(governmentVouchers, item.dateOfBirth);
    
                    let key = item.competitionId + "#" + item.organisationId + "#" + item.email;
                    let memKey = key + "#" + item.membershipMappingId;
                    let participantCompTemp = partMap.get(key);
                    let memTemp = memMap.get(memKey);
                    let selectedVal = null;
                    if(participantCompTemp == undefined){

                        let compLogo =  competitionLogo.find(x=>x);
                        let competitionLogoUrl = null;
                        if(isNotNullAndUndefined(compLogo)){
                            competitionLogoUrl = compLogo.logoUrl;
                        }

                        if(isNotNullAndUndefined(regTrackReviewData)){
                            if(isArrayPopulated(regTrackReviewData.compParticipants)){
                              //  console.log("regTrackReviewData.compParticipants" + JSON.stringify(regTrackReviewData.compParticipants));
                                selectedVal = regTrackReviewData.compParticipants.find(x=>x.competitionUniqueKey == 
                                    item.competitionUniqueKey && x.organisationUnqiueKey == 
                                    item.organisationUnqiueKey && x.email == item.email);
                               // console.log("####" + JSON.stringify(selectedVal));
                            }
                        }

                        let compPartObj = this.getCompPartObj(item,competitionLogoUrl, 
                            filterdGovernmentVoucher, instalmentDates, fees, paymentMethods);

                        let selectedObj = this.setSelectedObj(selectedVal,compPartObj);

                        this.getPaymentOptions(paymentOptions, compPartObj, selectedObj);
                        compPartObj.selectedOptions = selectedObj;
                        let memObj = this.getMemObj(item);
                        compPartObj.membershipProducts.push(memObj);

                        this.getFees(fees,compPartObj,selectedObj, instalmentDates, memObj);

                        partMap.set(key, compPartObj);
                        memMap.set(memKey, memObj);
                        obj.compParticipants.push(compPartObj);
                    }
                    else{
                       
                        if(memTemp == undefined){
                            let memObj = this.getMemObj(item);
                            participantCompTemp.membershipProducts.push(memObj);
                            this.getFees(fees,participantCompTemp,participantCompTemp.selectedOptions, instalmentDates, 
                                memObj);
                            memMap.set(memKey, memObj);
                        }
                        else{
                            this.getFees(fees,participantCompTemp,participantCompTemp.selectedOptions, instalmentDates, memTemp);
                        }
                    }
                }
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
            if(isArrayPopulated(query[2])){
                let stateOrg = query[2].find(x=>x);
                obj.stateOrgId = stateOrg.stateOrgId;
            }
           
            let instalmentFinalArr = [];
            let paymentOptionArr = [];
            let securePaymentOptions = [];
            for(let item of obj.compParticipants){
                for(let x of item.membershipProducts){
                    let instalmentArr = await this.calculateInstalmentFees(x, item);
                    if(isArrayPopulated(instalmentArr)){
                        instalmentFinalArr.push(...instalmentArr);
                    }

                    item.governmentVoucherAmount = feeIsNull(item.governmentVoucherAmount) + 
                    feeIsNull(x.governmentVoucherAmount);

                    this.addNominationFee(x);

                    this.calculateTotalAmt(x,total);

                    x.discountsToDeduct = formatValue(x.discountsToDeduct);
                    x.feesToPay = formatValue(x.feesToPay);

                    if(isNotNullAndUndefined(x.fees.membershipFee))
                        delete x.fees.membershipFee.orgId;
                    if(isNotNullAndUndefined(x.fees.competitionOrganisorFee))
                        delete x.fees.competitionOrganisorFee.orgId;
                    if(isNotNullAndUndefined(x.fees.affiliateFee))
                        delete x.fees.affiliateFee.orgId;
                }

                this.getSecurePaymentOptions(item, paymentOptionArr);
                item.governmentVoucherAmount = formatValue(item.governmentVoucherAmount);

                delete item.competitionId
                delete item.fees;
                delete item.paymentMethods;
            }

             // Final Payment Options 
             securePaymentOptions = this.getConsolidatedPaymentOptions(paymentOptionArr);
             obj.securePaymentOptions = securePaymentOptions;

             this.calculateTargetValue(total, obj.charityRoundUpRefId)
             this.calculateShopProduct(total, obj);
             this.calculateTransactionFee(total);

            if(isArrayPopulated(instalmentFinalArr)){
                obj.hasFutureInstalment = 1;
                await this.instalmentDateToDBTrack(instalmentFinalArr, registrationId, registrationCreatedBy, userRegId);
            }
           
            return obj;
            
        } catch (error) {
            throw error;
        }
    }

    public async getUserRegistrationReviewProducts(regTrackReviewData): Promise<any>{
        try {
           // console.log("**************" + JSON.stringify(regTrackReviewData));
            if(isNotNullAndUndefined(regTrackReviewData)){
                regTrackReviewData = regTrackReviewData.jsonData;
                let isSchoolRegistration = 0;
                let otherOption = 0;

                let total = {
                    subTotal: null,
                    gst: null,
                    shipping: null,
                    charityValue: null,
                    targetValue: null
                }
                let securePaymentOptions = [];

                regTrackReviewData["total"] = total;
                regTrackReviewData["deletedProducts"] = [];
                let paymentOptionArr = [];

                if(isArrayPopulated(regTrackReviewData.compParticipants)){
                    for(let item of regTrackReviewData.compParticipants){
                        if(isArrayPopulated(item.membershipProducts)){
                            for(let mem of item.membershipProducts){
                                let seasonalFee = (isNullOrUndefined(mem.fees.membershipFee) ? feeIsNull(mem.fees.membershipFee.feesToPay) : 0) + 
                                                    (isNullOrUndefined(mem.fees.competitionOrganisorFee) ? feeIsNull(mem.fees.competitionOrganisorFee.feesToPay) : 0) + 
                                                    (isNullOrUndefined(mem.fees.affiliateFee) ?  feeIsNull(mem.fees.affiliateFee.feesToPay) : 0);

                                let seasonalGST = (isNullOrUndefined(mem.fees.membershipFee) ? feeIsNull(mem.fees.membershipFee.feesToPayGST) : 0) + 
                                                (isNullOrUndefined(mem.fees.competitionOrganisorFee) ? feeIsNull(mem.fees.competitionOrganisorFee.feesToPayGST) : 0) + 
                                                (isNullOrUndefined(mem.fees.affiliateFee) ?  feeIsNull(mem.fees.affiliateFee.feesToPayGST) : 0);
                                total.subTotal = feeIsNull(total.subTotal)  + feeIsNull(seasonalFee);
                                total.gst = feeIsNull(total.gst) + feeIsNull(seasonalGST);

                                total.subTotal = feeIsNull(total.subTotal) - feeIsNull(mem.discountsToDeduct);
                            }
                        }

                        // Determine the Secure Payment Options
                        this.getSecurePaymentOptions(item, paymentOptionArr);
                    }

                    regTrackReviewData.compParticipants.map((item) =>{
                        item.membershipProducts.map((mem) =>{
                             mem.discountsToDeduct = formatValue(mem.discountsToDeduct);
                             mem.feesToPay = formatValue(mem.feesToPay);
                        })
                    })

                    // Final Payment Options 
                    securePaymentOptions = this.getConsolidatedPaymentOptions(paymentOptionArr);
                    regTrackReviewData["securePaymentOptions"] = securePaymentOptions;

                    // Calculate Charity Value
                    let targetTotal = total.subTotal + total.gst;
                    if(regTrackReviewData.charityRoundUpRefId > 0 && targetTotal > 0){
                        let charityCalcResult = this.getCharityValue(targetTotal, regTrackReviewData.charityRoundUpRefId);
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
            }

            return regTrackReviewData;
            
        } catch (error) {
            throw error;
        }
    }

    private getFees(fees, item, selectedVal, instalmentDates, mem){
        try {
            
            if(isNotNullAndUndefined(fees)){

                //for(let mem of item.membershipProducts){
                    let feeObj = null;

                    if(fees.feeType == "membership"){
                        feeObj = mem.fees.membershipFee;
                    }
                    else if(fees.feeType == "competition"){
                        feeObj = mem.fees.competitionOrganisorFee;
                    }
                    else if(fees.feeType == "affiliate"){
                        feeObj = mem.fees.affiliateFee;
                    }

                    let obj = {
                        organisationId: fees.organisationUniqueKey,
                        name: fees.organisationName, 
                        emailId: fees.organisationEmailId,
                        phoneNo: fees.organisationPhoneNo,
                        membershipMappingId: mem.membershipMappingId,
                        organisationAccountId: null,
                        seasonalFee: feeIsNull(fees.feeAmount),
                        seasonalGST: feeIsNull(fees.gstAmount),
                        orgDiscountAmt: feeIsNull(fees.discountAmount),
                        feesToPay: feeObj ? feeObj.feesToPay : 0,
                        feesToPayGST: feeObj ? feeObj.feesToPayGST : 0,
                        discountsToDeduct: feeObj ? feeObj.discountsToDeduct : 0,
                        childDiscountsToDeduct: 0,
                        transactionId: fees.teamTransactionId,
                        orgId: fees.organisationId,
                        nominationFeeToPay: fees.nominationFee,
                        nominationGSTToPay: fees.nominationGST,  
                        nominationTransId: fees.nominationTransId,
                        governmentVoucherAmount: feeObj ? feeObj.governmentVoucherAmount : 0,
                    }

                    if(selectedVal!= null && selectedVal.paymentOptionRefId == 4){
                        let totalDates = 0;
                        let paidDates = 0;
                        let dates = this.getInstalmentDatesToPay(instalmentDates, item);
                        console.log("dates" + JSON.stringify(dates));
                        totalDates = dates.totalDates;
                        paidDates = dates.paidDates;
                        let fee = 0;
                        let gst = 0;
                        let discount = 0;
                        if(fees.feeType == "membership"){
                            fee = feeIsNull(fees.feeAmount);
                            gst = feeIsNull(fees.gstAmount);
                            discount = feeIsNull(fees.discountAmount);
                        }
                        else{
                            fee = totalDates == 0 ? 0 : (this.getAdjustedVal(fees.feeAmount, totalDates) * paidDates);
                            gst = totalDates == 0 ? 0 : (this.getAdjustedVal(fees.gstAmount, totalDates) * paidDates);
                            discount = totalDates == 0 ? 0 : (this.getAdjustedVal(fees.discountAmount, totalDates) * paidDates); 
                        }
                        
                        fee = this.applyGovernmentVoucher(selectedVal, mem, fee, obj);
                        obj.feesToPay = fee;  
                        obj.feesToPayGST = gst; 
                        obj.discountsToDeduct =  discount; 

                        mem.feesToPay = feeIsNull(mem.feesToPay) + obj.feesToPay + obj.feesToPayGST ;
                        mem.discountsToDeduct = feeIsNull(mem.discountsToDeduct) + feeIsNull(obj.discountsToDeduct);
                    }
                    else{
                        let fee = feeIsNull(fees.feeAmount);
                        fee = this.applyGovernmentVoucher(selectedVal, mem, fee, obj);
                        obj.feesToPay = feeIsNull(obj.feesToPay) +  fee;
                        obj.feesToPayGST = feeIsNull(obj.feesToPayGST) +  feeIsNull(fees.gstAmount);
                        obj.discountsToDeduct = feeIsNull(fees.discountAmount);
                        mem.feesToPay = feeIsNull(mem.feesToPay) + fee + feeIsNull(fees.gstAmount);
                        mem.discountsToDeduct = feeIsNull(mem.discountsToDeduct) + obj.discountsToDeduct;
                    }

                    if(fees.feeType == "membership"){
                        mem.fees.membershipFee = obj;
                    }
                    else if(fees.feeType == "competition"){
                        console.log("mem.fees.competitionOrganisorFee" + JSON.stringify(obj))
                        mem.fees.competitionOrganisorFee = obj;
                    }
                    else if(fees.feeType == "affiliate"){
                        mem.fees.affiliateFee = obj;
                    }
                // }
            }
        } catch (error) {
            throw error;
        }
    }

    private setSelectedObj(selectedVal, compPartObj)
    {
       // console.log("selectedVal" +JSON.stringify(selectedVal));
        let selectedObj = {
            "paymentOptionRefId": null,
            "nominationPayOptionRefId": null,
            "selectedGovernmentVouchers":[],
            "isHardshipCodeApplied": 0,
            "vouchers": []
        }

        if(isNotNullAndUndefined(selectedVal)){
            (selectedVal.selectedOptions.selectedGovernmentVouchers || []).map((item, index) =>{
                item["remainingAmount"] = item.balance;
                item["redeemAmount"] = 0;
            });
            selectedObj.selectedGovernmentVouchers = selectedVal.selectedOptions.selectedGovernmentVouchers;
           
            selectedObj.vouchers = selectedVal.selectedOptions.vouchers;

            if(selectedVal.selectedOptions.paymentOptionRefId == null){
                selectedObj.paymentOptionRefId = (isArrayPopulated(compPartObj.paymentOptions) ? 
                compPartObj.paymentOptions[0].paymentOptionRefId: null)
            }
            else{
                selectedObj.paymentOptionRefId = selectedVal.selectedOptions.paymentOptionRefId;
            }
        }
        else{
            selectedObj.paymentOptionRefId = (isArrayPopulated(compPartObj.paymentOptions) ? 
                compPartObj.paymentOptions[0].paymentOptionRefId: null)
        }

        return selectedObj;
    }

    private getPaymentOptions(paymentOptions, compPartObj, selectedObj){
       
        for(let op of paymentOptions){
            let opt = this.getPaymentOptionRefId(op.paymentOptionRefId, op.feesTypeRefId);
            if(opt!= 0){
                let pObj = 
                {
                    "feesTypeRefId": op.feesTypeRefId,
                    "paymentOptionRefId": opt
                }

                compPartObj.paymentOptions.push(pObj);
                
            //     if(payMap.get(opt) == undefined){
            //         let pObj = 
            //         {
            //             "feesTypeRefId": op.feesTypeRefId,
            //             "paymentOptionRefId": opt,
            //             "subOptions":[]
            //         }
            //         pObj.subOptions.push(subObj);

            //         compPartObj.paymentOptions.push(pObj);
            //         payMap.set(opt, pObj);
            //     }
            //     else{
            //         let objTemp = payMap.get(opt);
            //         objTemp.subOptions.push(subObj);
            //     }
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
        }

        if(selectedObj.paymentOptionRefId == null){
            selectedObj.paymentOptionRefId = (isArrayPopulated(compPartObj.paymentOptions) ? 
            compPartObj.paymentOptions[0].paymentOptionRefId: null)
        }
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
    }

    private getInstalmentDatesToPay(instalmentDates, item){
        try {
            let totalDates = 0;
            let paidDates = 0;
            let futureDates = [];
            if(item.isTeamSeasonalUponReg == 1 ){
                totalDates += 1;
                paidDates += 1;
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
                obj.paymentOptions.push(...paymentMethods);
            }
            
            paymentOptionArr.push(obj);
        } catch (error) {
            throw error;
        }
    }
    
    private getConsolidatedPaymentOptions(paymentOptionArr){
        try {
            let finalArr = [];
            let tempPaymentOptionArr = [];

            if(isArrayPopulated(paymentOptionArr)){

                for(let x of paymentOptionArr){
                    if(x.isSchoolRegCodeApplied == 1){
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

    private getCharityValue(targetValue, charityRoundUpRefId){
        console.log("targetValue ::" + targetValue + ":::" + charityRoundUpRefId );
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

    private async calculateInstalmentFees(memObj, item){
        let transArr = [];
        try {
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
                console.log("Dates" + JSON.stringify(dates));
                for(let i = 0; i < remainingDays; i++){

                    let fee = 0; let gst = 0; let discountAmt = 0; let familydiscount = 0;
                    let nominationFee = 0; let nominationGST = 0;
                  //  console.log("futureDates" + JSON.stringify(futureDates));
                     let instalmentDate = futureDates[i];
                    console.log("instalmentDate" + JSON.stringify(instalmentDate));
                    if(isNullOrUndefined(memObj.fees.affiliateFee)){
                        let feeObj = memObj.fees.affiliateFee;
                        fee = this.getAdjustedVal(feeObj.seasonalFee, totalDates);
                        let gvObj = this.applyGVFutureInstalment(selectedVal, memObj, fee);
                        fee = gvObj.fee;
                        gst = this.getAdjustedVal(feeObj.seasonalGST,  totalDates);
                        // nominationFee = feeIsNull(feeObj.nominationFeeToPay) / totalDates;
                        // nominationGST = feeIsNull(feeObj.nominationGSTToPay) / totalDates;
                        discountAmt = this.getAdjustedVal(feeObj.orgDiscountAmt,  totalDates);
                        familydiscount = this.getAdjustedVal(feeObj.childDiscountsToDeduct, totalDates);
                        if(fee){
                            let trans = this.getInstalmentTransactionObj(fee,gst, discountAmt, familydiscount,"affiliate", 
                            item.competitionId,feeObj.orgId,feeObj.membershipMappingId,item, instalmentDate,
                            memObj.divisionId, nominationFee, nominationGST, selectedVal.paymentOptionRefId);
                            transArr.push(trans);
                        }
                    }

                    if(isNullOrUndefined(memObj.fees.competitionOrganisorFee)){
                        let feeObj = memObj.fees.competitionOrganisorFee;
                        fee = this.getAdjustedVal(feeObj.seasonalFee,  totalDates);
                        let gvObj = this.applyGVFutureInstalment(selectedVal, memObj, fee);
                        fee = gvObj.fee;
                        gst = feeIsNull(feeObj.seasonalGST) / totalDates;
                        // nominationFee = feeIsNull(feeObj.nominationFeeToPay) / totalDates;
                        // nominationGST = feeIsNull(feeObj.nominationGSTToPay) / totalDates;
                        discountAmt = this.getAdjustedVal(feeObj.orgDiscountAmt, totalDates);
                        familydiscount = this.getAdjustedVal(feeObj.childDiscountsToDeduct, totalDates);
                        if(fee){
                            let trans = this.getInstalmentTransactionObj(fee,gst, discountAmt, familydiscount,"competition", 
                            item.competitionId,feeObj.orgId,feeObj.membershipMappingId,item, instalmentDate,
                            memObj.divisionId, nominationFee, nominationGST, selectedVal.paymentOptionRefId);
                            transArr.push(trans);
                        }
                    }

                  /*  if(isNullOrUndefined(memObj.fees.membershipFee)){
                        let feeObj = memObj.fees.membershipFee;
                        fee = feeIsNull(feeObj.seasonalFee) / totalDates;
                        let gvObj = this.applyGVFutureInstalment(selectedVal, memObj, fee);
                        fee = gvObj.fee;
                        gst = feeIsNull(feeObj.seasonalGST) / totalDates;
                        discountAmt = feeIsNull(feeObj.orgDiscountAmt) / totalDates;
                        familydiscount = feeIsNull(feeObj.childDiscountsToDeduct) / totalDates;
                        if(fee){
                            let trans = this.getInstalmentTransactionObj(fee, gst, discountAmt, familydiscount,"membership", 
                            item.competitionId,feeObj.orgId,feeObj.membershipMappingId,item, instalmentDate,
                            memObj.divisionId, nominationFee, nominationGST);
                            transArr.push(trans);
                        }
                    } */
                }
            }
            return transArr
            
        } catch (error) {
            logger.error(`Exception occurred in calculateInstalmentFees ${error}`);
        }
    }

    private getInstalmentTransactionObj(feeAmt, gstAmt, discountAmt, familyDiscountAmt,
        feeType, competitionId, organsiationId, membershipMappingId, item, instalmentDate, divisionId,
        nominationFee, nominationGST, paymentOptionRefId)
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
            divisionId: divisionId,
            nominationFeeToPay: nominationFee,
            nominationGSTToPay: nominationGST,
            paymentOptionRefId: paymentOptionRefId,
            paymentFeeTypeRefId: this.getPaymentFeeTypeRefId(paymentOptionRefId, 1)
        }   

        return trxnMembership;
    }

    private getPaymentFeeTypeRefId(paymentOptionRefId, isTeamRegistration){
        if(paymentOptionRefId <=2 && isTeamRegistration == 0){
            return AppConstants.CASUAL_FEE;
        }
        else{
            return AppConstants.SEASONAL_FEE;
        }
    }


    private async instalmentDateToDBTrack(transArr, registrationId, registrationCreatedBy, userRegId){
        try {
            console.log("************ Instalment Future Date Arr " + JSON.stringify(transArr));
                if(isArrayPopulated(transArr)){
                    let trackData = await this.entityManager.query(`select * from  wsa_registrations.registrationTrack  where registrationId = ? and userRegistrationId = ? and stepsId = 15 and isDeleted = 0`,
                                [registrationId, userRegId]);
                    if(isArrayPopulated(trackData)){
                       
                        await this.entityManager.query(`Update wsa_registrations.registrationTrack set jsonData = ? where registrationId = ? and userRegistrationId = ? and stepsId = 15`,
                        [JSON.stringify(transArr), registrationId, userRegId]);
                    }
                    else{
                        await this.entityManager.query(`insert into wsa_registrations.registrationTrack(registrationId, stepsId,jsonData,createdBy, userRegistrationId) values(?,?,?,?,?)`,
                        [registrationId,15, JSON.stringify(transArr), registrationCreatedBy, userRegId]);
                    }
                }
        } catch (error) {
            logger.error(`Exception occurred in instalmentDateToDBTrack ${error}`);
        }
    }

    public async teamRegistrationInvite(userRegUniqueKey: string, userId: number){
        try{
            let obj = {};
            let query = await this.entityManager.query('CALL wsa_registrations.usp_team_registration_invite(?,?)',
                [userRegUniqueKey, userId]
              );

            if(isArrayPopulated(query)){
                let membershipProductName = ''; 
                let membershipProductTypeName = '';
                let typeArray = [];
                let memProductTypeMap = new Map();
                if(query[0])
                for(let q of query[0]) {
                    if(q.isInActive == 1) {
                        let parentEmailString = q.email.substr(0,q.email.lastIndexOf('.'));
                        q.email = parentEmailString.toLowerCase();
                    }
                    if (q['parentOrGaurdianDetails']) q['parentOrGaurdianDetails'] = JSON.parse(q['parentOrGaurdianDetails']);
                    if (q['products']) q['products'] = JSON.parse(q['products']);
                    if(q['products']){
                        for(let p of q['products']){
                            if(memProductTypeMap.get(p.membershipProductTypeName) == undefined){
                                membershipProductName = p.membershipProductName;
                                typeArray.push(p.membershipProductTypeName);
                                memProductTypeMap.set(p.membershipProductTypeName, p);
                            }
                        }
                    }
                }
                membershipProductTypeName = typeArray.join(', ')
                let userRegDetails = query[0].find(x=>x);
                userRegDetails['membershipProductName'] = membershipProductName;
                userRegDetails['membershipProductTypeName'] = membershipProductTypeName;
                let compDetail = query[1].find(x=>x)
                
                if(compDetail!= null){
                    if(compDetail['organisationPhotos']){
                        compDetail.organisationPhotos = JSON.parse(compDetail.organisationPhotos);
                    }
                    if (compDetail.venues){
                        compDetail.venues = JSON.parse(compDetail.venues);
                    }
                }
                if(isArrayPopulated(query[2])) {
                    for(let q of query[2]) {
                        if(q.isInActive == 1) {
                            let parentEmailString = q.email.substr(0,q.email.lastIndexOf('.'));
                            q.email = parentEmailString.toLowerCase();
                        }
                    }
                }
             
                obj["userRegDetails"] = userRegDetails;
                obj["competitionDetails"] = query[1].find(x=>x);
                obj["userInfo"] = query[2].find(x=>x);
            }
           
            return obj;


        }
        catch(error){
            throw error;
        }
    }

    public async getByUserRegUniqueKey(userRegUniqueKey: string): Promise<UserRegistration> {
        try{
            let query = await this.entityManager.createQueryBuilder(UserRegistration, 'userRegistration')
            .where('userRegistration.userRegUniqueKey = :userRegUniqueKey  and userRegistration.isDeleted = 0',
              { userRegUniqueKey: userRegUniqueKey })
            .getOne()
          return query;
        }
        catch(error) {
            throw error;
        }
    }

    
    public async getFailedInstallment(userRegId, userId){
        try{
            let query = await this.entityManager.query(
                `select t.*, r.id as registrationId from wsa_registrations.userRegistration ur 
                    inner join wsa_registrations.orgRegistrationParticipant orp 
                        on orp.userRegistrationId = ur.id and orp.isDeleted = 0 
                    inner join wsa_registrations.registration r 
                        on r.id = orp.registrationId and r.isDeleted = 0
                    inner join wsa_registrations.orgRegistration org
                        on org.id = orp.orgRegistrationId and org.isDeleted = 0
                    inner join wsa_registrations.invoice i 
                        on i.registrationId = r.id and i.isDeleted = 0
                    inner join wsa_registrations.transactions t 
                        on t.invoiceRefId = i.id and t.isDeleted = 0
                    where ur.isDeleted = 0 and t.instalmentDate is not null and t.statusRefId = 6
                    and ur.id = ? and t.participantId = ?`,[userRegId, userId]
            )

            return query;
        }
        catch(error){
            throw error;
        }
    }
    
    private getMainObj(total){
        let obj = {
            charityRoundUpRefId: -1,
            charity:null,
            charityRoundUp: [],
            compParticipants: [],
            total: total,
            shopProducts: [],
            securePaymentOptions: [],
            yourInfo: null,
            billingAddress: null,
            deliveryAddress: null,
            shippingOptions: [],
            stateOrgId: null,
            registrationId: null,
            hasFutureInstalment: 0
        }

        return obj;
    }

    private getCompPartObj(item, competitionLogoUrl, filterdGovernmentVoucher, 
        instalmentDates, fees, paymentMethods){
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
            "isTeamSeasonalUponReg": item.isTeamSeasonalUponReg,
            "fees": fees,
            "teamName": item.teamName ? item.teamName : "",
            "competitionId": item.competitionId,
            "competitionEndDate": item.competitionEndDate,
            "governmentVoucherAmount": 0,
            "orgRegistrationId": item.orgRegistrationId
        }

        return compPartObj;
    }

    private getMemObj(item){
        let memObj = {
            "firstName": item.firstName,
            "lastName": item.lastName,
            "email": item.email,
            "mobileNumber": item.mobileNumber,
            "membershipProductName": item.membershipProductName,
            "membershipTypeName": item.mTypeName,
            "membershipMappingId": item.membershipMappingId,
            "competitionMembershipProductTypeId": null,
            "feesToPay": 0,
            "orgRegParticipantId": item.orgRegParticipantId,
            "discountsToDeduct" : null,
            "divisionId": item.divisionId,
            "divisionName": item.divisionName,
            "governmentVoucherAmount": 0,
            "isPlayer": item.isPlayer,
            "fees":{
                "membershipFee": null,
                "competitionOrganisorFee": null,
                "affiliateFee": null
            }
        }

        return memObj;
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

    private addNominationFee(mem){
        if(isNullOrUndefined(mem.fees.competitionOrganisorFee)){
            let fee = feeIsNull(mem.fees.competitionOrganisorFee.nominationFeeToPay) + 
            feeIsNull(mem.fees.competitionOrganisorFee.nominationGSTToPay);
            //mem.fees.competitionOrganisorFee.feesToPay = feeIsNull(mem.fees.competitionOrganisorFee.feesToPay) + fee;
            mem.feesToPay = feeIsNull(mem.feesToPay) + fee;
        }
        if(isNullOrUndefined(mem.fees.affiliateFee)){
            let fee = feeIsNull(mem.fees.affiliateFee.nominationFeeToPay) + 
            feeIsNull(mem.fees.affiliateFee.nominationGSTToPay);
            //mem.fees.affiliateFee.feesToPay = feeIsNull(mem.fees.affiliateFee.feesToPay) + fee;
            mem.feesToPay = feeIsNull(mem.feesToPay) + fee;
        }
    }

    private calculateTotalAmt(mem, total){
        let fee = ( (isNullOrUndefined(mem.fees.membershipFee) ? feeIsNull(mem.fees.membershipFee.feesToPay) : 0) + 
                (isNullOrUndefined(mem.fees.competitionOrganisorFee) ? feeIsNull(mem.fees.competitionOrganisorFee.feesToPay) : 0) + 
                (isNullOrUndefined(mem.fees.competitionOrganisorFee) ? feeIsNull(mem.fees.competitionOrganisorFee.nominationFeeToPay) : 0) + 
                    (isNullOrUndefined(mem.fees.affiliateFee) ?  feeIsNull(mem.fees.affiliateFee.feesToPay) : 0) + 
                    (isNullOrUndefined(mem.fees.affiliateFee) ?  feeIsNull(mem.fees.affiliateFee.nominationFeeToPay) : 0));

        let gst = ((isNullOrUndefined(mem.fees.membershipFee) ? feeIsNull(mem.fees.membershipFee.feesToPayGST) : 0) + 
                    (isNullOrUndefined(mem.fees.competitionOrganisorFee) ? feeIsNull(mem.fees.competitionOrganisorFee.feesToPayGST) : 0) +
                    (isNullOrUndefined(mem.fees.competitionOrganisorFee) ? feeIsNull(mem.fees.competitionOrganisorFee.nominationGSTToPay) : 0) +  
                (isNullOrUndefined(mem.fees.affiliateFee) ?  feeIsNull(mem.fees.affiliateFee.feesToPayGST) : 0) + 
                (isNullOrUndefined(mem.fees.affiliateFee) ?  feeIsNull(mem.fees.affiliateFee.nominationGSTToPay) : 0));
      
        total.subTotal = feeIsNull(total.subTotal)  + feeIsNull(fee);
        total.gst = feeIsNull(total.gst) + feeIsNull(gst);

        total.subTotal = feeIsNull(total.subTotal) - feeIsNull(mem.discountsToDeduct) - feeIsNull(mem.childDiscountsToDeduct);
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

    private applyGovernmentVoucher(selectedVal, memObj, fee, feeObj){
        try {
            //console.log("memObj" + JSON.stringify(memObj));
            if(isArrayPopulated(selectedVal.selectedGovernmentVouchers) && memObj.isPlayer == 1){
                for(let gvrnm of selectedVal.selectedGovernmentVouchers){
                    if(gvrnm.remainingAmount > 0){
                        if(fee >= gvrnm.remainingAmount){
                            fee = fee - gvrnm.remainingAmount;
                            memObj.governmentVoucherAmount = feeIsNull(memObj.governmentVoucherAmount) + 
                                                gvrnm.remainingAmount;
                            feeObj.governmentVoucherAmount = feeIsNull(feeObj.governmentVoucherAmount) + 
                                                 gvrnm.remainingAmount;
                            gvrnm.redeemAmount = feeIsNull(gvrnm.redeemAmount) +  gvrnm.remainingAmount;
                            gvrnm.remainingAmount = 0;
                        }
                        else if(fee < gvrnm.remainingAmount){
                            gvrnm.remainingAmount = gvrnm.remainingAmount - fee;
                            memObj.governmentVoucherAmount = feeIsNull(memObj.governmentVoucherAmount) + fee;
                            feeObj.governmentVoucherAmount = feeIsNull(feeObj.governmentVoucherAmount) + fee;
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
            console.log("applyGovernmentVoucher::" + JSON.stringify(fee));
            return {fee, redeemAmount};
        } catch (error) {
            logger.error(`Exception occurred in applyGovernmentVoucher ${error}`);
            throw error;
        }
    }

    private getFilteredResult(teamInviteList) {
        try {
            let filteredList = [];
            let nominationList = [];
            for(let item of teamInviteList){
                if(item.fees){
                    if(item.fees.feeType != "nomination"){
                        filteredList.push(item);
                    }
                    else{
                        nominationList.push(item.fees);
                    }
                }
            }

            for(let item of filteredList){
                let nominationFeeObj = null;
                if(isArrayPopulated(nominationList)){
                    nominationFeeObj = nominationList.find(x=>x.organisationId == item.fees.organisationId);
                    if(nominationFeeObj){
                        item.fees["nominationFee"] = nominationFeeObj.feeAmount;
                        item.fees["nominationGST"] = nominationFeeObj.gstAmount;
                        item.fees["nominationTransId"] = nominationFeeObj.teamTransactionId;
                    }
                }
            }

            return filteredList;

        } catch (error) {
            logger.error(`Exception occcurred in getFilteredResult ${error}`);
            throw error;
        }
    }

    private getAdjustedVal(actualVal, divisor){
        let fee = feeIsNull(feeIsNull(actualVal) / divisor);
        let calcVal = (fee * divisor);
        if(calcVal != feeIsNull(actualVal)){
             let difVal = feeIsNull(actualVal) - calcVal;
             fee = feeIsNull(fee + (difVal));
         }
 
         return fee;
     }
}