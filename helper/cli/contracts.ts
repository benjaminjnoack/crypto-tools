import { z } from 'zod';
import { NonNegativeNumber, Percent, PositiveNumber } from '@contracts/validation';

export const FibOptionsSchema = z
  .object({
    bufferPercent: Percent,
    buyFib: NonNegativeNumber,
    dryRunFlag: z.boolean(),
    onePrice: NonNegativeNumber,
    riskPercent: Percent,
    takeProfitFib: NonNegativeNumber,
    zeroPrice: NonNegativeNumber,
  })
  .strict();

export const LoadOrderOptionsSchema = z
  .object({
    force: z.coerce.boolean().default(false),
  })
  .strict();

export const ModifyOptionsSchema = z
  .object({
    buyPrice: PositiveNumber.optional(),
    stopPrice: PositiveNumber.optional(),
    takeProfitPrice: PositiveNumber.optional(),
    orderId: z.uuid().optional(),
  })
  .strict();

export const OpenOptionsSchema = z
  .object({
    buyPrice: NonNegativeNumber,
    stopPrice: NonNegativeNumber,
    takeProfitPrice: NonNegativeNumber,
    value: NonNegativeNumber,
  })
  .strict();

export const PlanOptionsSchema = z
  .object({
    bufferPercent: Percent,
    buyPrice: PositiveNumber,
    dryRunFlag: z.boolean(),
    riskPercent: Percent,
    stopPrice: PositiveNumber,
    takeProfitPrice: PositiveNumber,
  })
  .strict();

export const PositionArgsSchema = z.object({
  position: z.string().min(1).default('BTC'),
});

export const ProductArgsSchema = z.object({
  product: z.string().min(1).default('BTC-USD'),
});

export const ReadOrderOptionsSchema = z
  .object({
    force: z.coerce.boolean().default(false),
  })
  .strict();

export const ScheduleOptionsSchema = z
  .object({
    onePrice: NonNegativeNumber,
    schedule: NonNegativeNumber,
    print: z.coerce.boolean().default(false),
    zeroPrice: NonNegativeNumber,
  })
  .strict();

export const TakeProfitOptionsSchema = z
  .object({
    takeProfitPrice: NonNegativeNumber,
  })
  .strict();

export const TrailOptionsSchema = z
  .object({
    stopLossPrice: NonNegativeNumber,
    targetPrice: NonNegativeNumber,
  })
  .strict();

export type FibOptions = z.infer<typeof FibOptionsSchema>;
export type LoadOrderOptions = z.infer<typeof LoadOrderOptionsSchema>;
export type ModifyOptions = z.infer<typeof ModifyOptionsSchema>;
export type PlanOptions = z.infer<typeof PlanOptionsSchema>;
export type OpenOptions = z.infer<typeof OpenOptionsSchema>;
export type PositionArgs = z.infer<typeof PositionArgsSchema>;
export type ProductArgs = z.infer<typeof ProductArgsSchema>;
export type ReadOrderOptions = z.infer<typeof ReadOrderOptionsSchema>;
export type ScheduleOptions = z.infer<typeof ScheduleOptionsSchema>;
export type TrailOptions = z.infer<typeof TrailOptionsSchema>;
export type TakeProfitOptions = z.infer<typeof TakeProfitOptionsSchema>;
