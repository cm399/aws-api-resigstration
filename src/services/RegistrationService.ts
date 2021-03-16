import { Service } from 'typedi';
import moment from 'moment';
import {round} from 'lodash'

import { logger } from '../logger';
import BaseService from './BaseService';
import {
  calculateTotalFeeGst,
  feeIsNull,
  isArrayPopulated,
  isNotNullAndUndefined,
  paginationData,
  stringTONumber
} from '../utils/Utils';
import AppConstants from '../validation/AppConstants';
import { Registration } from '../models/registrations/Registration';
import { InvoicePaymentStatus, RegPaymentOptionRef, TransactionStatus } from '../enums/enums';

@Service()
export default class RegistrationService extends BaseService<Registration> {
  modelName(): string {
    return Registration.name;
  }

  public async deleteByRegistrationId(registrationId: number){
    try{
        let result = await this.entityManager.query(
            ` update wsa_registrations.registration set isDeleted = 1 where id = ? and isDeleted = 0 `,[registrationId]);

        return result;
    }
    catch(error){
        throw error;
    }
  }

  public async registrationsettings(competitionUniqueKey, organisationUniqueKey) {
    try {
      let result = await this.entityManager.query(
        'call wsa_registrations.usp_registration_settings(?,?)',
        [competitionUniqueKey, organisationUniqueKey]
      );

      let obj = {};

      for (let setting of result[0]) {
        obj[setting.name] = setting.registrationSettingsRefId == null ? 0 : 1;
      }

      return obj;
    } catch (error) {
      throw error;
    }
  }

  public async membershipProducts(competitionUniqueKey, organisationUniqueKey, currentDate) {
    try {
      let result = await this.entityManager.query(
        'call wsa_registrations.usp_membership_products(?,?,?)',
        [competitionUniqueKey, organisationUniqueKey, currentDate]
      );

      let resultArray = [];
      if (result != null) {
        if (result[0] == null || result[0] == undefined || result[0] == '') {
          return null;
        } else {
          for (let resultset1 of result[0]) {
            let obj = {
              organisationUniqueKey: resultset1.organisationUniqueKey,
              organisationTypeRefId: resultset1.organisationTypeRefId,
              organisationLogoUrl: resultset1.organisationLogoUrl,
              organisationName: resultset1.organisationName,
              postalCode: resultset1.postalCode,
              street1: resultset1.street1,
              street2: resultset1.street2,
              suburb: resultset1.suburb,
              state: resultset1.state,
              organisationPhotos: JSON.parse(resultset1.organisationPhotos),
              competitions: [],
              hasTeamRegistration: 0,
              stateOrgId: resultset1.stateOrgId,
              stateOrgName: resultset1.stateOrgName,
              mobileNumber: resultset1.mobileNumber
            };
            let membershipByorganisation = result[1].filter(
              (x) => x.organisationId == resultset1.organisationId
            );
            resultset1.competitions = JSON.parse(resultset1.competitions);
            if (isArrayPopulated(resultset1.competitions)) {
              for (let c of resultset1.competitions) {
                let contactDetails;
                if (
                  c.replyName != null &&
                  c.replyName != '' &&
                  c.replyEmail != null &&
                  c.replyEmail != ''
                )
                  contactDetails =
                    AppConstants.contactDetailsText +
                    c.replyName +
                    ' on ' +
                    c.replyEmail;
                else if (
                  c.replyName != null &&
                  c.replyName != '' &&
                  c.replyRole != null &&
                  c.replyRole != ''
                )
                  contactDetails =
                    AppConstants.contactDetailsText +
                    c.replyName +
                    ' who is the ' +
                    c.replyRole;
                else if (
                  c.replyName != null &&
                  c.replyName != '' &&
                  c.replyPhone != null &&
                  c.replyPhone != ''
                )
                  contactDetails =
                    AppConstants.contactDetailsText +
                    c.replyName +
                    ' on ' +
                    c.replyPhone;
                else if (
                  c.replyRole != null &&
                  c.replyRole != '' &&
                  ((c.replyEmail != null && c.replyEmail != '') ||
                    (c.replyPhone != null && c.replyPhone != ''))
                )
                  contactDetails =
                    AppConstants.contactDetailsText +
                    c.replyRole +
                    ' on ' +
                    (c.replyEmail != null && c.replyEmail != ''
                      ? c.replyEmail
                      : '') +
                    (c.replyEmail != null &&
                      c.replyEmail != '' &&
                      c.replyPhone != null &&
                      c.replyPhone != ''
                      ? ' or '
                      : '') +
                    (c.replyPhone != null && c.replyPhone != ''
                      ? c.replyPhone
                      : '');
                else if (
                  c.replyEmail != null &&
                  c.replyEmail != '' &&
                  c.replyPhone != null &&
                  c.replyPhone != ''
                )
                  contactDetails =
                    AppConstants.contactDetailsText +
                    ' us on ' +
                    c.replyEmail +
                    ' or ' +
                    c.replyPhone;

                c.venues = JSON.parse(c.venues);
                let compObj = {
                  competitionId: c.competitionId,
                  competitionName: c.competitionName,
                  compOrgId: c.compOrgId,
                  compOrgName: c.compOrgName,
                  compLogoUrl: c.compLogoUrl,
                  heroImageUrl: c.heroImageUrl,
                  competitionUniqueKey: c.competitionUniqueKey,
                  registrationRestrictionTypeRefId:
                    c.registrationRestrictionTypeRefId,
                  venues: c.venues,
                  specialNote: c.specialNote,
                  training: c.training,
                  replyName: c.replyName,
                  replyRole: c.replyRole,
                  replyEmail: c.replyEmail,
                  replyPhone: c.replyPhone,
                  contactDetails: contactDetails,
                  registrationOpenDate: c.registrationOpenDate,
                  registrationCloseDate: c.registrationCloseDate,
                  membershipProducts: [],
                  hasTeamRegistration: 0,
                  organisationName: c.organisationName,
                  organisationUniqueKey: c.organisationUniqueKey,
                  stateOrgId: c.stateOrgId,
                  stateOrgName: c.stateOrgName,
                };
                let resultset2 = membershipByorganisation.filter(
                  (x) => x.competitionId == c.competitionId
                );

                let productTypeMap = new Map();

                for (let res1 of resultset2) {
                  let resultset3 = result[2].filter(
                    (x) =>
                      x.competitionMembershipProductId ==
                      res1.competitionMembershipProductId &&
                      x.competitionMembershipProductTypeId ==
                      res1.competitionMembershipProductTypeId &&
                      x.orgRegistrationId == res1.orgRegistrationId
                  );

                  let cmptKey = res1.competitionMembershipProductTypeId;
                  let getProductType = productTypeMap.get(cmptKey);
                  let membershipProductObj;

                  if(getProductType == undefined) {
                    membershipProductObj = {
                      competitionMembershipProductTypeId:
                        res1.competitionMembershipProductTypeId,
                      competitionMembershipProductId:
                        res1.competitionMembershipProductId,
                      name: res1.name,
                      isPlayer: res1.isPlayer,
                      isDisabled: res1.isDisabled,
                      shortName: res1.shortName,
                      allowTeamRegistrationTypeRefId:
                        res1.allowTeamRegistrationTypeRefId,
                      registrationLock: res1.registrationLock ? res1.registrationLock : 0,
                      registrationTeamLock: res1.registrationTeamLock ?  res1.registrationTeamLock : 0,
                      isIndividualRegistration: ((res1.isIndividualRegistration) && (res1.isCasual == 1 || res1.isSeasonal == 1)) ? 1 : 0,
                      isTeamRegistration: (res1.isTeamRegistration == 1 && res1.isTeamSeasonal == 1) ? 1 : 0,
                      isChildrenCheckNumber: res1.isChildrenCheckNumber,
                      isChecked: false,
                      orgRegistrationMembershipProductTypeId: res1.orgRegistrationMembershipProductTypeId,
                      divisions: resultset3 != null ? resultset3.sort((a, b) => a.divisionName.localeCompare(b.divisionName)) : [],
                    };
                    productTypeMap.set(cmptKey, membershipProductObj);
                  }
                  else{
                    if((res1.isIndividualRegistration) && (res1.isCasual == 1 || res1.isSeasonal == 1)){
                      getProductType.isIndividualRegistration = 1;
                    }
                    if(res1.isTeamRegistration == 1 && res1.isTeamSeasonal == 1){
                      getProductType.isTeamRegistration = 1;
                    }
                  }


                  if (
                    res1.allowTeamRegistrationTypeRefId != null &&
                    res1.allowTeamRegistrationTypeRefId != undefined
                  ) {
                    obj.hasTeamRegistration = 1;
                    compObj.hasTeamRegistration = 1;
                  }
                  
                  if (membershipProductObj != null){
                    compObj.membershipProducts.push(membershipProductObj);
                  }
                }
                obj.competitions.push(compObj);
              }
            }

            resultArray.push(obj);
          }
          return resultArray;
        }
      }
    } catch (error) {
      throw error;
    }
  }

