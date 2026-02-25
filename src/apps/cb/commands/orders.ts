import { logger } from "../../../shared/log/logger.js";
import { requestOpenOrders, requestOrder, requestOrderCancellation } from "../../../shared/coinbase/rest.js";
import { printOrder } from "../../../shared/log/orders.js";
import type { ProductId } from "../../../shared/schemas/primitives.js";

export async function handleOrderAction(orderId: string): Promise<void> {
  const order = await requestOrder(orderId);
  printOrder(order);
}

export async function handleOrdersAction(productId: ProductId | null): Promise<void> {
  const openOrders = await requestOpenOrders(productId);
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
  await requestOrderCancellation(order_id);
}
