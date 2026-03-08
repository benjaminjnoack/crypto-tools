import { addStringNumbersWithPrecision, calculateWeightedAveragePrice } from '@core/precision.mjs';
import { ORDER_STATUS } from '@core/dictionary.ts';

class OrdersGroup extends Map {
  constructor() {
    super();
  }

  /**
   * Returns the cumulative base_size of all orders
   * @param {string} baseIncrement
   * @returns {number}
   */
  getTotalBaseSize(baseIncrement) {
    if (this.size === 0) {
      return 0;
    } else if (this.size === 1) {
      const order = this.values().next().value;
      return parseFloat(order.base_size);
    }
    const baseSizes = [];
    this.forEach((order) => baseSizes.push(order.base_size));
    return addStringNumbersWithPrecision(baseSizes, baseIncrement);
  }

  /**
   * Returns the cumulative filled_size of orders
   * @param {string} baseIncrement
   * @returns {number}
   */
  getTotalFilledSize(baseIncrement) {
    if (this.size === 0) {
      return 0;
    } else if (this.size === 1) {
      const order = this.values().next().value;
      return parseFloat(order.filled_size);
    }
    const filledSizes = [];
    this.forEach((order) => filledSizes.push(order.filled_size));
    return addStringNumbersWithPrecision(filledSizes, baseIncrement);
  }

  /**
   * Returns the cumulative filled_value for all orders
   * @param {string} priceIncrement
   * @returns {number}
   */
  getTotalFilledValue(priceIncrement) {
    if (this.size === 0) {
      return 0;
    } else if (this.size === 1) {
      const order = this.values().next().value;
      return parseFloat(order.filled_value);
    }
    const filledValues = [];
    this.forEach((order) => filledValues.push(order.filled_value));
    return addStringNumbersWithPrecision(filledValues, priceIncrement);
  }

  /**
   * Returns the cumulative base_size of OPEN orders
   * @param {string} baseIncrement
   * @returns {number}
   */
  getTotalUnfilledSize(baseIncrement) {
    if (this.size === 0) {
      return 0;
    } else if (this.size === 1) {
      const order = this.values().next().value;
      if (order.status === ORDER_STATUS.OPEN) {
        return parseFloat(order.base_size);
      } else {
        return parseFloat(order.filled_size);
      }
    }
    const unfilledSizes = [];
    this.forEach((order) => {
      if (order.status === ORDER_STATUS.OPEN) {
        unfilledSizes.push(order.base_size);
      }
    });
    return addStringNumbersWithPrecision(unfilledSizes, baseIncrement);
  }

  /**
   * Returns a weighted average fill_price based on filled_size
   * @param {string} baseIncrement
   * @param {string} priceIncrement
   * @returns {number}
   */
  getAverageFilledPrice(baseIncrement, priceIncrement) {
    if (this.size === 0) {
      return 0;
    } else if (this.size === 1) {
      const order = this.values().next().value;
      return parseFloat(order.fill_price);
    }

    const orders = [];

    this.forEach((order) => {
      orders.push({
        price: order.fill_price,
        size: order.filled_size,
      });
    });

    return calculateWeightedAveragePrice(orders, baseIncrement, priceIncrement);
  }

  /**
   * Returns a weighted average limit_price based on base_size
   * @param {string} baseIncrement
   * @param {string} priceIncrement
   * @returns {number}
   */
  getAverageLimitPrice(baseIncrement, priceIncrement) {
    if (this.size === 0) {
      return 0;
    } else if (this.size === 1) {
      const order = this.values().next().value;
      return parseFloat(order.limit_price);
    }

    const orders = [];

    this.forEach((order) => {
      orders.push({
        price: order.limit_price,
        size: order.base_size,
      });
    });

    return calculateWeightedAveragePrice(orders, baseIncrement, priceIncrement);
  }

  /**
   * @param {string} priceName
   * @returns {number}
   */
  getHighestPrice(priceName) {
    if (this.size === 0) {
      return 0;
    } else if (this.size === 1) {
      const order = this.values().next().value;
      return parseFloat(order[priceName]);
    }

    let highestPrice = 0;
    this.forEach((order) => {
      const price = parseFloat(order[priceName]);
      if (price > highestPrice) {
        highestPrice = price;
      }
    });
    return highestPrice;
  }

  /**
   * @param {string} priceName
   * @returns {number}
   */
  getLowestPrice(priceName) {
    if (this.size === 0) {
      return 0;
    } else if (this.size === 1) {
      const order = this.values().next().value;
      return parseFloat(order[priceName]);
    }

    let lowestPrice = Infinity;
    this.forEach((order) => {
      const price = parseFloat(order[priceName]);
      if (price < lowestPrice) {
        lowestPrice = price;
      }
    });
    return lowestPrice;
  }

  /**
   * returns true if there is at least one open order in the group
   * @returns {number}
   */
  getOpenOrderCount() {
    let open = 0;
    this.forEach((order) => {
      if (order.status === ORDER_STATUS.OPEN) {
        open++;
      }
    });
    return open;
  }
}

export default OrdersGroup;
