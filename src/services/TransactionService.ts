import { Service } from "typedi";
import { logger } from "../logger";
import BaseService from "./BaseService";
import { feeIsNull, formatFeeForStripe1, isArrayPopulated, paginationData, stringTONumber } from "../utils/Utils";
import AppConstants from "../validation/AppConstants";
import { Transaction } from "../models/registrations/Transaction";
import Stripe from 'stripe';
import { NumberAttributeValue } from "aws-sdk/clients/dynamodbstreams";
import { FinanceFeeType, RegistrationStep, TransactionStatus } from "../enums/enums";

let stripe = null;

@Service()
export default class TransactionService extends BaseService<Transaction> {

    modelName(): string {
        return Transaction.name;
    }

    public async deleteByInvoiceId(invoiceId: number){
        try{
            let result = await this.entityManager.query(
                ` update wsa_registrations.transactions t 
                set t.statusRefId = 6
                where (t.invoiceId = ?) and t.isDeleted = 0 `,[invoiceId, invoiceId]);

            return result;
        }
        catch(error){
            throw error;
        }
    }

    public async deleteByInvoiceRefId(invoiceId: number){
        try{
            let result = await this.entityManager.query(
                ` update wsa_registrations.transactions t 
                set t.statusRefId = 6
                where (t.invoiceRefId = ?) and t.isDeleted = 0 `,[invoiceId, invoiceId]);

            return result;
        }
        catch(error){
            throw error;
        }
    }

    public async deleteByTransactionId(transactionId: number) {
        return await this.entityManager.query(`update transactions set isDeleted = 1 where id = ?`, [transactionId]);
    }

    public async getTransactionStatus(invoiceId: number): Promise<Transaction> {
        return await this.entityManager.createQueryBuilder().select().from(Transaction, 't')
            .andWhere("t.invoiceId = :invoiceId", { invoiceId })
            //.andWhere("t.feeType = :feeType", { feeType: "charity" })
            .andWhere("t.isDeleted = 0").execute();
    }

    public async getPaymentTransactionList(
        organisationId: number,
        offset: number,
        limit: number,
        userId: number,
        registrationId: string,
        sortBy: string = undefined,
        sortOrder: 'ASC' | 'DESC' = undefined,
        yearId: number = undefined,
        competitionKey: string = undefined,
        paymentFor: string = undefined,
        dateFrom: Date = undefined,
        dateTo: Date = undefined,
        search: string = undefined,
        feeTypeRefId: number = undefined,
        paymentOption: number = undefined,
        paymentMethod: string = undefined,
        membershipType: string = undefined,
        paymentStatus: number = undefined,
        discountMethod: number = undefined
    ): Promise<any> {
        const query = await this.entityManager.query(
            "call wsa_registrations.usp_get_payment_transaction_list(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)", [
            organisationId,
            userId,
            registrationId,
            yearId,
            competitionKey,
            paymentFor,
            dateFrom,
            dateTo,
            offset,
            limit,
            sortBy,
            sortOrder,
            search,
            feeTypeRefId,
            paymentOption,
            paymentMethod,
            membershipType,
            paymentStatus,
            discountMethod
        ]);
        if(isArrayPopulated(query) && isArrayPopulated(query[0])) {
            for(let item of query[0]) {
                if(discountMethod == -1){
                    if(isArrayPopulated(query[3])) {
                        let regId = query[3].find(x => x.registrationId == item.registrationId)
                        if(regId) {
                            item['discount'] = (feeIsNull(item.feeAmount) + feeIsNull(item.gstAmount))
                                            - (feeIsNull(item.discountAmount) + feeIsNull(item.familyDiscountAmount));
                        }
                        else{
                            item['discount'] =  feeIsNull(item.discountAmount) + feeIsNull(item.familyDiscountAmount)    
                        }
                    }
                    else{
                        item['discount'] =  feeIsNull(item.discountAmount) + feeIsNull(item.familyDiscountAmount)    
                    }
                }
                else if(discountMethod == 3){
                    if(isArrayPopulated(query[3])) {
                        let regId = query[3].find(x => x.registrationId == item.registrationId)
                        if(regId) {
                            item['discount'] = (feeIsNull(item.feeAmount) + feeIsNull(item.gstAmount))
                                            - (feeIsNull(item.discountAmount) + feeIsNull(item.familyDiscountAmount));
                        }
                    }
                }
                else if(discountMethod == 2){
                    item['discount'] = feeIsNull(item.familyDiscountAmount);
                }
                else if(discountMethod == 1){
                    item['discount'] = feeIsNull(item.discountAmount);
                }

                let canPartialRefund = 1;
                
                // if(item.affiliatePortion < 0){
                //     item.affiliatePortion = 0
                // }
                if(item.affiliatePortion <= 0 || item.playerStatusRefId == 3 || item.playerStatusRefId == 4 || item.paidFee <= 0){
                    canPartialRefund = 0;
                }
                item['canPartialRefund'] = canPartialRefund;
            }
        }
        if (isArrayPopulated(query) && isArrayPopulated(query[0])) {
            return { count: query[1][0].totalCount, data: query[0], competitionList: query[2] };
        } else {
            return { count: 0, data: [], competitionList: query[2] };
        }
    }

    public async getTransactionByFilter(invoiceId: number, organisationId: number, userId: number,
        competitionId: number, membershipProductMappingId: number, feeType: string, divisionId: number): Promise<any> {
        try {
            let result = await this.entityManager.query(`select * from wsa_registrations.transactions t 
            where invoiceId = ? and organisationId = ? and participantId = ? and membershipProductMappingId = ?
            and feeType = ? and competitionId = ? and isDeleted = 0 and (case when divisionId = 0 or divisionId is null 
                then 1 else divisionId = ? end)`,
                [invoiceId, organisationId, userId, membershipProductMappingId, feeType, competitionId, divisionId]);

            return result;
        } catch (error) {

        }
    }

