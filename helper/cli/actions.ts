import axios, { AxiosError, type AxiosRequestConfig } from 'axios';
import Product from '@cb/Product';
import { requestCurrencyAccount } from '@cb/http/rest.js';
import { toIncrement } from '@core/increment';
import {
  checkConfirmation,
  DEFAULT_PRODUCT,
  ensureProduct,
  getProductInstance,
  getProductNameFromPositionName,
  isHelperServiceRunning,
  printApiResponseData,
  printPosition,
  promptYesNo,
  readline,
} from '@cli/utils';
import { log } from '@core/logger.js';
import { safeNumber } from '@core/validation.js';
import { checkFib, getPriceForFib, getSchedule, NUM_SCHEDULES } from '@core/schedule.js';
import { readOrder } from '@order/service.js';
import { loadOrder } from '@cb/order/service.js';
import { endClient } from '@db/client';
import { getTransactionSummary } from '@cb/cached.js';
import type { PositionJSON } from '@core/dictionary';
import {
  type BreakRequest,
  type ExecRequest,
  type ModifyRequest,
  type OpenRequest,
  type PositionFills,
  PositionFillsSchema,
  type PrepRequest,
  type ScheduleRequest,
  type TakeProfitRequest,
  type TrailRequest,
} from '@http/contracts';
import {
  type FibOptions,
  type LoadOrderOptions,
  type ModifyOptions,
  type OpenOptions,
  type PlanOptions,
  type ReadOrderOptions,
  type ScheduleOptions,
  type TakeProfitOptions,
  type TrailOptions,
} from '@cli/contracts';

const JSON_HEADERS_CONFIG: AxiosRequestConfig = {
  headers: { 'Content-Type': 'application/json' },
};

const DEFAULT_POSITION = 'btc';

function printServerError(message: string, e: any): void {
  log.error(message);
  if (e instanceof AxiosError) {
    log.error(e.message);
    log.error(e.code);
  } else if (e instanceof Error) {
    log.error(e.message);
  } else {
    log.error(e);
  }
}

export async function handleAskAction(position: string): Promise<void> {
  try {
    if (!position) {
      log.warn(`Defaulting to ${DEFAULT_POSITION}`);
      position = DEFAULT_POSITION;
    }

    let confirmation = await readline(
      `Do you want to SELL ${position} at the asking price? (y/n): `,
    );
    if (!checkConfirmation(confirmation)) {
      console.log(' Aborted by the user.');
      process.stdin.pause();
      return;
    }
    isHelperServiceRunning();
    let url = 'http://localhost:3000/ask';
    url += `?position=${encodeURIComponent(position)}`;
    const response = await axios.delete(url); //TODO why is this delete?
    printApiResponseData(response.data);
  } catch (e) {
    printServerError('Error Closing Position', e);
  }
}

export async function handleBreakEvenAction(position: string): Promise<void> {
  try {
    if (!position) {
      log.warn(`Defaulting to ${DEFAULT_POSITION}`);
      position = DEFAULT_POSITION;
    }

    let confirmation = await readline(
      `Do you want modify the sell order for ${position} to Break Even? (y/n): `,
    );
    if (!checkConfirmation(confirmation)) {
      console.log(' Aborted by the user.');
      process.stdin.pause();
      return;
    }

    const payload: BreakRequest = {
      position,
    };

    isHelperServiceRunning();
    const response = await axios.post(`http://localhost:3000/break`, payload, JSON_HEADERS_CONFIG);
    printApiResponseData(response.data);
    const positionName = response.data.success.pop();
    await handleStateAction(positionName);
  } catch (e) {
    printServerError('Error Breaking Even On Position', e);
  } finally {
    process.stdin.pause();
  }
}

export async function handleCancelAction(position: string): Promise<void> {
  try {
    if (!position) {
      log.warn(`Defaulting to ${DEFAULT_POSITION}`);
      position = DEFAULT_POSITION;
    }

    let confirmation = await readline(`Do you want cancel the ${position} position? (y/n): `);
    if (!checkConfirmation(confirmation)) {
      console.log(' Aborted by the user.');
      process.stdin.pause();
      return;
    }

    isHelperServiceRunning();
    const response = await axios.delete(
      `http://localhost:3000/cancel?position=${encodeURIComponent(position)}`,
    );
    printApiResponseData(response.data);
    const positionName = response.data.success.pop();

    confirmation = await readline(`Do you want clear the positions? (y/n): `);
    if (checkConfirmation(confirmation)) {
      await handleClearAction(positionName);
    }
    await handleStateAction(null);
  } catch (e) {
    printServerError('Error Cancelling Position', e);
  } finally {
    process.stdin.pause();
  }
}