  public async registrationCount(yearRefId: number, organisationUniqueKey: string) {
    try {
      let result = await this.entityManager.query(
        'call wsa_registrations.usp_registration_count(?,?)',
        [yearRefId, organisationUniqueKey]
      );
      if (result[0]) {
        let res = result[0].find((x) => x);
        return res;
      }
    } catch (error) { }
  }

  public async registrationDashboard(requestBody: any, organisationId: number, sortBy: string = undefined, sortOrder: 'ASC' | 'DESC' = undefined) {
    try {
      let yearRefId = requestBody.yearRefId;
      let organisationUniqueKey = requestBody.organisationUniqueKey;
      let competitionUniqueKey = requestBody.competitionUniqueKey;
      let dobFrom = requestBody.dobFrom;
      let dobTo = requestBody.dobTo;
      let membershipProductTypeId = requestBody.membershipProductTypeId;
      let genderRefId = requestBody.genderRefId;
      let postalCode = requestBody.postalCode;
      let affiliate = requestBody.affiliate;
      let membershipProductId = requestBody.membershipProductId;
      let paymentStatusRefId = requestBody.paymentStatusRefId;
      let paymentId = requestBody.paymentId;
      let limit = requestBody.paging.limit;
      let offset = requestBody.paging.offset;
      let searchText = requestBody.searchText;
      let regFrom = requestBody.regFrom;
      let regTo = requestBody.regTo;
      let teamId = requestBody.teamId;

      let result = await this.entityManager.query(
        'call wsa_registrations.usp_registration_dashboard(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)',
        [
          yearRefId,
          organisationUniqueKey,
          competitionUniqueKey,
          dobFrom,
          dobTo,
          membershipProductTypeId,
          genderRefId,
          postalCode,
          affiliate,
          membershipProductId,
          limit,
          offset,
          paymentStatusRefId,
          searchText,
          regFrom,
          regTo,
          sortBy,
          sortOrder,
          paymentId,
          teamId
        ]
      );

      if (isArrayPopulated(result)) {
        let totalCount = result[0].find((x) => x).totalCount;

        let responseObject = paginationData(
          stringTONumber(totalCount),
          limit,
          offset
        );
        let registrations = result[1];
        let feesPaid = 0;

        if(isArrayPopulated(registrations)) {
          for(let reg of registrations) {
            let instalments = reg.duePerInstalment != null ? reg.duePerInstalment : [];
            if(isArrayPopulated(instalments)) {
              let totalAmount = 0;
              for(let ins of instalments) {
                totalAmount = feeIsNull(ins.feeAmount) + feeIsNull(ins.gstAmount) -
                              feeIsNull(ins.discountAmount) - feeIsNull(ins.familyDiscountAmount);

              }
              reg.duePerInstalment = round(feeIsNull(totalAmount), 2);
            }
            else {
              reg.duePerInstalment = 0;
            }
            reg.duePerMatch = feeIsNull(reg.duePerMatch.teamSeasonalFees) + feeIsNull(reg.duePerMatch.teamSeasonalGST);
            reg.duePerMatch = feeIsNull(reg.duePerMatch);
            let transactions = reg.transactions!= null ? JSON.parse(reg.transactions) : [];
            reg['governmentVoucherAmount'] = 0;
            if(isArrayPopulated(transactions)) {
              for(let item of transactions) { 
                if(reg.voucherCode != null && reg.voucherCode != 0) {
                  reg['governmentVoucherAmount'] += feeIsNull(item.governmentVoucherAmount); 
                  if(item.governmentVoucherStatusRefId == 1){
                      reg['governmentVoucherStatusRefId'] = 1
                      reg['actionView'] = 3;
                  }
                }
              }
            } 
          }
        }

        if(isArrayPopulated(result[6])){
          for(let trans of result[6]){
            let transactions = trans.transactions!= null ? JSON.parse(trans.transactions) : [];
            let regKey = trans.regKey;
            let deRegistered = trans.deRegistered;
            let item = registrations.find(x=>x.key == regKey);
            let regIndex = registrations.findIndex(x=>x.key == regKey);

            let userMap = new Map();
            let arr = [];
            (transactions || []).map((t, index) =>{
              let key = t.paidByUserId + "#" + t.paidBy;
              if(userMap.get(key) == undefined){
                if(t.paidBy){
                  let obj = {
                    paidBy: t.paidBy,
                    paidByUserId: t.paidByUserId
                  }
                  arr.push(obj);
                  userMap.set(key, obj);
                }
              }
            });



            if(item){
              let actionView = 0;
              item["paidByUsers"] = arr;
              item["actionView"] = actionView;
              item["amountToTransfer"] = 0;
              item["transactionId"] = 0;
              if(isArrayPopulated(transactions)){
                let paidFeeList = transactions.filter(x=>x.statusRefId == 2);
                let pendingFeeList = transactions.filter(x=>x.statusRefId == 1 || x.statusRefId == 3 || x.statusRefId == 6);
                let paymentType = null;
                let subPaymentType = null;
                if(isArrayPopulated(paidFeeList)){
                  let paidFee = 0;
                  for(let fee of paidFeeList){
                    let totalFee =  feeIsNull(fee.feeAmount) + feeIsNull(fee.gstAmount) -
                                    feeIsNull(fee.discountAmount) - feeIsNull(fee.familyDiscountAmount);
                    feesPaid += totalFee;
                    paidFee += totalFee;
                    paymentType = fee.paymentType;
                    subPaymentType = fee.subPaymentType;
                  }

                  item["paidFee"] = feeIsNull(paidFee);
                  if(subPaymentType == AppConstants.cash){
                    let affiliateFeeFound = paidFeeList.find(x=>x.feeType == AppConstants.affiliate);
                    if(isNotNullAndUndefined(affiliateFeeFound)){
                      if(affiliateFeeFound.organisationId == organisationId){
                        let amountReceived = feeIsNull(affiliateFeeFound.amountReceived);
                        let isProcessed = feeIsNull(affiliateFeeFound.isProcessed);
                        item["amountToTransfer"] = amountReceived;
                        item["transactionId"] = affiliateFeeFound.transactionId;
                        item["feeType"] = AppConstants.affiliate;
                        if(isProcessed == 0){
                          item["actionView"] = 2;
                        }
                      }
                    }
                  }
                }

                if(isArrayPopulated(pendingFeeList) && deRegistered != 1){
                  let pendingFee = 0;
                  let subPaymentType = null;
                  let paymentType = null;
                  for(let fee of pendingFeeList){
                    let totalFee =  feeIsNull(fee.feeAmount) + feeIsNull(fee.gstAmount) -
                                    feeIsNull(fee.discountAmount) - feeIsNull(fee.familyDiscountAmount);
                    feesPaid += totalFee;
                    pendingFee += totalFee;
                    paymentType = fee.paymentType;
                    subPaymentType = fee.subPaymentType;
                  }
                  item["pendingFee"] = feeIsNull(pendingFee);

                  if(subPaymentType == AppConstants.cash){
                    let affiliateFeeFound = pendingFeeList.find(x=>x.feeType == AppConstants.affiliate);
                    if(isNotNullAndUndefined(affiliateFeeFound)){
                      if(affiliateFeeFound.organisationId == organisationId){
                        let amountReceived = feeIsNull(affiliateFeeFound.amountReceived);
                        let isProcessed = feeIsNull(affiliateFeeFound.isProcessed);
                        let amountToTransfer = pendingFee - amountReceived;
                        item["amountToTransfer"] = amountToTransfer;
                        item["transactionId"] = affiliateFeeFound.transactionId;
                        item["feeType"] = AppConstants.affiliate;
                        if(amountToTransfer > 0 && isProcessed == 0){
                          item["actionView"] = 1;
                        }
                        else if(amountToTransfer == 0 && isProcessed == 0){
                          item["actionView"] = 2;
                          item["feeType"] = AppConstants.affiliate;
                        }
                      }
                    }
                    else{
                      let compFeeFound = pendingFeeList.find(x=>x.feeType == AppConstants.competition);
                      if(isNotNullAndUndefined(compFeeFound)){
                        if(compFeeFound.organisationId == organisationId){
                          let amountReceived = feeIsNull(compFeeFound.amountReceived);
                          let amountToTransfer = pendingFee - amountReceived;
                          item["amountToTransfer"] = amountToTransfer;
                          item["transactionId"] = compFeeFound.transactionId;
                          item["feeType"] = AppConstants.competition;
                          if(amountToTransfer > 0 ){
                            item["actionView"] = 1;
                          }
                        }
                      }
                    }
                  }
                }
              }
             
              if(item['actionView'] == 0){
                  if(item.governmentVoucherStatusRefId == 1){
                    item['actionView'] = 3;
                    item['processType'] = AppConstants.governmentVoucher;
                  }
                  let paymentOptionRefId = transactions.find(x=>x.paymentOptionRefId == RegPaymentOptionRef.SchoolInvoice);
                  
                  if(paymentOptionRefId){
                    item['actionView'] = 4;
                  }
                  let failedTransactions = transactions.find(x=>x.statusRefId == TransactionStatus.Failed);
                  
                  let paymentStatus = transactions.find(x=>x.paymentStatus == InvoicePaymentStatus.Failed);
                  if(paymentStatus){
                    item["actionView"] = 6;
                  }
                  else if(item.paymentOptionRefId == RegPaymentOptionRef.Instalment && failedTransactions){
                    item["actionView"] = 5;
                  }
              }

              delete item.transactions;

              registrations[regIndex] = item;
            }
            else{
              if(isArrayPopulated(transactions)){
                for(let fee of transactions){
                  let totalFee =  feeIsNull(fee.feeAmount) + feeIsNull(fee.gstAmount) -
                                  feeIsNull(fee.discountAmount) - feeIsNull(fee.familyDiscountAmount);
                  feesPaid += totalFee;
                }
              }
            }


          }
        }
        responseObject['registrations'] = registrations;
        responseObject['competitions'] = result[2];
        responseObject['membershipProducts'] = result[3];
        responseObject['membershipProductTypes'] = result[4];
        responseObject['feesPaid'] = feesPaid;

        let postArr = [];
        for (let item of result[5]) {
          for (let i = item.startId; i <= item.endId; i++) {
            let val = '';
            if (i < 1000) {
              val = '0' + i;
            } else {
              val = val + i;
            }
            postArr.push(val);
          }
        }

        responseObject['postalCodes'] = postArr;

        return responseObject;
      } else {
        return [];
      }
    } catch (error) {
      console.log(`Error ${error}`);
      throw error;
    }
  }

