import { toIncrement } from '@core/increment';
import { safeNumber } from '@core/validation';

export const NUM_SCHEDULES = 23;
export const DEFAULT_SCHEDULE = '23';

const ALL_FIB_EXTENSIONS: number[] = [
  0.236, 0.295, 0.382, 0.5, 0.618, 0.786, 1, 1.272, 1.414, 1.5, 1.618, 2, 2.272, 2.414, 2.5, 2.618,
  3, 3.272, 3.414, 3.5, 3.618, 4, 4.272, 4.236, 4.414, 4.618, 5,
];

export function checkFib(fibExtension: number): boolean {
  return ALL_FIB_EXTENSIONS.includes(fibExtension);
}

export function getSchedule(name: string): number[] {
  switch (name) {
    case '1':
      return [1];

    case '2':
      return [1, 2];

    case '3':
      return [1, 2, 3];

    case '4':
      return [1, 1.272];

    case '5':
      return [1, 1.618];

    case '6':
      return [1, 1.272, 1.618];

    case '7':
      return [1, 1.272, 1.618, 2];

    case '8':
      return [1, 1.272, 1.618, 2, 2.272];

    case '9':
      return [1, 1.272, 1.618, 2, 2.272, 2.618];

    case '10':
      return [1, 1.272, 1.618, 2, 2.272, 2.618, 3];

    case '11':
      return [1, 1.272, 1.618, 2, 2.272, 2.414, 2.618, 3];

    case '12':
      return [1, 1.272, 1.618, 2, 2.272, 2.414, 2.618, 3, 3.618];

    case '13':
      return [1, 1.272, 1.618, 2, 2.272, 2.414, 2.618, 3, 3.618, 4.236];

    // Cases with retracement levels
    case '14':
      return [0.618, 1];

    case '15':
      return [0.786, 1];

    case '16':
      return [0.5, 0.618, 1];

    case '17':
      return [0.5, 0.618, 0.786, 1];

    case '18':
      return [0.5, 0.618, 0.786, 1, 1.272];

    case '19':
      return [0.5, 0.618, 0.786, 1, 1.272, 1.618];

    case '20':
      return [0.5, 0.618, 0.786, 1, 1.272, 1.618, 2, 2.618];

    case '21':
      return [0.5, 0.618, 0.786, 1, 1.272, 1.414, 1.618, 2, 2.272, 2.414, 2.618, 3];

    case '22':
      return [0.618, 0.786, 1, 1.272, 1.414, 1.618, 2, 2.272, 2.414, 2.618, 3];

    case '23':
      /**
       * Slightly more than 1.414's returns
       * Does not demand hitting two and gives basically the same returns
       * Likely provides a little something if you barely catch any bounce
       */
      return [1.272, 1.414, 1.618];

    default:
      throw new Error(`getSchedule => cannot find schedule ${name}`);
  }
}

export function getSchedulePrices(
  scheduleName: string,
  zeroPrice: string,
  onePrice: string,
  priceIncrement: string,
): string[] {
  const schedule = getSchedule(scheduleName);
  const numZero = safeNumber(zeroPrice, `getSchedulePrices => zeroPrice = ${zeroPrice}`);
  const numOne = safeNumber(onePrice, `getSchedulePrices => onePrice = ${onePrice}`);
  const difference = numOne - numZero;
  if (difference < 0) {
    throw new Error(`getSchedulePrices => cannot plot schedule for ${zeroPrice} -> ${onePrice}`);
  }

  return schedule.map((point) => {
    const numPrice = numZero + difference * point;
    return toIncrement(priceIncrement, numPrice);
  });
}

export function getPriceForFib(
  zeroPrice: number,
  onePrice: number,
  fibExtension: number,
  priceIncrement: string,
): string {
  const difference = onePrice - zeroPrice;
  if (difference < 0) {
    throw new Error(`getPriceForFib => cannot get price for ${zeroPrice} -> ${onePrice}`);
  }
  const numPrice = zeroPrice + difference * fibExtension;
  return toIncrement(priceIncrement, numPrice);
}
