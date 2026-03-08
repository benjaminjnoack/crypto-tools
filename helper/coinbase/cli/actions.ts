import process from 'node:process';
import {
  requestOrderCancellation,
  requestAccounts,
  requestBestBidAsk,
  requestOpenOrders,
  requestOrder,
  requestMarketTrades,
  requestCurrencyAccount,
} from '@cb/http/rest';
import {
  placeBracketOrder,
  placeLimitOrder,
  placeLimitTpSlOrder,
  placeMarketOrder,
  placeStopLimitOrder,
} from '@cb/cli/orders';
import Product from '@cb/Product';
import { toIncrement } from '@core/increment';
import { safeNumber } from '@core/validation';
import { loadOrder } from '@cb/order/service';
import { ORDER_TYPES } from '@core/dictionary';
import { getTransactionSummary } from '@cb/cached';
import type {
  AccountsOptions,
  AskOptions,
  BidOptions,
  BracketOptions,
  BuyOptions,
  LimitOptions,
  LimitTpSlOptions,
  MarketOptions,
  PlanOptions,
  SellOptions,
  StopOptions,
} from '@cb/cli/contracts';
import { ensureProduct, getProductInstance } from '@cli/utils';
import { log } from '@core/logger';

export async function handleAccountsAction(
  product: string | undefined,
  options: AccountsOptions,
): Promise<void> {
  let accounts = await requestAccounts();

  if (product) {
    accounts = accounts.filter((acc) => acc.currency.toUpperCase() === product.toUpperCase());
    const { price, price_increment } = await Product.getProductInfo(
      `${product.toUpperCase()}-USD`,
      true,
    );
    console.table(
      accounts.map((acc) => {
        const hold = acc.hold.value;
        const available = acc.available_balance.value;
        const holdValue = toIncrement(price_increment, parseFloat(hold) * parseFloat(price));
        const availableValue = toIncrement(
          price_increment,
          parseFloat(available) * parseFloat(price),
        );
        return {
          Currency: acc.currency,
          Price: price,
          Hold: `${hold} ($${holdValue})`,
          Available: `${available} ($${availableValue})`,
        };
      }),
    );
  } else {
    if (options.crypto) {
      accounts = accounts.filter((acc) => acc.type === 'ACCOUNT_TYPE_CRYPTO');
    } else if (options['cash']) {
      accounts = accounts.filter((acc) => acc.type === 'ACCOUNT_TYPE_FIAT');
    }

    accounts = accounts.filter((acc) => {
      return acc.available_balance.value !== '0' || acc.hold.value !== '0';
    });

    console.table(
      accounts.map((acc) => ({
        Currency: acc.currency,
        Hold: parseFloat(acc.hold.value).toFixed(2),
        Available: parseFloat(acc.available_balance.value).toFixed(2),
      })),
    );
  }
}

export async function handleAskAction(product: string = 'btc', options: AskOptions): Promise<void> {
  const productId = Product.getProductId(product);
  const { asks } = await requestBestBidAsk(productId);
  if (!asks[0]) {
    throw new Error(`No asking prices were found`);
  }
  const limitOptions: LimitOptions = {
    baseSize: options.baseSize,
    limitPrice: asks[0].price,
    sell: true,
    value: options.value,
  };
  await handleLimitAction(productId, limitOptions);
}

export async function handleBalanceAction() {
  const { available, hold, total } = await requestCurrencyAccount('USD', '0.01');
  console.log(`USD ($)`);
  console.log(`Available: $${available}`);
  console.log(`Hold: $${hold}`);
  console.log(`Total: $${total}`);
}

export async function handleBidAction(product: string = 'btc', options: BidOptions): Promise<void> {
  const productId = Product.getProductId(product);
  const { bids } = await requestBestBidAsk(productId);
  if (!bids[0]) {
    throw new Error(`No bidding prices were found.`);
  }
  const limitOptions = {
    baseSize: options.baseSize,
    limitPrice: bids[0].price,
    buy: true,
    value: options.value,
  };
  await handleLimitAction(productId, limitOptions);
}

export async function handleBracketAction(
  product: string = 'btc',
  options: BracketOptions,
): Promise<void> {
  await placeBracketOrder(Product.getProductId(product), options);
}

export async function handleBuyAction(product: string = 'btc', options: BuyOptions): Promise<void> {
  const marketOptions = {
    buy: true,
    baseSize: options.baseSize,
    value: options.value,
  };
  await handleMarketAction(Product.getProductId(product), marketOptions);
}

export async function handleCancelAction(order_id: string): Promise<void> {
  await requestOrderCancellation(order_id);
}

export async function handleCashAction() {
  const accountsOptions: AccountsOptions = {
    cash: true,
  };
  return handleAccountsAction(undefined, accountsOptions);
}

