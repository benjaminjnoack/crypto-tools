import OrderConfig, { type OrderConfigJSON } from './OrderConfig';
import { POSITION_KEYS } from '@core/dictionary';

export default class MarketOrderConfig extends OrderConfig {
  constructor(uuid: string, base_size: string, order_id: string | null = null) {
    super(uuid, base_size, order_id);
  }

  toJSON() {
    return {
      ...super.toJSON(),
    };
  }

  static fromJSON(json: OrderConfigJSON) {
    return new MarketOrderConfig(
      json[POSITION_KEYS.UUID],
      json[POSITION_KEYS.BASE_SIZE],
      json[POSITION_KEYS.ORDER_ID],
    );
  }
}