export async function handleClearAction(position: string): Promise<void> {
  try {
    isHelperServiceRunning();
    let url = 'http://localhost:3000/clear';
    if (position) {
      url += `?position=${encodeURIComponent(position)}`;
    }
    const response = await axios.delete(url);
    printApiResponseData(response.data);
  } catch (e) {
    printServerError('Error Clearing Positions', e);
  }
}

export async function handleExecAction(position: string): Promise<void> {
  try {
    if (!position) {
      log.warn(`Defaulting to ${DEFAULT_POSITION}`);
      position = DEFAULT_POSITION;
    }

    let confirmation = await readline(`Do you want EXECUTE the ${position} position? (y/n): `);
    if (!checkConfirmation(confirmation)) {
      console.log(' Aborted by the user.');
      process.stdin.pause();
      return;
    }

    const payload: ExecRequest = {
      position,
    };

    isHelperServiceRunning();
    const response = await axios.post(`http://localhost:3000/exec`, payload, JSON_HEADERS_CONFIG);
    printApiResponseData(response.data);
    const positionName = response.data.success.pop();
    await handleStateAction(positionName);
  } catch (e) {
    printServerError('Error Executing Position', e);
  } finally {
    process.stdin.pause();
  }
}

export async function handleFibAction(product: string, options: FibOptions): Promise<void> {
  try {
    // Ensure product is set
    product = await ensureProduct(product);
    const productInstance = await getProductInstance(product);

    const stopPrice = toIncrement(productInstance.price_increment, options.zeroPrice);
    const bufferPercent = options.bufferPercent.toFixed(2);
    const riskPercent = options.riskPercent.toFixed(2);

    if (!checkFib(options.buyFib)) {
      options.buyFib /= 1000;
      if (checkFib(options.buyFib)) {
        log.info(`Using buy fib ${options.buyFib}`);
      } else {
        log.warn(`handleFibAction => ${options.buyFib} is not a fib extension`);
        return;
      }
    }
    const buyPrice = getPriceForFib(
      options.zeroPrice,
      options.onePrice,
      options.buyFib,
      productInstance.price_increment,
    );

    // The default should be 2
    // A 2:1 R:R allows for two bites at the apple and still making one R
    if (!checkFib(options.takeProfitFib)) {
      options.takeProfitFib /= 1000;
      if (checkFib(options.takeProfitFib)) {
        log.info(`Using buy fib ${options.takeProfitFib}`);
      } else {
        log.warn(`handleFibAction => ${options.takeProfitFib} is not a fib extension`);
        return;
      }
    }
    const takeProfitPrice = getPriceForFib(
      options.zeroPrice,
      options.onePrice,
      options.takeProfitFib,
      productInstance.price_increment,
    );

    const planOpts: PlanOptions = {
      bufferPercent: Number(bufferPercent),
      buyPrice: Number(buyPrice),
      dryRunFlag: options.dryRunFlag,
      riskPercent: Number(riskPercent),
      stopPrice: Number(stopPrice),
      takeProfitPrice: Number(takeProfitPrice),
    };

    await handlePlanAction(product, planOpts);
  } catch (e) {
    printServerError('Error Planning Fib Position', e);
  } finally {
    process.stdin.pause();
  }
}