  public async userInfo(requestBody: any) {
    try {
      let userId = requestBody.userId;
      let competitionUniqueKey = requestBody.competitionUniqueKey;
      let organisationUniqueKey = requestBody.organisationUniqueKey;
      let result = await this.entityManager.query(
        'call wsa_registrations.usp_user_info(?,?,?)',
        [userId, competitionUniqueKey, organisationUniqueKey]
      );
      let teamResult = await this.teamUserInfo(userId)
      if (isArrayPopulated(result[0])) {
        for (let u of result[0]) {
          if(u.isInActive == 1) {
            let parentEmailString = u.email.substr(0,u.email.lastIndexOf('.'));
            u.email = parentEmailString.toLowerCase();
          }
          let tempMap = new Map();
          let tempArray = [];
          u.genderRefId = u.genderRefId != null ? Number(u.genderRefId) : 0;
          if (isArrayPopulated(u.parentOrGuardian)) {
            for (let p of u.parentOrGuardian) {
              if (tempMap.get(p.userId) == undefined) {
                tempArray.push(p);
                tempMap.set(p.userId, p);
              }
            }
            u.parentOrGuardian = tempArray;
          }

          if (u.friends) {
            u.friends = JSON.parse(u.friends)
          }
          if (u.referFriends) {
            u.referFriends = JSON.parse(u.referFriends)
          }
        }
      }
      result[0] = [...result[0], ...teamResult]
      return result[0];
    } catch (error) {
      throw error;
    }
  }

