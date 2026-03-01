import { z } from "zod";

export const DateRange = {
  WEEK: "week",
  MONTH: "month",
  QUARTER: "quarter",
  YEAR: "year",
  ALL: "all",
} as const;

export type DateRangeValue = (typeof DateRange)[keyof typeof DateRange];
export const DateRangeValues = [
  DateRange.WEEK,
  DateRange.MONTH,
  DateRange.QUARTER,
  DateRange.YEAR,
  DateRange.ALL,
] as const;
export const DateRangeSchema = z.enum(DateRangeValues);
