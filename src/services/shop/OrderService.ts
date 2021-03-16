
import { Service } from "typedi";
import BaseService from "../BaseService";
import { isArrayPopulated, isNotNullAndUndefined } from "../../utils/Utils";
import { Order } from "../../models/shop/Order";


@Service()
export default class OrderService extends BaseService<Order> {
  modelName(): string {
    return Order.name;
  }

  public async getOrderObj(paymentMethod, paymentStatus, registration, prod, orderGrpResponse, invoiceId,
    registrationProducts, paymentIntent, transferForShopFee){
    try {
          let order = new Order();
          order.id = 0;
          order.paymentMethod = paymentMethod;
          order.paymentStatus = paymentStatus;
          order.organisationId = prod.orgId;
          order.userId = registration.createdBy;
          order.orderGroupId = orderGrpResponse.id;
          order.invoiceId = invoiceId;
          order.createdBy = registration.createdBy;
          order.createdOn = new Date();
          order.paymentIntentId = paymentIntent.id;
          order.stripeTransferId = transferForShopFee ? transferForShopFee.id : null;
          let shipping = null;
          if(isArrayPopulated(registrationProducts.shippingOptions)){
              shipping = registrationProducts.shippingOptions.find(x=>x.organisationId ==
                  prod.organisationId);
          }

          if(isNotNullAndUndefined(shipping)){
              order.fulfilmentStatus = '2';
              order.deliveryType = "pickup";
              order.address = shipping.street1 + " " + (shipping.street2 ? shipping.street2 : "");
              order.suburb = shipping.suburb;
              order.state =  await this.getStateName(shipping.stateRefId);
              order.postcode = shipping.postalCode;
          }
          else{
              order.deliveryType = "shipping";
              order.fulfilmentStatus = '1';
              if(isNotNullAndUndefined(registrationProducts.deliveryAddress)){
                  let deliveryAddress = registrationProducts.deliveryAddress;
                  order.address = deliveryAddress.street1 + " " + (deliveryAddress.street2 ? deliveryAddress.street2 : "");
                  order.suburb = deliveryAddress.suburb;
                  order.state = await this.getStateName(deliveryAddress.stateRefId);
                  order.postcode = deliveryAddress.postalCode;
              }
          }
        return order;
    } catch (error) {
      throw error;
    }
  }

  private async getStateName(stateRefId):Promise<string>{
    try {
      let state = null;
      const result = await this.entityManager.query(
        `select name from wsa_common.reference 
         where id = ? and referenceGroupId = 37`,
        [stateRefId]
      );

      if(isArrayPopulated(result)){
        let reference = result.find(x=>x);
        state = reference.name;

        console.log("State::" + state);
      }

      return state;

    } catch (error) {
      throw error;
    }
  }

  public async findOrderByInvoiceId(invoiceId: number): Promise<Order[]> {
    return this.entityManager.createQueryBuilder(Order, 'order')
      .where('order.invoiceId = :invoiceId', {invoiceId})
      .getMany();
  }
};
