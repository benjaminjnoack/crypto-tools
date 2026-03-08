import { CHANNEL_NAMES } from '@core/dictionary.js';
import { log } from '@core/logger.js';
import Channel from './Channel';
import {
  type Ticker,
  type TickerBatchEvents,
  TickerBatchEventsSchema,
} from '@cb/websocket/contracts';

class TickerChannel extends Channel {
  private tickers: Record<string, Ticker> = {};

  constructor() {
    super(CHANNEL_NAMES.ticker_batch);
  }

  handleConnectionMessage(message: unknown): void {
    const events: TickerBatchEvents = TickerBatchEventsSchema.parse(message);

    for (const event of events) {
      const tickers = event.tickers;
      for (const ticker of tickers) {
        const last_ticker = this.tickers[ticker.product_id] || { price: null };

        if (last_ticker.price !== ticker.price) {
          this.tickers[ticker.product_id] = ticker;
          log.debug(`${this.channel}: ${ticker.product_id} ${ticker.price}`);
          this.emit(ticker.product_id, ticker);
        }
      }
    }
  }
}

const tickerChannel = new TickerChannel();

export default tickerChannel;
