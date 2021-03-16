import { Service } from "typedi";
import BaseService from "./BaseService";
import { feeIsNull, formatValue, isArrayPopulated, isNotNullAndUndefined, isNullOrUndefined } from "../utils/Utils";
import { User } from "../models/security/User";
import { OrgRegistrationParticipant } from "../models/registrations/OrgRegistrationParticipant";

@Service()
export default class OrgRegistrationParticipantService extends BaseService<OrgRegistrationParticipant> {

    modelName(): string {
        return OrgRegistrationParticipant.name;
    }

    public async findByTemplate(orgRegistrationId: number, registrationId : number, userRegistrationId: number): Promise<OrgRegistrationParticipant>{
        try{
            let query = await this.entityManager.createQueryBuilder(OrgRegistrationParticipant, 'orpt')
                        .where('orpt.orgRegistrationId = :orgRegistrationId and orpt.registrationId =:registrationId and orpt.userRegistrationId = :userRegistrationId and orpt.isDeleted = 0',
                        {orgRegistrationId: orgRegistrationId, registrationId: registrationId, userRegistrationId: userRegistrationId})
                        .getOne();
            return query;
        }
        catch(error){
            throw error;
        }
    }

    public async deleteByRegistrationId(registrationId: number){
        try{
            let result = await this.entityManager.query(
                ` update wsa_registrations.orgRegistrationParticipant set isDeleted = 1 
                    where registrationId = ? and isDeleted = 0 `,[registrationId]);

            return result;
        }
        catch(error){
            throw error;
        }
    }

    public async getSingleGameDetails(registrationData: any, requestBody: any, user: User): Promise<any>{
        try {
            let response = null;
            console.log("requestBody" + JSON.stringify(requestBody));
            if(isNotNullAndUndefined(registrationData)){
                registrationData = registrationData.jsonData;
            }
            const competitionMembershipProductTypeId = requestBody.competitionMembershipProductTypeId;
            const membershipMappingId = requestBody.membershipMappingId;
            const divisionId = requestBody.divisionId;
            const competitionMembershipProductDivisionId = requestBody.competitionMembershipProductDivisionId ? requestBody.competitionMembershipProductDivisionId : 0;
            const email = requestBody.email;
            const orgId = requestBody.orgId;
            const compId = requestBody.compId;
            const organisationId = requestBody.organisationId;
            const competitionId = requestBody.competitionId;

            const query = await this.entityManager.query(`call wsa_registrations.usp_registration_single_game_details(?,?,?,?,?)`, 
            [competitionMembershipProductTypeId, membershipMappingId, competitionMembershipProductDivisionId,
                orgId, compId]);
            
            let fees = null;
            if(isArrayPopulated(query[0])){
                let data = query[0].find(x=>x);
                fees = data && data.fees!= null ? JSON.parse(data.fees): [];
            }
           
            if(registrationData){
                let compParticipant = registrationData.compParticipants.filter(x=>x.email == email && 
                    x.competitionUniqueKey == competitionId && x.organisationUniqueKey == organisationId);
                registrationData.compParticipants = [];

                if(isArrayPopulated(compParticipant)){
                    for(let comp of compParticipant){
                        let filterdMemProduct = [];
                        if(isArrayPopulated(comp.membershipProducts)){
                            filterdMemProduct = comp.membershipProducts.filter(x=>x.competitionMembershipProductTypeId == 
                                competitionMembershipProductTypeId && x.membershipMappingId == membershipMappingId && 
                                (competitionMembershipProductDivisionId != 0 ? x.divisionId == competitionMembershipProductDivisionId : 1) && 
                                x.email == email);
                        }

                        (filterdMemProduct || []).map((mem, index) => {
                            if(index == 0){
                                 mem.feesToPay = 0;
                            }
                            if(mem.fees.membershipFee){
                                let obj = mem.fees.membershipFee;
                                let fee = fees.find(x=>x.mOrganisationId == obj.organisationId);
                                if(fee){
                                    this.setFees(obj,fee, "membership", mem);
                                }
                            }
                            else{
                                mem.fees["membershipFee"] = null;
                            }
                            
                            if(mem.fees.competitionOrganisorFee){
                                let obj = mem.fees.competitionOrganisorFee;
                                let fee = fees.find(x=>x.cOrganisationId == obj.organisationId);
                                if(fee){
                                    this.setFees(obj,fee, "competition", mem);
                                }
                            }
                            else{
                                mem.fees["competitionOrganisorFee"] = null;
                            }

                            if(mem.fees.affiliateFee){
                                let obj = mem.fees.affiliateFee;
                                let fee = fees.find(x=>x.cOrganisationId == obj.organisationId);
                                if(fee){
                                    this.setFees(obj,fee, "affiliate", mem);
                                }
                            }
                            else{
                                mem.fees["affiliateFee"] = null;
                            }
                        });
                       
                        comp.membershipProducts = [];
                        comp.membershipProducts.push(...filterdMemProduct);
                    }
                   
                    this.setSecurePaymentOption(registrationData);
                    this.calculateTotalAmt(registrationData, compParticipant);
                    this.calculateTargetValue(registrationData, compParticipant);
                    registrationData.compParticipants = compParticipant;
                    this.setYourInfo(user, registrationData);
                    this.deleteObject(registrationData);
                   
                    response = registrationData;
                }
            }

            return response;
        } catch (error) {
            throw error;
        }
    }

