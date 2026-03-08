import { CHANNEL_NAMES } from '@core/dictionary';
import { log } from '@core/logger.js';
import Channel from './Channel';
import { signWithJWT } from '../signing.js';
import { type UserEvents, UserEventsSchema } from '@cb/websocket/contracts';

class UserChannel extends Channel {
  constructor() {
    super(CHANNEL_NAMES.user);
  }

  async initialize() {
    await super.initialize();

    // Subscribe to an empty array of product_ids to subscribe to all products
    const message = {
      type: 'subscribe',
      channel: this.channel,
      product_ids: this.product_ids,
    };
    const subscribeMsg = signWithJWT(message);
    this.connection.send(subscribeMsg);
  }

  handleConnectionMessage(message: unknown): void {
    const events: UserEvents = UserEventsSchema.parse(message);

    events.forEach(({ orders }) => {
      orders.forEach((order) => {
        log.debug(`${this.channel}: ${order.order_id} ${order.status}`);
        this.emit(order.order_id, order);
      });
    });
  }
}

const userChannel = new UserChannel();

export default userChannel;
