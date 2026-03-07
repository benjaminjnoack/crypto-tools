import { EventEmitter } from 'node:events';
import PositionLogger from './PositionLogger.mjs';
import {
  ORDER_EVENT_NAMES,
  ORDER_KEYS,
  ORDER_SIDE,
  ORDER_STATUS,
  POSITION_KEYS,
  POSITION_STATUS,
} from '@core/dictionary.ts';
import LimitBuyOrder from '@cb/order/LimitBuyOrder.ts';
import AccountManager from '@cb/accounts/AccountManager';
import Account from '@cb/accounts/Account';
import delay from '@core/delay.ts';
import MarketOrder from '@cb/order/MarketOrder.ts';
import Product from '@cb/Product';
import { toIncrement } from './lib/increment.js';
import { sendMail } from '@core/email.ts';
import BracketSellOrder from '@cb/order/BracketSellOrder.ts';
import { requestBestBidAsk, requestCurrencyAccount, requestProduct } from '@cb/http/rest.js';
import { deletePosition, loadPosition, savePosition } from './lib/cache.js';
import LimitBuyOrderConfig from '@cb/order/config/LimitBuyOrderConfig.ts';
import OrderConfigMap from '@cb/order/config/OrderConfigMap.ts';
import BracketSellOrderConfig from '@cb/order/config/BracketSellOrderConfig.ts';
import MarketOrderConfig from '@cb/order/config/MarketOrderConfig.ts';
import OrderConfig from '@cb/order/config/OrderConfig.ts';
import * as UUID from 'uuid';
import { addStringNumbersWithPrecision, splitBaseSizeEqually } from '@core/precision.ts';
import { getSchedulePrices } from './lib/schedule.js';
import { safeNumber } from '@core/validation.ts';
import tickerChannel from './coinbase/websocket/TickerChannel';
import { createBracketOrder, createLimitOrder, createMarketOrder } from '@cb/order/service.ts';
import { loadOrder } from '@cb/order/service.ts';
import { writeOrder } from '@order/service.ts';

const DUMMY_CONFIG_VALUE = '0';
const DEFAULT_PNL = '+/-';

class Position extends EventEmitter {
  /**
   * NOTE: this constructor must not have any side effects as it is used to test new positions in the SIGUSR2 handler
   * @param positionName {string}
   */
  constructor(positionName) {
    super();
    this.positionName = positionName;
    this.logger = new PositionLogger(this.positionName);

    this.product_id = null;
    this.currency = null;
    this.tickerId = null;
    this.price = null;
    this.account = null;
    this.product = null;
    this.finalPnL = null;

    /**
     * @type {boolean}
     */
    this.isExecuting = false;
    /**
     * @type {boolean}
     */
    this.isCancelled = false;
    /**
     * @type {boolean}
     */
    this.isComplete = false;
    /**
     * @type {boolean}
     */
    this.hasTickerSubscription = false;

    /**
     * @type {string[]}
     */
    this.log = [];
    /**
     * A map of the target => stop
     * @type {Map<string, string>}
     */
    this.trails = new Map();

    /**
     * @type {OrderConfigMap<string, LimitBuyOrderConfig>}
     */
    this.limitBuyOrderConfigs = new OrderConfigMap();
    /**
     * @type {OrderConfigMap<string, BracketSellOrder>}
     */
    this.bracketSellOrderConfigs = new OrderConfigMap();
    /**
     * @type {OrderConfigMap<string, MarketOrder>}
     */
    this.marketSellOrderConfigs = new OrderConfigMap();

    this.handleBuyOrderStatusChangeBound = this.handleBuyOrderStatusChange.bind(this);
    this.handleSellOrderStatusChangeBound = this.handleSellOrderStatusChange.bind(this);
    this.handleTickerBound = this.handleTicker.bind(this);
  }

  /**
   * Returns all orders sorted chronologically from first to last based on last_fill_time.
   * @returns {Array<Order>} - Sorted array of orders.
   */
  getChronologicalOrders() {
    return [
      ...this.limitBuyOrderConfigs.getOrdersByStatus(ORDER_STATUS.FILLED),
      ...this.marketSellOrderConfigs.getOrdersByStatus(ORDER_STATUS.FILLED),
      ...this.bracketSellOrderConfigs.getOrdersByStatus(ORDER_STATUS.FILLED),
    ].sort((a, b) => new Date(a.last_fill_time) - new Date(b.last_fill_time));
  }

  /**
   * @returns {{name: string, fills: {class: string, side, order_id, filled_value: *, total_fees: *, total_value_after_fees: *}[], totals: {value_bought: string, buy_fees: string, value_sold: string, sell_fees: string, total_fees: string, total: string}}}
   */
  getChronologicalOrderSummary() {
    const orders = this.getChronologicalOrders();

    const valueBought = [];
    const buyFees = [];
    const valueSold = [];
    const sellFees = [];

    const fills = orders.map((order) => {
      let orderClass = 'UnknownOrder'; // Default in case an order type isn't recognized

      if (order instanceof LimitBuyOrder) {
        orderClass = 'LimitBuyOrder';
      } else if (order instanceof BracketSellOrder) {
        orderClass = 'BracketSellOrder';
      } else if (order instanceof MarketOrder) {
        orderClass = 'MarketOrder';
      }

      const filledValue = Number(order.filled_value) || 0;
      const fees = Number(order.total_fees) || 0;
      const valueAfterFees = Number(order.total_value_after_fees) || 0;

      /**
       * with a buy order, the total value after fees is the filled_value + total fees
       * with a sell order, the total value after fees is the filled_value - total fees
       */
      // Track running totals
      if (order.side === 'BUY') {
        valueBought.push(valueAfterFees);
        buyFees.push(fees);
      } else if (order.side === 'SELL') {
        valueSold.push(filledValue);
        sellFees.push(fees);
      }

      return {
        class: orderClass,
        side: order.side || 'N/A',
        order_id: order.order_id || 'N/A',
        filled_value: filledValue.toFixed(2),
        total_fees: fees.toFixed(2),
        total_value_after_fees: valueAfterFees.toFixed(2),
      };
    });
    //TODO BUG: where the final bracket order total fees and total value after fees is 0
    const numValueBought = addStringNumbersWithPrecision(valueBought, '0.01');
    const numBuyFees = addStringNumbersWithPrecision(buyFees, '0.01');
    const numValueSold = addStringNumbersWithPrecision(valueSold, '0.01');
    const numSellFees = addStringNumbersWithPrecision(sellFees, '0.01');
    const totalFees = numBuyFees + numSellFees;

    let total = '?';
    if (this.isComplete) {
      total = (numValueSold - numValueBought).toFixed(2);
    }

    return {
      name: this.positionName,
      fills,
      totals: {
        value_bought: numValueBought.toFixed(2),
        buy_fees: numBuyFees.toFixed(2),
        value_sold: numValueSold.toFixed(2),
        sell_fees: numSellFees.toFixed(2),
        total_fees: totalFees.toFixed(2),
        total: total,
      },
    };
  }

  /**
   * @returns {{name: string, fills: {class: string, side, order_id, filled_value: *, total_fees: *, total_value_after_fees: *}[], totals: {value_bought: string, buy_fees: string, value_sold: string, sell_fees: string, total_fees: string, total: string}}}
   */
  fills() {
    return this.getChronologicalOrderSummary();
  }

  /*******************************************************************************************************************
   *                                          Position Management
   ******************************************************************************************************************/

  /**
   * @param {string} product
   * @param {string} buyPrice
   * @param {string} value
   * @param {string} takeProfitPrice
   * @param {string} stopPrice
   * @returns {Promise<void>}
   */
  async prep(product, buyPrice, value, takeProfitPrice, stopPrice) {
    if (this.isExecuting) {
      throw new Error(`prep => ${this.positionName} is already executing`);
    }
    await this.initializeProduct(Product.getProductId(product)); // Throws error if already set

    const numBuyPrice = safeNumber(buyPrice, `prep => buyPrice`);
    const numValue = safeNumber(value, `prep => value`);
    const numTakeProfitPrice = safeNumber(takeProfitPrice, `prep => takeProfitPrice`);
    const numStopPrice = safeNumber(stopPrice, `prep => stopPrice`);

    buyPrice = this.toPriceIncrement(numBuyPrice);
    const baseSize = this.getBaseSize(numValue, numBuyPrice);
    takeProfitPrice = this.toPriceIncrement(numTakeProfitPrice);
    stopPrice = this.toPriceIncrement(numStopPrice);

    this.open_date = Position.getRecordDate();
    const limitBuyOrderConfig = new LimitBuyOrderConfig(OrderConfig.getUUID(), baseSize, buyPrice);
    this.limitBuyOrderConfigs.set(limitBuyOrderConfig.uuid, limitBuyOrderConfig);
    const bracketSellOrderConfig = new BracketSellOrderConfig(
      OrderConfig.getUUID(),
      baseSize,
      takeProfitPrice,
      stopPrice,
    );
    this.bracketSellOrderConfigs.set(bracketSellOrderConfig.uuid, bracketSellOrderConfig);
    this.saveJSON();
  }

  /**
   * @param {string} product
   * @param {string} buyPrice
   * @param {string} value
   * @param {string} stopPrice
   * @param {string} schedule
   * @param {string|null} zeroPrice
   * @param {string} onePrice
   * @returns {Promise<void>}
   */
  async prepWithSchedule(product, buyPrice, value, stopPrice, schedule, zeroPrice, onePrice) {
    if (this.isExecuting) {
      throw new Error(`prep => ${this.positionName} is already executing`);
    }
    await this.initializeProduct(Product.getProductId(product)); // Throws error if already set

    const numBuyPrice = safeNumber(buyPrice, `prepWithSchedule => buyPrice`);
    const numValue = safeNumber(value, `prepWithSchedule => value`);
    const numStopPrice = safeNumber(stopPrice, `prepWithSchedule => stopPrice`);

    buyPrice = this.toPriceIncrement(numBuyPrice);
    const baseSize = this.getBaseSize(numValue, numBuyPrice);
    stopPrice = this.toPriceIncrement(numStopPrice);

    this.open_date = Position.getRecordDate();
    const limitBuyOrderConfig = new LimitBuyOrderConfig(OrderConfig.getUUID(), baseSize, buyPrice);
    this.limitBuyOrderConfigs.set(limitBuyOrderConfig.uuid, limitBuyOrderConfig);
    await this.setSchedule(schedule, zeroPrice, onePrice, stopPrice);
    this.saveJSON();
  }