export async function handleFeesAction() {
  const { total_fees, total_volume, fee_tier, total_balance } = await getTransactionSummary();
  const { pricing_tier, taker_fee_rate, maker_fee_rate } = fee_tier;
  console.log(`Transaction Summary:`);
  console.log(`  Total balance: ${total_balance}`);
  console.log(`  Total volume: ${total_volume}`);
  console.log(`  Pricing Tier: ${pricing_tier}`);
  ``;
  console.log(`  Taker Fee Rate: ${taker_fee_rate}`);
  ``;
  console.log(`  Maker Fee Rate: ${maker_fee_rate}`);
  ``;
  console.log(`  Total fees: ${total_fees}`);
}

export async function handleLimitAction(
  product: string = 'btc',
  options: LimitOptions,
): Promise<void> {
  await placeLimitOrder(Product.getProductId(product), options);
}

export async function handleLoadOrderAction(orderId: string): Promise<void> {
  await loadOrder(orderId, true, false, true, true);
}

export async function handleMarketAction(product: string = 'btc', options: MarketOptions) {
  await placeMarketOrder(Product.getProductId(product), options);
}

export async function handleMaxAction(product: string = 'btc'): Promise<void> {
  const productId = Product.getProductId(product);
  const productInstance = new Product(productId);
  await productInstance.update();
  const { bids } = await requestBestBidAsk(productId);
  if (!bids[0]) {
    throw new Error(`No bidding prices were found.`);
  }
  const bidPrice = bids[0].price;
  console.log(`Bid price: ${bidPrice}`);
  const numBid = safeNumber(bidPrice, 'handleMaxAction => numBid');
  const priceIncrement = productInstance.price_increment;
  console.log(`Price Increment: ${priceIncrement}`);
  const numPriceIncrement = safeNumber(priceIncrement, 'handleMaxAction => numPriceIncrement');
  const numLimitPrice = numBid + numPriceIncrement;
  const limitPrice = toIncrement(productInstance.price_increment, numLimitPrice);
  console.log(`Limit: ${limitPrice}`);
  const { available } = await requestCurrencyAccount('USD', '0.01');
  const numUsdBalance = safeNumber(available, 'handleMaxAction => available');
  const numUsd500 = Math.floor(numUsdBalance / 500) * 500; // Round down to the nearest 500 to cover fees
  const usd500 = numUsd500.toFixed(2);
  console.log(`USD balance: ${usd500}`);
  const options: LimitOptions = {
    buy: true,
    limitPrice: limitPrice,
    value: usd500,
  };
  await placeLimitOrder(productId, options);
}

export async function handleOrderAction(orderId: string): Promise<void> {
  const order = await requestOrder(orderId);
  console.dir(order);
}

export async function handleOrdersAction(product: string): Promise<void> {
  const openOrders = await requestOpenOrders(product);
  if (openOrders.length === 0) {
    console.log('No open orders found.');
  } else {
    openOrders.forEach((order) => {
      console.log(`Order ID: ${order.order_id}`);
      console.log(`  Product: ${order.product_id}`);
      console.log(`  Side: ${order.side}`);
      switch (order.order_type) {
        case ORDER_TYPES.LIMIT:
          console.log(`  Base Size: ${order.order_configuration.limit_limit_gtc.base_size}`);
          console.log(`  Limit Price: ${order.order_configuration.limit_limit_gtc.limit_price}`);
          break;
        case ORDER_TYPES.MARKET:
          console.log(`WARNING: Open market order?`);
          break;
        case ORDER_TYPES.STOP_LIMIT:
          console.log(
            `  Base Size: ${order.order_configuration.stop_limit_stop_limit_gtc.base_size}`,
          );
          console.log(
            `  Stop Price: ${order.order_configuration.stop_limit_stop_limit_gtc.stop_price}`,
          );
          console.log(
            `  Limit Price: ${order.order_configuration.stop_limit_stop_limit_gtc.limit_price}`,
          );
          break;
        case ORDER_TYPES.BRACKET:
          console.log(`  Base Size: ${order.order_configuration.trigger_bracket_gtc.base_size}`);
          console.log(
            `  Limit Price: ${order.order_configuration.trigger_bracket_gtc.limit_price}`,
          );
          console.log(
            `  Stop Price: ${order.order_configuration.trigger_bracket_gtc.stop_trigger_price}`,
          );
          break;
        default:
          console.error('Unknown order type');
          console.dir(order);
      }
      console.log(`  Status: ${order.status}`);
      console.log('---');
    });
  }
}

