import type { LimitTpSlOptions, PlanOptions } from "./schemas/command-options.js";
import { placeLimitTpSlOrder } from "../service/order-service.js";
import {
  getProductId,
  getProductInfo,
  getTransactionSummary,
  requestCurrencyAccount,
} from "#shared/coinbase/index";
import { toIncrement } from "#shared/common/index";

type TradePlanBuildInput = {
  product: string;
  baseIncrement: string;
  priceIncrement: string;
  buyPrice: number;
  stopPrice: number;
  takeProfitPrice: number;
  bufferPercent: number;
  riskPercent: number;
  allIn: boolean;
  usdBalance: number;
  makerFeeRate: number;
  takerFeeRate: number;
};

type TradePlanBuildFailure = {
  ok: false;
  error: string;
  warnings: string[];
};

type TradePlanBuildSuccess = {
  ok: true;
  warnings: string[];
  adjustedForUsdBalance: boolean;
  allIn: boolean;
  product: string;
  riskPercent: string;
  effectiveRiskPercent: number;
  buyPrice: string;
  stopPrice: string;
  takeProfitPrice: string;
  positionSize: number;
  positionSizeDisplay: string;
  makerFeeRate: number;
  takerFeeRate: number;
  maxRiskAmount: number;
  actualRisk: number;
  takeProfitSubtotal: number;
  takeProfitFee: number;
  netTakeProfit: number;
  netTakeProfitPnl: number;
  totalFeesWhenProfit: number;
  stopLossSubtotal: number;
  stopLossFee: number;
  netStopLoss: number;
  netStopLossPnL: number;
  totalFeesWhenLoss: number;
  totalCostWithFee: number;
  buyFee: number;
  rewardPercentage: number;
  riskPercentageCalc: number;
  accountRoiOnWinPercentage: number;
  accountRoiOnLossPercentage: number;
  rawRatio: number;
  trueRrRatio: number;
  orderOptions: LimitTpSlOptions;
};

type TradePlanBuildResult = TradePlanBuildFailure | TradePlanBuildSuccess;

