import { Service } from "typedi";
import BaseService from "./BaseService";
import { TransactionAudit } from "../models/registrations/TransactionAudit";

@Service()
export default class TransactionAuditService extends BaseService<TransactionAudit> {

    modelName(): string {
        return TransactionAudit.name;
    }
}