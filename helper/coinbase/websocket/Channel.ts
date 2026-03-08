import { EventEmitter } from 'node:events';
import { WebsocketConnection } from './WebsocketConnection';
import { log } from '@core/logger.js';
import { signWithJWT } from '../signing.js';

class Channel extends EventEmitter {
  public readonly channel: string;

  private _product_ids: Map<string, number> = new Map();
  protected connection: WebsocketConnection;

  constructor(channel: string) {
    super();
    this.channel = channel;

    this.connection = new WebsocketConnection(this.channel);
    this.connection.on(this.channel, this.handleConnectionMessage.bind(this));
  }

  get product_ids() {
    return Array.from(this._product_ids.keys());
  }

  async initialize() {
    await this.connection.connect();
  }

  handleConnectionMessage(message: unknown): void {
    console.dir(message);
    throw new Error(`must override Channel handleConnectionMessage`);
  }

  subscribe(product_id: string) {
    if (this._product_ids.has(product_id)) {
      const currentCount = this._product_ids.get(product_id);
      if (currentCount) {
        this._product_ids.set(product_id, currentCount + 1);
        return;
      }
    }
    this._product_ids.set(product_id, 1);
    log.debug(`${this.channel} subscribing to ${product_id}`);
    const message = {
      type: 'subscribe',
      channel: this.channel,
      product_ids: this.product_ids,
    };
    const subscribeMsg = signWithJWT(message);
    this.connection.send(subscribeMsg);
  }

  unsubscribe(product_id: string) {
    if (this._product_ids.has(product_id)) {
      const currentCount = this._product_ids.get(product_id);
      if (!currentCount) {
        return;
      }
      if (currentCount === 1) {
        this._product_ids.delete(product_id);
        log.debug(`${this.channel} un-subscribing from ${product_id}`);
        const product_ids = [product_id];
        const message = {
          type: 'unsubscribe',
          channel: this.channel,
          product_ids,
        };
        const subscribeMsg = signWithJWT(message);
        this.connection.send(subscribeMsg);
      } else {
        this._product_ids.set(product_id, currentCount - 1);
      }
    }
  }

  cleanup() {
    log.debug(`${this.channel} cleanup`);
    if (this.connection.isConnected()) {
      // https://docs.cdp.coinbase.com/advanced-trade/docs/ws-overview#unsubscribing
      // "unsubscribe from a channel entirely by providing no product IDs"
      const message = {
        type: 'unsubscribe',
        channel: this.channel,
        product_ids: [],
      };
      const subscribeMsg = signWithJWT(message);
      this.connection.send(subscribeMsg);
    }

    this.connection.close();
  }
}

export default Channel;
