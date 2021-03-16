import { Service } from "typedi";
import BaseService from "../BaseService";
import { SKU } from "../../models/shop/SKU";

@Service()
export default class SellProductService extends BaseService<SKU> {

    modelName(): string {
        return SKU.name;
    }

    public async updateQuantity(skuId: number, quantity: number, updatedById: number) {
      return this.entityManager
        .createQueryBuilder(SKU, 'sku')
        .update()
        .set({ quantity: quantity , updatedBy: updatedById })
        .where('id = :skuId', { skuId })
        .execute();
    }

}
