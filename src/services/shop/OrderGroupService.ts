import { Service } from "typedi";
import BaseService from "../BaseService";
import { OrderGroup } from '../../models/shop/OrderGroup';

@Service()
export default class OrderGroupService extends BaseService<OrderGroup> {
    modelName(): string {
        return OrderGroup.name;
    }


    public async getOrderGroupObj(userId: number, totalFee: number) 
    {
        let orderGrp = new OrderGroup();
        orderGrp.id = 0;
        orderGrp.total = totalFee;
        orderGrp.createdBy = userId;
        orderGrp.createdOn = new Date()

        return orderGrp;
    }

};
