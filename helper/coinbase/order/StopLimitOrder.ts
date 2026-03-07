import Order from '@cb/order/Order';
import { CoinbaseStopLimitOrderSchema, type CoinbaseStopLimitOrder } from '@cb/http/contracts';

class StopLimitOrder extends Order<CoinbaseStopLimitOrder> {
  constructor(order: CoinbaseStopLimitOrder) {
    super(order, CoinbaseStopLimitOrderSchema);
  }

  get order_configuration() {
    return this._order.order_configuration.stop_limit_stop_limit_gtc;
  }

  /**
   * Returns the stop_price directly from the order configuration
   */
  get stop_price() {
    return this._order.order_configuration.stop_limit_stop_limit_gtc.stop_price;
  }

  /**
   * Returns the limit_price directly from the order configuration
   */
  get limit_price() {
    return this._order.order_configuration.stop_limit_stop_limit_gtc.limit_price;
  }

  /**
   * The configured order base_size
   */
  get base_size() {
    return this._order.order_configuration.stop_limit_stop_limit_gtc.base_size;
  }
}

export default StopLimitOrder;