  public async getInvoice(registrationId: number, invoiceId: number): Promise<any> {
    try {
      const query = await this.entityManager.query(
        'CALL wsa_registrations.usp_get_invoice(?,?)',
        [registrationId, invoiceId]
      );
      if (isArrayPopulated(query) && isArrayPopulated(query[0])) {
        for (let k of query[0]) {
          if (k['fees'] !== null) {
            k['fees'] = JSON.parse(k['fees']);
            if (isArrayPopulated(k['fees'])) {
              for (let i of k['fees']) {
                if (i['charityDetail'] !== null)
                  i['charityDetail'] = JSON.parse(i['charityDetail']);
                else i['charityDetail'] = [];
              }
            }
          }
        }
        return query[0].map((e) => {
          if (isArrayPopulated(e.fees)) {
            e.fees = e.fees.map((f) => {
              f.affiliateDetail =
                f.competitionDetail.cIsDirect == 1
                  ? undefined
                  : f.affiliateDetail;
              f.userDetail.newUser = f.userDetail.newUser == 1 ? true : false;
              f.userDetail.alreadyAMember =
                f.userDetail.alreadyAMember == 1 ? true : false;
              f.totalAmount.affiliateFees =
                f.competitionDetail.cIsDirect == 1
                  ? undefined
                  : f.totalAmount.affiliateFees;
              f.totalAmount.affiliateGst =
                f.competitionDetail.cIsDirect == 1
                  ? undefined
                  : f.totalAmount.affiliateGst;
              f.competitionDetail.isDirect =
                f.competitionDetail.cIsDirect == 1 ? true : false;
              f.totalAmount.totalSum = calculateTotalFeeGst(
                f.totalAmount.membershipFees,
                f.totalAmount.membershipGst,
                f.totalAmount.competitionFees,
                f.totalAmount.competitionGst,
                f.totalAmount.affiliateFees,
                f.totalAmount.affiliateGst
              );
              delete f.competitionDetail.cIsDirect;
              return f;
            });
          }
          return e;
        });
      } else {
        return [];
      }
    } catch (error) {
      console.log("&&&&&&&&&&&&" + error);
      throw error;
    }
  }

  public async teamUserInfo(userId: number){
    try{
        let query = await this.entityManager.query(
          ` select ur.userRegUniqueKey, t.name as teamName, urd.totalMembers , 1 as isTeamRegistration from wsa_registrations.userRegistration ur 
          inner join wsa_registrations.userRegistrationDraft urd 
            on urd.id = ur.userRegDraftId and urd.isDeleted = 0
          inner join wsa_competitions.team t 
            on t.id = ur.teamId and t.isDeleted = 0
          where ur.registeringYourselfRefId = 4 and ur.isDeleted = 0 
          and ur.personRoleRefId is not null and ur.userId = ?
          order by ur.id desc limit 1`,[userId]);

          if(query){
            for(let q of query){
                q.isTeamRegistration = Number(q.isTeamRegistration);
            }
          }
          return query
    }
    catch(error){
      throw error;
    }
  }