  async exec() {
    if (this.isComplete) {
      throw new Error(`exec => ${this.positionName} is already complete`);
    } else if (this.isCancelled) {
      throw new Error(`exec => ${this.positionName} is already cancelled`);
    } else if (this.isExecuting) {
      throw new Error(`exec => ${this.positionName} is already executing`);
    }
    this.isExecuting = true;
    this.saveJSON();

    const productPrice = await this.getProductPrice();
    for (const limitBuyOrderConfig of this.limitBuyOrderConfigs.values()) {
      await this.placeLimitBuyOrder(limitBuyOrderConfig, productPrice);
    }
    await this.mailState('Position Executed');
    this.saveJSON();
    this.subscribeToTicker();
  }

  /**
   * @param {string} product
   * @param {string} buyPrice
   * @param {string} value
   * @param {string} takeProfitPrice
   * @param {string} stopPrice
   * @returns {Promise<void>}
   */
  async open(product, buyPrice, value, takeProfitPrice, stopPrice) {
    await this.prep(product, buyPrice, value, takeProfitPrice, stopPrice);
    await this.exec();
  }

  /**
   * @param {string|null} buyPrice
   * @param {string|null} stopPrice
   * @param {string|null} targetPrice
   * @param {string|null} orderId
   * @returns {Promise<{errors: string[], modified: string[]}>}
   */
  async modify(buyPrice, stopPrice, targetPrice, orderId) {
    if (this.isCancelled) {
      throw new Error(`modify => position is already cancelled`);
    } else if (this.isComplete) {
      throw new Error(`modify => position is already complete`);
    }

    const productPrice = await this.getProductPrice();

    const modified = [];
    const errors = [];
    if (buyPrice) {
      try {
        const config = await this.modifyBuyOrder(buyPrice, productPrice, orderId);
        modified.push(config.uuid);
      } catch (e) {
        this.logger.error(e.message);
        errors.push(e.message);
      }
    }

    if (targetPrice) {
      // There may be a stop price
      try {
        const config = await this.modifySellOrder(targetPrice, stopPrice, productPrice, orderId);
        modified.push(config.uuid);
      } catch (e) {
        this.logger.error(e.message);
        errors.push(e.message);
      }
    } else if (stopPrice) {
      // There is only a stop price
      try {
        const configs = await this.setStopPrice(stopPrice, productPrice, orderId);
        configs.forEach((config) => modified.push(config.uuid));
      } catch (e) {
        this.logger.error(e.message);
        errors.push(e.message);
      }
    }

    await this.mailState('Position Modified');
    this.saveJSON();
    return {
      errors,
      modified,
    };
  }

  async breakEven() {
    if (this.isCancelled) {
      throw new Error(`breakEven => position is already cancelled`);
    } else if (this.isComplete) {
      throw new Error(`breakEven => position is already complete`);
    }
    if (!this.isExecuting) {
      throw new Error(`breakEven => position is not executing`);
    }

    if (this.limitBuyOrderConfigs.getNumberOfConfigsWithOrdersByStatus(ORDER_STATUS.FILLED) === 0) {
      throw new Error(`breakEven => nothing has been bought`);
    }

    if (!this.bracketSellOrderConfigs.hasOpenOrders()) {
      throw new Error(`breakEven => there are no open sell orders`);
    }

    /**
     * The current fees are 0.15% for the limit buy and 0.25% for the bracket stop which is a market sell.
     * We're covering the bare minimum here and nothing extra.
     */
    const averageBuyFillPrice = this.limitBuyOrderConfigs.getAverageFillPrice(
      this.product.base_increment,
      this.product.price_increment,
    );
    const numStopPrice = averageBuyFillPrice * 1.004;
    const stopPrice = this.toPriceIncrement(numStopPrice);

    const productPrice = await this.getProductPrice();
    const numProductPrice = safeNumber(productPrice, 'breakEven => productPrice');
    if (numStopPrice > numProductPrice) {
      throw new Error(
        `breakEven => cannot set new stop ${stopPrice} above current market price ${productPrice}`,
      );
    }

    for (const bracketSellOrderConfig of this.bracketSellOrderConfigs.values()) {
      if (bracketSellOrderConfig.hasOrder()) {
        if (bracketSellOrderConfig.order.filled) {
          this.logger.warn(
            `breakEven => cannot set new stop price on filled bracket sell order ${bracketSellOrderConfig.order.order_id}`,
          );
        } else {
          await this.cancelSellOrder(bracketSellOrderConfig, true);

          bracketSellOrderConfig.stop_price = stopPrice;
          this.saveJSON();

          await this.waitUntilSizeToSellAvailable();
          await this.placeBracketSellOrder(bracketSellOrderConfig, productPrice);
        }
      } else {
        bracketSellOrderConfig.stop_price = stopPrice;
      }
    }

    await this.mailState('Position Break Even');
    this.saveJSON();
  }

  /**
   * Add a new bracket sell order config using the common stop, then re-size
   * @param {string} takeProfitPrice
   * @returns {Promise<void>}
   */
  async takeProfit(takeProfitPrice) {
    const productPrice = await this.getProductPrice();
    if (Number(productPrice) > Number(takeProfitPrice)) {
      throw new Error(
        `takeProfit => cannot set take profit price ${takeProfitPrice} below market price ${productPrice}`,
      );
    }

    const stopPrice = this.findCommonStopPrice();
    // Place the new take-profit bracket sell order
    const takeProfitBracketSellOrderConfig = new BracketSellOrderConfig(
      OrderConfig.getUUID(),
      DUMMY_CONFIG_VALUE, // DUMMY BASE SIZE
      takeProfitPrice,
      stopPrice,
    );
    this.bracketSellOrderConfigs.set(
      takeProfitBracketSellOrderConfig.uuid,
      takeProfitBracketSellOrderConfig,
    );
    await this.reSizeBracketSellOrders(productPrice);
  }

  /**
   * @param {string} stopLossPrice
   * @param {string} targetPrice
   * @return {Promise<void>}
   */
  async trail(stopLossPrice, targetPrice) {
    const productPrice = await this.getProductPrice();
    const numProductPrice = safeNumber(productPrice, 'trail => productPrice');
    const numStopPrice = safeNumber(stopLossPrice, 'trail => stopLossPrice');
    const numTakeProfitPrice = safeNumber(targetPrice, 'trail => targetPrice');
    if (numStopPrice >= numProductPrice) {
      throw new Error(
        `trail => cannot set stop price (${stopLossPrice}) above market price (${productPrice})`,
      );
    } else if (numTakeProfitPrice <= numProductPrice) {
      throw new Error(
        `trail => cannot set take profit price (${targetPrice}) below market price (${productPrice})`,
      );
    }
    this.logger.info(`trail => setting ${stopLossPrice} ${targetPrice}`);
    this.trails.set(targetPrice, stopLossPrice);
    this.saveJSON();
  }

  /**
   * Cancel the buy order if it has not been filled.
   * Cancel the sell order if it has not been filled.
   * Bracket sell the remaining size at the current asking price
   * @returns {Promise<void>}
   */
  async ask() {
    if (this.isComplete) {
      this.logger.warn(`ask => position is already complete`);
      return;
    } else if (this.isCancelled) {
      this.logger.warn(`ask => position is already cancelled`);
      return;
    }

    // Before everything, make sure we have the asking price
    const { asks } = await requestBestBidAsk(this.product_id);
    const askPrice = asks[0]['price'];
    safeNumber(askPrice, 'ask => askPrice');

    if (this.limitBuyOrderConfigs.allOrdersAreStatus(ORDER_STATUS.FILLED)) {
      this.logger.warn(`ask => all buy orders have been filled`);
    } else {
      for (const limitBuyOrderConfig of this.limitBuyOrderConfigs.values()) {
        if (limitBuyOrderConfig.hasOrder()) {
          if (!limitBuyOrderConfig.order.filled) {
            await this.cancelBuyOrder(limitBuyOrderConfig, false);
          }
        }
      }

      if (this.limitBuyOrderConfigs.getTotalFilledSize(this.product.base_increment) === 0) {
        this.logger.info(`ask => nothing was bought`);
        return this.complete('Closed with nothing bought', true, false);
      }
    }

    if (this.bracketSellOrderConfigs.allOrdersAreStatus(ORDER_STATUS.FILLED)) {
      throw new Error(`ask => all sell orders have been filled`);
    } else {
      const stopPrice = this.findCommonStopPrice();
      for (const bracketSellOrderConfig of this.bracketSellOrderConfigs.values()) {
        if (bracketSellOrderConfig.hasOrder()) {
          if (!bracketSellOrderConfig.order.filled) {
            await this.cancelSellOrder(bracketSellOrderConfig, false);
          }
        }
      }
      this.pruneBracketSellOrderConfigs();

      const baseSize = await this.waitUntilSizeToSellAvailable();

      const bracketSellOrderConfig = new BracketSellOrderConfig(
        OrderConfig.getUUID(),
        baseSize,
        askPrice,
        stopPrice,
      );
      this.bracketSellOrderConfigs.set(bracketSellOrderConfig.uuid, bracketSellOrderConfig);
      await this.placeBracketSellOrder(bracketSellOrderConfig);
    }
  }

  /**
   * Cancel the buy order if it has not been filled.
   * Cancel the sell order if it has not been filled, and market sell the remaining size
   * @returns {Promise<void>}
   */
  async sell() {
    if (this.isComplete) {
      this.logger.warn(`sell => position is already complete`);
      return;
    } else if (this.isCancelled) {
      this.logger.warn(`sell => position is already cancelled`);
      return;
    }

    if (this.limitBuyOrderConfigs.allOrdersAreStatus(ORDER_STATUS.FILLED)) {
      this.logger.warn(`sell => all buy orders have been filled`);
    } else {
      for (const limitBuyOrderConfig of this.limitBuyOrderConfigs.values()) {
        if (limitBuyOrderConfig.hasOrder()) {
          if (!limitBuyOrderConfig.order.filled) {
            await this.cancelBuyOrder(limitBuyOrderConfig, false);
          }
        }
      }

      if (this.limitBuyOrderConfigs.getTotalFilledSize(this.product.base_increment) === 0) {
        this.logger.info(`sell => nothing was bought`);
        return this.complete('Closed with nothing bought', true, false);
      }
    }

    if (this.bracketSellOrderConfigs.allOrdersAreStatus(ORDER_STATUS.FILLED)) {
      throw new Error(`sell => all sell orders have been filled`);
    } else {
      for (const bracketSellOrderConfig of this.bracketSellOrderConfigs.values()) {
        if (bracketSellOrderConfig.hasOrder()) {
          if (!bracketSellOrderConfig.order.filled) {
            await this.cancelSellOrder(bracketSellOrderConfig, false);
          }
        }
      }
      const baseSize = await this.waitUntilSizeToSellAvailable();
      const marketSellOrderConfig = new MarketOrderConfig(OrderConfig.getUUID(), baseSize);
      this.marketSellOrderConfigs.set(marketSellOrderConfig.uuid, marketSellOrderConfig);
      this.logger.warn(`sell => market selling ${marketSellOrderConfig.base_size}`);
      await this.placeMarketSellOrder(marketSellOrderConfig);
    }

    await this.complete('Closed with Market Sale', true, false);
  }