export async function handleFillsAction(position: string): Promise<void> {
  try {
    if (!position) {
      log.warn(`Defaulting to ${DEFAULT_POSITION}`);
      position = DEFAULT_POSITION;
    }

    isHelperServiceRunning();
    const url = `http://localhost:3000/fills?position=${encodeURIComponent(position)}`;
    const response = await axios.get<unknown>(url, JSON_HEADERS_CONFIG);
    const data: PositionFills = PositionFillsSchema.parse(response.data);
    const { fills, name, totals } = data;

    // Format output
    console.log(`\n Position Name: ${name}`);
    console.log('\n Fill History:');
    fills.forEach((fill, index) => {
      console.log(`  ${index + 1}. ${fill.class} (${fill.side})`);
      console.log(`     Order ID:      ${fill.order_id}`);
      console.log(`     Filled Value:  $${fill.filled_value.toFixed(2)}`);
      console.log(`     Total Fees:    $${fill.total_fees.toFixed(2)}`);
      console.log(`     Total Value:   $${fill.total_value_after_fees.toFixed(2)}`);
      console.log('');
    });

    console.log(' Totals:');
    console.log('------------------------------------------');
    console.log(`  Value Bought:     $${totals.value_bought}`);
    console.log(`  Buy Fees:         $${totals.buy_fees}`);
    console.log('------------------------------------------');
    console.log(`  Value Sold:       $${totals.value_sold}`);
    console.log(`  Sell Fees:        $${totals.sell_fees}`);
    console.log('------------------------------------------');
    console.log(`  Total Fees:       $${totals.total_fees}`);
    console.log(`  Total:            $${totals.total}`);
    console.log('');
  } catch (e) {
    printServerError('Error Getting Position Fills', e);
  } finally {
    process.stdin.pause();
  }
}

export async function handleFireSaleAction() {
  try {
    // Confirm before sending the order
    const confirmation = await readline('DUMP IT? (y/n): ');
    if (!checkConfirmation(confirmation)) {
      console.log(' Aborted by the user.');
      process.stdin.pause();
      return;
    }
    console.log('Starting the Fire');
    const response = await axios.get(`http://localhost:3000/fire`, JSON_HEADERS_CONFIG);
    const data = response.data;
    console.log(data.message);
  } catch (e) {
    printServerError('Error Starting the Fire', e);
  } finally {
    process.stdin.pause();
  }
}

export async function handleLoadOrderAction(
  orderId: string,
  options: LoadOrderOptions,
): Promise<void> {
  await loadOrder(orderId, options.force, false, true, true);
  await endClient();
}

export async function handleModifyAction(position: string, options: ModifyOptions): Promise<void> {
  try {
    if (!position) {
      log.warn(`Defaulting to ${DEFAULT_POSITION}`);
      position = DEFAULT_POSITION;
    }

    const product = position.indexOf('-') === -1 ? position : position.split('-')[0];
    if (product === undefined) {
      throw new Error(`Product is undefined`);
    }
    // Get product details
    const productId = Product.getProductId(product);
    const productInstance = new Product(productId);
    await productInstance.update(false);

    const payload: ModifyRequest = {
      position,
      ...(options.buyPrice && {
        buy_price: toIncrement(productInstance.price_increment, options.buyPrice),
      }),
      ...(options.stopPrice && {
        stop_price: toIncrement(productInstance.price_increment, options.stopPrice),
      }),
      ...(options.takeProfitPrice && {
        target_price: toIncrement(productInstance.price_increment, options.takeProfitPrice),
      }),
      ...(options.orderId && { order_id: options.orderId }),
    };

    console.log('\nPosition:', payload.position);
    if (options.buyPrice) {
      console.log('Buy Price: ', payload.buy_price);
    }
    if (options.stopPrice) {
      console.log('Stop Loss:', payload.stop_price);
    }
    if (options.takeProfitPrice) {
      console.log('Take Profit:', payload.target_price);
    }
    if (options.orderId) {
      console.log('Order ID: ', payload.order_id);
    }

    const confirmation = await readline(`Do you want to modify the ${position} position? (y/n): `);
    if (!checkConfirmation(confirmation)) {
      console.log('Aborted by the user.');
      process.stdin.pause();
      return;
    }

    isHelperServiceRunning();
    const response = await axios.patch('http://localhost:3000/modify', payload, {
      headers: { 'Content-Type': 'application/json' },
    });

    const data = response.data;
    printApiResponseData(data);

    console.log('Modified Configs:');
    data.modified.forEach((modified: string) => {
      console.log(`\t${modified}`);
    });
    console.log();
    console.log('Errors:');
    data.errors.forEach((error: string) => {
      console.log(`\t${error}`);
    });
    console.log();

    const positionName = data.success.pop();
    await handleStateAction(positionName);
  } catch (e) {
    printServerError('Error Modifying Position', e);
  } finally {
    process.stdin.pause();
  }
}