    private setFees(feeObj, fee, feeType, mem){
        let casualFee = 0;
        let casualGST = 0;

        if(feeType == "membership"){
            casualFee = fee.mCasualFee;
            casualGST = fee.mCasualGST;
        }
        else{
            casualFee = fee.casualFee;
            casualGST = fee.casualGST; 
        }

        mem.feesToPay  = feeIsNull(mem.feesToPay) + feeIsNull(casualFee) +  feeIsNull(casualGST);
        mem.childDiscountsToDeduct = 0;
        mem.discountsToDeduct = 0;
        feeObj.casualFee =  casualFee;
        feeObj.casualGST =  casualGST;
        feeObj.feesToPayGST = casualGST;
        feeObj.feesToPay = casualFee;
        feeObj.nominationFeeToPay = 0;
        feeObj.nominationGSTToPay = 0;
        feeObj.childDiscountsToDeduct = 0;
        feeObj.governmentVoucherAmount = 0;
        feeObj.nominationFee = 0;
        feeObj.nominationGST = 0;
        feeObj.seasonalFee = 0;
        feeObj.seasonalGST = 0;
    }

    private setSecurePaymentOption(registrationData){
        registrationData.securePaymentOptions = [];
        let obj = {
            "securePaymentOptionRefId": 2
          }
        registrationData.securePaymentOptions.push(obj);
        let obj1 = {
            "securePaymentOptionRefId": 3
          }
        registrationData.securePaymentOptions.push(obj1);

    }

    private calculateTotalAmt(registrationData, compParticipant){
        registrationData.total.gst = 0;
        registrationData.total.total = 0;
        registrationData.total.subTotal = 0;
        registrationData.total.targetValue = 0;
        registrationData.total.charityValue = 0;
        registrationData.total.transactionFee = 0;

        for(let item of compParticipant){
            for(let mem of item.membershipProducts){
                let fee = ( (isNullOrUndefined(mem.fees.membershipFee) ? feeIsNull(mem.fees.membershipFee.feesToPay) : 0) + 
                    (isNullOrUndefined(mem.fees.competitionOrganisorFee) ? feeIsNull(mem.fees.competitionOrganisorFee.feesToPay) : 0) + 
                    (isNullOrUndefined(mem.fees.affiliateFee) ?  feeIsNull(mem.fees.affiliateFee.feesToPay) : 0));
                    
    
                let gst = ((isNullOrUndefined(mem.fees.membershipFee) ? feeIsNull(mem.fees.membershipFee.feesToPayGST) : 0) + 
                    (isNullOrUndefined(mem.fees.competitionOrganisorFee) ? feeIsNull(mem.fees.competitionOrganisorFee.feesToPayGST) : 0) + 
                    (isNullOrUndefined(mem.fees.affiliateFee) ?  feeIsNull(mem.fees.affiliateFee.feesToPayGST) : 0));
      
                registrationData.total.subTotal = feeIsNull(registrationData.total.subTotal)  + feeIsNull(fee);
                registrationData.total.gst = feeIsNull(registrationData.total.gst) + feeIsNull(gst);
    
                registrationData.total.subTotal = feeIsNull(registrationData.total.subTotal) - feeIsNull(mem.discountsToDeduct);
            }
        }
        
    }

