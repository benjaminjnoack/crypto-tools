import type { BuyOptions, MarketOptions, SellOptions } from "./schemas/command-options.js";
import { placeMarketOrder } from "../service/order-service.js";
import { getProductId } from "#shared/coinbase/index";

export async function handleBuyAction(product: string = "btc", options: BuyOptions): Promise<void> {
  const marketOptions = {
    buy: true,
    baseSize: options.baseSize,
    value: options.value,
  };
  await handleMarketAction(getProductId(product), marketOptions);
}

export async function handleMarketAction(product: string = "btc", options: MarketOptions) {
  await placeMarketOrder(getProductId(product), options);
}

export async function handleSellAction(
  product: string = "btc",
  options: SellOptions,
): Promise<void> {
  const marketOptions: MarketOptions = {
    sell: true,
    baseSize: options.baseSize,
    value: options.value,
  };
  await handleMarketAction(getProductId(product), marketOptions);
}
