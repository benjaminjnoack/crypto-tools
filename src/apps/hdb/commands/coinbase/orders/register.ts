import type { Command } from "commander";
import { runAction, runActionWithArgument } from "../../shared/action-runner.js";
import { coinbaseOrders, coinbaseOrdersFees, coinbaseOrdersInsert, coinbaseOrdersUpdate } from "./handlers.js";
import { type DebugOptions, DebugOptionsSchema } from "../../schemas/debug-options.js";
import {
  type CoinbaseOrdersFeesOptions,
  CoinbaseOrdersFeesOptionsSchema,
  CoinbaseOrdersUpdateOptionsSchema
} from "./schemas/orders.js";
import { COINBASE_EPOCH } from "../../shared/utils.js";
import { COINBASE_ORDERS_TABLE } from "../../../db/coinbase/orders/repository.js";

export function registerCoinbaseOrderCommands(coinbase: Command) {
  const orders = coinbase.command("orders").description("Coinbase order operations");

  orders
    .command("get <orderId>")
    .alias("g")
    .description(
      "Select order from the database by orderId and print the order record to the console",
    )
    .option("-D, --debug", "Enable debug logging", false)
    .action(async (orderId: string, options: DebugOptions) =>
      runActionWithArgument(coinbaseOrders, orderId, options, DebugOptionsSchema),
    );

  const NOW = new Date().toISOString(); // TODO move somewhere common
  orders
    .command("fees [productId]")
    .alias("f")
    .description("Show total fees paid on orders")
    .option("-D, --debug", "Enable debug logging", false)
    .option("-f, --from <date>", "Start date (inclusive, ISO format)", COINBASE_EPOCH)
    .option("-r, --range <period>", "Shortcut range: week | month | quarter | year | all")
    .option("-s, --side <side>", "Order side (BUY || SELL)")
    .option("-t, --to <date>", "End date (exclusive, ISO format)", NOW)
    .option("-y, --year <year>", "Calculate fees for the specified year")
    .action(async (productId: string | undefined, options: CoinbaseOrdersFeesOptions) =>
      runActionWithArgument(coinbaseOrdersFees, productId, options, CoinbaseOrdersFeesOptionsSchema),
    );

  orders
    .command("insert <orderId>")
    .alias("i")
    .description("Download an order from the exchange and insert into the database")
    .option("-D, --debug", "Enable debug logging", false)
    .action(async (orderId: string, options: DebugOptions) =>
      runActionWithArgument(coinbaseOrdersInsert, orderId, options, DebugOptionsSchema),
    );

  orders
    .command("update")
    .alias("u")
    .description(`Update ${COINBASE_ORDERS_TABLE} from cache or remote`)
    .option("-c, --cache", "Use only cached orders")
    .option("-D, --debug", "Enable debug logging", false)
    .option("-f, --from <date>", "Start date (inclusive, ISO format)", COINBASE_EPOCH)
    .option("-t, --to <date>", "End date (exclusive, ISO format)", NOW)
    .option(
      "-r, --rsync",
      `Read the last filled order from ${COINBASE_ORDERS_TABLE} and request all filled orders since`,
      false,
    )
    .action(async (options) => runAction(coinbaseOrdersUpdate, options, CoinbaseOrdersUpdateOptionsSchema));
}
