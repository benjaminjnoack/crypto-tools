import { z } from "zod";

// accepts only numeric strings like "123", "-0.5", "3.14"
export const NumericString = z.string().regex(/^-?\d+(\.\d+)?$/, "Must be a numeric string");

export const PositiveNumericString = z
  .string()
  .regex(/^(?:[1-9]\d*(?:\.\d+)?|0\.\d*[1-9]\d*)$/, "Must be a positive numeric string");

export const Percent = NumericString.refine((value) => {
  const num = Number(value);
  return Number.isFinite(num) && num >= 0 && num <= 100;
}, "Must be a numeric string between 0 and 100");

export const ProductIdSchema = z.string().regex(/^[A-Z]+-USD$/, {
  message: "Product must be uppercase letters followed by -USD (e.g. BTC-USD).",
});
export type ProductId = z.infer<typeof ProductIdSchema>;

export const OrderIdSchema = z.uuid();