  /**
   * @param {string} reason
   * @returns {Promise<void>}
   */
  async cancel(reason) {
    if (this.isComplete) {
      this.logger.warn(`cancel => position is already complete`);
      return;
    } else if (this.isCancelled) {
      this.logger.warn(`cancel => position is already cancelled`);
      return;
    }

    if (this.limitBuyOrderConfigs.getNumberOfConfigsWithOrders() === 0) {
      if (this.bracketSellOrderConfigs.getNumberOfConfigsWithOrders() === 0) {
        this.logger.warn(`cancel => there are no orders`);
        return this.complete(`Position Without Orders Cancelled by ${reason}`, false, true);
      }
    }

    let cancelledBuyOrder = false;
    for (const limitBuyOrderConfig of this.limitBuyOrderConfigs.values()) {
      if (limitBuyOrderConfig.hasOrder()) {
        if (limitBuyOrderConfig.order.filled) {
          this.logger.warn(`cancel => buy order has already been filled`);
        } else {
          await this.cancelBuyOrder(limitBuyOrderConfig, false);
          cancelledBuyOrder = true;
        }
      }
    }

    let cancelledSellOrder = false;
    for (const bracketSellOrderConfig of this.bracketSellOrderConfigs.values()) {
      if (bracketSellOrderConfig.hasOrder()) {
        if (bracketSellOrderConfig.order.filled) {
          this.logger.warn(`cancel => sell order has already been filled`);
        } else {
          await this.cancelSellOrder(bracketSellOrderConfig, false);
          cancelledSellOrder = true;
        }
      }
    }

    if (!cancelledBuyOrder && !cancelledSellOrder) {
      throw new Error(`cancel: cannot find any orders to cancel`);
    }

    return this.complete(`All Open Orders Cancelled by ${reason}`, false, true);
  }

  /**
   * @param {string} reason
   * @param {boolean} completed
   * @param {boolean} cancelled
   * @returns {Promise<void>}
   */
  async complete(reason, completed, cancelled) {
    if (this.isComplete) {
      this.logger.warn(`complete => position already complete`);
      return;
    } else if (this.isCancelled) {
      this.logger.warn(`complete => position already cancelled`);
      return;
    } else if (completed) {
      this.isComplete = true;
    } else if (cancelled) {
      this.isCancelled = true;
    } else {
      throw new Error(`complete => position must be either completed or cancelled`);
    }
    this.close_date = Position.getRecordDate();
    await this.saveJSON();
    await deletePosition(this.positionName);
    if (this.isExecuting) {
      await this.mailState(`Complete: ${reason}`);
    }
    this.unsubscribeFromTicker();
  }

  /**
   * @param {string} schedule
   * @param {string|null} zeroPrice
   * @param {string} onePrice
   * @param {string|null} stopPrice
   * @returns {Promise<void>}
   */
  async setSchedule(schedule, zeroPrice, onePrice, stopPrice = null) {
    if (zeroPrice === null) {
      this.logger.warn(`setSchedule => zeroPrice is null; finding the common stop...`);
      zeroPrice = this.findCommonStopPrice();
    }
    const allSchedulePrices = getSchedulePrices(
      schedule,
      zeroPrice,
      onePrice,
      this.product.price_increment,
    );

    let schedulePrices;
    const productPrice = await this.getProductPrice();
    const hasSizeToSell = this.getSizeToSell();

    /**
     * Cancel all OPEN sell orders.
     * This will do nothing in the case that nothing has been bought yet
     */
    await this.cancelAllOpenBracketSellOrders();

    // We cannot use schedule prices which are below the current market price
    // IF we have to be selling right now, because they would be immediately filled at the current market price
    // ELSE, we have nothing to sell, so we can use all schedule prices, because they SHOULD be above the buy price
    // TODO there is no logic to ensure that sell prices are below the buy price!
    if (hasSizeToSell) {
      this.logger.info('setSchedule => has size to Sell');
      const numCurrentPrice = Number(productPrice);
      schedulePrices = allSchedulePrices.filter(
        (schedulePrice) => Number(schedulePrice) > numCurrentPrice,
      );
      if (schedulePrices.length === 0) {
        throw new Error(
          `setSchedule => all schedule prices are below current price ${productPrice}`,
        );
      }
    } else {
      this.logger.info('setSchedule => nothing to sell');
      schedulePrices = allSchedulePrices;
    }

    if (!stopPrice) {
      stopPrice = this.findCommonStopPrice();
    }

    this.pruneBracketSellOrderConfigs();

    /**
     * Create a new bracket sell order config for all the schedule prices.
     * There is a dummy base size value on the ASSUMPTION that reSizeBracketSellOrders will set the base size as necessary
     */
    schedulePrices.forEach((limitPrice) => {
      const bracketSellOrderConfig = new BracketSellOrderConfig(
        OrderConfig.getUUID(),
        DUMMY_CONFIG_VALUE, // DUMMY BASE SIZE
        limitPrice,
        stopPrice,
      );
      this.bracketSellOrderConfigs.set(bracketSellOrderConfig.uuid, bracketSellOrderConfig);
    });

    // 3. **Save updated configurations to disk**
    this.saveJSON();

    // 4. **Recalculate and reallocate sizes to sell orders**
    if (hasSizeToSell) {
      await this.reSizeBracketSellOrders(productPrice);
    }
  }

  clear() {
    if (this.isComplete) {
      this.logger.warn(`clear => is complete`);
    } else if (this.isCancelled) {
      this.logger.warn(`clear => is cancelled`);
    } else {
      throw new Error(`clear => ${this.positionName} is not complete or cancelled`);
    }
    this.saveJSON();

    this.logger.warn(`close => turning off limit buy order config status change handlers`);
    for (const config of this.limitBuyOrderConfigs.values()) {
      if (config.hasOrder()) {
        config.order.off(ORDER_EVENT_NAMES.STATUS_CHANGE, this.handleBuyOrderStatusChangeBound);
      }
    }
    this.logger.warn(`close => turning off bracket sell order config status change handlers`);
    for (const config of this.bracketSellOrderConfigs.values()) {
      if (config.hasOrder()) {
        config.order.off(ORDER_EVENT_NAMES.STATUS_CHANGE, this.handleBuyOrderStatusChangeBound);
      }
    }
  }

  /*******************************************************************************************************************
   *                                            ACCOUNT
   ******************************************************************************************************************/

  /**
   * @param {boolean} forceAccountRefresh
   * @returns {Promise<void>}
   */
  async initializeAccount(forceAccountRefresh = false) {
    if (this.hasAccount()) {
      return this.account.update();
    } else {
      const account = await AccountManager.getAccountByCurrency(this.currency, forceAccountRefresh);
      this.account = new Account(account);
    }
  }

  /**
   * Returns true if the account is not null
   * @returns {boolean}
   */
  hasAccount() {
    return this.account !== null;
  }

  /**
   * Wait until value is available from the USD account
   * @param {string} value
   * @returns {Promise<void>}
   */
  async waitUntilUsdAvailable(value) {
    const numValue = safeNumber(value, 'waitUntilUsdAvailable => value');

    let { available } = await requestCurrencyAccount('USD', '0.01');
    let numAvailable = safeNumber(available, 'waitUntilUsdAvailable => available');
    this.logger.info(`USD available: ${numAvailable}`);
    let attempts = 0;
    while (numAvailable < numValue) {
      if (++attempts > 10) {
        throw new Error('waitUntilUsdAvailable => exceeded max attempts');
      }
      await delay();
      ({ available } = await requestCurrencyAccount('USD', '0.01'));
      numAvailable = safeNumber(available, 'waitUntilUsdAvailable => available');
      this.logger.info(`USD available: ${numAvailable}`);
    }
  }

  /*******************************************************************************************************************
   *                                            PRODUCT
   ******************************************************************************************************************/

  /**
   * @param {string} productId Capitalized, of the form XXX-USD
   */
  async initializeProduct(productId) {
    if (this.product_id !== null) {
      throw new Error(`setProductIdAndDerived => already have product id ${this.product_id}`);
    }
    this.product_id = productId;
    this.currency = this.product_id.split('-')[0];
    // this.tickerId = `${this.currency}-USD`;// TODO DEPRECATED: Ticker information is not available in USD
    this.tickerId = productId;

    this.product = new Product(this.product_id);
    await this.product.update();
  }

  /**
   * @param {number} price
   * @returns {string}
   */
  toPriceIncrement(price) {
    return toIncrement(this.product.price_increment, price);
  }

  /**
   * @param {number} size
   * @returns {string}
   */
  toSizeIncrement(size) {
    return toIncrement(this.product.base_increment, size);
  }

  /**
   * @param {number} value
   * @param {number} buyPrice
   */
  getBaseSize(value, buyPrice) {
    return this.toSizeIncrement(value / buyPrice);
  }

  /**
   * @return {Promise<string>}
   */
  async getProductPrice() {
    if (this.price) {
      return this.price;
    } else {
      this.logger.warn(`getProductPrice => missing price`);
      const { price } = await requestProduct(this.product_id);
      return price;
    }
  }

  /*******************************************************************************************************************
   *                                            FILE SYSTEM
   ******************************************************************************************************************/

