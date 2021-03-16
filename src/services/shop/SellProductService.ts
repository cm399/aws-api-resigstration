import { Service } from "typedi";
import BaseService from "../BaseService";
import { SellProduct } from "../../models/shop/SellProduct";

@Service()
export default class SellProductService extends BaseService<SellProduct> {

    modelName(): string {
        return SellProduct.name;
    }

    public getSellProductObj(cart, order, prod, sku, userId){
        try {
            let sellProduct = new SellProduct();
            sellProduct.id = 0;
            sellProduct.cartId = cart.id;
            sellProduct.orderId = order.id;
            sellProduct.productId = prod.productId;
            sellProduct.quantity = prod.quantity;
            sellProduct.skuId = prod.skuId;
            sellProduct.cost = sku.cost;
            sellProduct.price = sku.price;
            sellProduct.createdBy = userId;
            sellProduct.createdOn = new Date();
        
            return sellProduct;
        } catch (error) {
            throw error;
        }
    }
}
