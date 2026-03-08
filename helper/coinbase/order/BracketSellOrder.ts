import Order from '@cb/order/Order';
import { CoinbaseBracketOrderSchema, type CoinbaseBracketOrder } from '@cb/http/contracts';

class BracketSellOrder extends Order<CoinbaseBracketOrder> {
  constructor(order: CoinbaseBracketOrder) {
    super(order, CoinbaseBracketOrderSchema);
  }

  get order_configuration() {
    return this._order.order_configuration.trigger_bracket_gtc;
  }

  get limit_price() {
    return this._order.order_configuration.trigger_bracket_gtc.limit_price;
  }

  get base_size() {
    return this._order.order_configuration.trigger_bracket_gtc.base_size;
  }

  get stop_trigger_price() {
    return this._order.order_configuration.trigger_bracket_gtc.stop_trigger_price;
  }
}

export default BracketSellOrder;
