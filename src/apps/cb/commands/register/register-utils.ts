import process from "node:process";
import { type ZodType } from "zod";
import { printError } from "../../../../shared/log/error.js";
import type { ProductId } from "../../../../shared/schemas/primitives.js";
import { getProductId } from "../../../../shared/coinbase/product.js";

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
} as const;

export function printErrorAndExit(commandName: string, e: unknown, code = 1) {
  console.log(`Error running ${commandName}`);
  printError(e);
  process.exit(code);
}

type AsyncVoid = Promise<void> | void;
type Parser<TArgs extends unknown[]> = (...raw: unknown[]) => TArgs;
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
  return withCommandError(commandName, async (...raw: unknown[]) => {
    const args = parser(...raw);
    await handler(...args);
  });
}

export function parseNone(): Parser<[]> {
  return () => [];
}

export function parseArg<TArg>(argSchema: ZodType<TArg>): Parser<[TArg]> {
  return (rawArg: unknown) => [argSchema.parse(rawArg)];
}

export function parseArgOptions<TArg, TOptions>(
  argSchema: ZodType<TArg>,
  optionsSchema: ZodType<TOptions>,
): Parser<[TArg, TOptions]> {
  return (rawArg: unknown, rawOptions: unknown) => [
    argSchema.parse(rawArg),
    optionsSchema.parse(rawOptions),
  ];
}

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