    private calculateTargetValue(registrationData, compParticipant)
    {
        const charityRoundUpRefId = registrationData.charityRoundUpRefId;
        let targetTotal = feeIsNull(registrationData.total.gst) + feeIsNull(registrationData.total.subTotal);
        if(charityRoundUpRefId > 0 && targetTotal > 0){
            let charityCalcResult = this.getCharityValue(targetTotal, charityRoundUpRefId);
            registrationData.total.total =  formatValue(charityCalcResult.targetValue);
            registrationData.total.targetValue = formatValue(charityCalcResult.targetValue);
            registrationData.total.charityValue = formatValue(charityCalcResult.charityValue);
        }
        else{
            registrationData.total.targetValue = formatValue(targetTotal);
            registrationData.total.total = formatValue(targetTotal);
            registrationData.total.charityValue = "0.00";
        } 
  
        registrationData.total.gst = formatValue(registrationData.total.gst);
        registrationData.total.subTotal = formatValue(registrationData.total.subTotal);
        registrationData.total.shipping = formatValue(registrationData.total.shipping);

        for(let item of compParticipant){
            for(let mem of item.membershipProducts){
                mem.feesToPay = formatValue(mem.feesToPay);
                mem.discountsToDeduct = formatValue(mem.discountsToDeduct);
            }
           
        }

        registrationData.total["noOfMatch"] = 1;
    }

    private getCharityValue(targetValue, charityRoundUpRefId){
        //console.log("targetValue ::" + targetValue + ":::" + charityRoundUpRefId );
        try {
            let chartityValue = 0;
            let finalTargetValue = 0;
            let val = Math.ceil(targetValue);
            
            let remainder = val % 10;
            let quotient = ((val - remainder) / 10) * 10;
            //console.log("val::" + val + "remainder::" + remainder + "quotient::" + quotient);
            if(charityRoundUpRefId == 1){
                finalTargetValue =  quotient + remainder +  ((remainder % 2) == 0 ? 2 : 1);
               // console.log("finalTargetValue::" + finalTargetValue);
            }
            else if(charityRoundUpRefId == 2){
                if(remainder < 5){
                    finalTargetValue = quotient + 5
                }
                else{
                    finalTargetValue = quotient + 10
                }
            }
            else if(charityRoundUpRefId == 3){
                finalTargetValue = quotient + 10;
            }

            chartityValue = finalTargetValue - targetValue;

            return {
                charityValue: chartityValue,
                targetValue: finalTargetValue
            }
        } catch (error) {
            throw error;
        } 
    }

    private setYourInfo(user : User, registrationData){
        registrationData.yourInfo = {
            "id": user.id,
            "email": user.email,
            "suburb": user.suburb,
            "street1": user.street1,
            "street2": user.street2,
            "lastName": user.lastName,
            "firstName": user.firstName,
            "postalCode": user.postalCode,
            "stateRefId": user.stateRefId,
            "countryRefId": user.stateRefId,
            "mobileNumber": user.mobileNumber
        }
    }

    private deleteObject(registrationData){
        if(registrationData.charity)
            delete registrationData.charity;
        if(registrationData.shopProducts)
            delete registrationData.shopProducts;
        if(registrationData.volunteerInfo)
            delete registrationData.volunteerInfo;
        if(registrationData.billingAddress)
            delete registrationData.billingAddress;
        if(registrationData.charityRoundUp)
            delete registrationData.charityRoundUp;
        if(registrationData.deliveryAddress)
            delete registrationData.deliveryAddress;
        if(registrationData.shippingOptions)
            delete registrationData.shippingOptions;
        if(registrationData.hasClubVolunteer)
            delete registrationData.hasClubVolunteer;
        if(registrationData.isHardshipEnabled)
            delete registrationData.isHardshipEnabled;
        if(registrationData.isSchoolRegistration)
            delete registrationData.isSchoolRegistration;  
            
        for(let item of registrationData.compParticipants){
            if(item.teamMembers)
                delete item.teamMembers;  
            if(item.noOfPlayers)
                delete item.noOfPlayers; 
            if(item.gameVouchers)
                delete item.gameVouchers; 
            if(item.totalMembers)
                delete item.totalMembers;   
            if(item.paymentOptions)
                delete item.paymentOptions;  
            if(item.instalmentDates)
                delete item.instalmentDates; 
        }
    }
}