import type {
  AskOptions,
  BidOptions,
  BracketOptions,
  LimitOptions,
  StopOptions
} from "./schemas/command-options.js";
import { placeBracketOrder, placeLimitOrder, placeStopLimitOrder } from "../service/order-service.js";
import {
  getProductId,
  getProductInfo,
  requestBestBidAsk,
  requestCurrencyAccount,
} from "#shared/coinbase/index";
import { toIncrement } from "#shared/common/index";

export async function handleAskAction(product: string = "btc", options: AskOptions): Promise<void> {
  const productId = getProductId(product);
  const { asks } = await requestBestBidAsk(productId);
  if (!asks[0]) {
    throw new Error("No asking prices were found");
  }
  const limitOptions: LimitOptions = {
    baseSize: options.baseSize,
    limitPrice: asks[0].price,
    postOnly: options.postOnly,
    sell: true,
    value: options.value,
  };
  await handleLimitAction(productId, limitOptions);
}

export async function handleBidAction(product: string = "btc", options: BidOptions): Promise<void> {
  const productId = getProductId(product);
  const { bids } = await requestBestBidAsk(productId);
  if (!bids[0]) {
    throw new Error("No bidding prices were found.");
  }
  const limitOptions = {
    baseSize: options.baseSize,
    limitPrice: bids[0].price,
    buy: true,
    postOnly: options.postOnly,
    value: options.value,
  };
  await handleLimitAction(productId, limitOptions);
}

export async function handleBracketAction(
  product: string = "btc",
  options: BracketOptions,
): Promise<void> {
  await placeBracketOrder(getProductId(product), options);
}

export async function handleLimitAction(
  product: string = "btc",
  options: LimitOptions,
): Promise<void> {
  await placeLimitOrder(getProductId(product), options);
}

export async function handleMaxAction(product: string = "btc"): Promise<void> {
  const productId = getProductId(product);
  const productInstance = await getProductInfo(productId);
  const { bids } = await requestBestBidAsk(productId);
  if (!bids[0]) {
    throw new Error("No bidding prices were found.");
  }
  const bidPrice = bids[0].price;
  console.log(`Bid price: ${bidPrice}`);
  const numBid = parseFloat(bidPrice);
  const priceIncrement = productInstance.price_increment;
  console.log(`Price Increment: ${priceIncrement}`);
  const numPriceIncrement = parseFloat(priceIncrement);
  const numLimitPrice = numBid + numPriceIncrement;
  const limitPrice = toIncrement(productInstance.price_increment, numLimitPrice);
  console.log(`Limit: ${limitPrice}`);
  const { available } = await requestCurrencyAccount("USD", "0.01");
  const numUsdBalance = parseFloat(available);
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

export async function handleStopAction(
  product: string = "btc",
  options: StopOptions,
): Promise<void> {
  await placeStopLimitOrder(getProductId(product), options);
}