    public async getTransactionData(transaction, feeType): Promise<any> {
        try {
            let divisionId = transaction.divisionId ? transaction.divisionId : 0;
            let result = await this.entityManager.query(`select * from wsa_registrations.transactions t 
            where invoiceId = ? and participantId = ? and membershipProductMappingId = ?
            and feeType = ? and competitionId = ? and isDeleted = 0 and (case when divisionId = 0 or divisionId is null 
            then 1 else divisionId = ? end) `,
                [transaction.invoiceId, transaction.participantId, transaction.membershipProductMappingId, feeType,
                transaction.competitionId, divisionId]);

            return result;
        } catch (error) {
            throw error;
        }
    }

    public async findFutureInstalments(item) {
        try {

            let query = null;
            if (item.divisionId != null) {
                query = await this.entityManager.query(
                    `select 
                         DATE_FORMAT(it.instalmentDate, '%d/%m/%Y') as instalmentDate,  JSON_ARRAYAGG(JSON_OBJECT('feeAmount', it.feeAmount, 'gstAmount',it.gstAmount,
                        'discountAmount',it.discountAmount, 'familyDiscountAmount',it.familyDiscountAmount)) as fees
                    from wsa_registrations.transactions it 
                    where it.participantId = ? and it.competitionId = ? and it.divisionId = ? and it.membershipProductMappingId = ? and it.instalmentDate is not null and it.isDeleted = 0 group by it.instalmentDate and
                        DATE_FORMAT(now(), '%Y-%m-%d') < DATE_FORMAT(it.instalmentDate, '%Y-%m-%d')`,
                    [item.userId, item.competitionId, item.divisionId, item.membershipMappingId]);
            }
            else {
                query = await this.entityManager.query(
                    `select 
                    DATE_FORMAT(it.instalmentDate, '%d/%m/%Y') as instalmentDate,  JSON_ARRAYAGG(JSON_OBJECT('feeAmount', it.feeAmount, 'gstAmount',it.gstAmount,
                   'discountAmount',it.discountAmount, 'familyDiscountAmount',it.familyDiscountAmount)) as fees
               from wsa_registrations.transactions it 
               where it.participantId = ? and it.competitionId = ? and it.membershipProductMappingId = ? and it.instalmentDate is not null and it.isDeleted = 0 group by it.instalmentDate and
                   DATE_FORMAT(now(), '%Y-%m-%d') < DATE_FORMAT(it.instalmentDate, '%Y-%m-%d')`,
                    [item.userId, item.competitionId, item.membershipMappingId]);
            }

            let resArr = [];
            if (isArrayPopulated(query)) {
                for (let q of query) {
                    let sumTotal = 0
                    if (isArrayPopulated(q.fees)) {
                        for (let f of q.fees) {
                            let totalFee = this.getTotalFee(f);
                            sumTotal += totalFee
                        }
                    }
                    let obj = {
                        date: q.instalmentDate,
                        amount: sumTotal
                    }
                    resArr.push(obj)
                }
            }
            return resArr
        }
        catch (error) {
            throw error;
        }
    }

    public async findFutureInstallmentByInvoiceId(invoiceId) {
        try {
            let query = await this.entityManager.query(
                `select DATE_FORMAT(it.instalmentDate, '%d/%m/%Y') as instalmentDate,  JSON_ARRAYAGG(JSON_OBJECT('feeAmount', it.feeAmount, 'gstAmount',it.gstAmount,
             'discountAmount',it.discountAmount, 'familyDiscountAmount',it.familyDiscountAmount)) as fees
         from wsa_registrations.transactions it 
         where it.invoiceRefId = ? and it.instalmentDate is not null and it.isDeleted = 0  and
             DATE_FORMAT(now(), '%Y-%m-%d') < DATE_FORMAT(it.instalmentDate, '%Y-%m-%d') group by it.instalmentDate`, [invoiceId]);

            let resArr = [];
            if (isArrayPopulated(query)) {
                for (let q of query) {
                    let sumTotal = 0
                    if (isArrayPopulated(q.fees)) {
                        for (let f of q.fees) {
                            let totalFee = this.getTotalFee(f);
                            sumTotal += totalFee
                        }
                    }
                    let obj = {
                        date: q.instalmentDate,
                        amount: sumTotal
                    }
                    resArr.push(obj)
                }
            }
            return resArr

        }
        catch (error) {
            throw error;
        }
    }

    private getTotalFee(tran) {
        try {
            console.log("getTotalFee Enrty -> ");
            let totalFee = feeIsNull(tran.feeAmount) + feeIsNull(tran.gstAmount)
                - feeIsNull(tran.discountAmount) - feeIsNull(tran.familyDiscountAmount);

            return totalFee;
        } catch (error) {
            logger.error(`Exception occurred in getTotalFee ${error}`);
        }
    }

    public async updateTransactionDD(paymentType, registrationId: number, invoiceId: number = undefined): Promise<any> {
        try {
            if (paymentType == AppConstants.directDebit) {
                await this.entityManager.query(`	
                    Update wsa_registrations.transactions t 
                    inner join wsa_registrations.invoice iv 
                        on iv.id = t.invoiceId  and iv.isDeleted = 0
                    set t.statusRefId = 2
                    where iv.registrationId = ? and iv.paymentType  = 'direct_debit'
                    and t.statusRefId = 1
                    and t.isDeleted = 0 `, [registrationId]);
            }
            else if (paymentType == AppConstants.cashDirectDebit) {
                await this.entityManager.query(`	
                Update wsa_registrations.transactions t 
				inner join wsa_registrations.invoice iv 
					on iv.id = t.invoiceId  and iv.isDeleted = 0
				set t.statusRefId = 2
				where iv.registrationId = ? and iv.paymentType  = 'cash' and iv.subPaymentType = 'cash_direct_debit'
				and t.statusRefId = 1 and t.feeType in('nomination', 'membership')
				and t.isDeleted = 0 `, [registrationId]);
            }

        } catch (error) {
            logger.error(`Exception occurred in updateTransactionDD ${error}`);
        }
    }

