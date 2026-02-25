import type { CoinbaseOrder } from "../coinbase/schemas/orders.js";
import { logger } from "./logger.js";

const ORDER_CONFIGURATION_KEY: Record<CoinbaseOrder["order_type"], string> = {
  BRACKET: "trigger_bracket_gtc",
  LIMIT: "limit_limit_gtc",
  MARKET: "market_market_ioc",
  STOP_LIMIT: "stop_limit_stop_limit_gtc",
};

const ORDER_FIELDS = [
  "order_id",
  "product_id",
  "side",
  "status",
  "completion_percentage",
  "filled_size",
  "average_filled_price",
  "filled_value",
  "total_fees",
  "total_value_after_fees",
  "product_type",
  "last_fill_time",
  "order_type",
] as const satisfies ReadonlyArray<Exclude<keyof CoinbaseOrder, "order_configuration">>;

const ORDER_CONFIGURATION_FIELDS: Record<CoinbaseOrder["order_type"], readonly string[]> = {
  BRACKET: ["base_size", "limit_price", "stop_trigger_price"],
  LIMIT: ["base_size", "limit_price", "post_only"],
  MARKET: ["base_size", "quote_size"],
  STOP_LIMIT: ["base_size", "limit_price", "stop_direction", "stop_price"],
};
const ATTACHED_ORDER_CONFIGURATION_FIELDS = ["limit_price", "stop_trigger_price"] as const;

function logField(key: string, value: unknown, indent: number): void {
  if (value === undefined) {
    return;
  }
  logger.info(`${" ".repeat(indent)}${key}:`, value);
}

export function printOrder(order: CoinbaseOrder): void {
  logger.info("Order:");
  ORDER_FIELDS.forEach((field) => {
    logField(field, order[field], 2);
  });

  const orderConfiguration = order.order_configuration as Record<string, Record<string, unknown> | undefined>;
  const configurationKey = ORDER_CONFIGURATION_KEY[order.order_type];
  const typedOrderConfiguration = orderConfiguration[configurationKey];

  logger.info("  order_configuration:");
  logger.info(`    ${String(configurationKey)}:`);

  if (typedOrderConfiguration === undefined) {
    return;
  }

  ORDER_CONFIGURATION_FIELDS[order.order_type].forEach((field) => {
    logField(field, typedOrderConfiguration[field], 6);
  });

  if (order.order_type !== "LIMIT") {
    return;
  }

  const attachedOrderConfiguration = order.attached_order_configuration;
  if (attachedOrderConfiguration === undefined || attachedOrderConfiguration === null) {
    return;
  }

  logger.info("  attached_order_configuration:");
  logger.info("    trigger_bracket_gtc:");
  ATTACHED_ORDER_CONFIGURATION_FIELDS.forEach((field) => {
    logField(field, attachedOrderConfiguration.trigger_bracket_gtc[field], 6);
  });
}
