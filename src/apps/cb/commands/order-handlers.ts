import { logger } from "../../../shared/log/logger.js";
import { cancelOrder, getOpenOrders, getOrder } from "../../../shared/coinbase/orders-client.js";
import { printOrder } from "../../../shared/log/orders.js";
import type { ProductId } from "../../../shared/schemas/primitives.js";
import type { ModifyOptions } from "./schemas/command-options.js";
import { placeModifyOrder } from "../service/order-service.js";

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

export async function handleCancelAction(order_id: string): Promise<void> {
  await cancelOrder(order_id);
}

export async function handleModifyAction(orderId: string, options: ModifyOptions): Promise<void> {
  await placeModifyOrder(orderId, options);
}
