import Order from '@cb/order/Order';
import { CoinbaseMarketOrderSchema, type CoinbaseMarketOrder } from '@cb/http/contracts';

class MarketOrder extends Order<CoinbaseMarketOrder> {
  constructor(order: CoinbaseMarketOrder) {
    super(order, CoinbaseMarketOrderSchema);
  }

  get order_configuration() {
    return this._order.order_configuration.market_market_ioc;
  }

  get base_size() {
    return this._order.order_configuration.market_market_ioc.base_size;
  }
}

export default MarketOrder;