export async function handleOpenAction(product: string, options: OpenOptions): Promise<void> {
  try {
    product = await ensureProduct(product);
    const productInstance = await getProductInstance(product);
    await productInstance.update(false);

    const buyPriceInc = toIncrement(productInstance.price_increment, options.buyPrice);
    const takeProfitPriceInc = toIncrement(
      productInstance.price_increment,
      options.takeProfitPrice,
    );
    const stopPriceInc = toIncrement(productInstance.price_increment, options.stopPrice);
    const valueFmt = options.value.toFixed(2);

    console.log('\nProduct:', product);
    console.log('Buy Price:', buyPriceInc);
    console.log('Stop Price:', stopPriceInc);
    console.log('Take Profit Price:', takeProfitPriceInc);
    console.log('Value:', valueFmt);

    const confirmation = await readline(`Do you want to open the ${product} position? (y/n): `);
    if (!checkConfirmation(confirmation)) {
      console.log('Aborted by the user.');
      process.stdin.pause();
      return;
    }

    const payload: OpenRequest = {
      product,
      buy_price: buyPriceInc,
      value: valueFmt,
      take_profit_price: takeProfitPriceInc,
      stop_price: stopPriceInc,
    };

    isHelperServiceRunning();
    const response = await axios.post('http://localhost:3000/open', payload, {
      headers: { 'Content-Type': 'application/json' },
    });

    printApiResponseData(response.data);
    const positionName = response.data.success.pop();
    await handleStateAction(positionName);
  } catch (e) {
    printServerError('Error Opening Position', e);
  } finally {
    process.stdin.pause();
  }
}

/**
 * TODO
 *  we no longer support multiple take profit prices
 *  therefore, a lot of the complexity of this function is unnecessary
 *  alos, the whole "schedule" idea is deprecated
 */
