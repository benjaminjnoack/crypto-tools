import { z } from "zod";

export const CoinbaseUtcDateTimePattern =
  /^(?<year>\d{4})-(?<month>0[1-9]|1[0-2])-(?<day>0[1-9]|[12]\d|3[01])T(?<hour>[01]\d|2[0-3]):(?<minute>[0-5]\d):(?<second>[0-5]\d)(?:\.\d+)?Z$/;

// Coinbase timestamps look like: 2026-01-23T14:07:59.123456Z
export const CoinbaseUtcDateTimeString = z.string().superRefine((value, ctx) => {
  const match = CoinbaseUtcDateTimePattern.exec(value);
  if (!match || !match.groups) {
    ctx.addIssue({
      code: "custom",
      message: "Must be an ISO-8601 UTC datetime string (e.g. 2026-01-23T14:07:59.123456Z)",
    });
    return;
  }

  const year = Number(match.groups.year);
  const month = Number(match.groups.month);
  const day = Number(match.groups.day);

  // Ensure day actually exists in the given year/month (e.g. reject 2026-02-30).
  const maxDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  if (day > maxDay) {
    ctx.addIssue({
      code: "custom",
      message: "Must be a real calendar datetime in UTC (invalid day for month).",
    });
  }
});