    public async updateTeamInviteTransactionDD(paymentType, registrationId: number, userRegId: number, invoiceId: number = undefined): Promise<any> {
        try {
            if (paymentType == AppConstants.directDebit) {
                await this.entityManager.query(`	
                    Update wsa_registrations.transactions t 
                    inner join wsa_registrations.invoice iv 
                        on iv.id = t.invoiceId  and iv.isDeleted = 0
                    set t.statusRefId = 2
                    where iv.registrationId = ? and iv.paymentType  = 'direct_debit'
                    and t.statusRefId = 1 and iv.userRegistrationId = ?
                    and t.isDeleted = 0 `, [registrationId, userRegId]);
            }
            else if (paymentType == AppConstants.cashDirectDebit) {
                await this.entityManager.query(`	
                Update wsa_registrations.transactions t 
				inner join wsa_registrations.invoice iv 
					on iv.id = t.invoiceId  and iv.isDeleted = 0
				set t.statusRefId = 2
				where iv.registrationId = ? and iv.paymentType  = 'cash' and iv.subPaymentType = 'cash_direct_debit'
                and t.statusRefId = 1 and t.feeType in('nomination', 'membership')
                and iv.userRegistrationId = ?
				and t.isDeleted = 0 `, [registrationId, userRegId]);
            }

        } catch (error) {
            logger.error(`Exception occurred in updateTransactionDD ${error}`);
        }
    }

    public async updateInstalmentTransactionDD(registrationId: number, invoiceId: number, paidBy: number): Promise<any> {
        try {
            await this.entityManager.query(`	
            Update wsa_registrations.transactions t 
            inner join wsa_registrations.invoice iv 
                on iv.id = t.invoiceId  and iv.isDeleted = 0
            set t.statusRefId = 2, t.paidBy = ?
            where iv.registrationId = ? and iv.paymentType  = 'direct_debit'
            and t.statusRefId = 3
            and t.isDeleted = 0 and iv.id = ? and t.instalmentDate is not null `, [paidBy, registrationId, invoiceId]);
        } catch (error) {
            logger.error(`Exception occurred in updateTransactionDD ${error}`);
        }
    }

    public async getTransactionByRegId(registrationId: number, invoiceId: number, userRegId: number = undefined, teamMemberRegId: number = undefined): Promise<any> {
        try {
            let result = [];
            if (userRegId) {
                result = await this.entityManager.query(`	
                select t.* from wsa_registrations.transactions t  
                inner join wsa_registrations.invoice iv 
                    on iv.id = t.invoiceId and iv.isDeleted = 0
                where iv.registrationId = ? and iv.id = ?  and iv.userRegistrationId = ?  `, [registrationId, invoiceId, userRegId]);
            }
            else if (teamMemberRegId) {
                result = await this.entityManager.query(`	
                select t.* from wsa_registrations.transactions t  
                inner join wsa_registrations.invoice iv 
                    on iv.id = t.invoiceId and iv.isDeleted = 0
                where iv.registrationId = ? and iv.id = ?  and iv.teamMemberRegId = ?  `, [registrationId, invoiceId, teamMemberRegId]);
            }
            else {
                result = await this.entityManager.query(`	
                select t.* from wsa_registrations.transactions t  
                inner join wsa_registrations.invoice iv 
                    on iv.id = t.invoiceId and iv.isDeleted = 0
                where iv.registrationId = ? and iv.id = ?  `, [registrationId, invoiceId]);
            }
            return result;
        } catch (error) {
            logger.error(`Exception occurred in getTransactionByRegId ${error}`);
        }
    }

    public async teamInviteCheck(userRegId) {
        try {
            let teamInviteCount = 0;
            let query = await this.entityManager.query(
                `select COUNT(*) as teamInviteCount from  wsa_registrations.transactions tt 
              inner join wsa_registrations.userRegistration ur 
                  on ur.userId  = tt.participantId and ur.isDeleted = 0
              where  tt.invoiceRefId is not null and tt.invoiceId = 0 and tt.isDeleted = 0
              and tt.statusRefId = 1 and instalmentDate is null and ur.id = ? and 
              tt.feeAmount != 0`, [userRegId]);

            if (isArrayPopulated(query)) {
                teamInviteCount = query.find(x => x).teamInviteCount;
            }
            return teamInviteCount;

        }
        catch (error) {
            throw error;
        }
    }

    public async findByInvoiceRefId(invoiceRefId: number, participantId: number): Promise<Transaction[]> {
        try {
            let result = await this.entityManager.createQueryBuilder(Transaction, 'tr')
                .where('tr.invoiceRefId = :invoiceRefId and tr.statusRefId = 1 and tr.participantId = :participantId and tr.isDeleted = 0',
                    { invoiceRefId: invoiceRefId, participantId: participantId })
                .getMany()
            return result
        }
        catch (error) {
            throw error;
        }
    }

    public async playersToPayList(ORGANISATION_ID: number, competitionId: number,requestBody: any) {
        try {
            let limit = requestBody.paging.limit;
            let offset = requestBody.paging.offset;

            let result = await this.entityManager.query(
                'call wsa_registrations.usp_players_to_pay(?,?,?,?)', [ORGANISATION_ID, competitionId, limit, offset]);

            if (isArrayPopulated(result)) {
                let totalCount = result[0].find((x) => x).totalCount;
                let responseObject = paginationData(
                    stringTONumber(totalCount),
                    limit,
                    offset
                );

                responseObject['playersToPay'] = result[1];
                return responseObject;
            }
        }
        catch (error) {
            logger.error(`Exception occurred in playersToPayList ${error}`);
            throw error;
        }
    }