export async function handlePlanAction(product: string, options: PlanOptions): Promise<void> {
  try {
    // Ensure product is set
    product = await ensureProduct(product);
    const productInstance = await getProductInstance(product);

    let numBuyPrice = options.buyPrice;

    let numBufferPercent = options.bufferPercent;
    let bufferPercent = numBufferPercent.toFixed(2);

    let numTakeProfitPrice = options.takeProfitPrice;
    let numStopPrice = options.stopPrice;

    if (numBufferPercent > 0) {
      log.warn(`Adding ${bufferPercent}% buffer to stop`);
      numStopPrice *= 1 - numBufferPercent / 100;
    }

    if (product === DEFAULT_PRODUCT) {
      if (numBuyPrice < 100) {
        // 88
        numBuyPrice *= 1000; //88,000
      } else if (numBuyPrice < 1000) {
        //881
        numBuyPrice *= 100; //88100
      }
      if (numStopPrice < 100) {
        // 88
        numStopPrice *= 1000; //88,000
      } else if (numStopPrice < 1000) {
        //881
        numStopPrice *= 100; //88100
      }
      if (numTakeProfitPrice < 100) {
        // 88
        numTakeProfitPrice *= 1000; //88,000
      } else if (numTakeProfitPrice < 1000) {
        //881
        numTakeProfitPrice *= 100; //88100
      }
    }

    let buyPrice = toIncrement(productInstance.price_increment, numBuyPrice);
    let stopPrice = toIncrement(productInstance.price_increment, numStopPrice);
    let takeProfitPrice = toIncrement(productInstance.price_increment, numTakeProfitPrice);

    let numRiskPercent = options.riskPercent;
    let riskPercent = numRiskPercent.toFixed(2);

    // Final Checks
    if (numStopPrice >= numBuyPrice) {
      log.error(
        `handlePlanAction => stopPrice ${stopPrice} cannot be greater than or equal to buyPrice ${buyPrice}`,
      );
      return;
    }
    if (numTakeProfitPrice <= numBuyPrice) {
      log.error(
        `handlePlanAction => takeProfitPrice ${takeProfitPrice} cannot be less than or equal to buyPrice ${buyPrice}`,
      );
      return;
    }

    // Retrieve USD balance (rounded down to nearest 500)
    const { available, hold, total } = await requestCurrencyAccount('USD', '0.01');
    log.info(`Available = ${available}, Hold = ${hold}, Total = ${total}`);

    let usdBalance;
    if (options.dryRunFlag) {
      usdBalance = total;
    } else {
      const numHold = safeNumber(hold, 'handlePlanAction => hold');
      if (numHold > 0) {
        log.warn(`$${hold} under hold. Other positions are open.`);
      }
      usdBalance = available;
    }
    let numUsdBalance = safeNumber(usdBalance, 'plan => usdBalance');
    numUsdBalance = Math.floor(numUsdBalance / 500) * 500;
    if (isNaN(numUsdBalance) || numUsdBalance <= 0) {
      log.error('handlePlanAction => Unable to retrieve USD balance or balance is zero.');
      return;
    }

    // Fees and risk calculation
    const { fee_tier } = await getTransactionSummary();
    const { pricing_tier, taker_fee_rate, maker_fee_rate } = fee_tier;
    console.log(`Pricing Tier: ${pricing_tier}`);
    const makerFeeRate = safeNumber(maker_fee_rate, 'taker_fee_rate');
    const takerFeeRate = safeNumber(taker_fee_rate, 'taker_fee_rate');
    const maxRiskAmount = (numUsdBalance * numRiskPercent) / 100;
    const totalCostPerUnit =
      numBuyPrice - numStopPrice + numBuyPrice * makerFeeRate + numStopPrice * takerFeeRate;
    let positionSize = maxRiskAmount / totalCostPerUnit;

    // Compute cost and fees for the buy order
    let totalBuyCost = positionSize * numBuyPrice;
    let buyFee = totalBuyCost * makerFeeRate;
    let totalCostWithFee = totalBuyCost + buyFee;

    // Adjust position size if total cost exceeds USD balance
    if (totalCostWithFee > numUsdBalance) {
      console.log('\nAdjusting position size to fit within available USD...');
      positionSize = numUsdBalance / (numBuyPrice * (1 + makerFeeRate));
      totalBuyCost = positionSize * numBuyPrice;
      buyFee = totalBuyCost * makerFeeRate;
      totalCostWithFee = totalBuyCost + buyFee;
    }

    // The positionSize must be done after re-balancing for USD limits
    let takeProfitPrices = [
      {
        takeProfitPrice,
        numTakeProfitPrice,
        baseSize: positionSize,
      },
    ];
    // can only be calculated AFTER the takeProfitPrices array has been populated above
    let portionCostWithFee = totalCostWithFee / takeProfitPrices.length;

    // Map take profit orders with computed details
    let totalTakeProfitSubTotal = 0;
    let totalTakeProfitFee = 0;
    let totalNetTakeProfit = 0;
    let totalNetTakeProfitPnL = 0;
    let totalRewardPercentage = 0;

    /**
     * @type {{takeProfitPrice: string, numTakeProfitPrice: number, takeProfitSubtotal: number, takeProfitFee: number, netTakeProfit: number, netTakeProfitPnl: number, rewardPercentage: number, baseSize: number}[]}
     */
    const takeProfitOrders = takeProfitPrices.map(
      ({ takeProfitPrice, numTakeProfitPrice, baseSize }) => {
        const takeProfitSubtotal = baseSize * numTakeProfitPrice;
        totalTakeProfitSubTotal += takeProfitSubtotal;

        const takeProfitFee = takeProfitSubtotal * makerFeeRate;
        totalTakeProfitFee += takeProfitFee;

        const netTakeProfit = takeProfitSubtotal - takeProfitFee;
        totalNetTakeProfit += netTakeProfit;

        const netTakeProfitPnl = netTakeProfit - portionCostWithFee;
        totalNetTakeProfitPnL += netTakeProfitPnl;

        // TODO this does not account for fees
        const rewardPercentage = ((numTakeProfitPrice - numBuyPrice) / numBuyPrice) * 100;
        totalRewardPercentage += rewardPercentage;

        return {
          takeProfitPrice,
          numTakeProfitPrice,
          takeProfitSubtotal,
          takeProfitFee,
          netTakeProfit,
          netTakeProfitPnl,
          rewardPercentage,
          baseSize,
        };
      },
    );

    const averageRewardPercentage = totalRewardPercentage / takeProfitOrders.length;

    // Stop-loss computations
    const stopLossSubtotal = positionSize * numStopPrice;
    const stopLossFee = stopLossSubtotal * takerFeeRate;
    const netStopLoss = stopLossSubtotal - stopLossFee;
    const netStopLossPnL = netStopLoss - totalCostWithFee;
    const actualRisk = Math.abs(netStopLossPnL);
    const riskPercentageCalc = ((numBuyPrice - numStopPrice) / numBuyPrice) * 100;

    if (actualRisk - 0.01 > maxRiskAmount) {
      // Adjust for floating-point precision
      console.log(
        `\n Warning: Calculated risk ($${actualRisk.toFixed(2)}) exceeds allowed max risk ($${maxRiskAmount.toFixed(2)}).`,
      );
      console.log('   Consider adjusting the stop price or risk percentage.');
      return;
    }

    const rawRatio = averageRewardPercentage / riskPercentageCalc;
    const trueRrRatio = totalNetTakeProfitPnL / actualRisk;
    const totalFeesWhenProfit = buyFee + totalTakeProfitFee;
    const totalFeesWhenLoss = buyFee + stopLossFee;

    // Display the trade plan details
    console.log('\n Trade Plan:');
    console.log(`  Buy Price:        $${buyPrice}`);
    console.log(
      `  Position Size:    ${toIncrement(productInstance.base_increment, positionSize)} ${product.toUpperCase()}`,
    );
    console.log(`  Fee (${(makerFeeRate * 100).toFixed(2)}%):      $${buyFee.toFixed(2)}`);
    console.log(`  Total Cost:       $${totalCostWithFee.toFixed(2)}`);
    console.log('\n Risk Details:');
    console.log(`  Risk Percentage:  ${riskPercent}%`);
    console.log(`  Max Risk Allowed: $${maxRiskAmount.toFixed(2)}`);
    console.log(`  Actual Risk:      $${actualRisk.toFixed(2)}`);
    console.log('\n Take Profit Details:');
    takeProfitOrders.forEach(
      ({
        takeProfitPrice,
        takeProfitFee,
        takeProfitSubtotal,
        rewardPercentage,
        baseSize,
        netTakeProfit,
        netTakeProfitPnl,
      }) => {
        console.log(`  Price:            $${takeProfitPrice} (${rewardPercentage.toFixed(2)}%)`);
        console.log(
          `  Size:             ${toIncrement(productInstance.base_increment, baseSize)} ${product.toUpperCase()}`,
        );
        console.log(`  Subtotal:         $${takeProfitSubtotal.toFixed(2)}`);
        console.log(
          `  Fee (${(makerFeeRate * 100).toFixed(2)}%):      $${takeProfitFee.toFixed(2)}`,
        );
        console.log(`  Net:              $${netTakeProfit.toFixed(2)}`);
        console.log(`  PnL:              $${netTakeProfitPnl.toFixed(2)}\n`);
      },
    );
    console.log(' Total Profit Details:');
    console.log(`  Value:            $${totalTakeProfitSubTotal.toFixed(2)}`);
    console.log(`  Fees:             $${totalTakeProfitFee.toFixed(2)}`);
    console.log(`  Total Fees:       $${totalFeesWhenProfit.toFixed(2)}`);
    console.log(`  Net:              $${totalNetTakeProfit.toFixed(2)}`);
    console.log(`  PnL:              $${totalNetTakeProfitPnL.toFixed(2)}`);
    console.log(
      `  Reward:           ${averageRewardPercentage.toFixed(2)}% (${rawRatio.toFixed(2)}:1)`,
    );

    console.log('\nStop-Loss Details:');
    console.log(`  Stop Price:       $${stopPrice} (-${riskPercentageCalc.toFixed(2)}%)`);
    console.log(`  Proceeds:         $${stopLossSubtotal.toFixed(2)}`);
    console.log(`  Fee (${(takerFeeRate * 100).toFixed(2)}%):      $${stopLossFee.toFixed(2)}`);
    console.log(`  Total Fees:       $${totalFeesWhenLoss.toFixed(2)}`);
    console.log(`  Net:              $${netStopLoss.toFixed(2)}`);
    console.log(`  PnL:              $${netStopLossPnL.toFixed(2)}`);

    console.log(`\n True R/R:          ${trueRrRatio.toFixed(2)}:1\n`);

    if (options.dryRunFlag) {
      console.log(' Dry run.');
      process.stdin.pause();
      return;
    }

    // Prepare and send order payload
    console.log('\n Payload Details:');
    const payload: PrepRequest = {
      product,
      buy_price: buyPrice,
      value: totalBuyCost.toFixed(2),
      stop_price: stopPrice,
      take_profit_price: takeProfitOrders[0]!.takeProfitPrice, //TODO !!!
    };
    console.log(`  Product: ${payload.product}`);
    console.log(`  Buy Price: ${payload.buy_price}`);
    console.log(`  Value: ${payload.value}`);
    console.log(`  Stop Price: ${payload.stop_price}`);
    console.log(`  Take Profit Price: ${payload.take_profit_price}`);

    // Confirm before prepping the position
    let confirmation = await readline(`Do you want to PREP the ${product} position? (y/n): `);
    if (!checkConfirmation(confirmation)) {
      console.log(' Aborted by the user.');
      process.stdin.pause();
      return;
    }

    isHelperServiceRunning();
    const response = await axios.post('http://localhost:3000/prep', payload, JSON_HEADERS_CONFIG);
    const data = response.data;
    printApiResponseData(data);

    const positionName = response.data.success.pop();
    await handleStateAction(positionName, false);
    console.log();

    await handleExecAction(positionName);
  } catch (e) {
    printServerError('Error Planning Position', e);
  } finally {
    process.stdin.pause();
  }
}

