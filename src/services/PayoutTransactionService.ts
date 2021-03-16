import { Service } from "typedi";

import { logger } from "../logger";
import BaseService from "./BaseService";
import { PayoutTransaction } from "../models/registrations/PayoutTransaction";

@Service()
export default class PayoutTransactionService extends BaseService<PayoutTransaction> {
    modelName(): string {
        return PayoutTransaction.name;
    }

    public async save(data): Promise<any> {
        try {
            await this.entityManager.query(
                `insert into wsa_registrations.payoutTransactions(organisationUniqueKey, transactionId, payoutId, description, date, amount, status, createdOn) values(?,?,?,?,?,?,?,?)`,
                [data.organisationUniqueKey, data.transactionId, data.payoutId, data.description, data.date, data.amount, data.status, data.createdOn]
            );
        } catch (error) {
            logger.error(`Exception occurred in PayoutTransactionService.save ${error}`);
        }
    }
}