import { logger } from "../../log/logger.js";
import { getSignedConfig, requestWithSchema } from "../http/http-client.js";
import { ORDER_STATUS } from "../schemas/coinbase-enum-schemas.js";
import type { CoinbaseOrder } from "../schemas/coinbase-order-schemas.js";
import {
  type EditOrderRequest,
  EditOrderResponseSchema,
  type OrderHistoricalBatchResponse,
  type OrderRequest,
  OrderResponseSchema,
  OrdersBatchCancelResponseSchema,
  OrdersHistoricalBatchResponseSchema,
  OrdersHistoricalResponseSchema,
} from "../schemas/coinbase-rest-schemas.js";

const ORDER_PLACEMENT_SOURCE = {
  UNKNOWN: "UNKNOWN_PLACEMENT_SOURCE",
  SIMPLE: "RETAIL_SIMPLE",
  ADVANCED: "RETAIL_ADVANCED",
} as const;

export async function requestOrderCreation(order: OrderRequest): Promise<string> {
  const requestPath = "/api/v3/brokerage/orders";
  const config = await getSignedConfig("POST", requestPath, null, order);
  const parsed = await requestWithSchema(config, OrderResponseSchema);
  if (parsed.success) {
    if (!parsed.success_response) {
      throw new Error("Missing order ID in success response.");
    }
    return parsed.success_response.order_id;
  }
  if (!parsed.error_response) {
    throw new Error("Missing error response");
  }
  if (parsed.error_response.message) {
    throw new Error(parsed.error_response.message);
  }
  if (parsed.error_response.error) {
    throw new Error(parsed.error_response.error);
  }
  throw new Error(parsed.error_response.preview_failure_reason);
}

export async function requestOrderCancellation(order_id: string): Promise<boolean> {
  const requestPath = "/api/v3/brokerage/orders/batch_cancel";
  const data = { order_ids: [order_id] };
  const config = await getSignedConfig("POST", requestPath, null, data);
  const parsed = await requestWithSchema(config, OrdersBatchCancelResponseSchema);
  const result = parsed.results.find((entry) => entry.order_id === order_id);
  if (!result) {
    throw new Error(`Order ID ${order_id} not found in response`);
  }
  if (result.success) {
    logger.info(`Order ${order_id} canceled successfully.`);
    return true;
  }
  throw new Error(`Cancel failed: ${result.failure_reason || "Unknown reason"}`);
}

export async function requestOrderEdit(
  order_id: string,
  order: Omit<EditOrderRequest, "order_id">,
): Promise<boolean> {
  const requestPath = "/api/v3/brokerage/orders/edit";
  const data: EditOrderRequest = {
    order_id,
    price: order.price,
    size: order.size,
    stop_price: order.stop_price,
  };
  const config = await getSignedConfig("POST", requestPath, null, data);
  const parsed = await requestWithSchema(config, EditOrderResponseSchema);
  if (parsed.success) {
    return true;
  }

  const firstError = parsed.errors?.[0];
  const message = firstError?.message
    ?? firstError?.edit_failure_reason
    ?? firstError?.preview_failure_reason
    ?? "Unknown reason";
  throw new Error(`Edit failed: ${message}`);
}

export async function requestOpenOrders(
  product_id: string | null = null,
): Promise<CoinbaseOrder[]> {
  return requestOrders(ORDER_STATUS.OPEN, ORDER_PLACEMENT_SOURCE.ADVANCED, product_id, null, null);
}

export async function requestOrders(
  orderStatus: string,
  orderPlacementSource: string = ORDER_PLACEMENT_SOURCE.ADVANCED,
  productId: string | null = null,
  startDate: string | null = null,
  endDate: string | null = null,
): Promise<CoinbaseOrder[]> {
  const requestPath = "/api/v3/brokerage/orders/historical/batch";

  let responseData: OrderHistoricalBatchResponse = { orders: [] };
  const orders = [];
  do {
    let queryString = `?order_status=${orderStatus}`;
    if (orderPlacementSource) {
      queryString += `&order_placement_source=${orderPlacementSource}`;
    }
    if (productId) {
      queryString += `&product_ids=${productId}`;
    }
    if (startDate) {
      queryString += `&start_date=${startDate}`;
    }
    if (endDate) {
      queryString += `&end_date=${endDate}`;
    }
    if (responseData.cursor) {
      queryString += `&cursor=${responseData.cursor}`;
    }

    const config = await getSignedConfig("GET", requestPath, queryString);
    responseData = await requestWithSchema(config, OrdersHistoricalBatchResponseSchema);
    orders.push(...responseData.orders);
  } while (responseData.has_next);

  return orders;
}

export async function requestOrder(orderId: string): Promise<CoinbaseOrder> {
  const requestPath = `/api/v3/brokerage/orders/historical/${orderId}`;
  const config = await getSignedConfig("GET", requestPath);
  const parsed = await requestWithSchema(config, OrdersHistoricalResponseSchema);
  return parsed.order;
}
