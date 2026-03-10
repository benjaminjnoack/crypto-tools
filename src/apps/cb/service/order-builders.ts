import type {
  BracketOptions,
  LimitOptions,
  LimitTpSlOptions,
  MarketOptions,
  ModifyOptions,
  StopOptions,
} from "../commands/schemas/command-options.js";
import {
  type CoinbaseOrder,
  ORDER_SIDE,
  ORDER_TYPES,
  type OrderSide,
} from "../../../shared/coinbase/index.js";
import { toIncrement } from "../../../shared/common/index.js";

function toIncrementUp(increment: string, value: number): string {
  const floored = parseFloat(toIncrement(increment, value));
  if (floored + 1e-12 >= value) {
    return toIncrement(increment, floored);
  }

  const step = increment === "1" ? 1 : parseFloat(increment);
  return toIncrement(increment, floored + step);
}

export function buildMarketOrderValues(
  options: MarketOptions,
  marketPrice: string,
  baseIncrement: string,
): {
  side: OrderSide;
  baseSize: string;
  orderValue: string;
} {
  if (!options.buy && !options.sell) {
    throw new Error("You must specify either --buy or --sell.");
  }

  const numMarketPrice = parseFloat(marketPrice);
  let numBaseSize: number;
  let numOrderValue: number;
  if (options.baseSize) {
    numBaseSize = parseFloat(options.baseSize);
    numOrderValue = numBaseSize * numMarketPrice;
  } else if (options.value) {
    numOrderValue = parseFloat(options.value);
    numBaseSize = numOrderValue / numMarketPrice;
  } else {
    throw new Error("You must specify either --baseSize or --value.");
  }

  if (!numBaseSize || numBaseSize <= 0) {
    throw new Error("Invalid base size or value provided.");
  }

  return {
    side: options.buy ? ORDER_SIDE.BUY : ORDER_SIDE.SELL,
    baseSize: toIncrement(baseIncrement, numBaseSize),
    orderValue: toIncrement("0.01", numOrderValue),
  };
}

export function buildLimitOrderValues(
  options: LimitOptions,
  baseIncrement: string,
  priceIncrement: string,
): {
  side: OrderSide;
  postOnly: boolean;
  baseSize: string;
  limitPrice: string;
  orderValue: string;
} {
  if (!options.buy && !options.sell) {
    throw new Error("You must specify either --buy or --sell.");
  }
  const side = options.buy ? ORDER_SIDE.BUY : ORDER_SIDE.SELL;
  const postOnly = options.postOnly ?? true;

  const numLimitPrice = parseFloat(options.limitPrice);
  let numBaseSize: number;
  let numValue: number;
  if (options.baseSize) {
    numBaseSize = parseFloat(options.baseSize);
    numValue = numBaseSize * numLimitPrice;
  } else if (options.value) {
    numValue = parseFloat(options.value);
    numBaseSize = numValue / numLimitPrice;
  } else {
    throw new Error("You must specify either --baseSize or --value.");
  }

  if (!numBaseSize || numBaseSize <= 0) {
    throw new Error("Invalid base size or value provided.");
  }

  return {
    side,
    postOnly,
    baseSize: toIncrement(baseIncrement, numBaseSize),
    limitPrice: toIncrement(priceIncrement, numLimitPrice),
    orderValue: toIncrement("0.01", numValue),
  };
}

export function buildLimitTpSlValues(options: LimitTpSlOptions): {
  postOnly: boolean;
  orderValue: string;
} {
  const postOnly = options.postOnly ?? true;
  const numLimitPrice = parseFloat(options.limitPrice);
  const numBaseSize = parseFloat(options.baseSize);

  if (!numBaseSize || numBaseSize <= 0) {
    throw new Error("Invalid base size or value provided.");
  }

  return {
    postOnly,
    orderValue: toIncrement("0.01", numBaseSize * numLimitPrice),
  };
}

export function buildBracketOrderValues(
  options: BracketOptions,
  baseIncrement: string,
  priceIncrement: string,
): {
  side: OrderSide;
  baseSize: string;
  limitPrice: string;
  stopPrice: string;
  confirmationPrice: string;
  confirmationValue: string;
} {
  const numLimitPrice = parseFloat(options.limitPrice);
  const numStopPrice = parseFloat(options.stopPrice);

  if (numStopPrice >= numLimitPrice) {
    throw new Error("Stop price must be less than limit price");
  }

  const numBaseSize = parseFloat(options.baseSize);
  const baseSize = toIncrement(baseIncrement, numBaseSize);
  const limitPrice = toIncrement(priceIncrement, numLimitPrice);
  const stopPrice = toIncrement(priceIncrement, numStopPrice);
  const limitValue = toIncrement(priceIncrement, numLimitPrice * numBaseSize);
  const stopValue = toIncrement(priceIncrement, numStopPrice * numBaseSize);

  return {
    side: ORDER_SIDE.SELL,
    baseSize,
    limitPrice,
    stopPrice,
    confirmationPrice: `${limitPrice}/${stopPrice}`,
    confirmationValue: `${limitValue}/${stopValue}`,
  };
}

