import { z } from 'zod';

// accepts only numeric strings like "123", "-0.5", "3.14"
export const NumericString = z.string().regex(/^-?\d+(\.\d+)?$/, 'Must be a numeric string');
export const NonNegativeNumericString = z
  .string()
  .regex(/^\d+(\.\d+)?$/, 'Must be a non-negative numeric string');
export const PositiveNumericString = z
  .string()
  .regex(/^(?:[1-9]\d*(?:\.\d+)?|0\.\d+)$/, 'Must be a positive numeric string');

// base strict number (finite) from numeric string
export const StrictNumber = NumericString.transform((s) => Number(s)).pipe(z.number());

// with bounds
export const NonNegativeNumber = NumericString.transform((s) => Number(s)).pipe(z.number().min(0));

export const Percent = NumericString.transform(Number).pipe(z.number().min(0).max(100));

export const PositiveNumber = NumericString.transform((s) => Number(s)).pipe(z.number().gt(0));
