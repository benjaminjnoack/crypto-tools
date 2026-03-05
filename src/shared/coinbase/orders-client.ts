import type { CoinbaseOrder } from "./schemas/orders.js";
import type { EditOrderRequest, OrderRequest } from "./schemas/rest.js";
import {
  requestOpenOrders,
  requestOrder,
  requestOrderCancellation,
  requestOrderCreation,
  requestOrderEdit,
} from "./rest.js";

export async function createOrder(order: OrderRequest): Promise<string> {
  return requestOrderCreation(order);
}

export async function getOrder(orderId: string): Promise<CoinbaseOrder> {
  return requestOrder(orderId);
}

export async function getOpenOrders(productId: string | null = null): Promise<CoinbaseOrder[]> {
  return requestOpenOrders(productId);
}

export async function cancelOrder(orderId: string): Promise<boolean> {
  return requestOrderCancellation(orderId);
}

export async function editOrder(
  orderId: string,
  order: Omit<EditOrderRequest, "order_id">,
): Promise<boolean> {
  return requestOrderEdit(orderId, order);
}
