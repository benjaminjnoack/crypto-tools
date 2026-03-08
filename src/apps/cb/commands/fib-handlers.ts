import readlineSync from "readline-sync";
import type { FibOptions, LimitTpSlOptions } from "./schemas/command-options.js";
import { placeLimitTpSlOrder } from "../service/order-service.js";
import { buildTradePlan, renderTradePlan } from "./plan-handlers.js";
import {
  getProductId,
  getProductInfo,
  getTransactionSummary,
  requestCurrencyAccount,
} from "#shared/coinbase/index";

const ENTRY_LEVELS = [0.382, 0.295, 0.236] as const;
const EXIT_LEVELS = [1.272, 1.414, 1.618, 2, 2.272, 2.414, 2.618, 3, 3.272, 3.618, 4, 4.236, 4.618, 5] as const;
const DEFAULT_ENTRY_LEVEL = 0.382;
const DEFAULT_EXIT_LEVEL = 1.618;
const EPSILON = 1e-9;

function deriveFibPrice(fib0: number, fib1: number, level: number): number {
  return fib0 + (fib1 - fib0) * level;
}

function promptFibLevel(
  label: string,
  levels: readonly number[],
  defaultLevel: number,
  fib0: number,
  fib1: number,
): number {
  const defaultIndex = levels.indexOf(defaultLevel);
  if (defaultIndex < 0) {
    throw new Error(`Default ${label} fib level ${defaultLevel} was not found in configured levels.`);
  }

  console.log(`\n${label} Levels:`);
  levels.forEach((level, idx) => {
    const price = deriveFibPrice(fib0, fib1, level);
    const isDefault = level === defaultLevel ? " (default)" : "";
    console.log(`  ${idx + 1}) ${level.toFixed(3)} @ $${price.toFixed(2)}${isDefault}`);
  });

  const raw = readlineSync.question(`Choose ${label.toLowerCase()} level [${defaultIndex + 1}]: `).trim();
  if (!raw) {
    return defaultLevel;
  }

  const selectedIndex = Number.parseInt(raw, 10);
  if (Number.isInteger(selectedIndex) && selectedIndex >= 1 && selectedIndex <= levels.length) {
    const selectedByIndex = levels[selectedIndex - 1];
    if (selectedByIndex !== undefined) {
      return selectedByIndex;
    }
  }

  const selectedLevel = Number.parseFloat(raw);
  if (levels.some((level) => Math.abs(level - selectedLevel) < 1e-9)) {
    return selectedLevel;
  }

  throw new Error(`Invalid ${label.toLowerCase()} level selection "${raw}". Use a menu number or a listed fib level.`);
}

function parseLevelSelection(raw: string, levels: readonly number[], kind: "entry" | "take-profit"): number {
  const direct = Number.parseFloat(raw);
  if (Number.isFinite(direct) && levels.some((level) => Math.abs(level - direct) < EPSILON)) {
    return direct;
  }

  if (!/^\d+$/.test(raw)) {
    throw new Error(
      `Invalid ${kind} extension "${raw}". Use one of the configured extensions (decimal or shorthand).`,
    );
  }

  if (raw.length > 3) {
    throw new Error(
      `Invalid ${kind} extension "${raw}". Use one of the configured extensions (decimal or shorthand).`,
    );
  }
  const normalized = Number(kind === "entry"
    ? `0.${raw.padStart(3, "0")}`
    : `1.${raw.padStart(3, "0")}`);

  if (levels.some((level) => Math.abs(level - normalized) < EPSILON)) {
    return normalized;
  }

  throw new Error(
    `Invalid ${kind} extension "${raw}". Use one of the configured extensions (decimal or shorthand).`,
  );
}

function toNiceStep(target: number): number {
  const exponent = Math.floor(Math.log10(target));
  const magnitude = 10 ** exponent;
  const normalized = target / magnitude;
  if (normalized <= 1) {
    return magnitude;
  }
  if (normalized <= 2) {
    return 2 * magnitude;
  }
  if (normalized <= 5) {
    return 5 * magnitude;
  }
  return 10 * magnitude;
}

function roundUp(value: number, step: number): number {
  return Math.ceil((value - EPSILON) / step) * step;
}

function roundDown(value: number, step: number): number {
  return Math.floor((value + EPSILON) / step) * step;
}

function resolveRoundStep(entryPrice: number, takeProfitPrice: number, priceIncrement: number): number {
  const referencePrice = Math.max((entryPrice + takeProfitPrice) / 2, priceIncrement);
  const target = Math.max(referencePrice * 0.001, priceIncrement);
  const niceStep = toNiceStep(target);
  const increments = Math.max(1, Math.round(niceStep / priceIncrement));
  return increments * priceIncrement;
}

