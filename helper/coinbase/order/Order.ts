import { EventEmitter } from 'node:events';
import userChannel from '../websocket/UserChannel';
import { ORDER_STATUS, ORDER_EVENT_NAMES } from '@core/dictionary';
import { log } from '@core/logger.js';
import { requestOrder, requestOrderCancellation } from '../http/rest.js';
import delay from '@core/delay';
import { readOrder, writeOrder } from '@order/service';
import { type CoinbaseWebsocketOrder, CoinbaseWebsocketOrderSchema } from '@cb/websocket/contracts';
import type { CoinbaseOrder } from '@cb/http/contracts';
import type { ZodType } from 'zod';

abstract class Order<TOrder extends CoinbaseOrder> extends EventEmitter {
  private isCancelling: boolean;
  private isCancelled: boolean;
  private readonly handleOrderEventBound: (...args: any[]) => void;
  private readonly schema: ZodType<TOrder>;
  protected _order: TOrder;
  constructor(order: TOrder, schema: ZodType<TOrder>) {
    super();
    this._order = schema.parse(order);
    this.isCancelling = false;
    this.isCancelled = false;
    this.handleOrderEventBound = this.handleOrderEvent.bind(this);
    this.schema = schema;
  }

  /*******************************************************************************************************************
   *                                                 Direct Order Access
   ******************************************************************************************************************/

  abstract get base_size(): string;

  getOrder(): TOrder {
    return this._order;
  }

  /**
   * Returns the order_id directly from the order
   */
  get order_id() {
    return this._order.order_id;
  }

  /**
   * Returns the product_id directly from the order
   */
  get product_id() {
    return this._order.product_id;
  }

  /**
   * Returns the status directly from the order
   */
  get status() {
    return this._order.status;
  }

  /**
   * The actual price at which the order was filled
   * Returns the average_filled_price directly from the order
   */
  get fill_price() {
    return this._order.average_filled_price;
  }

  /**
   * The actual money (sans fees)
   * Returns the filled_value directly from the order
   */
  get filled_value() {
    return this._order.filled_value;
  }

  /**
   * Returns the completion_percentage directly from the order
   */
  get completion_percentage() {
    return this._order.completion_percentage;
  }

  /**
   * The actual size of the position so far
   * Returns the filled_size directly from the order
   */
  get filled_size() {
    return this._order.filled_size;
  }

  /**
   * Return the total_fees directly from the order
   */
  get total_fees() {
    return this._order.total_fees;
  }

  /**
   * Return the total_value_after_fees directly from the order
   */
  get total_value_after_fees() {
    return this._order.total_value_after_fees;
  }

  /**
   * Return the last_fill_time directly from the order
   */
  get last_fill_time() {
    return this._order.last_fill_time;
  }

  /**
   * Return the side directly from the order
   */
  get side() {
    return this._order.side;
  }

  /*******************************************************************************************************************
   *                                                 Compound Getters
   ******************************************************************************************************************/

  /**
   * Invokes the status getter to check if the order is filled
   */
  get filled() {
    return this.status === ORDER_STATUS.FILLED;
  }

  /*******************************************************************************************************************
   *                                                  Order Subscription
   ******************************************************************************************************************/

  /**
   * subscribe to user channel updates for this order
   */
  subscribe() {
    userChannel.on(this.order_id, this.handleOrderEventBound);
  }

  unsubscribe() {
    userChannel.off(this.order_id, this.handleOrderEventBound);
  }

  /**
   * NOTE: this function receives objects from the websocket
   * https://docs.cdp.coinbase.com/advanced-trade/docs/ws-channels#user-channel
   */
  handleOrderEvent(order: CoinbaseWebsocketOrder) {
    // TODO probably unnecessary - this will have been parsed by UserChannel.handleConnectionMessage
    const parsedOrder = CoinbaseWebsocketOrderSchema.parse(order);

    // keep a copy of the old status for comparison
    const last_status = this.status;
    // update order properties so that they may be accurately read by the position,
    // even if no event is emitted
    this._order.status = parsedOrder.status;
    this._order.average_filled_price = parsedOrder.avg_price;
    this._order.filled_size = parsedOrder.cumulative_quantity;
    this._order.filled_value = parsedOrder.filled_value;
    this._order.completion_percentage = parsedOrder.completion_percentage;

    // there has been a status change in the order
    if (this.status !== last_status) {
      // if we are cancelling then there is no need to notify the position of the status change
      if (this.isCancelling) {
        // the other expected status is CANCELLED_PENDING, which is ignored
        if (this.status === ORDER_STATUS.CANCELLED) {
          // this will free up the delay loop in Order.cancel
          this.isCancelled = true;
        }
      } else {
        // notify the position that the order status has changed
        this.emit(ORDER_EVENT_NAMES.STATUS_CHANGE, {
          order_id: this.order_id,
          status: this.status,
        });
      }
    }
  }

  /**
   * read the order from the server and update internal model
   */
  async update() {
    const latest = await readOrder(this.order_id, true, false, false, false);
    this._order = this.schema.parse(latest);
  }

  /**
   * send cancel request
   * wait for 10 seconds checking isCancelled
   * unsubscribe
   */
  async cancel(positionName: string) {
    this.isCancelling = true;
    await requestOrderCancellation(this.order_id);

    await delay();
    let orderFromServer = await requestOrder(this.order_id);
    for (let i = 0; i < 60; i++) {
      if (orderFromServer.status === ORDER_STATUS.CANCELLED) {
        log.warn(`${positionName}: Order from server is ${ORDER_STATUS.CANCELLED}`);
        this.isCancelled = true;
        break;
      }
      await delay();
      // Poll the server because we may not get the update from the websocket
      orderFromServer = await requestOrder(this.order_id);
    }

    if (this.isCancelled) {
      log.warn(`${positionName}: ${this.order_id} was cancelled`);
      await writeOrder(orderFromServer, true, true);
    } else {
      throw new Error('Order cancellation failed');
    }

    this.unsubscribe();
  }

  /**
   * @param positionName - the name of the position (for logging)
   */
  async awaitCompletion(positionName: string) {
    let wait = true;
    let delays = 0;
    let maxDelays = 10;
    let delayMs = 6 * 1000; // 6 seconds * 10 delays = 1 minute

    do {
      const completionPercentage = parseFloat(this.completion_percentage);
      if (completionPercentage === 100) {
        log.info(`${positionName}: ${this.order_id} is complete`);
        wait = false;
        await writeOrder(this._order, true, true);
      } else {
        log.info(`${positionName}: ${this.order_id} completion is ${completionPercentage}%`);
        if (++delays < maxDelays) {
          await delay(delayMs);
          await this.update();
        } else {
          throw new Error(`Order ${this.order_id} is not complete (${this.completion_percentage})`);
        }
      }
    } while (wait);
  }
}

export default Order;