export function buildStopLimitOrderValues(
  options: StopOptions,
  baseIncrement: string,
  priceIncrement: string,
): {
  side: OrderSide;
  baseSize: string;
  limitPrice: string;
  stopPrice: string;
  confirmationPrice: string;
  confirmationValue: string;
  defaultedLimitPrice: boolean;
} {
  const numBaseSize = parseFloat(options.baseSize);
  const numStopPrice = parseFloat(options.stopPrice);

  let defaultedLimitPrice = false;
  let numLimitPrice: number;
  if (options.limitPrice) {
    numLimitPrice = parseFloat(options.limitPrice);
  } else {
    defaultedLimitPrice = true;
    numLimitPrice = numStopPrice * 0.99;
  }

  if (numLimitPrice >= numStopPrice) {
    throw new Error("Limit price must be less than stop price");
  }

  const baseSize = toIncrement(baseIncrement, numBaseSize);
  const limitPrice = toIncrement(priceIncrement, numLimitPrice);
  const stopPrice = toIncrement(priceIncrement, numStopPrice);

  return {
    side: ORDER_SIDE.SELL,
    baseSize,
    limitPrice,
    stopPrice,
    confirmationPrice: `${stopPrice}/${limitPrice}`,
    confirmationValue: (numStopPrice * numBaseSize).toFixed(2),
    defaultedLimitPrice,
  };
}

export function buildBreakEvenStopPrice(
  buyPrice: string,
  makerFeeRate: number,
  takerFeeRate: number,
  priceIncrement: string,
): string {
  const numBuyPrice = parseFloat(buyPrice);
  if (!Number.isFinite(numBuyPrice) || numBuyPrice <= 0) {
    throw new Error("Invalid buy price for break-even stop calculation.");
  }
  if (!Number.isFinite(makerFeeRate) || makerFeeRate < 0 || makerFeeRate >= 1) {
    throw new Error("Invalid maker fee rate for break-even stop calculation.");
  }
  if (!Number.isFinite(takerFeeRate) || takerFeeRate < 0 || takerFeeRate >= 1) {
    throw new Error("Invalid taker fee rate for break-even stop calculation.");
  }

  const rawBreakEvenStop = numBuyPrice * (1 + makerFeeRate) / (1 - takerFeeRate);
  return toIncrementUp(priceIncrement, rawBreakEvenStop);
}

export type ModifiableOrderValues = {
  baseSize: string;
  limitPrice: string;
};

export type AttachedTpSlValues = {
  takeProfitPrice: string;
  stopPrice: string;
};

export function getModifiableOrderValues(order: CoinbaseOrder): ModifiableOrderValues {
  switch (order.order_type) {
    case ORDER_TYPES.LIMIT: {
      const config = order.order_configuration.limit_limit_gtc;
      return {
        baseSize: config.base_size,
        limitPrice: config.limit_price,
      };
    }
    case ORDER_TYPES.BRACKET:
    case ORDER_TYPES.TAKE_PROFIT_STOP_LOSS: {
      const config = order.order_configuration.trigger_bracket_gtc;
      return {
        baseSize: config.base_size,
        limitPrice: config.limit_price,
      };
    }
    case ORDER_TYPES.STOP_LIMIT: {
      const config = order.order_configuration.stop_limit_stop_limit_gtc;
      return {
        baseSize: config.base_size,
        limitPrice: config.limit_price,
      };
    }
    case ORDER_TYPES.MARKET:
      throw new Error("Cannot modify market orders.");
  }
}

export function getAttachedTpSlValues(order: CoinbaseOrder): AttachedTpSlValues | null {
  if (order.order_type !== ORDER_TYPES.LIMIT) {
    return null;
  }

  const attached = order.attached_order_configuration?.trigger_bracket_gtc;
  if (!attached) {
    return null;
  }

  return {
    takeProfitPrice: attached.limit_price,
    stopPrice: attached.stop_trigger_price,
  };
}

export function buildModifyOrderValues(
  options: ModifyOptions,
  existing: ModifiableOrderValues,
): {
  baseSize: string;
  limitPrice: string;
  stopPrice?: string;
} {
  return {
    baseSize: options.baseSize ?? existing.baseSize,
    limitPrice: options.limitPrice ?? existing.limitPrice,
    ...(options.stopPrice ? { stopPrice: options.stopPrice } : {}),
  };
}