  /**
   * @param {boolean} forceUpdate
   * @returns {Promise<void>}
   */
  async initialize(forceUpdate = false) {
    const json = loadPosition(this.positionName);

    if (typeof json !== 'object') {
      throw new Error(`cannot parse position`);
    }

    if (Object.hasOwn(json, POSITION_KEYS.OPEN_DATE)) {
      this.open_date = json[POSITION_KEYS.OPEN_DATE];
    } else {
      this.open_date = Position.getRecordDate();
    }

    if (Object.hasOwn(json, POSITION_KEYS.CLOSE_DATE) && json[POSITION_KEYS.CLOSE_DATE]) {
      //empty string check
      this.close_date = json[POSITION_KEYS.CLOSE_DATE];
    }

    if (Object.hasOwn(json, POSITION_KEYS.LOG) && Array.isArray(json[POSITION_KEYS.LOG])) {
      json[POSITION_KEYS.LOG].forEach((item) => {
        this.log.push(item);
      });
    }

    if (Object.hasOwn(json, POSITION_KEYS.PRODUCT_ID)) {
      await this.initializeProduct(json[POSITION_KEYS.PRODUCT_ID]);
    } else {
      throw new Error(`initialize => cannot read position product_id`);
    }

    if (
      Object.hasOwn(json, POSITION_KEYS.EXECUTING) &&
      typeof json[POSITION_KEYS.EXECUTING] === 'boolean'
    ) {
      this.isExecuting = json[POSITION_KEYS.EXECUTING];
      if (this.isExecuting) {
        this.logger.warn(`initialize => position is executing`);
      } else {
        this.logger.warn(`initialize => position is NOT executing`);
      }
    } else {
      throw new Error(`initialize => cannot read position executing status`);
    }

    if (Object.hasOwn(json, POSITION_KEYS.TRAIL) && Array.isArray(json[POSITION_KEYS.TRAIL])) {
      const trail = json[POSITION_KEYS.TRAIL];
      for (const { stop, target } of trail) {
        this.trails.set(target, stop);
      }
    } else {
      this.logger.warn(`initialize => cannot read trail`);
    }

    if (!Object.hasOwn(json, POSITION_KEYS.BUY)) {
      throw new Error(`initialize => cannot read position buy`);
    }
    const buy = json[POSITION_KEYS.BUY];
    //                                                                                                     LIMIT BUY
    const limitBuyOrderConfigurations = buy[ORDER_KEYS.LIMIT_LIMIT_GTC];
    if (!limitBuyOrderConfigurations) {
      throw new Error(`initialize => cannot read position buy order configurations`);
    } else if (!Array.isArray(limitBuyOrderConfigurations)) {
      throw new Error(`initialize => limit buy order configurations are not an array`);
    } else if (this.isExecuting && limitBuyOrderConfigurations.length === 0) {
      throw new Error(`initialize => did not find any limit buy order configurations`);
    } else if (limitBuyOrderConfigurations.length > 1) {
      throw new Error(
        `initialize => found ${limitBuyOrderConfigurations.length} limit buy order configurations`,
      );
    }
    for (const config of limitBuyOrderConfigurations) {
      // console.dir(config);
      if (typeof config !== 'object') {
        throw new Error(`initialize => cannot read buy order configuration`);
      } else if (!Object.hasOwn(config, POSITION_KEYS.UUID)) {
        config[POSITION_KEYS.UUID] = UUID.v4();
      }

      const orderConfig = LimitBuyOrderConfig.fromJSON(config);
      this.limitBuyOrderConfigs.set(orderConfig.uuid, orderConfig);

      if (orderConfig.order_id) {
        orderConfig.order = await loadOrder(orderConfig.order_id, false, true, false, false);
        this.logger.info(
          `initialize => buy order ${orderConfig.order.order_id} is ${orderConfig.order.status}`,
        );

        switch (orderConfig.order.status) {
          case ORDER_STATUS.CANCELLED:
          case ORDER_STATUS.CANCEL_QUEUED:
            this.logger.warn(
              `Buy order ${orderConfig.order.order_id} is ${orderConfig.order.status}`,
            );
            break;
          default:
            orderConfig.order.on(
              ORDER_EVENT_NAMES.STATUS_CHANGE,
              this.handleBuyOrderStatusChangeBound,
            );
            orderConfig.order.subscribe();
            break;
        }
      } else if (this.isExecuting) {
        throw new Error(`initialize => cannot read buy order configuration order id`);
      } else {
        this.logger.warn(`initialize => cannot read buy order configuration order id`);
      }
    }

    if (this.limitBuyOrderConfigs.allConfigsHaveOrders()) {
      this.logger.info(`initialize => all limit buy configs have orders`);
      if (this.limitBuyOrderConfigs.allOrdersAreComplete()) {
        this.logger.info(`initialize => all limit buy orders are complete`);
        if (this.limitBuyOrderConfigs.allOrdersAreStatus(ORDER_STATUS.CANCELLED)) {
          await this.complete('All limit buy orders have been cancelled', false, true);
        }
      }
    }

    //                                                                                                  BRACKET SELL
    if (!Object.hasOwn(json, POSITION_KEYS.SELL)) {
      throw new Error(`initialize => missing sell object`);
    }
    const sell = json[POSITION_KEYS.SELL];

    const bracketSellOrderConfigurations = sell[ORDER_KEYS.TRIGGER_BRACKET_GTC];
    if (!bracketSellOrderConfigurations) {
      throw new Error(`initialize => cannot read position bracket sell order configurations`);
    } else if (!Array.isArray(bracketSellOrderConfigurations)) {
      throw new Error(`initialize => bracket sell order configurations are not an array`);
    } else if (bracketSellOrderConfigurations.length === 0) {
      throw new Error(`initialize => did not find any bracket sell order configurations`);
    }
    for (const config of bracketSellOrderConfigurations) {
      // console.dir(config);
      if (typeof config !== 'object') {
        throw new Error(`initialize => cannot read sell order configuration`);
      } else if (!Object.hasOwn(config, POSITION_KEYS.UUID)) {
        config[POSITION_KEYS.UUID] = UUID.v4();
      }

      const orderConfig = BracketSellOrderConfig.fromJSON(config);
      this.bracketSellOrderConfigs.set(orderConfig.uuid, orderConfig);

      if (orderConfig.order_id) {
        orderConfig.order = await loadOrder(orderConfig.order_id, false, true, false, false);
        this.logger.info(
          `initialize => sell order ${orderConfig.order.order_id} is ${orderConfig.order.status}`,
        );

        switch (orderConfig.order.status) {
          case ORDER_STATUS.CANCELLED:
          case ORDER_STATUS.CANCEL_QUEUED:
            this.logger.warn(
              `Sell order ${orderConfig.order.order_id} found to be cancelled during initialization`,
            );
            break;
          default:
            orderConfig.order.on(
              ORDER_EVENT_NAMES.STATUS_CHANGE,
              this.handleSellOrderStatusChangeBound,
            );
            orderConfig.order.subscribe();
            break;
        }
      }
    }

    if (this.bracketSellOrderConfigs.allConfigsHaveOrders()) {
      this.logger.info(`initialize => all bracket sell configs have orders`);
      if (this.bracketSellOrderConfigs.allOrdersAreComplete()) {
        const message = 'All bracket sell orders are complete';
        this.logger.info(`initialize => ${message}`);
        if (this.bracketSellOrderConfigs.allOrdersAreStatus(ORDER_STATUS.FILLED)) {
          await this.complete(message, true, false);
        } else {
          await this.complete(message, false, true);
        }
      }
    }

    //                                                                                                   MARKET SELL
    const marketSellOrderConfigurations = sell[ORDER_KEYS.MARKET_MARKET_IOC];
    if (!marketSellOrderConfigurations) {
      throw new Error(`initialize => cannot read position market sell order configurations`);
    } else if (!Array.isArray(marketSellOrderConfigurations)) {
      throw new Error(
        `initialize => cannot read position market sell order configurations (Array)`,
      );
    }
    for (const config of marketSellOrderConfigurations) {
      // console.dir(config);
      if (typeof config !== 'object') {
        throw new Error(`initialize => cannot read market sell order configuration`);
      } else if (!Object.hasOwn(config, POSITION_KEYS.UUID)) {
        config[POSITION_KEYS.UUID] = UUID.v4();
      }

      const orderConfig = MarketOrderConfig.fromJSON(config);
      this.marketSellOrderConfigs.set(orderConfig.uuid, orderConfig);
      orderConfig.order = await loadOrder(orderConfig.order_id, false, true, false, false);
      this.logger.info(
        `init => market order ${orderConfig.order.order_id} is ${orderConfig.order.status}`,
      );
    }

    if (this.isExecuting) {
      const productPrice = await this.getProductPrice();
      // Ensure all the buy order configs have orders
      for (const limitBuyOrderConfig of this.limitBuyOrderConfigs.values()) {
        if (!limitBuyOrderConfig.hasOrder()) {
          this.logger.warn(`initialize => found buy order config without an order`);
          await this.placeLimitBuyOrder(limitBuyOrderConfig, productPrice);
        }
      }

      if (this.getSizeToSell() > 0) {
        // A buy order has been filled.
        // Therefore, we have an account.
        // Even if the account is empty because the sell order has also been filled.
        await this.initializeAccount(forceUpdate);

        if (this.bracketSellOrderConfigs.allOrdersAreStatus(ORDER_STATUS.FILLED)) {
          this.logger.info(`initialize => all sell orders were found to be filled on init`);
          await this.complete('All sell orders are filled', true, false);
        } else {
          if (
            this.bracketSellOrderConfigs.getNumberOfConfigsWithOrders() !==
            this.bracketSellOrderConfigs.size
          ) {
            await this.reSizeBracketSellOrders(productPrice);
          }
        }
      }
    }

    this.saveJSON();

    if (!this.isComplete && !this.isCancelled) {
      this.subscribeToTicker();
    }
  }

