import OrderConfig, { OrderConfigJSONSchema } from './OrderConfig';
import { POSITION_KEYS } from '@core/dictionary';
import { safeNumber } from '@core/validation.js';
import { z } from 'zod';

export const BracketSellOrderConfigJSONSchema = OrderConfigJSONSchema.extend({
  [POSITION_KEYS.LIMIT_PRICE]: z.string(),
  [POSITION_KEYS.STOP_PRICE]: z.string(),
});

export type BracketSellOrderConfigJSON = z.infer<typeof BracketSellOrderConfigJSONSchema>;

/**
 * Represents the configuration for a bracket sell order.
 * Extends {@link OrderConfig}.
 */
export default class BracketSellOrderConfig extends OrderConfig {
  private readonly _limit_price: string;
  private readonly _stop_price: string;
  constructor(
    uuid: string,
    base_size: string,
    limit_price: string,
    stop_price: string,
    order_id: string | null = null,
  ) {
    super(uuid, base_size, order_id);
    safeNumber(limit_price, 'BracketSellOrderConfig => limit_price', true);
    this._limit_price = limit_price;
    safeNumber(stop_price, 'BracketSellOrderConfig => stop_price', true);
    this._stop_price = stop_price;
  }

  toJSON() {
    return {
      ...super.toJSON(),
      [POSITION_KEYS.LIMIT_PRICE]: this._limit_price,
      [POSITION_KEYS.STOP_PRICE]: this._stop_price,
    };
  }

  static fromJSON(json: BracketSellOrderConfigJSON) {
    return new BracketSellOrderConfig(
      json[POSITION_KEYS.UUID],
      json[POSITION_KEYS.BASE_SIZE],
      json[POSITION_KEYS.LIMIT_PRICE],
      json[POSITION_KEYS.STOP_PRICE],
      json[POSITION_KEYS.ORDER_ID],
    );
  }
}