export async function handleFibAction(product: string, options: FibOptions): Promise<void> {
  const productInstance = await getProductInfo(product);

  const fib0 = parseFloat(options.floor);
  const fib1 = parseFloat(options.ceiling);
  const bufferPercent = parseFloat(options.bufferPercent);
  const riskPercent = parseFloat(options.riskPercent);
  const allIn = options.allIn;

  if (fib1 <= fib0) {
    console.error(`handleFibAction => fib1 (${fib1}) must be greater than fib0 (${fib0}) for spot long planning.`);
    return;
  }

  const entryLevel = options.entry
    ? parseLevelSelection(options.entry, ENTRY_LEVELS, "entry")
    : promptFibLevel("Entry", ENTRY_LEVELS, DEFAULT_ENTRY_LEVEL, fib0, fib1);
  const takeProfitLevel = options.takeProfit
    ? parseLevelSelection(options.takeProfit, EXIT_LEVELS, "take-profit")
    : promptFibLevel("Take-Profit", EXIT_LEVELS, DEFAULT_EXIT_LEVEL, fib0, fib1);
  const rawBuyPrice = deriveFibPrice(fib0, fib1, entryLevel);
  const rawTakeProfitPrice = deriveFibPrice(fib0, fib1, takeProfitLevel);
  const priceIncrement = parseFloat(productInstance.price_increment);
  const shouldRound = options.round;
  const roundStep = shouldRound ? resolveRoundStep(rawBuyPrice, rawTakeProfitPrice, priceIncrement) : null;
  const buyPrice = shouldRound && roundStep !== null ? roundUp(rawBuyPrice, roundStep) : rawBuyPrice;
  const takeProfitPrice = shouldRound && roundStep !== null ? roundDown(rawTakeProfitPrice, roundStep) : rawTakeProfitPrice;
  const stopPrice = fib0;

  if (takeProfitPrice <= buyPrice) {
    throw new Error("Rounded take-profit price must remain greater than rounded entry price.");
  }

  console.log(`\nSelected Entry: Fib ${entryLevel.toFixed(3)} @ $${buyPrice.toFixed(2)}`);
  console.log(`Selected TP:    Fib ${takeProfitLevel.toFixed(3)} @ $${takeProfitPrice.toFixed(2)}`);
  console.log(`Stop Anchor:    Fib 0.000 @ $${fib0.toFixed(2)}`);
  if (shouldRound && roundStep !== null) {
    console.log(`Round Step:     $${roundStep.toFixed(8)}`);
  }

  const { available, hold, total } = await requestCurrencyAccount("USD", "0.01");
  console.info(`Available = ${available}, Hold = ${hold}, Total = ${total}`);

  let usdBalance: string;
  if (options.dryRunFlag) {
    usdBalance = total;
  } else {
    const numHold = parseFloat(hold);
    if (numHold > 0) {
      console.warn(`$${hold} under hold. Other positions are open.`);
    }
    usdBalance = available;
  }
  const numUsdBalance = Math.floor(parseFloat(usdBalance) / 500) * 500;
  if (isNaN(numUsdBalance) || numUsdBalance <= 0) {
    console.error("handleFibAction => Unable to retrieve USD balance or balance is zero.");
    return;
  }

  const { fee_tier } = await getTransactionSummary();
  const { pricing_tier, taker_fee_rate, maker_fee_rate } = fee_tier;
  console.log(`Pricing Tier: ${pricing_tier}`);
  const makerFeeRate = parseFloat(maker_fee_rate);
  const takerFeeRate = parseFloat(taker_fee_rate);

  const plan = buildTradePlan({
    product,
    baseIncrement: productInstance.base_increment,
    priceIncrement: productInstance.price_increment,
    buyPrice,
    stopPrice,
    takeProfitPrice,
    bufferPercent,
    riskPercent,
    allIn,
    usdBalance: numUsdBalance,
    makerFeeRate,
    takerFeeRate,
  });

  plan.warnings.forEach((warning) => console.warn(warning));
  if (!plan.ok) {
    console.error(`handleFibAction => ${plan.error}`);
    if (plan.error.startsWith("Calculated risk")) {
      console.log("   Consider adjusting the selected entry level or risk percentage.");
    }
    return;
  }

  renderTradePlan(plan);

  if (options.dryRunFlag) {
    console.log(" Dry run.");
    process.stdin.pause();
    return;
  }

  console.log("\n Payload Details:");
  const limitTpSlOptions: LimitTpSlOptions = {
    ...plan.orderOptions,
    postOnly: options.postOnly ?? true,
  };
  console.log(`  Product: ${product}`);
  console.log(`  Buy Price: ${limitTpSlOptions.limitPrice}`);
  console.log(`  Base Size: ${limitTpSlOptions.baseSize}`);
  console.log(`  Take Profit Price: ${limitTpSlOptions.takeProfitPrice}`);
  console.log(`  Stop Price: ${limitTpSlOptions.stopPrice}`);
  console.log(`  Post Only: ${limitTpSlOptions.postOnly}`);

  await placeLimitTpSlOrder(getProductId(product), limitTpSlOptions);
}
