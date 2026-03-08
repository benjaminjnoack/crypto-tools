import { ORDER_STATUS } from '@core/dictionary';
import { addStringNumbersWithPrecision, calculateWeightedAveragePrice } from '@core/precision';
import type { CoinbaseOrder } from '@cb/http/contracts';
import type Order from '@cb/order/Order.js';
import type OrderConfig from './OrderConfig';

export default class OrderConfigMap<TOrder extends CoinbaseOrder = CoinbaseOrder> extends Map<
  string,
  OrderConfig<TOrder>
> {
  constructor() {
    super();
  }

  hasConfigForOrderId(orderId: string): boolean {
    let hasConfig = false;
    for (const config of this.values()) {
      if (config.hasOrder()) {
        if (config.order.order_id === orderId) {
          hasConfig = true;
        }
      }
    }
    return hasConfig;
  }

  getConfigByOrderId(orderId: string): OrderConfig<TOrder> {
    for (const config of this.values()) {
      if (config.hasOrder()) {
        if (config.order.order_id === orderId) {
          return config;
        }
      }
    }
    throw new Error(`getConfigByOrderId => ${orderId} not found`);
  }

  allConfigsHaveOrders(): boolean {
    for (const config of this.values()) {
      if (!config.hasOrder()) {
        return false;
      }
    }
    return true;
  }

  noConfigsHaveOrders(): boolean {
    for (const config of this.values()) {
      if (config.hasOrder()) {
        return false;
      }
    }
    return true;
  }

  getOrders(): Array<Order<TOrder>> {
    const orders: Array<Order<TOrder>> = [];
    for (const config of this.values()) {
      if (config.hasOrder()) {
        orders.push(config.order);
      }
    }
    return orders;
  }

  /**
   * Returns true only if ALL configs have orders
   * AND all orders are STATUS
   */
  allOrdersAreStatus(status: string): boolean {
    if (!this.allConfigsHaveOrders()) {
      return false;
    }

    for (const config of this.values()) {
      if (!config.hasOrder()) {
        return false;
      } else if (config.order.status !== status) {
        return false;
      }
    }
    return true;
  }

  /**
   * Returns true only if ALL configs have orders,
   * AND all orders are either FILLED, CANCELLED, or EXPIRED
   */
  allOrdersAreComplete(): boolean {
    if (!this.allConfigsHaveOrders()) {
      return false;
    }
    for (const config of this.values()) {
      if (!config.hasOrder()) {
        return false;
      }
      switch (config.order.status) {
        case ORDER_STATUS.CANCELLED:
        case ORDER_STATUS.CANCEL_QUEUED:
        case ORDER_STATUS.FILLED:
        case ORDER_STATUS.EXPIRED:
          break;
        default:
          return false;
      }
    }
    return true;
  }

  getOrdersByStatus(status: string): Array<Order<TOrder>> {
    const orders = this.getOrders();
    return orders.filter((order) => order.status === status);
  }

  /**
   * Returns the number of configs which either do not have an order, or have an order that has not yet been filled
   */
  getNumberOfConfigsWhichHaveNotBeenFilled(): number {
    let n = 0;
    for (const config of this.values()) {
      if (config.hasOrder()) {
        if (!config.order.filled) {
          n++;
        }
      } else {
        n++;
      }
    }
    return n;
  }

  getNumberOfConfigsWithOrders(): number {
    return this.getOrders().length;
  }

  getNumberOfConfigsWithOrdersByStatus(status: string): number {
    return this.getOrders().filter((order) => order.status === status).length;
  }

  /**
   * Returns the number of configs which have a FILLED order
   */
  getNumberOfConfigsWhichHaveBeenFilled(): number {
    let n = 0;
    for (const config of this.values()) {
      if (config.hasOrder()) {
        if (config.order.filled) {
          n++;
        }
      }
    }
    return n;
  }

  hasOpenOrders(): boolean {
    for (const config of this.values()) {
      if (config.hasOrder() && !config.order.filled) {
        return true;
      }
    }
    return false;
  }

  /**
   * Returns the number of configs that have OPEN orders
   */
  getNumberOfOpenOrders(): number {
    let n = 0;
    for (const config of this.values()) {
      if (config.hasOrder()) {
        switch (config.order.status) {
          case ORDER_STATUS.OPEN:
          case ORDER_STATUS.PENDING:
            n++;
            break;
        }
      }
    }
    return n;
  }

  /**
   * Get the total base size for all orders in the map
   */
  getTotalBaseSize(baseIncrement: string): number {
    const orders = this.getOrders();
    if (orders.length === 0) {
      return 0;
    } else if (orders.length === 1) {
      const order = orders[0];
      if (!order) {
        return 0;
      }
      return parseFloat(order.base_size);
    }
    const baseSizes: string[] = [];
    orders.forEach((order) => baseSizes.push(order.base_size));
    return addStringNumbersWithPrecision(baseSizes, baseIncrement);
  }

  /**
   * Get the total filled size for all orders in the map
   */
  getTotalFilledSize(baseIncrement: string): number {
    const orders = this.getOrders();
    if (orders.length === 0) {
      return 0;
    } else if (orders.length === 1) {
      const order = orders[0];
      if (!order) {
        return 0;
      }
      return parseFloat(order.filled_size);
    }
    const filledSizes: string[] = [];
    orders.forEach((order) => filledSizes.push(order.filled_size));
    return addStringNumbersWithPrecision(filledSizes, baseIncrement);
  }

  /**
   * Get the total filled value for all orders in the map
   */
  getTotalFilledValue(priceIncrement: string) {
    const orders = this.getOrders();
    if (orders.length === 0) {
      return 0;
    } else if (orders.length === 1) {
      const order = orders[0];
      if (!order) {
        return 0;
      }
      return parseFloat(order.filled_value);
    }

    const filledValues: string[] = [];
    orders.forEach((order) => filledValues.push(order.filled_value));
    return addStringNumbersWithPrecision(filledValues, priceIncrement);
  }

  getTotalValueAfterFees(priceIncrement: string) {
    const orders = this.getOrders();
    if (orders.length === 0) {
      return 0;
    } else if (orders.length === 1) {
      const order = orders[0];
      if (!order) {
        return 0;
      }
      return parseFloat(order.total_value_after_fees);
    }

    const filledValues: string[] = [];
    orders.forEach((order) => filledValues.push(order.total_value_after_fees));
    return addStringNumbersWithPrecision(filledValues, priceIncrement);
  }

  /**
   * Returns a weighted average limit_price based on base_size
   */
  getAverageFillPrice(baseIncrement: string, priceIncrement: string): number {
    const orders = this.getOrders();
    if (orders.length === 0) {
      return 0;
    } else if (orders.length === 1) {
      const order = orders[0];
      if (!order) {
        return 0;
      }
      return parseFloat(order.fill_price);
    }

    const mappedOrders = orders.map((order) => {
      return {
        price: order.fill_price,
        size: order.base_size,
      };
    });

    return calculateWeightedAveragePrice(mappedOrders, baseIncrement, priceIncrement);
  }
}
