import Order from '@cb/order/Order';
import { CoinbaseLimitOrderSchema, type CoinbaseLimitOrder } from '@cb/http/contracts';

class LimitBuyOrder extends Order<CoinbaseLimitOrder> {
  constructor(order: CoinbaseLimitOrder) {
    super(order, CoinbaseLimitOrderSchema);
  }

  get order_configuration() {
    return this._order.order_configuration.limit_limit_gtc;
  }

  get limit_price() {
    return this._order.order_configuration.limit_limit_gtc.limit_price;
  }

  get base_size() {
    return this._order.order_configuration.limit_limit_gtc.base_size;
  }
}

export default LimitBuyOrder;
