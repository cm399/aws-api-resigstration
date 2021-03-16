
import { Service } from "typedi";
import BaseService from "../BaseService";
import { Cart } from "../../models/shop/Cart";

@Service()
export default class CartService extends BaseService<Cart> {
    modelName(): string {
        return Cart.name;
    }

    public async getCartObj(userId) {
        try {
            const cart = new Cart();
            cart.createdBy = userId;
            cart.createdOn = new Date();
            return cart;
        } catch (error) {
            throw error;
        }
    };

    public async findByShopUniqueKey(shopUniqueKey: string): Promise<Cart> {
        try {
            let query = await this.entityManager.createQueryBuilder(Cart, 'c')
                .where('c.shopUniqueKey = :shopUniqueKey  and c.isDeleted = 0',
                    { shopUniqueKey })
                .getOne()
            return query;
        }
        catch (error) {
            throw error;
        }
    }
};