export function buildTradePlan(input: TradePlanBuildInput): TradePlanBuildResult {
  const warnings: string[] = [];
  let numStopPrice = input.stopPrice;

  if (input.bufferPercent > 0) {
    warnings.push(`Adding ${input.bufferPercent.toFixed(2)}% buffer to stop`);
    numStopPrice *= 1 - input.bufferPercent / 100;
  }

  const buyPrice = toIncrement(input.priceIncrement, input.buyPrice);
  const stopPrice = toIncrement(input.priceIncrement, numStopPrice);
  const takeProfitPrice = toIncrement(input.priceIncrement, input.takeProfitPrice);
  const effectiveBuyPrice = parseFloat(buyPrice);
  const effectiveStopPrice = parseFloat(stopPrice);
  const effectiveTakeProfitPrice = parseFloat(takeProfitPrice);
  const riskPercent = input.riskPercent.toFixed(2);
  const requestedMaxRiskAmount = (input.usdBalance * input.riskPercent) / 100;

  if (effectiveStopPrice >= effectiveBuyPrice) {
    return {
      ok: false,
      warnings,
      error: `stopPrice ${stopPrice} cannot be greater than or equal to buyPrice ${buyPrice}`,
    };
  }
  if (effectiveTakeProfitPrice <= effectiveBuyPrice) {
    return {
      ok: false,
      warnings,
      error: `takeProfitPrice ${takeProfitPrice} cannot be less than or equal to buyPrice ${buyPrice}`,
    };
  }

  const totalCostPerUnit =
    effectiveBuyPrice -
    effectiveStopPrice +
    effectiveBuyPrice * input.makerFeeRate +
    effectiveStopPrice * input.takerFeeRate;
  let positionSize = input.allIn
    ? input.usdBalance / (effectiveBuyPrice * (1 + input.makerFeeRate))
    : requestedMaxRiskAmount / totalCostPerUnit;
  let positionSizeDisplay = toIncrement(input.baseIncrement, positionSize);
  let effectivePositionSize = parseFloat(positionSizeDisplay);

  if (isNaN(effectivePositionSize) || effectivePositionSize <= 0) {
    return {
      ok: false,
      warnings,
      error: "Calculated position size is too small for the product base increment.",
    };
  }

  let totalBuyCost = effectivePositionSize * effectiveBuyPrice;
  let buyFee = totalBuyCost * input.makerFeeRate;
  let totalCostWithFee = totalBuyCost + buyFee;
  let adjustedForUsdBalance = false;

  if (totalCostWithFee > input.usdBalance) {
    adjustedForUsdBalance = true;
    positionSize = input.usdBalance / (effectiveBuyPrice * (1 + input.makerFeeRate));
    positionSizeDisplay = toIncrement(input.baseIncrement, positionSize);
    effectivePositionSize = parseFloat(positionSizeDisplay);
    if (isNaN(effectivePositionSize) || effectivePositionSize <= 0) {
      return {
        ok: false,
        warnings,
        error: "Available USD is too low for the product base increment.",
      };
    }

    totalBuyCost = effectivePositionSize * effectiveBuyPrice;
    buyFee = totalBuyCost * input.makerFeeRate;
    totalCostWithFee = totalBuyCost + buyFee;
  }

  const takeProfitSubtotal = effectivePositionSize * effectiveTakeProfitPrice;
  const takeProfitFee = takeProfitSubtotal * input.makerFeeRate;
  const netTakeProfit = takeProfitSubtotal - takeProfitFee;
  const netTakeProfitPnl = netTakeProfit - totalCostWithFee;
  const rewardPercentage = ((effectiveTakeProfitPrice - effectiveBuyPrice) / effectiveBuyPrice) * 100;

  const stopLossSubtotal = effectivePositionSize * effectiveStopPrice;
  const stopLossFee = stopLossSubtotal * input.takerFeeRate;
  const netStopLoss = stopLossSubtotal - stopLossFee;
  const netStopLossPnL = netStopLoss - totalCostWithFee;
  const actualRisk = Math.abs(netStopLossPnL);
  const riskPercentageCalc = ((effectiveBuyPrice - effectiveStopPrice) / effectiveBuyPrice) * 100;

  if (!input.allIn && actualRisk - 0.01 > requestedMaxRiskAmount) {
    return {
      ok: false,
      warnings,
      error: `Calculated risk ($${actualRisk.toFixed(2)}) exceeds allowed max risk ($${requestedMaxRiskAmount.toFixed(2)}).`,
    };
  }

  const rawRatio = rewardPercentage / riskPercentageCalc;
  const trueRrRatio = netTakeProfitPnl / actualRisk;
  const accountRoiOnWinPercentage = (netTakeProfitPnl / input.usdBalance) * 100;
  const accountRoiOnLossPercentage = (netStopLossPnL / input.usdBalance) * 100;
  const effectiveRiskPercent = (actualRisk / input.usdBalance) * 100;
  const totalFeesWhenProfit = buyFee + takeProfitFee;
  const totalFeesWhenLoss = buyFee + stopLossFee;

  return {
    ok: true,
    warnings,
    adjustedForUsdBalance,
    allIn: input.allIn,
    product: input.product,
    riskPercent,
    effectiveRiskPercent,
    buyPrice,
    stopPrice,
    takeProfitPrice,
    positionSize: effectivePositionSize,
    positionSizeDisplay,
    makerFeeRate: input.makerFeeRate,
    takerFeeRate: input.takerFeeRate,
    maxRiskAmount: requestedMaxRiskAmount,
    actualRisk,
    takeProfitSubtotal,
    takeProfitFee,
    netTakeProfit,
    netTakeProfitPnl,
    totalFeesWhenProfit,
    stopLossSubtotal,
    stopLossFee,
    netStopLoss,
    netStopLossPnL,
    totalFeesWhenLoss,
    totalCostWithFee,
    buyFee,
    rewardPercentage,
    riskPercentageCalc,
    accountRoiOnWinPercentage,
    accountRoiOnLossPercentage,
    rawRatio,
    trueRrRatio,
    orderOptions: {
      baseSize: positionSizeDisplay,
      limitPrice: buyPrice,
      stopPrice,
      takeProfitPrice,
    },
  };
}