  public async getTeamInvoice(registrationId: number): Promise<any> {
    try {
      let result = await this.entityManager.query('CALL wsa_registrations.usp_get_team_invoice(?)',
        [registrationId]);

      let obj = {
        "numberOfCompetitionsUsed": 0,
        "fees": [],
        "userRegistrationCreator": null,
        "billTo": null,
        "charitySelected": null,
        "organisationLogo": null
      }

      if (isArrayPopulated(result) && isArrayPopulated(result[0])) {
        let result1 = result[0];
        let fees = [];

        result1.map((item) => {
          if (item.payingForCount > 0) {
            obj.numberOfCompetitionsUsed = Number(item.numberOfCompetitionsUsed);
            let feesObj = {
              "isTeamReg": true,
              "isDirect": item.isDirect,
              "userDetail": null,
              "totalAmount": null,
              "charityDetail": [],
              "affiliateDetail": null,
              "membershipDetail": null,
              "competitionDetail": null
            }

            let totalAmtObj = {
              "affiliateGst": 0, "affiliateFees": 0, "competitionGst": 0,
              "membershipFees": 0, "competitionFees": 0,
              "membershipGst": 0, "actualMembershipFees": 0,
              "totalSum": 0
            }

            if (isArrayPopulated(result[2])) {
              let filterFees = result[2].filter(x => x.orgRegistrationId == item.orgRegistrationId);
              if (isArrayPopulated(filterFees)) {
                feesObj.totalAmount = totalAmtObj;
                let i = 0;
                filterFees.map((fee) => {
                  if (i == 0 && item.isRegisteredAsPlayer == 1) {
                    feesObj.membershipDetail = fee.membershipFees;
                    feesObj.membershipDetail.mSeasonalFee = (feeIsNull(feesObj.membershipDetail.mSeasonalFee));
                    feesObj.membershipDetail.mSeasonalGst = (feeIsNull(feesObj.membershipDetail.mSeasonalGst));
                    feesObj.membershipDetail.mCasualFee = (feeIsNull(feesObj.membershipDetail.mCasualFee));
                    feesObj.membershipDetail.mCasualGst = (feeIsNull(feesObj.membershipDetail.mCasualGst));
                    totalAmtObj.membershipFees += (feeIsNull(feesObj.membershipDetail.mSeasonalFee) +
                      (feeIsNull(feesObj.membershipDetail.mCasualFee)));
                    totalAmtObj.membershipGst += (feeIsNull(feesObj.membershipDetail.mSeasonalGst) +
                      (feeIsNull(feesObj.membershipDetail.mCasualGst)));
                    totalAmtObj.totalSum += (feeIsNull(feesObj.membershipDetail.mSeasonalFee) +
                      feeIsNull(feesObj.membershipDetail.mSeasonalGst) +
                      feeIsNull(feesObj.membershipDetail.mCasualFee) +
                      feeIsNull(feesObj.membershipDetail.mCasualGst));
                  }
                  if (fee.isCompOrganisor == 1) {
                    //console.log("fee.feeDetails" + JSON.stringify(fee.feesDetails));
                    feesObj.competitionDetail = fee.feesDetails;
                    // console.log("feesObj.competitionDetail" + JSON.stringify(feesObj.competitionDetail));
                    feesObj.competitionDetail.cSeasonalFee =
                      (feeIsNull(feesObj.competitionDetail.cSeasonalFee) / Number(item.noOfPlayers)) *
                      Number(item.payingForCount);
                    feesObj.competitionDetail.cSeasonalGst =
                      (feeIsNull(feesObj.competitionDetail.cSeasonalGst) / Number(item.noOfPlayers)) *
                      feeIsNull(item.payingForCount);
                    totalAmtObj.competitionFees += feeIsNull(feesObj.competitionDetail.cSeasonalFee);
                    totalAmtObj.competitionGst += feeIsNull(feesObj.competitionDetail.cSeasonalGst);
                    totalAmtObj.totalSum += (feeIsNull(feesObj.competitionDetail.cSeasonalFee) +
                      feeIsNull(feesObj.competitionDetail.cSeasonalGst));
                  }
                  else {
                    feesObj.affiliateDetail = fee.feesDetails;
                    feesObj.affiliateDetail.aSeasonalFee =
                      (feeIsNull(feesObj.affiliateDetail.aSeasonalFee) / Number(item.noOfPlayers))
                      * feeIsNull(item.payingForCount);
                    feesObj.affiliateDetail.aSeasonalGst =
                      (feeIsNull(feesObj.affiliateDetail.aSeasonalGst) / Number(item.noOfPlayers))
                      * feeIsNull(item.payingForCount);
                    totalAmtObj.affiliateFees += feeIsNull(feesObj.affiliateDetail.aSeasonalFee);
                    totalAmtObj.affiliateGst += feeIsNull(feesObj.affiliateDetail.aSeasonalGst);
                    totalAmtObj.totalSum += (feeIsNull(feesObj.affiliateDetail.aSeasonalFee) +
                      feeIsNull(feesObj.affiliateDetail.aSeasonalGst));
                  }

                  i++;
                });

                if (isArrayPopulated(result[1])) {
                  let registeringUser = result[1].find(x => x.orgRegistrationId == item.orgRegistrationId);
                  if (registeringUser != null && registeringUser != undefined) {
                    feesObj.userDetail = registeringUser.personRegisteringUser;
                  }
                }
                fees.push(feesObj);
              }
            }
          }
        });

        obj.fees.push(...fees);

        if (isArrayPopulated(result[1])) {
          let billTo = result[1].find(x => x);
          obj.billTo = billTo.registeredUser;
        }
      }

      let arr = [];
      arr.push(obj);
      return arr;
    } catch (error) {
      console.log("****************" + error);
      throw error;
    }
  }

  public async registrationRestrictionValidate(competitionId: number, organisationId: number, userId: number, divisionId: number, competitionMembershipProductTypeId: number) {
    try {
      let query = await this.entityManager.query(
        'CALL wsa_registrations.usp_registration_restriction_validate(?,?,?,?, ?)',
        [competitionId, organisationId, userId, divisionId, competitionMembershipProductTypeId]
      );
      return query[0];
    } catch (error) {
      throw error;
    }
  }