  /**
   * @return {object}
   */
  getJSON() {
    const json = {
      [POSITION_KEYS.NAME]: this.positionName,
      [POSITION_KEYS.STATUS]: this.getPositionStatus(),
      [POSITION_KEYS.PRODUCT_ID]: this.product_id,
      [POSITION_KEYS.OPEN_DATE]: this.open_date,
      [POSITION_KEYS.BUY]: {
        [ORDER_KEYS.LIMIT_LIMIT_GTC]: [],
      },
      [POSITION_KEYS.SELL]: {
        [ORDER_KEYS.TRIGGER_BRACKET_GTC]: [],
        [ORDER_KEYS.MARKET_MARKET_IOC]: [],
      },
      [POSITION_KEYS.LOG]: this.log,
      [POSITION_KEYS.EXECUTING]: this.isExecuting,
      [POSITION_KEYS.COMPLETE]: this.isComplete,
      [POSITION_KEYS.CANCELLED]: this.isCancelled,
      [POSITION_KEYS.TRAIL]: [],
    };

    for (const config of this.limitBuyOrderConfigs.values()) {
      json[POSITION_KEYS.BUY][ORDER_KEYS.LIMIT_LIMIT_GTC].push(config.toJSON());
    }

    for (const config of this.bracketSellOrderConfigs.values()) {
      json[POSITION_KEYS.SELL][ORDER_KEYS.TRIGGER_BRACKET_GTC].push(config.toJSON());
    }

    for (const config of this.marketSellOrderConfigs.values()) {
      json[POSITION_KEYS.SELL][ORDER_KEYS.MARKET_MARKET_IOC].push(config.toJSON());
    }

    for (const [stop, target] of this.trails) {
      json[POSITION_KEYS.TRAIL].push({ stop, target });
    }

    if (this.close_date) {
      json[POSITION_KEYS.CLOSE_DATE] = this.close_date;
    } else {
      json[POSITION_KEYS.CLOSE_DATE] = '';
    }
    // console.dir(json);
    return json;
  }

  /**
   * @returns {void}
   */
  saveJSON() {
    const json = this.getJSON();
    this.logger.info('saving...');
    if (this.isComplete) {
      savePosition(this.positionName, json, true, false);
    } else if (this.isCancelled) {
      savePosition(this.positionName, json, false, true);
    } else {
      savePosition(this.positionName, json, false, false);
    }
  }

  /*******************************************************************************************************************
   *                                          Buy Order Operations
   ******************************************************************************************************************/

  /**
   * Place the order.
   * Save the order_id.
   * Get the order.
   * Save the order.
   * Set up the order subscriptions
   * @param {LimitBuyOrderConfig} config
   * @param {string|null} productPrice - short-cut to prevent too much noise
   * @returns {Promise<Order>}
   */
  async placeLimitBuyOrder(config, productPrice = null) {
    if (!this.limitBuyOrderConfigs.has(config.uuid)) {
      throw new Error(`placeBuyOrder => unknown config`);
    } else if (config.hasOrder()) {
      throw new Error(`placeBuyOrder => config already has an order ${config.order_id}`);
    } else if (config.limit_price === DUMMY_CONFIG_VALUE) {
      throw new Error(`placeBuyOrder => DUMMY limit_price`);
    } else if (config.base_size === DUMMY_CONFIG_VALUE) {
      throw new Error(`placeBuyOrder => DUMMY base_size`);
    }

    if (!productPrice) {
      productPrice = await this.getProductPrice();
    }
    const numCurrentPrice = Number(productPrice);
    if (config.limit_price > numCurrentPrice) {
      throw new Error(
        `placeBuyOrder => cannot place limit price ${config.limit_price} above current price ${productPrice}`,
      );
    }

    this.logger.info(`placeBuyOrder => Buying ${config.base_size} @ ${config.limit_price}`);

    const orderId = await createLimitOrder(
      this.product_id,
      ORDER_SIDE.BUY,
      config.base_size,
      config.limit_price,
    );
    this.logger.info(`placeBuyOrder => Placed limit buy order ${orderId}`);
    config.order_id = orderId;
    this.saveJSON();
    await delay(); // Delay here will mitigate the 404 we see during initial order creation.

    config.order = await loadOrder(orderId, true, false, false, false);
    this.logger.info(`placeBuyOrder => ${config.order.order_id} is ${config.order.status}`);
    this.saveJSON();

    switch (config.order.status) {
      case ORDER_STATUS.CANCELLED:
      case ORDER_STATUS.CANCEL_QUEUED:
        throw new Error(`placeBuyOrder => ${config.order.order_id} was immediately cancelled`);
      default:
        config.order.on(ORDER_EVENT_NAMES.STATUS_CHANGE, this.handleBuyOrderStatusChangeBound);
        config.order.subscribe();
        break;
    }
    return config.order;
  }

  /**
   * On FILLED: stop monitoring changes, await completion, place the sell order, send mail to inform the buy order has been filled.
   * On CANCELLED: stop monitoring changes, call the cancel function.
   * @param order_id {string}
   * @param status {string}
   * @returns {Promise<void>}
   */
  async handleBuyOrderStatusChange({ order_id, status }) {
    this.logger.info(`handleBuyOrderStatusChange => ${order_id}: ${status}`);
    if (!this.limitBuyOrderConfigs.hasConfigForOrderId(order_id)) {
      this.logger.warn(`handleBuyOrderStatusChange => Cannot handle event for unknown buy order.`);
      return;
    }

    const config = this.limitBuyOrderConfigs.getConfigByOrderId(order_id);
    if (!config.hasOrder()) {
      throw new Error(`handleBuyOrderStatusChange => config does not have the order`);
    }

    const order = config.order;
    const orderObj = order.getOrder();
    if (!orderObj) {
      throw new Error(`handleSellOrderStatusChange => missing orderObj`);
    }
    await writeOrder(orderObj, true, true);

    switch (status) {
      case ORDER_STATUS.FILLED:
        config.order.off(ORDER_EVENT_NAMES.STATUS_CHANGE, this.handleBuyOrderStatusChangeBound);
        await config.order.awaitCompletion(this.positionName);
        await this.mailState(`Buy Order Filled`);
        this.saveJSON();
        await this.reSizeBracketSellOrders(null);
        break;
      case ORDER_STATUS.CANCELLED:
        config.order.off(ORDER_EVENT_NAMES.STATUS_CHANGE, this.handleBuyOrderStatusChangeBound);
        if (
          this.limitBuyOrderConfigs.getNumberOfConfigsWithOrdersByStatus(ORDER_STATUS.OPEN) === 0
        ) {
          this.logger.info(`handleBuyOrderStatusChange => there are no more open buy orders`);
          await this.complete(`Buy order was cancelled`, false, true);
        }
        break;
    }
  }

  /**
   * @param {string} buyPrice
   * @param {string|null} productPrice
   * @param {string|null} orderId
   * @returns {Promise<OrderConfig>}
   */
  async modifyBuyOrder(buyPrice, productPrice, orderId = null) {
    const numBuyPrice = safeNumber(buyPrice, 'modifyBuyPrice => buyPrice');
    const numProductPrice = safeNumber(productPrice, 'modifyBuyPrice => productPrice');
    if (this.isExecuting && numBuyPrice > numProductPrice) {
      throw new Error(
        `modifyBuyPrice => buy price (${buyPrice}) is above the current market price (${productPrice})`,
      );
    }

    let limitBuyOrderConfig;
    if (orderId) {
      if (this.limitBuyOrderConfigs.hasConfigForOrderId(orderId)) {
        limitBuyOrderConfig = this.limitBuyOrderConfigs.getConfigByOrderId(orderId);
      } else {
        throw new Error(`modifyBuyOrder => cannot find config for order id ${orderId}`);
      }
    } else if (this.limitBuyOrderConfigs.size === 1) {
      limitBuyOrderConfig = this.limitBuyOrderConfigs.values().next().value;
    } else {
      throw new Error(
        `modifyBuyOrder => cannot find buy order config with ${this.limitBuyOrderConfigs.size} configs`,
      );
    }

    /**
     * Calculate the position value from the current limit price and base size
     * Then divide the value by the new limit price to get the new base size
     */
    const numLimitPrice = safeNumber(
      limitBuyOrderConfig.limit_price,
      'modifyBuyOrder => limit_price',
    );
    const numBaseSize = safeNumber(limitBuyOrderConfig.base_size, 'modifyBuyOrder => base_size');
    const numValue = numLimitPrice * numBaseSize;
    const baseSize = this.getBaseSize(numValue, numBuyPrice);
    const value = numValue.toFixed(2);
    this.logger.info(`modifyBuyOrder => buying ${baseSize} at ${buyPrice} for $${value}`);

    if (limitBuyOrderConfig.hasOrder()) {
      if (limitBuyOrderConfig.order.filled) {
        throw new Error(`modifyBuyOrder => cannot modifyBuyOrder filled buy order`);
      }

      await this.cancelBuyOrder(limitBuyOrderConfig, true);

      limitBuyOrderConfig.limit_price = buyPrice;
      limitBuyOrderConfig.base_size = baseSize;
      this.saveJSON();

      await this.waitUntilUsdAvailable(value);
      await this.placeLimitBuyOrder(limitBuyOrderConfig, productPrice);
    } else {
      limitBuyOrderConfig.limit_price = buyPrice;
      limitBuyOrderConfig.base_size = baseSize;
    }

    return limitBuyOrderConfig;
  }

  /**
   * Cancel the buy order if it is OPEN or PENDING.
   * @param {LimitBuyOrderConfig} config
   * @param {boolean} deleteOrder
   * @returns {Promise<void>}
   */
  async cancelBuyOrder(config, deleteOrder) {
    if (!config.hasOrder()) {
      throw new Error(`cancelBuyOrder => config does not have the order`);
    }
    await config.order.update();
    config.order.off(ORDER_EVENT_NAMES.STATUS_CHANGE, this.handleBuyOrderStatusChangeBound);

    switch (config.order.status) {
      case ORDER_STATUS.PENDING:
      case ORDER_STATUS.OPEN:
      case ORDER_STATUS.QUEUED:
      case ORDER_STATUS.UNKNOWN:
        this.logger.warn(
          `cancelBuyOrder => Cancelling ${config.order.order_id} (${config.order.status})`,
        );
        await config.order.cancel(this.positionName);
        break;
      default:
        this.logger.warn(
          `cancelBuyOrder => ${config.order.order_id} was already ${config.order.status}`,
        );
    }

    if (deleteOrder) {
      config.deleteOrder();
      this.saveJSON();
    }
  }

  /*******************************************************************************************************************
   *                                         Sell Order Operations
   ******************************************************************************************************************/

  /**
   * Find the stop price common to all bracket sell orders.
   * THROWS an Error if there are different stop prices
   * @returns {string}
   */
  findCommonStopPrice() {
    if (this.bracketSellOrderConfigs.noConfigsHaveOrders()) {
      throw new Error(`findCommonStopPrice => no bracket sell configs have orders`);
    }
    let stopPrice = ''; // Safety check: ensure all existing orders share the same stop price
    for (const existingBracketSellOrderConfig of this.bracketSellOrderConfigs.values()) {
      if (stopPrice) {
        if (existingBracketSellOrderConfig.stop_price !== stopPrice) {
          throw new Error(
            `findCommonStopPrice => found multiple stop prices (${stopPrice}, ${existingBracketSellOrderConfig.stop_price})`,
          );
        }
      } else {
        stopPrice = existingBracketSellOrderConfig.stop_price;
      }
    }
    return stopPrice;
  }

