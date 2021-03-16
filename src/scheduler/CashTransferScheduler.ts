import { Transaction } from "../models/registrations/Transaction";
import { feeIsNull, formatFeeForStripe1, isArrayPopulated } from "../utils/Utils";
import AppConstants from "../validation/AppConstants";
import { getManager } from "typeorm";
import { logger } from "../logger";
import { Invoice } from "../models/registrations/Invoice";
import Stripe from 'stripe';

const cron = require("node-cron");

let stripe = null;

export class CashTransferScheduler {

    public async scheduleCashTransfer(){
        try {
            stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2020-03-02' });
            await cron.schedule("*/5 * * * *", async() => {

                let transactions = await this.getTransactions();
                if(isArrayPopulated(transactions)){
                    for(let item of transactions){
                        let competitionTransaction = await this.getTransactionData(item);
                        if(isArrayPopulated(competitionTransaction)){
                            let compTransaction = competitionTransaction.find(x=>x);
                            await this.updateCompTransaction(item, compTransaction);
                        }
                    }
                }
            });
        } catch (error) {
            logger.error(`Exception occurred in ScheduleCashTransfer ${error}`);
        }
    }

    private async getTransactions(){
        try {
            let feeType = AppConstants.affiliate;
            const entityManager  = getManager();
            let transactions = await entityManager.query(`select t.*, iv.stripeSourceTransaction, iv.stripeSubSourceTransaction from wsa_registrations.transactions t 
                    inner join wsa_registrations.transactionAudit ta 
                        on ta.transactionId  = t.id and ta.isDeleted = 0
                    inner join wsa_registrations.invoice iv 
                        on iv.id = t.invoiceRefId and iv.isDeleted = 0
                    where t.statusRefId = 2 and t.feeType  = ? and (t.isProcessed = 0 or t.isProcessed is null) and iv.subPaymentType = ?`, [feeType, AppConstants.cash]);

            return transactions;
        } catch (error) {
            logger.error(`Exception occurred in scheduler getTransactions ${error}`);
        }
    }

    public async getTransactionData(transaction):Promise<any>{
        try {
            const entityManager  = getManager();
            let divisionId = transaction.divisionId ? transaction.divisionId : 0;
            let feeType = 'competition';
            let result = await entityManager.query(`select * from wsa_registrations.transactions t 
            where invoiceRefId = ? and participantId = ? and membershipProductMappingId = ? and statusRefId = 5
            and feeType = ? and competitionId = ? and isDeleted = 0 and (case when divisionId = 0 or divisionId is null 
            then 1 else divisionId = ? end) and referenceId = ? `, 
            [transaction.invoiceRefId, transaction.participantId, transaction.membershipProductMappingId, feeType, 
                transaction.competitionId, divisionId, transaction.referenceId]);

            return result;
        } catch (error) {
            
        }
    }

    private async updateCompTransaction(transaction, compTransaction){
        try {
            const entityManager  = getManager();
            let compTrans = new Transaction();
            compTrans.id = compTransaction.id;
            compTrans.statusRefId = AppConstants.PAID;
            await entityManager.save(compTrans);

            let amount =  feeIsNull(compTransaction.feeAmount) +  feeIsNull(compTransaction.gstAmount)
            - feeIsNull(compTransaction.discountAmount) - feeIsNull(compTransaction.familyDiscountAmount);
            let amountReceived = feeIsNull(transaction.amountReceived) - amount;

            let trans = new Transaction();
            trans.id = transaction.id;
            trans.amountReceived = amountReceived;
            trans.statusRefId = AppConstants.PAID;
            trans.isProcessed = 1;
            trans.updatedOn = new Date();
            await entityManager.save(trans);

        } catch (error) {
           logger.error(`Exception occurred in updateCompTransaction ${error}`); 
        }
    }

    private async createInvoice(item) {

        try {
            const entityManager = getManager();
            let invoiceReceipt = await this.getInvoiceReciptId();
            let receiptId = feeIsNull(invoiceReceipt.receiptId) + 1;
            let invoice = new Invoice();
            invoice.id = 0;
            invoice.paymentStatus = "success";
            invoice.registrationId = item.registrationId;
            invoice.paymentType = AppConstants.card;
            invoice.subPaymentType = AppConstants.cash;
            invoice.receiptId = receiptId.toString();
            invoice.createdBy = item.createdBy;
            //let invoiceRes = await this.invoiceService.createOrUpdate(invoice);
            let invoiceRes = await entityManager.save(invoice)
            return invoiceRes;
        } catch (error) {
            logger.error(`Exception occurred in createInvoice Instalment :: ${error}`);
        }
    }

    public async getInvoiceReciptId(): Promise<any> {
        const entityManager = getManager();
        let query = await entityManager.query(`select IFNULL(receiptId, 100000) as receiptId from wsa_registrations.invoice order by id desc LIMIT 1`);
        return query.find(x => x);
    }

}