export async function handleReadOrderAction(
  orderId: string,
  options: ReadOrderOptions,
): Promise<void> {
  await readOrder(orderId, options.force, false, true, true);
  await endClient();
}

export async function handleSaveAction() {
  try {
    log.info('saving position data');
    isHelperServiceRunning();
    const response = await axios.get(`http://localhost:3000/save`, JSON_HEADERS_CONFIG);
    printApiResponseData(response.data);
  } catch (e) {
    printServerError('Error Saving Position', e);
  } finally {
    process.stdin.pause();
  }
}

export async function handleSellAction(position: string): Promise<void> {
  try {
    if (!position) {
      log.warn(`Defaulting to ${DEFAULT_POSITION}`);
      position = DEFAULT_POSITION;
    }
    let confirmation = await readline(`Do you want MARKET SELL the ${position} position? (y/n): `);
    if (!checkConfirmation(confirmation)) {
      console.log(' Aborted by the user.');
      process.stdin.pause();
      return;
    }

    isHelperServiceRunning();
    const response = await axios.delete(
      `http://localhost:3000/sell?position=${encodeURIComponent(position)}`,
      JSON_HEADERS_CONFIG,
    );
    printApiResponseData(response.data);
    const positionName = response.data.success.pop();
    await handleStateAction(positionName);
  } catch (e) {
    printServerError('Error Closing Position', e);
  } finally {
    process.stdin.pause();
  }
}