  /**
   * Remove any config that does not have an FILLED order.
   * @returns {void}
   */
  pruneBracketSellOrderConfigs() {
    const numOpen = this.bracketSellOrderConfigs.getNumberOfConfigsWithOrdersByStatus(
      ORDER_STATUS.OPEN,
    );
    if (numOpen > 0) {
      throw new Error(`pruneBracketSellOrderConfigs => found ${numOpen} open orders`);
    }

    for (const [uuid, bracketSellOrderConfig] of this.bracketSellOrderConfigs) {
      if (bracketSellOrderConfig.hasOrder()) {
        if (bracketSellOrderConfig.order.filled) {
          this.logger.warn(`setSchedule => ignoring config ${uuid} with filled order`);
        } else {
          throw new Error(`setSchedule => found unexpected unfilled order config`);
        }
      } else {
        if (this.bracketSellOrderConfigs.delete(uuid)) {
          this.logger.warn(`setSchedule => deleted config ${uuid}`);
        } else {
          throw new Error(`setSchedule => cannot delete config ${uuid}`);
        }
      }
    }
    this.saveJSON();
  }

  /**
   * The size to sell is the total size of all filled buy orders
   * minus the total size of all filled sell orders.
   * This is how much we have left to sell!
   * @returns {number}
   */
  getSizeToSell() {
    let sizeToSell = this.limitBuyOrderConfigs.getTotalFilledSize(this.product.base_increment);
    if (sizeToSell > 0) {
      sizeToSell -= this.marketSellOrderConfigs.getTotalFilledSize(this.product.base_increment);
      sizeToSell -= this.bracketSellOrderConfigs.getTotalFilledSize(this.product.base_increment);
    }
    return sizeToSell;
  }

  /**
   * Initializes the account if it is not already,
   * gets the size to sell,
   * which is all the filled buy orders minus all the filled sell orders,
   * updates the account,
   * and checks the size available in the account vs. what we need to sell.
   * @returns {Promise<string>}
   */
  async waitUntilSizeToSellAvailable() {
    let sizeToSell = 0;
    let sizeAvailableInAccount = 0;
    let baseSize = 0;
    let attempts = 0;
    let tryAgain = true;
    if (!this.hasAccount()) {
      // We cannot just use the account size because there may be multiple positions for the same product.
      await this.initializeAccount();
    }

    do {
      sizeToSell = this.getSizeToSell();
      await this.account.update();
      sizeAvailableInAccount = Number(this.account.getAvailableBalanceValue());

      this.logger.info(
        `waitUntilSizeToSellAvailable => To Sell: ${sizeToSell} Available: ${sizeAvailableInAccount}`,
      );
      if (sizeToSell <= sizeAvailableInAccount) {
        // the size we are looking to sell is less than or equal to the amount of assets in the account
        // this may be because the sizeToSell calculation was perfect
        // or because we have a lot more in the account owing to spot purchases, other positions, etc...
        // in either case, we have enough to sell what this position has bought
        baseSize = sizeToSell;
        tryAgain = false;
      } else if (sizeToSell <= sizeAvailableInAccount * 1.015) {
        // the sizeToSell calculations resulted in a little bit more than we actually have in the account
        // but the calculation was still within 1% of what we have in the account
        // therefore, just use the size available in the account
        baseSize = sizeAvailableInAccount;
        tryAgain = false;
      } else if (attempts++ > 10) {
        throw new Error(
          'waitUntilSizeToSellAvailable => account balance is not sufficient to place the sell order',
        );
      } else {
        // wait for a few seconds to give the exchange time to update the buy order and account information
        await delay(1000 * attempts);
      }
    } while (tryAgain);

    if (isNaN(baseSize)) {
      throw new Error(`waitUntilSizeToSellAvailable => baseSize is NaN`);
    } else if (baseSize < 0) {
      throw new Error(`waitUntilSizeToSellAvailable => baseSize is less than 0 (${baseSize})`);
    } else if (baseSize === 0) {
      throw new Error(`waitUntilSizeToSellAvailable => baseSize is 0 (${baseSize})`);
    }

    const baseSizeToIncrement = this.toSizeIncrement(baseSize);
    this.logger.info(
      `waitUntilSizeToSellAvailable => ${baseSizeToIncrement} is available in the account`,
    );
    return baseSizeToIncrement;
  }

  /**
   * Place the sell order.
   * Save the order_id.
   * Get the order.
   * Save the order
   * @param {BracketSellOrderConfig} config
   * @param {string|null} productPrice
   * @returns {Promise<Order>}
   */
  async placeBracketSellOrder(config, productPrice = null) {
    if (!this.bracketSellOrderConfigs.has(config.uuid)) {
      throw new Error(`placeBracketSellOrder => unknown config`);
    } else if (config.hasOrder()) {
      throw new Error(
        `placeBracketSellOrder => config already has an order ${config.order.order_id}`,
      );
    } else if (config.limit_price === DUMMY_CONFIG_VALUE) {
      throw new Error(`placeBracketSellOrder => DUMMY limit_price`);
    } else if (config.base_size === DUMMY_CONFIG_VALUE) {
      throw new Error(`placeBracketSellOrder => DUMMY base_size`);
    } else if (config.stop_price === DUMMY_CONFIG_VALUE) {
      throw new Error(`placeBracketSellOrder => DUMMY stop_price`);
    }

    if (!productPrice) {
      productPrice = await this.getProductPrice();
    }
    const numCurrentPrice = Number(productPrice);
    if (config.limit_price < numCurrentPrice) {
      throw new Error(
        `placeBracketSellOrder => cannot place limit price ${config.limit_price} below current price ${productPrice}`,
      );
    } else if (config.stop_price > numCurrentPrice) {
      throw new Error(
        `placeBracketSellOrder => cannot place stop price ${config.limit_price} above current price ${productPrice}`,
      );
    }

    this.logger.info(
      `placeSellOrder => Selling ${config.base_size} @ ${config.limit_price}/${config.stop_price}`,
    );

    const orderId = await createBracketOrder(
      this.product_id,
      config.base_size,
      config.limit_price,
      config.stop_price,
    );
    this.logger.info(`placeSellOrder => Placed bracket sell order ${orderId}`);
    config.order_id = orderId;
    this.saveJSON();
    await delay(); // Delay here will mitigate the 404 we see during initial order creation.

    config.order = await loadOrder(orderId, true, false, false, false);
    this.logger.info(`placeSellOrder => ${config.order.order_id} is ${config.order.status}`);
    this.saveJSON();

    switch (config.order.status) {
      case ORDER_STATUS.CANCELLED:
      case ORDER_STATUS.CANCEL_QUEUED:
        throw new Error(`placeSellOrder => ${config.order.order_id} was immediately cancelled`);
      default:
        config.order.on(ORDER_EVENT_NAMES.STATUS_CHANGE, this.handleSellOrderStatusChangeBound);
        config.order.subscribe();
        break;
    }
    return config.order;
  }

  /**
   * On FILLED: stop monitoring changes, await completion, notify that the sell order has been filled, call the complete function.
   * On CANCELLED: stop monitoring changes,  mail notification, call the cancel function.
   * @param order_id {string}
   * @param status {string}
   * @returns {Promise<void>}
   */
  async handleSellOrderStatusChange({ order_id, status }) {
    this.logger.info(`handleSellOrderStatusChange => sell order (${order_id}): ${status}`);
    if (!this.bracketSellOrderConfigs.hasConfigForOrderId(order_id)) {
      this.logger.warn(
        `handleSellOrderStatusChange => Cannot handle event for unknown sell order.`,
      );
      return;
    }

    const config = this.bracketSellOrderConfigs.getConfigByOrderId(order_id);
    if (!config.hasOrder()) {
      throw new Error(`handleSellOrderStatusChange => config does not have the order`);
    }

    const order = config.order;
    const orderObj = order.getOrder();
    if (!orderObj) {
      throw new Error(`handleSellOrderStatusChange => missing orderObj`);
    }
    await writeOrder(orderObj, true, true);

    switch (status) {
      case ORDER_STATUS.FILLED:
        config.order.off(ORDER_EVENT_NAMES.STATUS_CHANGE, this.handleSellOrderStatusChangeBound);
        await config.order.awaitCompletion(this.positionName);
        this.saveJSON();
        await this.notifySellOrderFilled(config);

        if (!this.bracketSellOrderConfigs.hasOpenOrders()) {
          this.logger.info(`handleSellOrderStatusChange => there are no more open sell orders`);
          await this.complete('Last Sell Order Filled', true, false);
        }
        break;
      case ORDER_STATUS.CANCELLED:
        config.order.off(ORDER_EVENT_NAMES.STATUS_CHANGE, this.handleSellOrderStatusChangeBound);
        if (!this.bracketSellOrderConfigs.hasOpenOrders()) {
          this.logger.warn(`handleSellOrderStatusChange => there are no more open sell orders`);
          await this.complete('Last Sell Order Cancelled', false, true);
        }
        break;
    }
  }

