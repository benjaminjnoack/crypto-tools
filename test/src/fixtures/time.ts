export type UtcParts = {
  year: number;
  month: number;
  day: number;
  hour?: number;
  minute?: number;
  second?: number;
  millisecond?: number;
};

export function isoUtc({
  year,
  month,
  day,
  hour = 0,
  minute = 0,
  second = 0,
  millisecond = 0,
}: UtcParts): string {
  return new Date(Date.UTC(year, month - 1, day, hour, minute, second, millisecond)).toISOString();
}

export function dateUtc(parts: UtcParts): Date {
  return new Date(isoUtc(parts));
}