  public async registrationExpiryCheck(organisationId: number, competitionId: number, currentDate: string): Promise<any>{
    try {
        let result = await this.entityManager.query(`select c.competitionUniqueKey, c.name as competitionName, c.heroImageUrl,
        DATE_FORMAT(c.startDate, '%d/%m/%Y') as registrationOpenDate, 
        DATE_FORMAT(c.endDate,'%d/%m/%Y') as registrationCloseDate, 
        o.name as organisationName,
        if(o.organisationTypeRefId = 2, a.affiliateOrgId, a.affiliatedToOrgId) as stateOrgId,
		    (select o2.name from wsa_users.organisation o2 where case when o.organisationTypeRefId = 2 then (a.affiliateOrgId = o2.id) else (a.affiliatedToOrgId = o2.id) end
		       	and o2.isDeleted = 0)   as stateOrgName,
        (select cl.logoUrl from wsa_registrations.competitionLogo cl where cl.competitionId = c.id and cl.isDefault = 1
        and cl.isDeleted = 0 limit 1) as compLogoUrl,
        case when DATE(org.registrationOpenDate) > DATE(?) then 
          CONCAT('Registration will be opened on ',DATE_FORMAT(org.registrationOpenDate, '%d/%m/%Y'))
          when DATE(org.registrationCloseDate) < DATE(?) then 'Registration have closed' else ''
        end as validateMessage
        from wsa_registrations.orgRegistration org 
        inner join wsa_registrations.competition c 
        on c.id = org.competitionId and c.isDeleted = 0
        inner join wsa_users.organisation o 
				on o.id = org.organisationId and o.isDeleted = 0
			inner join wsa_users.affiliate a 
			on a.affiliateOrgId = (case when o.organisationTypeRefId = 3 then  o.id 
					when o.organisationTypeRefId = 4 then (select a2.affiliatedToOrgId from wsa_users.affiliate a2 
							where  a2.affiliateOrgId = o.id and a2.organisationTypeRefId = 4 and a2.isDeleted = 0)
					else o.id end ) and a.isDeleted = 0 
      where org.organisationId = ? and c.id = ? and c.isDeleted = 0
      and (DATE(org.registrationOpenDate) > DATE(?) or 
        DATE(org.registrationCloseDate) < DATE(?))`,
            [currentDate, currentDate, organisationId, competitionId,  currentDate, currentDate]);
        return result;
    } catch (error) {
      throw error;
    }
  }

  public async findTeamRegistrationInfo(registrationId: number) {
    try {
      let result = await this.entityManager.query(`Call wsa_registrations.usp_team_registration_mail(?)`, [registrationId]);
      let query = result[0];
      if (isArrayPopulated(query)) {
        for (let i = 0; i < query.length; i++)
          if (query[i]['players']) query[i]['players'] = JSON.parse(query[i]['players']);
      }
      return query;
    }
    catch (error) {
      throw error;
    }
  }

  public async findParticipantRegistrationInfo(registrationId) {
    try {
      let query = await this.entityManager.query('Call wsa_registrations.usp_registration_mail(?)', [registrationId]);
      logger.info(` --- ##-- mail to information,  ${JSON.stringify(query[0])}`);

        if (query) {
            for (let res of query[0]) {
                if (res.products) {
                    res.products = JSON.parse(res.products);
                } else {
                    res.products = [];
                }
            }
        }
        return query;
    }
    catch (error) {
      throw error;
    }
  }

  public async findTeamMemberRegInfo(registrationId: number){
    try{
      let query = await this.entityManager.query(
        ``
      )
      return query
    }
    catch(error){
      throw error;
    }
  }

  public async registrationProductFees(competitionId, organisationId, competitionMembershipProductTypes) {
    try {
      let totalCasualFees = 0;
      let totalSeasonalFees = 0;
      let payAtRegistration = 0;
      let payAtMatch = 0;
      let teamRegChargeTypeRefId = 0;
          if(isArrayPopulated(competitionMembershipProductTypes)){
            for(let type of competitionMembershipProductTypes){
              let result = await this.entityManager.query('call wsa_registrations.usp_registration_product_fees(?,?,?,?)',
              [competitionId, organisationId, type.competitionMembershipProductTypeId, type.competitionMembershipProductDivisionId]
            );
            if (isArrayPopulated(result[0])) {
              let res = result[0].find((x) => x);
              teamRegChargeTypeRefId = res.teamRegChargeTypeRefId
              totalCasualFees += Number(res.totalCasualFees);
              totalSeasonalFees += Number(res.totalSeasonalFees);
              payAtRegistration += Number(res.payAtRegistration);
              payAtMatch += Number(res.payAtMatch);
            }
          }
        }

      let obj ={
        teamRegChargeTypeRefId: teamRegChargeTypeRefId,
        totalCasualFees: totalCasualFees.toFixed(2),
        totalSeasonalFees: totalSeasonalFees.toFixed(2),
        payAtRegistration: payAtRegistration.toFixed(2),
        payAtMatch: payAtMatch.toFixed(2)
      }
        return obj;

    } catch (error) {
      throw error;
    }
  }

  public async findMailReceiverType(registrationId) {
    try {
      let query = await this.entityManager.query(
        `	select count(teamRegistrationTypeRefId) as teamReg, 
        case when count( teamRegistrationTypeRefId ) != count(*) 
        then 1 else 0 end as individualReg, createdBy as userId  from wsa_registrations.orgRegistrationParticipant orp 
        where registrationId =?`, [registrationId]);

      return query;
    }
    catch (error) {
      throw error;
    }
  }
  