  /**
   * Modify a single sell order target price,
   * and optionally the stop price.
   * @param {string} targetPrice
   * @param {string|null} stopPrice
   * @param {string|null} productPrice
   * @param {string|null} orderId
   * @returns {Promise<OrderConfig>}
   */
  async modifySellOrder(targetPrice, stopPrice, productPrice = null, orderId = null) {
    const numProductPrice = safeNumber(productPrice, 'setStopPrice => productPrice');

    let numStopPrice;
    if (stopPrice) {
      numStopPrice = safeNumber(stopPrice, `modifySellOrder => stopPrice`);
      if (this.isExecuting && numStopPrice > numProductPrice) {
        throw new Error(
          `modifySellOrder => stop price (${stopPrice}) is above the current market price (${productPrice})`,
        );
      }
    }
    let numTargetPrice;
    if (targetPrice) {
      numTargetPrice = safeNumber(targetPrice, `modifySellOrder => targetPrice`);
      if (this.isExecuting && numTargetPrice < numProductPrice) {
        throw new Error(
          `modifySellOrder => target price (${targetPrice}) is below the current market price (${productPrice})`,
        );
      }
    }

    if (stopPrice && targetPrice) {
      if (numStopPrice > numTargetPrice) {
        throw new Error(
          `modifySellOrder => stop ${stopPrice} cannot be above target ${targetPrice}`,
        );
      }
    }

    let bracketSellOrderConfig;
    if (orderId) {
      // If a specific ID was passed
      if (this.bracketSellOrderConfigs.hasConfigForOrderId(orderId)) {
        bracketSellOrderConfig = this.bracketSellOrderConfigs.getConfigByOrderId(orderId);
      } else {
        throw new Error(`modifySellOrder => cannot find config for order id ${orderId}`);
      }
    } else if (this.bracketSellOrderConfigs.size === 1) {
      // Or if there is only one sell order config
      bracketSellOrderConfig = this.bracketSellOrderConfigs.values().next().value;
    } else {
      // Or if there is only one sell order config with an OPEN order
      const openOrders = this.bracketSellOrderConfigs.getOrdersByStatus(ORDER_STATUS.OPEN);
      if (openOrders.length === 1) {
        const openOrder = openOrders[0];
        bracketSellOrderConfig = this.bracketSellOrderConfigs.getConfigByOrderId(
          openOrder.order_id,
        );
      } else {
        throw new Error(
          `modifySellOrder => cannot set the target price with ${openOrders.length} open sell orders`,
        );
      }
    }

    if (targetPrice) {
      if (!stopPrice) {
        numStopPrice = safeNumber(
          bracketSellOrderConfig.stop_price,
          'modifySellOrder => stop_price',
        );
        if (numStopPrice > numTargetPrice) {
          throw new Error(
            `modifySellOrder => current stop ${stopPrice} cannot be above target ${targetPrice}`,
          );
        }
      }
    }
    if (stopPrice) {
      if (!targetPrice) {
        numTargetPrice = safeNumber(
          bracketSellOrderConfig.limit_price,
          'modifySellOrder => limit_price',
        );
        if (numStopPrice > numTargetPrice) {
          throw new Error(
            `modifySellOrder => current stop ${stopPrice} cannot be above target ${targetPrice}`,
          );
        }
      }
    }

    if (bracketSellOrderConfig.hasOrder()) {
      if (bracketSellOrderConfig.order.filled) {
        throw new Error(`modifySellOrder => cannot modifySellOrder filled sell order`);
      }

      await this.cancelSellOrder(bracketSellOrderConfig, true);

      if (targetPrice) {
        bracketSellOrderConfig.limit_price = targetPrice;
      }
      if (stopPrice) {
        bracketSellOrderConfig.stop_price = stopPrice;
      }
      this.saveJSON();

      await this.waitUntilSizeToSellAvailable();
      await this.placeBracketSellOrder(bracketSellOrderConfig, productPrice);
    } else {
      if (targetPrice) {
        bracketSellOrderConfig.limit_price = targetPrice;
      }
      if (stopPrice) {
        bracketSellOrderConfig.stop_price = stopPrice;
      }
    }

    return bracketSellOrderConfig;
  }

  /**
   * @param {string} stopPrice
   * @param {string|null} productPrice
   * @param {string|null} orderId
   * @returns {Promise<OrderConfig[]>}
   */
  async setStopPrice(stopPrice, productPrice = null, orderId = null) {
    const numProductPrice = safeNumber(productPrice, 'setStopPrice => productPrice');
    const numStopPrice = safeNumber(stopPrice, `setStopPrice => stopPrice`);
    if (this.isExecuting && numStopPrice > numProductPrice) {
      throw new Error(
        `setStopPrice => stop price (${stopPrice}) is above the current market price (${productPrice})`,
      );
    }

    const modifiedConfigs = [];

    if (orderId) {
      if (this.bracketSellOrderConfigs.hasConfigForOrderId(orderId)) {
        const bracketSellOrderConfig = this.bracketSellOrderConfigs.getConfigByOrderId(orderId);
        if (bracketSellOrderConfig.stop_price === stopPrice) {
          this.logger.warn(
            `setStopPrice => bracket sell order config ${bracketSellOrderConfig.uuid} already has a stop of ${stopPrice}`,
          );
        } else if (bracketSellOrderConfig.hasOrder()) {
          if (bracketSellOrderConfig.order.filled) {
            throw new Error(`setStopPrice => cannot find config for order id ${orderId}`);
          } else {
            await this.cancelSellOrder(bracketSellOrderConfig, true);

            bracketSellOrderConfig.stop_price = stopPrice;
            this.saveJSON();

            await this.waitUntilSizeToSellAvailable();
            await this.placeBracketSellOrder(bracketSellOrderConfig, productPrice);
            modifiedConfigs.push(bracketSellOrderConfig);
          }
        } else {
          bracketSellOrderConfig.stop_price = stopPrice;
          modifiedConfigs.push(bracketSellOrderConfig);
        }
      } else {
        throw new Error(`setStopPrice => cannot find config for order id ${orderId}`);
      }
    } else {
      for (const bracketSellOrderConfig of this.bracketSellOrderConfigs.values()) {
        if (bracketSellOrderConfig.stop_price === stopPrice) {
          this.logger.warn(
            `setStopPrice => bracket sell order config ${bracketSellOrderConfig.uuid} already has a stop of ${stopPrice}`,
          );
        } else if (bracketSellOrderConfig.hasOrder()) {
          if (bracketSellOrderConfig.order.filled) {
            this.logger.warn(
              `setStopPrice => cannot set new stop price on filled bracket sell order ${bracketSellOrderConfig.order.order_id}`,
            );
          } else {
            await this.cancelSellOrder(bracketSellOrderConfig, true);

            bracketSellOrderConfig.stop_price = stopPrice;
            this.saveJSON();

            await this.waitUntilSizeToSellAvailable();
            await this.placeBracketSellOrder(bracketSellOrderConfig, productPrice);
            modifiedConfigs.push(bracketSellOrderConfig);
          }
        } else {
          bracketSellOrderConfig.stop_price = stopPrice;
          modifiedConfigs.push(bracketSellOrderConfig);
        }
      }
    }

    return modifiedConfigs;
  }

  /**
   * Cancel the sell order if it is OPEN or PENDING.
   * DELETE the sell order from the position.
   * @param {BracketSellOrderConfig} config
   * @param {boolean} deleteOrder
   * @returns {Promise<void>}
   */
  async cancelSellOrder(config, deleteOrder = false) {
    if (!config.hasOrder()) {
      throw new Error(`cancelSellOrder => config does not have the order`);
    }
    await config.order.update();
    config.order.off(ORDER_EVENT_NAMES.STATUS_CHANGE, this.handleSellOrderStatusChangeBound);

    switch (config.order.status) {
      case ORDER_STATUS.PENDING:
      case ORDER_STATUS.OPEN:
      case ORDER_STATUS.QUEUED:
      case ORDER_STATUS.UNKNOWN:
        this.logger.warn(
          `cancelSellOrder => Cancelling ${config.order.order_id} (${config.order.status})`,
        );
        await config.order.cancel(this.positionName);
        break;
      default:
        this.logger.warn(
          `cancelSellOrder => Not cancelling ${config.order.order_id} => ${config.order.status}`,
        );
        break;
    }

    if (deleteOrder) {
      config.deleteOrder();
      this.saveJSON();
    }
  }

  /**
   * Cancel all config orders that are currently not filled
   * @param {boolean} deleteOrder
   * @returns {Promise<void>}
   */
  async cancelAllOpenBracketSellOrders(deleteOrder = false) {
    // Cancel existing bracket sell orders that have not been filled
    for (const bracketSellOrderConfig of this.bracketSellOrderConfigs.values()) {
      if (bracketSellOrderConfig.hasOrder() && !bracketSellOrderConfig.order.filled) {
        await this.cancelSellOrder(bracketSellOrderConfig, deleteOrder);
        await delay(500);
      }
    }
  }

  /**
   * Cancel all open sell orders,
   * Get the available size in the account,
   * Distribute it equally between all configs which have not already been filled,
   * Place the new sell orders.
   * @param {string|null} productPrice
   * @returns {Promise<void>}
   */
  async reSizeBracketSellOrders(productPrice = null) {
    await this.cancelAllOpenBracketSellOrders(true);
    // Wait for the available size to sell
    const sizeToSell = await this.waitUntilSizeToSellAvailable();

    const numConfigs = this.bracketSellOrderConfigs.getNumberOfConfigsWhichHaveNotBeenFilled();
    const equalBaseSizes = splitBaseSizeEqually(
      sizeToSell,
      numConfigs,
      this.product.base_increment,
    );

    if (!productPrice) {
      productPrice = await this.getProductPrice();
    }

    // Reallocate new sell orders with updated sizes
    let index = 0;
    for (const bracketSellOrderConfig of this.bracketSellOrderConfigs.values()) {
      if (bracketSellOrderConfig.hasOrder()) {
        if (bracketSellOrderConfig.order.filled) {
          this.logger.info(
            `reSizeBracketSellOrder => order ${bracketSellOrderConfig.order.order_id} is filled`,
          );
        } else {
          bracketSellOrderConfig.base_size = equalBaseSizes[index++];
          await this.placeBracketSellOrder(bracketSellOrderConfig, productPrice);
        }
      } else {
        bracketSellOrderConfig.base_size = equalBaseSizes[index++];
        await this.placeBracketSellOrder(bracketSellOrderConfig, productPrice);
      }
    }
    this.saveJSON();
  }

  /**
   * @param {MarketOrderConfig} config
   * @returns {Promise<Order>}
   */
  async placeMarketSellOrder(config) {
    if (!this.marketSellOrderConfigs.has(config.uuid)) {
      throw new Error(`placeMarketSellOrder => unknown config`);
    } else if (config.hasOrder()) {
      throw new Error(`placeMarketSellOrder => config already has an order ${config.order_id}`);
    }

    const orderId = await createMarketOrder(this.product_id, ORDER_SIDE.SELL, config.base_size);

    config.order_id = orderId;
    this.saveJSON();

    config.order = await loadOrder(orderId, true, false, false, false);
    await config.order.awaitCompletion(this.positionName);
    this.logger.info(`placeMarketSellOrder => Sold ${config.order.filled_size}`);
    return config.order;
  }

  /**
   * @returns {Promise<void>}
   */
  async fireSale() {
    this.logger.warn(`fireSale ===========>`);
    return this.close();
  }

  /*******************************************************************************************************************
   *                                                  Ticker
   ******************************************************************************************************************/

