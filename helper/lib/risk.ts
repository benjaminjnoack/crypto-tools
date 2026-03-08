export const FIRST_TARGET = 5 as const;
const TARGET_PERCENT = 2.5;
const STOP_PERCENT = 3.0;

export interface RiskProfile {
  nextTargetPrice: number;
  stopPrice: number;
}

export function assertNumber(value: number, name: string): asserts value is number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new TypeError(`Expected ${name} to be a number`);
  }
}

export function getRiskProfile(currentPrice: number): RiskProfile {
  assertNumber(currentPrice, 'currentPrice');
  const nextTargetPrice = currentPrice * (1 + TARGET_PERCENT / 100);
  const stopPrice = currentPrice * (1 - STOP_PERCENT / 100);
  return { nextTargetPrice, stopPrice };
}