  public async findRemoveMailUserObj(userRegId: number) {
    try {
      let query = await this.entityManager.query(
        `select CONCAT(u.firstName, ' ', u.lastName) as userName, u.id as userId, u.email, t.name as teamName, 
        c.name as competitionName, o.name as organisationName, orp.registrationId,
        (SELECT CONCAT(u2.firstName, ' ', u2.lastName) as teamRegUserName 
            from wsa_registrations.userRegistration ur2
            inner join wsa_users.user u2 on u2.id = ur2.userId and u2.isDeleted = 0
            where ur2.isDeleted = 0 and ur2.teamId = t.id and ur2.registeringYourselfRefId
              and ur2.personRoleRefId is not null) as teamRegisteringPerson
          from wsa_registrations.userRegistration ur 
          inner join wsa_users.user u on u.id = ur.userId and u.isDeleted = 0
          inner join wsa_competitions.team t on t.id = ur.teamId and t.isDeleted = 0
          inner join wsa_registrations.competition c on c.id = t.competitionId and c.isDeleted = 0
          inner join wsa_users.organisation o on o.id = t.organisationId and o.isDeleted = 0
          inner join wsa_registrations.orgRegistrationParticipant orp on orp.userRegistrationId = ur.id and orp.isDeleted = 0
          where ur.isDeleted = 0 and ur.id = ?	`, [userRegId]);

      return query;
    }
    catch (error) {
      throw error;
    }
  }
  
  public async findInvoiceReceiver(registrationId) {
    try {
      let query = await this.entityManager.query(
        `	select ur.id userRegId, ur.registeringYourselfRefId ,(YEAR(CURRENT_DATE()) - YEAR(u1.dateOfBirth )) as age
        from wsa_registrations.registration r 
        inner join wsa_registrations.orgRegistrationParticipant orpt 
          on orpt.registrationId = r.id and orpt.isDeleted = 0
        inner join wsa_registrations.userRegistration ur 
          on ur.id = orpt.userRegistrationId  and ur.isDeleted = 0
        inner join wsa_users.user u1 
          on u1.id = r.createdBy and u1.isDeleted = 0
        where r.id = ?`, [registrationId]);

      return query;
    }
    catch (error) {
      throw error;
    }
  }

  public async findIndividualTeamRegInfo(userRegistrationId: number){
    try {
      let query = await this.entityManager.query(
        `  SELECT DISTINCT json_object('id', u.id, 'firstName', u.firstName, 'lastName', u.lastName, 'password', u.password, 'isInActive', u.isInActive, 'email', u.email) as user,
           u.id as userId, u.firstName , u.lastName , u.email, u.mobileNumber ,
           json_arrayagg(json_object('organisationName', o.name, 'competitionName', c.name, 'startDate', DATE_FORMAT(c.startDate, '%d/%m/%Y'), 'registrationCloseDate', DATE_FORMAT(c.registrationCloseDate, '%d/%m/%Y'), 
      'replyEmail', org.replyEmail, 'replyName', org.replyName, 'replyRole', org.replyRole, 'replyPhone', org.replyPhone)) as products,
        o.name as organisationName, c.name as competitionName, orpt.registrationId, t.name as teamName,
        org.replyEmail ,org.replyName ,org.replyPhone , org.replyRole
        from wsa_registrations.userRegistration ur 
        inner join wsa_registrations.orgRegistrationParticipant orpt 
           on orpt.userRegistrationId = ur.id and orpt.isDeleted = 0
        inner join wsa_users.user u
           on u.id = ur.userId and u.isDeleted = 0
        inner join wsa_registrations.orgRegistration org 
           on org.id = orpt.orgRegistrationId and org.isDeleted = 0
        inner join wsa_registrations.competition c 
           on c.id = org.competitionId and c.isDeleted = 0
        inner join wsa_users.organisation o 
           on o.id = org.organisationId and o.isDeleted = 0  
        inner join wsa_competitions.team t 
           on t.id = ur.teamId and t.isDeleted = 0
        where ur.id = ? and ur.isDeleted = 0`, [userRegistrationId]);

      return query[0];
    }
    catch (error) {
      throw error;
    }
  }

  public async findByRegistrationKey(registrationUniqueKey: string): Promise<Registration> {
    try {
      let query = await this.entityManager.createQueryBuilder(Registration, 'registration')
        .where('registration.registrationUniqueKey = :registrationUniqueKey  and registration.isDeleted = 0',
          { registrationUniqueKey: registrationUniqueKey })
        .getOne()
      return query;
    }
    catch (error) {
      throw error;
    }
  }

  public async teamRegistrationDashboard(requestBody: any, organisationUniqueKey: string, sortBy: string = undefined, sortOrder: "ASC" | "DESC" = undefined) {
    try {
      let limit = requestBody.paging.limit;
      let offset = requestBody.paging.offset;

      let result = await this.entityManager.query(`Call wsa_registrations.usp_teamregistration_dashboard(?,?,?,?,?,?,?,?,?,?,?)`, [
        requestBody.yearRefId,
        requestBody.competitionUniqueKey,
        organisationUniqueKey,
        requestBody.membershipProductUniqueKey,
        requestBody.filterOrganisation,
        requestBody.divisionId,
        requestBody.searchText,
        limit,
        offset,
        sortBy,
        sortOrder
      ]);

      if (isArrayPopulated(result)) {
        let totalCount = result[0].find((x) => x).totalCount;

        let responseObject = paginationData(
          stringTONumber(totalCount),
          limit,
          offset
        );
        responseObject['teamRegistrations'] = result[1];
        responseObject['competitionsList'] = result[2];
        responseObject['membershipProductList'] = result[3];
        responseObject['divisionList'] = result[4];

        return responseObject;
      } else
        return [];
    } catch (error) {
      throw error;
    }
  }

  public async exportTeamRegistrationDashboard(requestBody: any) {
    try {
      let result = await this.entityManager.query('Call wsa_registrations.usp_teamregistration_dashboard(?,?,?,?,?,?,?,?,?,?,?)', [
        requestBody.yearRefId,
        requestBody.competitionUniqueKey,
        requestBody.organisationUniqueKey,
        requestBody.membershipProductUniqueKey,
        requestBody.filterOrganisation + '',
        requestBody.divisionId,
        requestBody.searchText,
        -1,
        0,
        null,
        null
      ]);
      // let result = await this.entityManager.query('Call wsa_registrations.usp_teamregistration_dashboard(?,?,?,?,?,?,?,?,?,?,?)',
      //   [-1, '-1', requestBody.organisationUniqueKey, '-1', '', -1, '', -1, 0, null, null]);

      let teamRegArray = [];
      if (isArrayPopulated(result)) {
        for (let r of result[1]) {
          teamRegArray.push({
            'Team Name': r.teamName,
            'Organisation': r.organisationName,
            'Division': r.divisionName,
            'Product': r.productName,
            'Registered By': r.registeredBy,
            'Registration Date': r.registrationDate != null ? moment(r.registrationDate).format('DD/MM/YYYY') : '',
            'Status': r.status,
          });
        }
      } else {
        teamRegArray.push({
          'Team Name': 'N/A',
          'Organisation': 'N/A',
          'Division': 'N/A',
          'Product': 'N/A',
          'Registered By': 'N/A',
          'Registration Date': 'N/A',
          'Status': 'N/A',
        });
      }

      return teamRegArray
    } catch (error) {
      throw error;
    }
  }