  async handleTicker(ticker) {
    this.price = ticker.price;
    this.logger.debug(`handleTicker => ${this.price}`);

    if (this.trails.size === 0) {
      return; //nothing further to do
    }

    let target, numTarget;
    let lowestTarget = Infinity;

    for (const t of this.trails.keys()) {
      numTarget = safeNumber(t, 'handleTicker => t');
      if (numTarget < lowestTarget) {
        lowestTarget = numTarget;
        target = t;
      }
    }

    const numPrice = safeNumber(this.price, 'handleTicker => this.price');
    /**
     * the price is still below the lowest target
     */
    if (numPrice < lowestTarget) {
      return;
    }

    const stop = this.trails.get(target);
    const numStop = safeNumber(stop, 'handleTicker => stop');
    if (numPrice < numStop) {
      this.logger.error(`handleTicker => stop ${stop} below current market price ${this.price}`);
      return;
    }

    await this.setStopPrice(stop, this.price);
    this.trails.delete(target);
    this.saveJSON();
  }

  subscribeToTicker() {
    if (this.hasTickerSubscription) {
      this.logger.warn(`subscribeToTicker => already subscribed to ticker`);
      return;
    }
    this.logger.info(`subscribeToTicker => subscribing to ${this.tickerId}`);
    tickerChannel.on(this.tickerId, this.handleTickerBound);
    tickerChannel.subscribe(this.tickerId);
    this.hasTickerSubscription = true;
  }

  unsubscribeFromTicker() {
    if (!this.hasTickerSubscription) {
      this.logger.warn(`unsubscribeFromTicker => not subscribed to ticker`);
      return;
    }
    this.logger.info(`unsubscribeFromTicker => unsubscribing from ${this.tickerId}`);
    tickerChannel.unsubscribe(this.tickerId);
    tickerChannel.off(this.tickerId, this.handleTickerBound);
  }

  /*******************************************************************************************************************
   *                                                  State
   ******************************************************************************************************************/

  /**
   * @returns {string}
   */
  getPositionStatus() {
    if (this.isCancelled) {
      return POSITION_STATUS.CANCELLED;
    } else if (this.isComplete) {
      return POSITION_STATUS.CLOSED;
    }

    if (this.limitBuyOrderConfigs.noConfigsHaveOrders()) {
      return POSITION_STATUS.PREPPED;
    } else if (this.limitBuyOrderConfigs.hasOpenOrders()) {
      return POSITION_STATUS.BUYING;
    } else if (this.limitBuyOrderConfigs.allOrdersAreStatus(ORDER_STATUS.FILLED)) {
      if (this.bracketSellOrderConfigs.hasOpenOrders()) {
        return POSITION_STATUS.SELLING;
      } else if (this.bracketSellOrderConfigs.allOrdersAreStatus(ORDER_STATUS.FILLED)) {
        return POSITION_STATUS.SOLD;
      } else {
        return POSITION_STATUS.BOUGHT;
      }
    } else {
      // Configs have orders, none are open, not all are filled
      return POSITION_STATUS.UNKNOWN;
    }
  }

  /**
   * @returns {number}
   */
  getTotalFees() {
    let fees = 0;

    const orders = [
      ...this.limitBuyOrderConfigs.getOrdersByStatus(ORDER_STATUS.FILLED),
      ...this.bracketSellOrderConfigs.getOrdersByStatus(ORDER_STATUS.FILLED),
      ...this.marketSellOrderConfigs.getOrdersByStatus(ORDER_STATUS.FILLED),
    ];

    for (const order of orders) {
      if (order.filled) {
        fees += Number(order.total_fees);
      }
    }

    return fees;
  }

  /**
   * @param {string} price
   * @returns {string}
   */
  getPnL(price) {
    if (this.finalPnL) {
      return this.finalPnL;
    }

    if (!this.bracketSellOrderConfigs.allConfigsHaveOrders()) {
      return DEFAULT_PNL;
    } else if (!this.bracketSellOrderConfigs.allOrdersAreStatus(ORDER_STATUS.FILLED)) {
      return DEFAULT_PNL;
    }

    const buyValue = this.limitBuyOrderConfigs.getTotalValueAfterFees(this.product.price_increment);
    let pnlValue, pnlPercent;
    let sellValue = 0;
    let final = false;

    const marketSellOrders = this.marketSellOrderConfigs.getOrders();
    for (const order of marketSellOrders) {
      sellValue += Number(order.total_value_after_fees);
    }

    if (this.bracketSellOrderConfigs.allConfigsHaveOrders()) {
      for (const bracketSellOrderConfig of this.bracketSellOrderConfigs.values()) {
        if (bracketSellOrderConfig.order.filled) {
          sellValue += Number(bracketSellOrderConfig.order.total_value_after_fees);
          final = true;
        } else {
          sellValue += Number(price) * this.getSizeToSell();
        }
      }
    } else {
      // use the current price for the remaining size
      sellValue += Number(price) * this.getSizeToSell();
    }

    sellValue -= this.getTotalFees();

    // Calculate the total PnL and percentage
    pnlValue = sellValue - buyValue;
    pnlPercent = (pnlValue / buyValue) * 100;

    // Format the PnL to 2 decimal places, and add "+" sign for positive PnL
    if (pnlValue > 0) {
      pnlValue = `$${pnlValue.toFixed(2)} (+${pnlPercent.toFixed(2)}%)`;
    } else {
      const absolutePnLValue = Math.abs(pnlValue);
      pnlValue = `-$${absolutePnLValue.toFixed(2)} (${pnlPercent.toFixed(2)}%)`;
    }

    // Mark as final PnL if all orders are filled
    if (final) {
      this.finalPnL = pnlValue;
    }

    return pnlValue;
  }

  /**
   * Returns the percentage of sell configs which have been filled
   * @return {number}
   */
  getPercentComplete() {
    const numConfigsFilled = this.bracketSellOrderConfigs.getNumberOfConfigsWhichHaveBeenFilled();
    if (numConfigsFilled === 0) {
      return 0;
    } else {
      return numConfigsFilled / this.bracketSellOrderConfigs.size;
    }
  }

  /**
   * @returns {Promise<object>}
   */
  async getState() {
    const position = this.getJSON();

    // try {
    //     const sellOrder = this.getSellOrder();
    //     const sizeToSell = this.getSizeToSell();
    //     const sizeForSale = Number(sellOrder.base_size);
    //     const coverage = ((sizeForSale / sizeToSell) * 100);
    //     position.coverage = coverage.toFixed(2);
    //     position.covered = (coverage > 98);
    // } catch (e) {
    //     this.logger.debug(`getState => cannot find sell order: ${e.message}`);
    // }
    //
    const price = await this.getProductPrice();
    position[POSITION_KEYS.CURRENT_PRICE] = price;
    position[POSITION_KEYS.PNL] = this.getPnL(price);
    position[POSITION_KEYS.PERCENT_COMPLETE] = this.getPercentComplete().toFixed(2);

    return position;
  }

  /**
   * @param {boolean} ids
   */
  async getStateStrings(ids = false) {
    const strings = [`Position Status: ${this.getPositionStatus()}`];

    const limitBuyOrders = this.limitBuyOrderConfigs.getOrders();
    for (const buyOrder of limitBuyOrders) {
      if (buyOrder.filled) {
        strings.push(
          `Buy: ${ids ? `(${buyOrder.order_id})` : ''} ${buyOrder.filled_size} @ ${buyOrder.fill_price} ${buyOrder.status}`,
        );
      } else {
        strings.push(
          `Buy: ${ids ? `(${buyOrder.order_id})` : ''} ${buyOrder.base_size} @ ${buyOrder.limit_price} ${buyOrder.status}`,
        );
      }
    }

    const bracketSellOrders = this.bracketSellOrderConfigs.getOrders();
    for (const sellOrder of bracketSellOrders) {
      if (sellOrder.filled) {
        strings.push(
          `Sell: ${ids ? `(${sellOrder.order_id})` : ''} ${sellOrder.filled_size} @ ${sellOrder.fill_price} ${sellOrder.status}`,
        );
      } else {
        strings.push(
          `Sell: ${ids ? `(${sellOrder.order_id})` : ''} ${sellOrder.base_size} @ ${sellOrder.limit_price}/${sellOrder.stop_trigger_price} ${sellOrder.status}`,
        );
      }
    }

    const price = await this.getProductPrice();
    strings.push(
      `Current Price: ${price} PnL: ${this.getPnL(price)} Percent Complete: ${this.getPercentComplete().toFixed(2)}`,
    );

    if (this.log.length) {
      this.log.forEach((log) => strings.push(log));
    }

    return strings;
  }

  /**
   * Log the position status
   * Used by the SIGUSR1 handler
   */
  async printState() {
    const strings = await this.getStateStrings();
    strings.forEach((string) => {
      this.logger.info(string);
    });
  }

  /**
   * @param {string} message
   * @returns {Promise<void>}
   */
  async mailState(message) {
    this.logger.info(message);
    this.addMessageToLog(message);

    const strings = await this.getStateStrings();
    strings.forEach((string) => {
      message += `\n${string}`;
    });

    return sendMail(this.positionName, message);
  }

  /**
   * @param {OrderConfig} bracketSellOrderConfig
   * @returns {Promise<void>}
   */
  async notifySellOrderFilled(bracketSellOrderConfig) {
    if (!bracketSellOrderConfig.hasOrder() || !bracketSellOrderConfig.order.filled) {
      throw new Error(`notifySellOrderFilled => sell order is not filled`);
    }

    const averageBuyFillPrice = this.limitBuyOrderConfigs.getAverageFillPrice(
      this.product.base_increment,
      this.product.price_increment,
    );
    const percentPrice =
      (Number(bracketSellOrderConfig.order.fill_price) / averageBuyFillPrice - 1) * 100;
    const percentPricePrint = `${percentPrice.toFixed(2)}%`;
    let message = 'Sell order filled for ';
    if (percentPrice > 0) {
      message += `+${percentPricePrint} profit.`;
    } else {
      message += `${percentPricePrint} loss.`;
    }

    await this.mailState(message);
  }

  /**
   * Add a timestamped message to the position log
   * @param {string} message
   */
  addMessageToLog(message) {
    this.log.push(`${Position.getRecordDate()}: ${message}`);
  }

  /**
   * @returns {Promise<void>}
   */
  async save() {
    await this.saveJSON();
  }

  /**
   * @returns {string}
   */
  static getRecordDate() {
    return new Date().toISOString();
  }
}

export default Position;