    public async paymentSummaryList(ORGANISATION_ID: number, requestBody: any, search, sortBy, sortOrder): Promise<any> {
        try {
            let limit = requestBody.paging.limit;
            let offset = requestBody.paging.offset;
            let userId = requestBody.userId;
            let yearId = requestBody.yearId;
            let competitionKey = requestBody.competitionKey;
            let paymentFor = requestBody.paymentFor;
            let dateFrom = requestBody.dateFrom;
            let dateTo = requestBody.dateTo;
            let paymentOption = requestBody.paymentOption;
            let paymentMethod = requestBody.paymentMethod;
            let membershipType = requestBody.membershipType;
            let paymentStatus = requestBody.paymentStatus;

            let result = await this.entityManager.query('call wsa_registrations.usp_payment_summary(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)', [
                ORGANISATION_ID,
                userId,
                yearId,
                competitionKey,
                paymentFor,
                dateFrom,
                dateTo,
                paymentOption,
                paymentMethod,
                membershipType,
                paymentStatus,
                search,
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

                let resultArray = [];

                if (isArrayPopulated(result[1])) {
                    for (let res of result[1]) {
                        let obj = {
                            userId: res.userId,
                            firstName: res.firstName,
                            lastName: res.lastName,
                            teamId: res.teamId,
                            teamName: res.teamName,
                            membership: {
                                paid: null,
                                declined: null,
                                owing: null
                            },
                            affiliate: {
                                paid: null,
                                declined: null,
                                owing: null
                            },
                            competition: {
                                paid: null,
                                declined: null,
                                owing: null
                            },
                            affiliateNomination: {
                                paid: null,
                                declined: null,
                                owing: null
                            },
                            competitionNomination: {
                                paid: null,
                                declined: null,
                                owing: null
                            }
                        }
                        const transactions = result[2].filter(x => x.participantId == res.userId);

                        if (isArrayPopulated(transactions)) {
                            const memTypeFees = transactions.filter(x => x.feeTypeRefId == 1)
                            const compNominationFees = transactions.filter(x => x.feeTypeRefId == 2)
                            const compTypeFees = transactions.filter(x => x.feeTypeRefId == 3)
                            const affiliateFees = transactions.filter(x => x.feeTypeRefId == 7)
                            const affiliateNominationFees = transactions.filter(x => x.feeTypeRefId == 6)

                            if (isArrayPopulated(memTypeFees)) {
                                await this.feeTypeTotal(memTypeFees, obj.membership);
                            }
                            if (isArrayPopulated(compNominationFees)) {
                                await this.feeTypeTotal(compNominationFees, obj.competitionNomination);
                            }
                            if (isArrayPopulated(compTypeFees)) {
                                await this.feeTypeTotal(compTypeFees, obj.competition);
                            }
                            if (isArrayPopulated(affiliateFees)) {
                                await this.feeTypeTotal(affiliateFees, obj.affiliate);
                            }
                            if (isArrayPopulated(affiliateNominationFees)) {
                                await this.feeTypeTotal(affiliateNominationFees, obj.affiliateNomination);
                            }
                            resultArray.push(obj);
                        }
                    }
                }

                if (!!sortBy && !!sortOrder) {
                    resultArray = await this.sortPaymentSummary(resultArray, sortBy, sortOrder);
                }

                responseObject['paymentSummary'] = resultArray.slice(offset, offset + limit - 1);
                responseObject['competitionList'] = result[3];
                return responseObject;
            }
        } catch (error) {
            logger.error(`Exception occurred in paymentSummaryList ${error}`);
            throw error;
        }
    }

    private async sortPaymentSummary(resultArray, sortBy, sortOrder) {
        if (sortBy === 'firstName' || sortBy === 'lastName' || sortBy === 'teamName')
            return resultArray;

        const sortArg = sortOrder === 'ASC' ? 1 : -1;

        switch(sortBy) {
            case "paid":
                resultArray.sort((a, b) => {
                    return (a.membership.paid - b.membership.paid) * sortArg;
                })
                break;
            case "declined":
                resultArray.sort((a, b) => {
                    return (a.membership.declined - b.membership.declined) * sortArg;
                })
                break;
            case "owing":
                resultArray.sort((a, b) => {
                    return (a.membership.owing - b.membership.owing) * sortArg;
                })
                break;
            case "nominationFeesPaid":
                resultArray.sort((a, b) => {
                    return (a.competitionNomination.paid - b.competitionNomination.paid) * sortArg;
                })
                break;
            case "nominationFeesDeclined":
                resultArray.sort((a, b) => {
                    return (a.competitionNomination.declined - b.competitionNomination.declined) * sortArg;
                })
                break;
            case "nominationFeesOwing":
                resultArray.sort((a, b) => {
                    return (a.competitionNomination.owing - b.competitionNomination.owing) * sortArg;
                })
                break;
            case "competitionFeesPaid":
                resultArray.sort((a, b) => {
                    return (a.competition.paid - b.competition.paid) * sortArg;
                })
                break;
            case "competitionFeesDeclined":
                resultArray.sort((a, b) => {
                    return (a.competition.declined - b.competition.declined) * sortArg;
                })
                break;
            case "competitionFeesOwing":
                resultArray.sort((a, b) => {
                    return (a.competition.owing - b.competition.owing) * sortArg;
                })
                break;
            case "affiliateNominationFeesPaid":
                resultArray.sort((a, b) => {
                    return (a.affiliateNomination.paid - b.affiliateNomination.paid) * sortArg;
                })
                break;
            case "affiliateNominationFeesDeclined":
                resultArray.sort((a, b) => {
                    return (a.affiliateNomination.declined - b.affiliateNomination.declined) * sortArg;
                })
                break;
            case "affiliateNominationFeesOwing":
                resultArray.sort((a, b) => {
                    return (a.affiliateNomination.owing - b.affiliateNomination.owing) * sortArg;
                })
                break;
            case "affiliateFeesPaid":
                resultArray.sort((a, b) => {
                    return (a.affiliate.paid - b.affiliate.paid) * sortArg;
                })
                break;
            case "affiliateFeesDeclined":
                resultArray.sort((a, b) => {
                    return (a.affiliate.declined - b.affiliate.declined) * sortArg;
                })
                break;
            case "affiliateFeesOwing":
                resultArray.sort((a, b) => {
                    return (a.affiliate.owing - b.affiliate.owing) * sortArg;
                })
                break;
        }

        return resultArray;
    }

    private async feeTypeTotal(typeFees, typeObj) {
        try {
            let paidFees = typeFees.filter(x => x.statusRefId == 2);
            let declinedFees = typeFees.filter(x => x.statusRefId == 6);
            let owingFees = typeFees.filter(x => x.statusRefId == 1 || x.statusRefId == 3);

            if (isArrayPopulated(paidFees)) {
                let paidFee = await this.feeStatusTotal(paidFees, typeObj.paid);
                typeObj.paid = paidFee;
            }
            if (isArrayPopulated(declinedFees)) {
                let declinedFee = await this.feeStatusTotal(declinedFees, typeObj.declined);
                typeObj.declined = declinedFee;
            }
            if (isArrayPopulated(owingFees)) {
                let owingFee = await this.feeStatusTotal(owingFees, typeObj.owing);
                typeObj.owing = owingFee;
            }
        }
        catch (error) {
            throw error;
        }
    }

    private async feeStatusTotal(statusFees, statusField) {
        try {
            if (isArrayPopulated(statusFees)) {
                let fees = 0
                for (let fee of statusFees) {
                    let totalFee = (feeIsNull(fee.feeAmount) + feeIsNull(fee.gstAmount)) -
                        (feeIsNull(fee.discountAmount) + feeIsNull(fee.familyDiscountAmount));
                    fees += totalFee;
                }
                statusField = fees;
            }
            return statusField;
        }
        catch (error) {
            throw error;
        }
    }

    public async getInstalments(regId, userId, divisionId) {
        try {
            // console.log("getInstalments entry");
            let instalments = await this.entityManager.query(`
            select
                it.*, i.stripeSourceTransaction, i.paymentStatus, i.paymentType, i.registrationId, t.id as teamId, t.name as teamName,
                i.userRegistrationId,i.createdBy, u.firstName , u.lastName, u.email, u.mobileNumber, 
                o.name as orgName, c.name as compName, u.stripeCustomerAccountId, re.registrationUniqueKey , 
                cmp.id as competitionMembershipProductid, cmpd.divisionName, mpt.name as membershipTypeName, c.startDate,
                o.organisationUniqueKey, o.email as orgEmail, o.phoneNo as orgPhoneNumber, c.competitionUniqueKey
            from wsa_registrations.transactions it
            inner join wsa_registrations.invoice i 
                on i.id = it.invoiceRefId and i.isDeleted = 0
            inner join wsa_registrations.registration re 
                on re.id = i.registrationId and re.isDeleted = 0
            inner join wsa_registrations.orgRegistrationParticipant orgp 
                on orgp.registrationId = re.id and orgp.isDeleted = 0 
            inner join wsa_users.user u 
                on u.id = it.paidBy and u.isDeleted = 0
            inner join wsa_registrations.userRegistration ur 
                on ur.userId = it.participantId and ur.isDeleted = 0 and orgp.userRegistrationId = ur.id 
            left join wsa_competitions.team t 
                on ur.teamId = t.id and t.isDeleted = 0
            inner join wsa_users.organisation o 
                on o.id = it.organisationId and o.isDeleted = 0
            inner join wsa_registrations.competition c 
                on c.id = it.competitionId and c.isDeleted = 0
            inner join wsa_registrations.competitionMembershipProduct cmp 
                on cmp.competitionId = c.id and cmp.isDeleted = 0
            inner join wsa_registrations.competitionMembershipProductType cmpt 
                on cmpt.competitionMembershipProductId = cmp.id and cmpt.membershipProductTypeMappingId = it.membershipProductMappingId
            inner join membershipProductTypeMapping mptm
                on cmpt.membershipProductTypeMappingId = mptm.id and mptm.isDeleted = 0
            inner join membershipProduct mp
                on mp.id = mptm.membershipProductId and mptm.isDeleted = 0          
            inner join membershipProductType mpt
                on mpt.id = mptm.membershipProductTypeId and mpt.isDeleted = 0
            left join wsa_registrations.competitionMembershipProductDivision cmpd 
                on cmpd.isDeleted = 0 and it.divisionId =  cmpd.id and cmp.id = cmpd.competitionMembershipProductId 
            where it.statusRefId = 6 and it.instalmentDate is not null and it.isDeleted = 0
            	and re.id = ? and it.paidBy = ? and it.divisionId = ?`,[regId, userId, divisionId]);
            return instalments;
        } catch (error) {
            logger.error((`Exception occurred in getInstalments ${error}`));
        }
    }

    public async getFailedPerMatch(registrationId, paidBy, divisionId, competitionId){
        try{
            let query = await this.entityManager.query(
                `select
                    it.*, it.referenceId as matchId, i.stripeSourceTransaction, i.stripeSubSourceTransaction ,i.paymentStatus, i.paymentType, 
                    i.registrationId, t.id as teamId, t.name as teamName,
                    i.userRegistrationId,i.createdBy, u.firstName , u.lastName, u.email, u.mobileNumber, u.id as userId,
                    o.name as orgName, c.name as compName, u.stripeCustomerAccountId, re.registrationUniqueKey , 
                    cmp.id as competitionMembershipProductid, cmpd.divisionName, mpt.name as membershipTypeName, c.startDate,
                    o.organisationUniqueKey, o.email as orgEmail, o.phoneNo as orgPhoneNumber, c.competitionUniqueKey,
                    cmpf.teamSeasonalFees,cmpf.teamSeasonalGST,cmpf.id as cmpfId,cmpf.teamRegChargeTypeRefId
                from wsa_registrations.transactions it
                inner join wsa_registrations.invoice i 
                    on i.id = it.invoiceId and i.isDeleted = 0
                inner join wsa_registrations.registration re 
                    on re.id = i.registrationId and re.isDeleted = 0
                inner join wsa_registrations.orgRegistrationParticipant orgp 
                    on orgp.registrationId = re.id and orgp.isDeleted = 0 
                inner join wsa_users.user u 
                    on u.id = it.paidBy and u.isDeleted = 0
                inner join wsa_registrations.userRegistration ur 
                    on ur.userId = it.participantId and ur.isDeleted = 0 and orgp.userRegistrationId = ur.id 
                left join wsa_competitions.team t 
                    on ur.teamId = t.id and t.isDeleted = 0
                inner join wsa_users.organisation o 
                    on o.id = it.organisationId and o.isDeleted = 0
                inner join wsa_registrations.competition c 
                    on c.id = it.competitionId and c.isDeleted = 0
                inner join wsa_registrations.competitionMembershipProduct cmp 
                    on cmp.competitionId = c.id and cmp.isDeleted = 0
                inner join wsa_registrations.competitionMembershipProductType cmpt 
                    on cmpt.competitionMembershipProductId = cmp.id and cmpt.membershipProductTypeMappingId = it.membershipProductMappingId
                inner join membershipProductTypeMapping mptm
                    on cmpt.membershipProductTypeMappingId = mptm.id and mptm.isDeleted = 0
                inner join membershipProduct mp
                    on mp.id = mptm.membershipProductId and mptm.isDeleted = 0          
                inner join membershipProductType mpt
                    on mpt.id = mptm.membershipProductTypeId and mpt.isDeleted = 0
                inner join wsa_competitions.competitionDivision cd  
                    on cd.id = it.divisionId and cd.isDeleted = 0
                inner join wsa_registrations.competitionMembershipProductDivision cmpd 
                    on cmpd.isDeleted = 0 and cd.competitionMembershipProductDivisionId = cmpd.id and cmp.id = cmpd.competitionMembershipProductId 
                left join wsa_registrations.competitionMembershipProductFee cmpf
                    on cmpf.competitionMembershipProductTypeId = cmpt.id  and cmpf.isDeleted = 0
                    and cmpf.organisationId = it.organisationId
                    and (cmpf.competitionMembershipProductDivisionId is null or cmpf.competitionMembershipProductDivisionId = cmpd.id)
                where  it.statusRefId in (1,6) and it.paymentOptionRefId = 1 and it.instalmentDate is null and it.isDeleted = 0 and referenceId is not null
                    and re.id = ? and it.paidBy = ? and cmpd.id = ? and it.competitionId = ?`,[registrationId, paidBy, divisionId, competitionId]);

            return query;
        }
        catch(error){
            throw error;
        }
    }

    public async instalmentDateToDBTrack(item, registrationId, invoiceId, createdBy) {
        try {
            // console.log("************ Instalment Future Date Arr " + JSON.stringify(transArr));
           
            let trackData = await this.entityManager.query(`select * from  wsa_registrations.registrationTrack  where registrationId = ? and stepsId = 16 and isDeleted = 0
           and invoiceId = ?`, [registrationId, invoiceId]);
            if (isArrayPopulated(trackData)) {
                await this.entityManager.query(`Update wsa_registrations.registrationTrack set jsonData = ? where registrationId = ? and stepsId = 16
                and invoiceId = ?`, [JSON.stringify(item), registrationId, invoiceId]);
            }
            else {
                //console.log("$$$$$$$$");
                await this.entityManager.query(`insert into wsa_registrations.registrationTrack(registrationId, stepsId,jsonData,createdBy, invoiceId) values(?,?,?,?,?)`,
                    [registrationId, RegistrationStep.InstalmentTrackStep, JSON.stringify(item), createdBy, invoiceId]);
            }
        } catch (error) {
            logger.error(`Exception occurred in instalmentDateToDBTrack ${error}`);
            //throw error;
        }
    }

    public async perMatchDateToDBTrack(item, registrationId, invoiceId, createdBy) {
        try {
            let trackData = await this.entityManager.query(`select * from  wsa_registrations.registrationTrack  where registrationId = ? and stepsId = 17 and isDeleted = 0
           and invoiceId = ?`, [registrationId, invoiceId]);
            if (isArrayPopulated(trackData)) {
                await this.entityManager.query(`Update wsa_registrations.registrationTrack set jsonData = ? where registrationId = ? and stepsId = 17
                and invoiceId = ?`, [JSON.stringify(item), registrationId, invoiceId]);
            }
            else {
                await this.entityManager.query(`insert into wsa_registrations.registrationTrack(registrationId, stepsId,jsonData,createdBy, invoiceId) values(?,?,?,?,?)`,
                    [registrationId, RegistrationStep.PerMatchFeeTrackStep, JSON.stringify(item), createdBy, invoiceId]);
            }
        } catch (error) {
            logger.error(`Exception occurred in perMatchDateToDBTrack ${error}`);
            throw error;
        }
    }

    public async getFailedTransactionsForCash(processType, registrationId, paidBy, divisionId, competitionId){
        try{
            let result = null;
            if(processType.toLowerCase() == AppConstants.instalment.toLowerCase()){
                result = await this.failedInstallment(registrationId, paidBy, divisionId, competitionId)
            }
            else if(processType.toLowerCase() == AppConstants.schoolInvoice.toLowerCase()){
                result = await this.pendingSchoolInvoice(registrationId, paidBy, competitionId)
            }
            else if(processType.toLowerCase() == AppConstants.governmentVoucher.toLowerCase()){
                result = await this.pendingGovermentVoucher(registrationId, paidBy, competitionId)
            }
            else if(processType.toLowerCase() == AppConstants.perMatch.toLowerCase()){
                result = await this.pendingPermatch(registrationId, paidBy, divisionId, competitionId)
            }
            
           return result;
        }
        catch(error){
            throw error;
        }
    }

    public async updateRefundedTransaction(referenceId: string) {
        try{
            await this.entityManager.query(`Update wsa_registrations.transactions set statusRefId = ? where referenceId = ? and isDeleted = 0`, 
            [AppConstants.PAID, referenceId]);
        }
        catch(error) {
            throw error;
        }
    }

    public async updateTransactionGovtStatusRefId(referenceId: string) {
        try{
            await this.entityManager.query(`Update wsa_registrations.transactions set governmentVoucherStatusRefId = ? where referenceId = ? and isDeleted = 0`, 
            [AppConstants.PAID, referenceId]);
        }
        catch(error) {
            throw error;
        }
    }

    public async getTransactionByReferenceId (referenceId: string) {
        try {
            let result = await this.entityManager.createQueryBuilder(Transaction, 'tr')
                        .where('tr.referenceId = :referenceId and  tr.isDeleted = 0',
                        { referenceId: referenceId })
                        .getOne();

            return result;
        }
        catch(error) {
            throw error;
        }
    }

    public async updateTransactionStatus(transactionId: any, statusRefId) {
        try{
            await this.entityManager.query(`Update wsa_registrations.transactions set statusRefId = ? where id = ? and isDeleted = 0`, 
            [statusRefId, transactionId]);
        }
        catch(error) {
            throw error;
        }
    }

    public async updateTransactionStatusByInvoiceId(userObj: any, statusRefId) {
        try{
            await this.entityManager.query(`Update wsa_registrations.transactions set statusRefId = ? 
                                    where (invoiceId = ? or invoiceRefId = ?) and participantId = ? and isDeleted = 0`, 
            [statusRefId, userObj.invoiceId, userObj.invoiceId, userObj.userId]);
        }
        catch(error) {
            throw error;
        }
    }

    private async failedInstallment(registrationId, paidBy, divisionId, competitionId){
        try{
            let query = await this.entityManager.query(
                `Select DISTINCT 
                        t.*, org.organisationId as sourceOrgId, orp.teamRegistrationTypeRefId,
                        u.firstName as playerFirstName, u.lastName as playerLastName, u.middleName as playerMiddleName,
                        u1.firstName as registeringPersonFirstName, u1.lastName as registeringPersonLastName, 
                        u1.middleName as registeringPersonMiddleName
                 from wsa_registrations.transactions t
                inner join wsa_registrations.invoice i 
                    on i.id = t.invoiceRefId and i.isDeleted = 0
                inner join wsa_registrations.registration r 
                    on r.id = i.registrationId and r.isDeleted = 0 
                inner join wsa_registrations.orgRegistrationParticipant orp
                    on orp.registrationId = r.id and orp.isDeleted = 0
                inner join wsa_registrations.orgRegistration org
                    on  org.id = orp.orgRegistrationId and org.isDeleted = 0
                inner join wsa_users.user u 
                    on u.id = t.participantId and u.isDeleted = 0
                inner join wsa_users.user u1 
                    on u1.id = t.paidBy and u1.isDeleted = 0
                where t.statusRefId = 6 and t.isDeleted = 0 and t.instalmentDate is not null and r.id = ? 
                    and t.paidBy = ?  and t.divisionId = ? and org.competitionId = ?`,
                [registrationId, paidBy, divisionId, competitionId]);

            return query;
        }
        catch(error){
            throw error;
        }
    }

    private async pendingSchoolInvoice(registrationId, paidBy, competitionId){
        try{
            let query = await this.entityManager.query(
                ` Select DISTINCT t.*, org.organisationId as sourceOrgId, orp.teamRegistrationTypeRefId,
                u.firstName as playerFirstName, u.lastName as playerLastName, u.middleName as playerMiddleName,
                u1.firstName as registeringPersonFirstName, u1.lastName as registeringPersonLastName, 
                u1.middleName as registeringPersonMiddleName
                 from wsa_registrations.transactions t
                inner join wsa_registrations.invoice i 
                    on i.id = t.invoiceId and i.isDeleted = 0
                inner join wsa_registrations.registration r 
                    on r.id = i.registrationId and r.isDeleted = 0 
                inner join wsa_registrations.orgRegistrationParticipant orp
                    on orp.registrationId = r.id and orp.isDeleted = 0
                inner join wsa_registrations.orgRegistration org
                    on  org.id = orp.orgRegistrationId and org.isDeleted = 0
                inner join wsa_users.user u 
                        on u.id = t.participantId and u.isDeleted = 0
                inner join wsa_users.user u1 
                        on u1.id = t.paidBy and u1.isDeleted = 0
                where t.statusRefId = 1 and t.isDeleted = 0 and t.paymentOptionRefId = 5 and r.id = ? 
                    and t.paidBy = ? and org.competitionId = ?`,
                [registrationId, paidBy, competitionId]);

            return query;
        }
        catch(error){
            throw error;
        }
    }

    private async pendingPermatch(registrationId, paidBy, divisionId, competitionId){
        try{
            let query = await this.entityManager.query(
                `Select DISTINCT 
                        t.*, org.organisationId as sourceOrgId, orp.teamRegistrationTypeRefId,
                        u.firstName as playerFirstName, u.lastName as playerLastName, u.middleName as playerMiddleName,
                        u1.firstName as registeringPersonFirstName, u1.lastName as registeringPersonLastName, 
                        u1.middleName as registeringPersonMiddleName
                 from wsa_registrations.transactions t
                inner join wsa_registrations.invoice i 
                    on i.id = t.invoiceRefId and i.isDeleted = 0
                inner join wsa_registrations.registration r 
                    on r.id = i.registrationId and r.isDeleted = 0 
                inner join wsa_registrations.orgRegistrationParticipant orp
                    on orp.registrationId = r.id and orp.isDeleted = 0
                inner join wsa_registrations.orgRegistration org
                    on  org.id = orp.orgRegistrationId and org.isDeleted = 0
                inner join wsa_users.user u 
                    on u.id = t.participantId and u.isDeleted = 0
                inner join wsa_users.user u1 
                    on u1.id = t.paidBy and u1.isDeleted = 0
                inner join wsa_competitions.competitionDivision cd  
                    on cd.id = t.divisionId and cd.isDeleted = 0
                inner join wsa_registrations.competitionMembershipProductDivision cmpd 
                    on cmpd.isDeleted = 0 and cd.competitionMembershipProductDivisionId = cmpd.id 
                where t.statusRefId in (1,6) and t.paymentOptionRefId = 1  and t.isDeleted = 0 and t.instalmentDate is null 
                and r.id = ? and t.paidBy = ?  and cmpd.id = ? and org.competitionId = ?`,
                [registrationId, paidBy, divisionId, competitionId]);

                return query;
        }
        catch(error){
            throw error;
        }
    }

    private async pendingGovermentVoucher(registrationId, participantId, competitionId){
        try{
            let query = await this.entityManager.query(
                ` Select DISTINCT t.*, org.organisationId as sourceOrgId, orp.teamRegistrationTypeRefId,
                u.firstName as playerFirstName, u.lastName as playerLastName, u.middleName as playerMiddleName,
                u1.firstName as registeringPersonFirstName, u1.lastName as registeringPersonLastName, 
                u1.middleName as registeringPersonMiddleName
                 from wsa_registrations.transactions t
                inner join wsa_registrations.invoice i 
                    on i.id = t.invoiceId and i.isDeleted = 0
                inner join wsa_registrations.registration r 
                    on r.id = i.registrationId and r.isDeleted = 0 
                inner join wsa_registrations.orgRegistrationParticipant orp
                    on orp.registrationId = r.id and orp.isDeleted = 0
                inner join wsa_registrations.orgRegistration org
                    on  org.id = orp.orgRegistrationId and org.isDeleted = 0
                inner join wsa_users.user u 
                    on u.id = t.participantId and u.isDeleted = 0
                inner join wsa_users.user u1 
                    on u1.id = t.paidBy and u1.isDeleted = 0
                where t.governmentVoucherStatusRefId = 1  
                    and t.isDeleted = 0  and r.id = ? 
                    and t.participantId = ? and org.competitionId = ?`,
                [registrationId, participantId, competitionId]);

            return query;
        }
        catch(error){
            throw error;
        }
    }

    public async refundIntent(refundAmount, chargeId, transaction, guidKey){
        try {
            stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2020-03-02' });
            let obj = {
                transactionId: transaction ? transaction.id : 0,
                'partialRefund': "PARTIALREFUND"+"#"+guidKey
            } 
            const STRIPE_TOTAL_FEE = formatFeeForStripe1(refundAmount);

            const refund = await stripe.refunds.create({
                amount: STRIPE_TOTAL_FEE,
                payment_intent: chargeId,
                metadata: obj
              });
              return {message: refund, code: 200};
        } catch (error) {
           logger.error(`Exception occurred in refundIntent ${error}`);
           return {message: error, code: 500};
        }
    }

    public async performTransferReversal(transaction, totalFee, guidKey){
        try {
            logger.debug(`Inside the performTransferReversal ${transaction.stripeTransactionId} ::${totalFee}`)
            stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2020-03-02' });
            let obj = {
                transferReversal: "TRANSFERREVERSAL" + "#" + guidKey
            }
            const STRIPE_TOTAL_FEE = formatFeeForStripe1(totalFee);
            const reversal = await stripe.transfers.createReversal(
                transaction.stripeTransactionId,
                {
                  amount: STRIPE_TOTAL_FEE,
                  metadata: obj
                },
              );
              return {message: reversal, code: 200};
           
        } catch (error) {
            logger.error(`Exception occurred in performTransferReversal ${error}`);
            return {message: error, code: 500};
        }
    }

    public async createTransactionObject(item, deRegister, transData, createdBy, refundIntent, guidKey) {
        try {
            const trxn = new Transaction();
            trxn.id = 0;
            trxn.invoiceId = item.invoiceId;
            trxn.participantId = deRegister.userId;
            trxn.createdBy = createdBy;
            trxn.feeAmount = -item.refundAmount;
            trxn.feeType = item.feeType;
            trxn.feeTypeRefId = transData != null ? transData.feeTypeRefId : 0;
            trxn.statusRefId = (refundIntent ? (refundIntent.status === "succeeded" ? AppConstants.PAID : AppConstants.NOT_PAID) : AppConstants.PAID);
            trxn.membershipProductMappingId = deRegister.membershipMappingId;
            trxn.competitionId = deRegister.competitionId;
            trxn.organisationId = item.payingOrgId;
            trxn.paymentOptionRefId = transData != null ? transData.paymentOptionRefId : 0;
            trxn.paymentFeeTypeRefId = transData != null ? transData.paymentFeeTypeRefId : 0;
            trxn.stripeTransactionId = refundIntent ? refundIntent.id : null;
            trxn.transactionTypeRefId = AppConstants.TRANSACTION_TYPE_REFUND
            trxn.divisionId = deRegister.divisionId;
            trxn.referenceId = guidKey;

            return trxn;
        }
        catch(error) {
            throw error;
        }
    }

  public async updateTransactionByInvoice(invoiceId,statusRefId,transactionTypeRefId){
    try{
       let updatedTransaction = await this.entityManager.query(`
                                    update wsa_registrations.transactions t 
                                    inner join wsa_registrations.invoice i
                                    on i.id = t.invoiceId and i.isDeleted = 0
                                    set statusRefId = ? where t.invoiceId = ? and t.transactionTypeRefId = ? and 
                                    t.isDeleted = 0 and (i.paymentType is null or i.paymentType = 'card')
                                    `,[statusRefId, invoiceId, transactionTypeRefId]);
        return updatedTransaction;
    }
    catch(error) {
        throw error;
    }   
}

}