export async function handlePlanAction(product: string, options: PlanOptions): Promise<void> {
  // Ensure product is set
  product = await ensureProduct(product);
  const productInstance = await getProductInstance(product);

  let numBuyPrice = safeNumber(options.buyPrice, 'handlePlanAction => numBuyPrice', true);
  let numBufferPercent = safeNumber(
    options.bufferPercent,
    'handlePlanAction => numBufferPercent',
    true,
  );
  let bufferPercent = numBufferPercent.toFixed(2);
  let numTakeProfitPrice = safeNumber(
    options.takeProfitPrice,
    'handlePlanAction => numTakeProfitPrice',
    true,
  );
  let numStopPrice = safeNumber(options.stopPrice, 'handlePlanAction -> numStopPrice', true);

  if (numBufferPercent > 0) {
    log.warn(`Adding ${bufferPercent}% buffer to stop`);
    numStopPrice *= 1 - numBufferPercent / 100;
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

  // Single take-profit calculations
  const portionCostWithFee = totalCostWithFee;
  const takeProfitSubtotal = positionSize * numTakeProfitPrice;
  const takeProfitFee = takeProfitSubtotal * makerFeeRate;
  const netTakeProfit = takeProfitSubtotal - takeProfitFee;
  const netTakeProfitPnl = netTakeProfit - portionCostWithFee;
  // TODO this does not account for fees
  const rewardPercentage = ((numTakeProfitPrice - numBuyPrice) / numBuyPrice) * 100;

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

  const rawRatio = rewardPercentage / riskPercentageCalc;
  const trueRrRatio = netTakeProfitPnl / actualRisk;
  const totalFeesWhenProfit = buyFee + takeProfitFee;
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
  console.log(`  Price:            $${takeProfitPrice} (${rewardPercentage.toFixed(2)}%)`);
  console.log(
    `  Size:             ${toIncrement(productInstance.base_increment, positionSize)} ${product.toUpperCase()}`,
  );
  console.log(`  Subtotal:         $${takeProfitSubtotal.toFixed(2)}`);
  console.log(`  Fee (${(makerFeeRate * 100).toFixed(2)}%):      $${takeProfitFee.toFixed(2)}`);
  console.log(`  Net:              $${netTakeProfit.toFixed(2)}`);
  console.log(`  PnL:              $${netTakeProfitPnl.toFixed(2)}\n`);
  console.log(' Total Profit Details:');
  console.log(`  Value:            $${takeProfitSubtotal.toFixed(2)}`);
  console.log(`  Fees:             $${takeProfitFee.toFixed(2)}`);
  console.log(`  Total Fees:       $${totalFeesWhenProfit.toFixed(2)}`);
  console.log(`  Net:              $${netTakeProfit.toFixed(2)}`);
  console.log(`  PnL:              $${netTakeProfitPnl.toFixed(2)}`);
  console.log(`  Reward:           ${rewardPercentage.toFixed(2)}% (${rawRatio.toFixed(2)}:1)`);

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
  const limitTpSlOptions: LimitTpSlOptions = {
    baseSize: toIncrement(productInstance.base_increment, positionSize),
    limitPrice: buyPrice,
    stopPrice: stopPrice,
    takeProfitPrice: takeProfitPrice,
  };
  console.log(`  Product: ${product}`);
  console.log(`  Buy Price: ${limitTpSlOptions.limitPrice}`);
  console.log(`  Base Size: ${limitTpSlOptions.baseSize}`);
  console.log(`  Take Profit Price: ${limitTpSlOptions.takeProfitPrice}`);
  console.log(`  Stop Price: ${limitTpSlOptions.stopPrice}`);

  await placeLimitTpSlOrder(Product.getProductId(product), limitTpSlOptions);
}

export async function handleProductAction(product: string = 'btc'): Promise<void> {
  const productId = Product.getProductId(product);
  const productInfo = await Product.getProductInfo(productId);
  console.dir(productInfo);
}

export async function handlePriceAction(product: string = 'btc'): Promise<void> {
  const productId = Product.getProductId(product);
  const { trades, best_bid, best_ask } = await requestMarketTrades(productId, 1);
  if (!trades[0]) {
    throw new Error('Trades not found');
  }
  console.table([
    {
      Product: productId,
      Price: trades[0].price,
      Bid: best_bid,
      Ask: best_ask,
    },
  ]);
}

export async function handleSellAction(
  product: string = 'btc',
  options: SellOptions,
): Promise<void> {
  const marketOptions: MarketOptions = {
    sell: true,
    baseSize: options.baseSize,
    value: options.value,
  };
  await handleMarketAction(Product.getProductId(product), marketOptions);
}

export async function handleStopAction(
  product: string = 'btc',
  options: StopOptions,
): Promise<void> {
  await placeStopLimitOrder(Product.getProductId(product), options);
}