export async function handleScheduleAction(
  position: string,
  options: ScheduleOptions,
): Promise<void> {
  if (Object.hasOwn(options, 'print')) {
    for (let i = 1; i <= NUM_SCHEDULES; i++) {
      const num = i.toFixed(0);
      const prices = getSchedule(num);
      console.log(num, '\t', prices.join(' '));
    }
    process.stdin.pause();
    return;
  }

  try {
    if (!position) {
      log.warn(`Defaulting to ${DEFAULT_POSITION}`);
      position = DEFAULT_POSITION;
    }

    // Ensure product is set
    const product = getProductNameFromPositionName(position);
    const productInstance = await getProductInstance(product);

    const scheduleFmt = options.schedule.toFixed(0);
    const zeroPriceInc = toIncrement(productInstance.price_increment, options.zeroPrice);
    const onePriceInc = toIncrement(productInstance.price_increment, options.onePrice);

    console.log(`\n Schedule:`, scheduleFmt);
    console.log(` Zero Price:`, zeroPriceInc);
    console.log(` One Price:`, zeroPriceInc);
    console.log();
    let confirmation = await readline(`Do you want to schedule the ${position} position? (y/n): `);
    if (!checkConfirmation(confirmation)) {
      console.log(' Aborted by the user.');
      process.stdin.pause();
      return;
    }

    const payload: ScheduleRequest = {
      position,
      schedule: scheduleFmt,
      zero_price: zeroPriceInc,
      one_price: onePriceInc,
    };

    isHelperServiceRunning();
    const response = await axios.post(
      `http://localhost:3000/schedule`,
      payload,
      JSON_HEADERS_CONFIG,
    );
    printApiResponseData(response.data);
    const positionName = response.data.success.pop();
    await handleStateAction(positionName);
  } catch (e) {
    printServerError('Error Getting Status', e);
  } finally {
    process.stdin.pause();
  }
}

