import {
  getProductId,
  getProductInfo,
  requestMarketTrades,
} from "../../../shared/coinbase/index.js";
import { emitJsonOutput } from "./json-output.js";
import type { InspectOptions } from "./schemas/command-options.js";

export async function handleProductAction(product: string = "btc", options: InspectOptions = {}): Promise<void> {
  const productId = getProductId(product);
  const productInfo = await getProductInfo(productId);
  if (options.json || options.jsonFile) {
    emitJsonOutput({
      row: productInfo,
      meta: {
        productId,
        view: "product",
      },
    }, options);
    return;
  }
  console.dir(productInfo);
}

export async function handlePriceAction(product: string = "btc", options: InspectOptions = {}): Promise<void> {
  const productId = getProductId(product);
  const { trades, best_bid, best_ask } = await requestMarketTrades(productId, 1);
  if (!trades[0]) {
    throw new Error("Trades not found");
  }
  const row = {
    productId,
    price: trades[0].price,
    bid: best_bid,
    ask: best_ask,
  };
  if (options.json || options.jsonFile) {
    emitJsonOutput({
      row,
      meta: {
        productId,
        view: "price",
      },
    }, options);
    return;
  }
  console.table([
    {
      Product: row.productId,
      Price: row.price,
      Bid: row.bid,
      Ask: row.ask,
    },
  ]);
}
