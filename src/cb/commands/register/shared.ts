import process from "node:process";
import { type ZodType } from "zod";
import { printError } from "../../../lib/log/error.js";
import type { ProductId } from "../../../lib/schemas/primitives.js";
import { getProductId } from "../../../lib/coinbase/product.js";

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

export function withNoArgs(commandName: string, handler: () => AsyncVoid) {
  return withCommandError(commandName, async () => {
    await handler();
  });
}

export function withValidatedArg<TArg>(
  commandName: string,
  argSchema: ZodType<TArg>,
  handler: (arg: TArg) => AsyncVoid,
) {
  return withCommandError(commandName, async (rawArg: unknown) => {
    const arg = argSchema.parse(rawArg);
    await handler(arg);
  });
}

export function withOptionalProduct(commandName: string, handler: (productId: ProductId | null) => AsyncVoid) {
  return withCommandError(commandName, async (rawProduct: unknown) => {
    if (rawProduct) {
      const productId: ProductId = (typeof rawProduct === "string") ? getProductId(rawProduct) : getProductId(DEFAULT_PRODUCT);
      await handler(productId);
    } else {
      await handler(null);
    }
  });
}

export function withValidatedOptions<TOptions>(
  commandName: string,
  optionsSchema: ZodType<TOptions>,
  handler: (product: ProductId | null, options: TOptions) => AsyncVoid,
) {
  return withCommandError(commandName, async (rawProduct: unknown, rawOptions: unknown) => {
    const options = optionsSchema.parse(rawOptions);
    if (rawProduct) {
      const productId: ProductId = (typeof rawProduct === "string") ? getProductId(rawProduct) : getProductId(DEFAULT_PRODUCT);
      await handler(productId, options);
    } else {
      await handler(null, options);
    }
  });
}

export function withValidatedProductId(
  commandName: string,
  handler: (productId: string) => AsyncVoid,
) {
  return withCommandError(commandName, async (rawProduct: unknown) => {
    const productId = getProductId((rawProduct ?? DEFAULT_PRODUCT) as string);
    await handler(productId);
  });
}

export function withValidatedProductIdOptions<TOptions>(
  commandName: string,
  optionsSchema: ZodType<TOptions>,
  handler: (productId: string, options: TOptions) => AsyncVoid,
) {
  return withCommandError(commandName, async (rawProduct: unknown, rawOptions: unknown) => {
    const productId = getProductId((rawProduct ?? DEFAULT_PRODUCT) as string);
    const options = optionsSchema.parse(rawOptions);
    await handler(productId, options);
  });
}