export async function handleStateAction(
  position: string | null,
  pause: boolean = true,
): Promise<void> {
  try {
    let url = `http://localhost:3000/state`;
    if (typeof position === 'string') {
      url += `?position=${encodeURIComponent(position)}`;
    }

    isHelperServiceRunning();
    const response = await axios.get(url);
    const positions = response.data;

    if (positions.length === 0) {
      console.log('No active positions.');
      process.stdin.pause();
      return;
    }

    positions.forEach((pos: PositionJSON) => {
      printPosition(pos);
    });
  } catch (e) {
    printServerError('Error Getting Position State', e);
  } finally {
    if (pause) {
      process.stdin.pause();
    }
  }
}

export async function handleStatusAction() {
  try {
    isHelperServiceRunning();
    const response = await axios.get('http://localhost:3000/status');
    const { version, state, timestamp, uptime, positions } = response.data;

    console.log(`\nServer Status:\n`);
    console.log(`  Version:    ${version}`);
    console.log(`  State:      ${state}`);
    console.log(`  Timestamp:  ${timestamp}`);
    console.log(`  Uptime:     ${uptime}`);
    console.log(`  Positions:  ${Object.keys(positions).length} active positions`);

    if (Object.keys(positions).length > 0) {
      console.log(`\n  Active Positions:`);
      for (const [key, value] of Object.entries(positions)) {
        console.log(`    ${key}: ${value}`);
      }
    }
  } catch (e) {
    printServerError('Error Getting Status', e);
  } finally {
    process.stdin.pause();
  }
}

export async function handleTakeProfitAction(
  position: string,
  options: TakeProfitOptions,
): Promise<void> {
  try {
    const product = getProductNameFromPositionName(position);
    const productInstance = await getProductInstance(product);

    const takeProfitPriceInc = toIncrement(
      productInstance.price_increment,
      options.takeProfitPrice,
    );

    let confirmation = await readline(
      `Do you want to take profit on the ${position} position at ${takeProfitPriceInc}? (y/n): `,
    );
    if (!checkConfirmation(confirmation)) {
      console.log(' Aborted by the user.');
      process.stdin.pause();
      return;
    }

    const payload: TakeProfitRequest = {
      position,
      take_profit_price: takeProfitPriceInc,
    };

    isHelperServiceRunning();
    const response = await axios.post(`http://localhost:3000/tp`, payload, JSON_HEADERS_CONFIG);
    printApiResponseData(response.data);
    const positionName = response.data.success.pop();
    await handleStateAction(positionName);
  } catch (e) {
    printServerError('Error Taking Profit On Position', e);
  } finally {
    process.stdin.pause();
  }
}

export async function handleTrailAction(position: string, options: TrailOptions): Promise<void> {
  try {
    const product = getProductNameFromPositionName(position);
    const productInstance = await getProductInstance(product);

    const stopLossPriceInc = toIncrement(productInstance.price_increment, options.stopLossPrice);
    const targetPriceInc = toIncrement(productInstance.price_increment, options.targetPrice);

    let confirmation = await readline(
      `Do you want to install a stop loss (${stopLossPriceInc}) on the ${position} position at target ${targetPriceInc}? (y/n): `,
    );
    if (!checkConfirmation(confirmation)) {
      console.log(' Aborted by the user.');
      process.stdin.pause();
      return;
    }

    const payload: TrailRequest = {
      position,
      stop_loss_price: stopLossPriceInc,
      target_price: targetPriceInc,
    };

    isHelperServiceRunning();
    const response = await axios.post(`http://localhost:3000/trail`, payload, JSON_HEADERS_CONFIG);
    printApiResponseData(response.data);
    const positionName = response.data.success.pop();
    await handleStateAction(positionName);
  } catch (e) {
    printServerError('Error Installing Trailing Stop Loss On Position', e);
  } finally {
    process.stdin.pause();
  }
}

export async function handleTradeAction() {
  console.log('\n--- Trade Checklist ---');

  const liquiditySweep = await promptYesNo('Liquidity Sweep', 1);
  if (liquiditySweep) {
    const bearsPunished = await promptYesNo('Bears Punished', 1);
    if (bearsPunished) {
      console.log('\nTrade.');
    } else {
      console.error('\nNo Trade.');
    }
  } else {
    console.error('\nNo Trade.');
  }

  process.stdin.pause();
}