export function renderTradePlan(plan: TradePlanBuildSuccess): void {
  const formatUsd = (value: number): string => `$${value.toFixed(2)}`;
  const formatSignedUsd = (value: number): string => `${value >= 0 ? "+" : "-"}$${Math.abs(value).toFixed(2)}`;
  const formatSignedPercent = (value: number): string => `${value >= 0 ? "+" : "-"}${Math.abs(value).toFixed(2)}%`;

  if (plan.adjustedForUsdBalance) {
    console.log("\nAdjusting position size to fit within available USD...");
  }

  console.log("\nRisk Details:");
  console.log(`  Sizing Mode:       ${plan.allIn ? "ALL-IN" : "RISK%"}`);
  console.log(`  Risk Percentage:   ${plan.riskPercent}%${plan.allIn ? " (ignored for sizing)" : ""}`);
  console.log(`  Effective Risk:    ${plan.effectiveRiskPercent.toFixed(2)}%`);
  console.log(`  Max Risk Allowed:  ${formatUsd(plan.maxRiskAmount)}`);
  console.log(`  Actual Risk:       ${formatUsd(plan.actualRisk)}`);
  console.log("\nEntry Details:");
  console.log(`  Buy Price:         $${plan.buyPrice}`);
  console.log(`  Position Size:     ${plan.positionSizeDisplay} ${plan.product.toUpperCase()}`);
  console.log(`  Entry Fee (${(plan.makerFeeRate * 100).toFixed(2)}%): ${formatUsd(plan.buyFee)}`);
  console.log(`  Total Entry Cost:  ${formatUsd(plan.totalCostWithFee)}`);
  console.log("\nProfit Details:");
  console.log(`  Price:             $${plan.takeProfitPrice} (${plan.rewardPercentage.toFixed(2)}%)`);
  console.log(`  Gross Proceeds:    ${formatUsd(plan.takeProfitSubtotal)}`);
  console.log(`  Exit Fee (${(plan.makerFeeRate * 100).toFixed(2)}%):  ${formatUsd(plan.takeProfitFee)}`);
  console.log(`  Total Fees:        ${formatUsd(plan.totalFeesWhenProfit)}`);
  console.log(`  Net Proceeds:      ${formatUsd(plan.netTakeProfit)}`);
  console.log(`  Net PnL:           ${formatSignedUsd(plan.netTakeProfitPnl)}`);
  console.log(`  Account ROI:       ${formatSignedPercent(plan.accountRoiOnWinPercentage)}`);
  console.log("\nStop-Loss Details:");
  console.log(`  Price:             $${plan.stopPrice} (-${plan.riskPercentageCalc.toFixed(2)}%)`);
  console.log(`  Gross Proceeds:    ${formatUsd(plan.stopLossSubtotal)}`);
  console.log(`  Exit Fee (${(plan.takerFeeRate * 100).toFixed(2)}%):  ${formatUsd(plan.stopLossFee)}`);
  console.log(`  Total Fees:        ${formatUsd(plan.totalFeesWhenLoss)}`);
  console.log(`  Net Proceeds:      ${formatUsd(plan.netStopLoss)}`);
  console.log(`  Net PnL:           ${formatSignedUsd(plan.netStopLossPnL)}`);
  console.log(`  Account ROI:       ${formatSignedPercent(plan.accountRoiOnLossPercentage)}`);
  console.log("\nRisk/Reward:");
  console.log(`  Raw R/R:           ${plan.rawRatio.toFixed(2)}:1`);
  console.log(`  True R/R:          ${plan.trueRrRatio.toFixed(2)}:1\n`);
}
export async function handlePlanAction(product: string, options: PlanOptions): Promise<void> {
  // Ensure product is set
  const productInstance = await getProductInfo(product);

  const buyPrice = parseFloat(options.buyPrice);
  const bufferPercent = parseFloat(options.bufferPercent);
  const takeProfitPrice = parseFloat(options.takeProfitPrice);
  const stopPrice = parseFloat(options.stopPrice);
  const riskPercent = parseFloat(options.riskPercent);
  const allIn = options.allIn;

  // Retrieve USD balance (rounded down to nearest 500)
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
    console.error("handlePlanAction => Unable to retrieve USD balance or balance is zero.");
    return;
  }

  // Fees and risk calculation
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
    console.error(`handlePlanAction => ${plan.error}`);
    if (plan.error.startsWith("Calculated risk")) {
      console.log("   Consider adjusting the stop price or risk percentage.");
    }
    return;
  }

  renderTradePlan(plan);

  if (options.dryRunFlag) {
    console.log(" Dry run.");
    process.stdin.pause();
    return;
  }

  // Prepare and send order payload
  console.log("\n Payload Details:");
  const limitTpSlOptions = {
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
