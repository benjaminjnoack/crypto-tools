import { z } from "zod";

export const AccountType = z.enum([
  "ACCOUNT_TYPE_CRYPTO",
  "ACCOUNT_TYPE_FIAT"
]);

export const OrderSideSchema = z.enum([
  "BUY",
  "SELL"
]);
export type OrderSide = z.infer<typeof OrderSideSchema>;
export const ORDER_SIDE = OrderSideSchema.enum;

export const OrderStatusSchema = z.enum([
  "PENDING",
  "OPEN",
  "FILLED",
  "CANCELLED",
  "EXPIRED",
  "FAILED",
  "UNKNOWN_ORDER_STATUS",
  "QUEUED",
  "CANCEL_QUEUED",
]);
export const ORDER_STATUS = OrderStatusSchema.enum;

export const OrderTypeSchema = z.enum([
  "UNKNOWN_ORDER_TYPE",
  "MARKET",
  "LIMIT",
  "STOP",
  "STOP_LIMIT",
  "BRACKET",
]);
export const ORDER_TYPES = OrderTypeSchema.enum;

// This is the pattern to follow
export const OrderPlacementSource = {
  UNKNOWN: "UNKNOWN_PLACEMENT_SOURCE",
  SIMPLE: "RETAIL_SIMPLE",
  ADVANCED: "RETAIL_ADVANCED",
} as const;

export type OrderPlacementValue = (typeof OrderPlacementSource)[keyof typeof OrderPlacementSource];
export const OrderPlacementValues = [
  OrderPlacementSource.UNKNOWN,
  OrderPlacementSource.SIMPLE,
  OrderPlacementSource.ADVANCED,
];
export const OrderPlacementSchema = z.enum(OrderPlacementValues);