  public async getRegistrationCap(compId: number, orgId: number, cmptId: number, divisionId: number): Promise <any> {
    try {
      let result = {
        teamRegistrationCap: 0,
        registrationCap: 0
      }
      let capQuery = await this.entityManager.query(
        `select  ormpt.teamRegistrationCap, ormpt.registrationCap
            from wsa_registrations.orgRegistrationMembershipProductType ormpt
            inner join wsa_registrations.orgRegistration org 
              on ormpt.orgRegistrationId = org.id and org.isDeleted = 0
            where ormpt.isDeleted = 0 and org.competitionId = ? and org.organisationId = ? 
              and ormpt.competitionMembershipProductTypeId = ?
              and ((case when ? = 0 then 1 = 1 else ormpt.competitionMembershipProductDivisionId = ? end))`
              ,[compId, orgId, cmptId, divisionId, divisionId]);

      if(capQuery){
        let response = capQuery.find(x=>x);
        result.registrationCap = response.registrationCap;
        result.teamRegistrationCap = response.teamRegistrationCap;
      }
      //console.log(JSON.stringify(result));
      return result;

    }
    catch (err) {
      return err;
    }
  }

  public async getRegistrationPlayerCount(compId: number, orgId: number, cmptId: number, divisionId: number): Promise <any>  {
    try
    {
      let result = {
        playerCount: 0
      }
        let playerQuery = await this.entityManager.query(
            `select count( p.userId) as playerCount from wsa_competitions.player p
            inner join wsa_registrations.orgRegistrationMembershipProductType ormpt 
              on ormpt.competitionMembershipProductTypeId = p.competitionMembershipProductTypeId 
              and ormpt.competitionMembershipProductDivisionId = p.competitionMembershipProductDivisionId 
              and ormpt.isDeleted = 0
            inner join wsa_registrations.orgRegistration org 
              on org.id = ormpt.orgRegistrationId and org.isDeleted = 0 and p.competitionId = org.competitionId 
              and org.organisationId = p.organisationId 
              where p.isDeleted = 0 and p.competitionId = ? and p.organisationId = ?
              and p.competitionMembershipProductTypeId = ?
              and (case when ? = 0 then 1 = 1 else p.competitionMembershipProductDivisionId = ? end) 
              and (p.statusRefId = 2 or p.statusRefId is null)`
              ,[compId, orgId, cmptId, divisionId, divisionId]);

        if(playerQuery){
          let response = playerQuery.find(x=>x);
          result.playerCount = response.playerCount;
        }
        console.log(JSON.stringify(result));
        return result;

    }
    catch (err) {
      return err;
    }
  }

  public async getRegistrationNonPlayerCount(compId: number, orgId: number, cmptId: number): Promise <any>  {
    try
    {
      let result = {
        playerCount: 0
      }
        let playerQuery = await this.entityManager.query(
            `select count( np.userId) as playerCount from wsa_competitions.nonPlayer np
            inner join wsa_registrations.orgRegistrationMembershipProductType ormpt 
              on ormpt.competitionMembershipProductTypeId = np.competitionMembershipProductTypeId 
              and ormpt.isDeleted = 0
            inner join wsa_registrations.orgRegistration org 
              on org.id = ormpt.orgRegistrationId and org.isDeleted = 0 and np.competitionId = org.competitionId 
              and org.organisationId = np.organisationId 
              where np.isDeleted = 0 and np.competitionId = ? and np.organisationId = ?
              and np.competitionMembershipProductTypeId = ? and (np.statusRefId = 2 or np.statusRefId is null)`
              ,[compId, orgId, cmptId]);

        if(playerQuery){
          let response = playerQuery.find(x=>x);
          result.playerCount = response.playerCount;
        }
        console.log(JSON.stringify(result));
        return result;

    }
    catch (err) {
      return err;
    }
  }

  public async getRegistrationTeamCount(compId: number, orgId: number, cmptId: number, divisionId: number): Promise <any>  {
    try
    {
      let result = {
        teamCount: 0
      }
        let playerQuery = await this.entityManager.query(
            `select count(DISTINCT p.teamId) as playerCount from wsa_competitions.player p
            inner join wsa_registrations.orgRegistrationMembershipProductType ormpt 
              on ormpt.competitionMembershipProductTypeId = p.competitionMembershipProductTypeId 
              and ormpt.isDeleted = 0
              where p.isDeleted = 0 and p.competitionId = ? and p.organisationId = ?
              and p.competitionMembershipProductTypeId = ?
              and (case when ? = 0 then 1 = 1 else p.competitionMembershipProductDivisionId = ? end) 
              and (p.statusRefId = 2 or p.statusRefId is null)`
              ,[compId, orgId, cmptId, divisionId, divisionId]);

              if(playerQuery){
                let response = playerQuery.find(x=>x);
                result.teamCount = response.playerCount;
              }
              console.log(JSON.stringify(result));
              return result;

    }
    catch (err) {
      return err;
    }
  }

  public async registrationTrackJsonData(registrationId: number, stepsId: number) {
    try {
      let query = await this.entityManager.query(`
                  SELECT rt.jsonData from wsa_registrations.registrationTrack rt 
                    where rt.registrationId = ? and rt.stepsId = ?`,[registrationId, stepsId]);

      return query;
    }
    catch (err) {
      return err;
    }
  }
}
