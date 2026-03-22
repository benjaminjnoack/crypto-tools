import process from "node:process";
import { type ZodType } from "zod";
import {
  parseArg,
  parseArgOptions,
  parseNone,
  type Parser,
  withParsedAction,
} from "../../../../shared/cli/register-utils.js";
import { getProductId } from "../../../../shared/coinbase/index.js";
import { printError } from "../../../../shared/log/index.js";
import type { ProductId } from "../../../../shared/schemas/shared-primitives.js";

export const OptionFlags = {
  baseSize: "-b, --baseSize <baseSize>",
  value: "-v, --value <value>",
  buy: "-B, --buy",
  sell: "-S, --sell",
  noPostOnly: "--no-postOnly",
  limitPrice: "-l, --limitPrice <limitPrice>",
  stopPrice: "-s, --stopPrice <stopPrice>",
  takeProfitPrice: "-t, --takeProfitPrice <takeProfitPrice>",
  buyPrice: "-b, --buyPrice <price>",
  bufferPercent: "-B, --bufferPercent <bufferPercent>",
  riskPercent: "-r, --riskPercent <riskPercent>",
  allIn: "-a, --all-in",
  dryRunFlag: "-x, --dryRunFlag",
  floor: "-f, --floor <price>",
  ceiling: "-c, --ceiling <price>",
  fibEntry: "-e, --entry <extension>",
  fibTakeProfit: "-t, --take-profit <extension>",
  fibRound: "-R, --round",
} as const;

export function printErrorAndExit(commandName: string, e: unknown, code = 1) {
  console.log(`Error running ${commandName}`);
  printError(e);
  process.exit(code);
}

type AsyncVoid = Promise<void> | void;
const DEFAULT_PRODUCT = "btc";

export function withCommandError(
  commandName: string,
  handler: (...args: unknown[]) => AsyncVoid,
) {
  return async (...args: unknown[]) => {
    try {
      await handler(...args);
    } catch (e) {
      printErrorAndExit(commandName, e);
    }
  };
}

export function withAction<TArgs extends unknown[]>(
  commandName: string,
  parser: Parser<TArgs>,
  handler: (...args: TArgs) => AsyncVoid,
) {
  return withCommandError(commandName, withParsedAction(parser, handler));
}

export { parseNone, parseArg, parseArgOptions };

export function parseOptionalProduct(): Parser<[ProductId | null]> {
  return (rawProduct: unknown) => {
    if (!rawProduct) {
      return [null];
    }
    const productId: ProductId = typeof rawProduct === "string"
      ? getProductId(rawProduct)
      : getProductId(DEFAULT_PRODUCT);
    return [productId];
  };
}

export function parseOptionalProductOptions<TOptions>(
  optionsSchema: ZodType<TOptions>,
): Parser<[ProductId | null, TOptions]> {
  return (rawProduct: unknown, rawOptions: unknown) => {
    const options = optionsSchema.parse(rawOptions);
    if (!rawProduct) {
      return [null, options];
    }
    const productId: ProductId = typeof rawProduct === "string"
      ? getProductId(rawProduct)
      : getProductId(DEFAULT_PRODUCT);
    return [productId, options];
  };
}

export function parseProductId(): Parser<[string]> {
  return (rawProduct: unknown) => [getProductId((rawProduct ?? DEFAULT_PRODUCT) as string)];
}

export function parseProductIdOptions<TOptions>(
  optionsSchema: ZodType<TOptions>,
): Parser<[string, TOptions]> {
  return (rawProduct: unknown, rawOptions: unknown) => [
    getProductId((rawProduct ?? DEFAULT_PRODUCT) as string),
    optionsSchema.parse(rawOptions),
  ];
}
