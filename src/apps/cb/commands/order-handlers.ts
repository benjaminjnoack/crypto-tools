import process from "node:process";
import { cancelOrder, getOpenOrders, getOrder } from "../../../shared/coinbase/index.js";
import { logger, printOrder } from "../../../shared/log/index.js";
import type { ProductId } from "../../../shared/schemas/shared-primitives.js";
import type { BreakEvenStopOptions, ModifyOptions } from "./schemas/command-options.js";
import {
  placeBreakEvenStopOrder,
  placeModifyOrder,
  replaceCancelledOrder,
} from "../service/order-service.js";

export async function handleOrderAction(orderId: string): Promise<void> {
  const order = await getOrder(orderId);
  printOrder(order);
}

export async function handleOrdersAction(productId: ProductId | null): Promise<void> {
  const openOrders = await getOpenOrders(productId);
  if (openOrders.length === 0) {
    logger.info("No open orders found.");
  } else {
    openOrders.forEach((order, index) => {
      logger.info(`Order ${index + 1}/${openOrders.length}`);
      printOrder(order);
      logger.info("---");
    });
  }
}

export async function handleCancelAction(orderId: string | null): Promise<void> {
  if (orderId !== null) {
    await cancelOrder(orderId);
    return;
  }
  const openOrders = await getOpenOrders(null);
  if (openOrders.length === 0) {
    logger.error("No open orders found.");
    process.exit(1);
  }
  if (openOrders.length > 1) {
    logger.error(`Multiple open orders found (${openOrders.length}). Specify an order ID.`);
    process.exit(1);
  }
  await cancelOrder(openOrders[0]!.order_id);
}

export async function handleModifyAction(orderId: string, options: ModifyOptions): Promise<void> {
  await placeModifyOrder(orderId, options);
}

export async function handleBreakEvenStopAction(
  orderId: string,
  options: BreakEvenStopOptions,
): Promise<void> {
  await placeBreakEvenStopOrder(orderId, options);
}

export async function handleReplaceAction(orderId: string): Promise<void> {
  await replaceCancelledOrder(orderId);
}
