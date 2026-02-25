import { getProductId, getProductInfo } from "../../lib/coinbase/product.js";
import { requestMarketTrades } from "../../lib/coinbase/rest.js";

export async function handleProductAction(product: string = "btc"): Promise<void> {
  const productId = getProductId(product);
  const productInfo = await getProductInfo(productId);
  console.dir(productInfo);
}

export async function handlePriceAction(product: string = "btc"): Promise<void> {
  const productId = getProductId(product);
  const { trades, best_bid, best_ask } = await requestMarketTrades(productId, 1);
  if (!trades[0]) {
    throw new Error("Trades not found");
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

