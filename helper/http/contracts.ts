import { z } from 'zod';
import { NonNegativeNumber, NumericString } from '@contracts/validation';

export const FillClass = z.enum(['LimitBuyOrder', 'BracketSellOrder', 'MarketOrder']);
export const FillSide = z.enum(['BUY', 'SELL']);

export const BreakRequestSchema = z
  .object({
    position: z.string(),
  })
  .strict();

export const ExecRequestSchema = z
  .object({
    position: z.string(),
  })
  .strict();

export const ModifyRequestSchema = z
  .object({
    buy_price: NumericString.optional(),
    stop_price: NumericString.optional(),
    target_price: NumericString.optional(), //TODO take profit
    order_id: z.uuid().optional(),
    position: z.string(),
  })
  .strict();

export const OpenRequestSchema = z
  .object({
    product: z.string(),
    buy_price: NumericString,
    stop_price: NumericString,
    take_profit_price: NumericString,
    value: NumericString,
  })
  .strict();

export const OrderFillSchema = z
  .object({
    class: FillClass,
    side: FillSide,
    order_id: z.uuid(),
    filled_value: NonNegativeNumber, //TODO these are probably strings?
    total_fees: NonNegativeNumber,
    total_value_after_fees: NonNegativeNumber,
  })
  .strict();

export const TotalsSchema = z
  .object({
    value_bought: NonNegativeNumber, //TODO these are probably strings?
    buy_fees: NonNegativeNumber,
    value_sold: NonNegativeNumber,
    sell_fees: NonNegativeNumber,
    total_fees: NonNegativeNumber,
    total: NonNegativeNumber,
  })
  .strict();

export const PositionFillsSchema = z
  .object({
    name: z.string(),
    fills: z.array(OrderFillSchema),
    totals: TotalsSchema,
  })
  .strict();

export const PrepRequestSchema = z.object({
  buy_price: NumericString,
  product: z.string(),
  stop_price: NumericString,
  take_profit_price: NumericString,
  value: NumericString,
});

export const ScheduleRequestSchema = z
  .object({
    position: z.string(),
    schedule: NumericString,
    zero_price: NumericString,
    one_price: NumericString,
  })
  .strict();

export const TakeProfitRequestSchema = z
  .object({
    position: z.string(),
    take_profit_price: NumericString,
  })
  .strict();

export const TrailRequestSchema = z
  .object({
    position: z.string(),
    stop_loss_price: NumericString,
    target_price: NumericString,
  })
  .strict();

// Inferred TypeScript types (always derive from Zod, never hand-write duplicates)
export type BreakRequest = z.infer<typeof BreakRequestSchema>;
export type ExecRequest = z.infer<typeof ExecRequestSchema>;
export type ModifyRequest = z.infer<typeof ModifyRequestSchema>;
export type PrepRequest = z.infer<typeof PrepRequestSchema>;
export type OpenRequest = z.infer<typeof OpenRequestSchema>;
export type OrderFill = z.infer<typeof OrderFillSchema>;
export type ScheduleRequest = z.infer<typeof ScheduleRequestSchema>;
export type Totals = z.infer<typeof TotalsSchema>;
export type PositionFills = z.infer<typeof PositionFillsSchema>;
export type TakeProfitRequest = z.infer<typeof TakeProfitRequestSchema>;
export type TrailRequest = z.infer<typeof TrailRequestSchema>;
