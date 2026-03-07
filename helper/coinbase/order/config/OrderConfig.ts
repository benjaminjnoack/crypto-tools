import { ORDER_KEYS, POSITION_KEYS } from '@core/dictionary';
import type { CoinbaseOrder } from '@cb/http/contracts';
import type Order from '../Order.js';
import { safeNumber } from '@core/validation';
import * as UUID from 'uuid';
import { z } from 'zod';

export const OrderConfigJSONSchema = z.object({
  [POSITION_KEYS.UUID]: z.string(),
  [POSITION_KEYS.BASE_SIZE]: z.string(),
  [POSITION_KEYS.ORDER_ID]: z.string().nullable(),
  [ORDER_KEYS.STATUS]: z.string().optional(),
  [ORDER_KEYS.FILLED_SIZE]: z.string().optional(),
  [ORDER_KEYS.FILLED_VALUE]: z.string().optional(),
  [ORDER_KEYS.AVERAGE_FILLED_PRICE]: z.string().optional(),
  [POSITION_KEYS.LIMIT_PRICE]: z.string().optional(),
});

export type OrderConfigJSON = z.infer<typeof OrderConfigJSONSchema>;

export default class OrderConfig<TOrder extends CoinbaseOrder = CoinbaseOrder> {
  private readonly _uuid: string;
  private readonly _base_size: string;
  private _order_id: string | null = null;
  private _order: Order<TOrder> | null = null;
  constructor(uuid: string, base_size: string, order_id: string | null = null) {
    if (UUID.validate(uuid)) {
      this._uuid = uuid;
    } else {
      throw new Error(`OrderConfig => uuid must be a valid uuid`);
    }
    safeNumber(base_size, 'OrderConfig => base_size', true);
    this._base_size = base_size;

    this._order_id = null;
    if (order_id) {
      this.order_id = order_id;
    }
    this._order = null;
  }

  get order_id() {
    if (this._order !== null) {
      return this._order.order_id;
    } else {
      return this._order_id;
    }
  }

  set order_id(order_id: string | null) {
    if (order_id === null) {
      this._order_id = null;
      return;
    }

    if (UUID.validate(order_id)) {
      this._order_id = order_id;
    } else {
      throw new Error(`OrderConfig => order_id must be a valid UUID`);
    }
  }

  get order(): Order<TOrder> | null {
    return this._order;
  }

  set order(order: Order<TOrder> | null) {
    this._order = order;
    this._order_id = order ? order.order_id : null;
  }

  hasOrder(): this is OrderConfig<TOrder> & { order: Order<TOrder> } {
    return this._order !== null;
  }

  /**
   * set the order and order_id properties to null
   */
  deleteOrder() {
    if (this._order !== null) {
      const order = this._order;
      this._order = null;
      this._order_id = null;
      return order;
    } else {
      throw new Error(`deleteOrder => config does not have an order`);
    }
  }

  toJSON() {
    const json: OrderConfigJSON = {
      [POSITION_KEYS.ORDER_ID]: this.order_id,
      [POSITION_KEYS.BASE_SIZE]: this._base_size,
      [POSITION_KEYS.UUID]: this._uuid,
    };

    if (this._order !== null) {
      json[ORDER_KEYS.STATUS] = this._order.status;
      json[ORDER_KEYS.FILLED_SIZE] = this._order.filled_size;
      json[ORDER_KEYS.FILLED_VALUE] = this._order.filled_value;
      json[ORDER_KEYS.AVERAGE_FILLED_PRICE] = this._order.fill_price;
    }

    return json;
  }

  static fromJSON(json: OrderConfigJSON) {
    return new OrderConfig(
      json[POSITION_KEYS.UUID],
      json[POSITION_KEYS.BASE_SIZE],
      json[POSITION_KEYS.ORDER_ID],
    );
  }

  static getUUID() {
    return UUID.v4();
  }
}
