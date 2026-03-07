import { requestOrderCancellation } from '../http/rest.js';
import UserChannel from '../websocket/UserChannel.mjs';
import { ORDER_KEYS, ORDER_STATUS } from '@core/dictionary.ts';
import { log } from '@core/logger.js';
import delay from '@core/delay.ts';
import userChannel from '../websocket/UserChannel.mjs';

const order_id = 'd4d22145-7233-4e78-8728-b71051dcc2d5';

await UserChannel.initialize();
await delay();

class CancelOrder {
  constructor() {
    this.order_id = order_id;
    this.isCancelling = false;
    this.isCancelled = false;
    this.handleOrderEventBound = this.handleOrderEvent.bind(this);
    this.subscribe();
  }

  subscribe() {
    userChannel.on(this.order_id, this.handleOrderEventBound);
  }

  unsubscribe() {
    userChannel.off(this.order_id, this.handleOrderEventBound);
  }

  handleOrderEvent(order) {
    const status = order[ORDER_KEYS.STATUS];
    if (typeof status !== 'string') {
      throw new Error(`Order status must be a string`);
    }

    if (this.isCancelling) {
      if (status === ORDER_STATUS.CANCELLED) {
        log.warn(`${this.order_id} was cancelled`);
        this.isCancelled = true;
      }
    }
  }

  async cancel() {
    this.isCancelling = true;
    await requestOrderCancellation(this.order_id);

    for (let i = 0; i < 10; i++) {
      await delay();
      if (this.isCancelled) {
        break;
      }
    }

    if (!this.isCancelled) {
      throw new Error('Order cancellation failed');
    } else {
      log.info(`order has been cancelled`);
    }

    this.unsubscribe();
  }
}

const co = new CancelOrder();
await co.cancel();
await UserChannel.cleanup();
