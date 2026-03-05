import type { Command } from "commander";
import { z } from "zod";
import {
  addCacheOption,
  addDebugOption,
  addFromOption,
  addRangeOption,
  addRsyncOption,
  addToOption,
  addYearOption,
} from "#shared/cli/option-builders";
import { runAction, runActionWithArgument } from "../../shared/action-runner.js";
import {
  coinbaseOrders,
  coinbaseOrdersFees,
  coinbaseOrdersInsert,
  coinbaseOrdersUpdate,
} from "./coinbase-orders-handlers.js";
import { DebugOptionsSchema } from "../../schemas/debug-options.js";
import {
  CoinbaseOrdersFeesOptionsSchema,
  CoinbaseOrdersUpdateOptionsSchema,
} from "./schemas/coinbase-orders-options.js";
import { COINBASE_EPOCH } from "../../shared/date-range-utils.js";
import { COINBASE_ORDERS_TABLE } from "../../../db/coinbase/orders/coinbase-orders-repository.js";
import { parseArgWithOptions, parseOptions, withAction } from "../../register/register-utils.js";

export function registerCoinbaseOrderCommands(coinbase: Command) {
  const orders = coinbase.command("orders").description("Coinbase order operations");

  const get = orders
    .command("get <orderId>")
    .alias("g")
    .description("Select order from the database by orderId and print the order record to the console");

  addDebugOption(get);

  get
    .action(
      withAction(
        parseArgWithOptions(z.string()),
        async (orderId, options) => runActionWithArgument(coinbaseOrders, orderId, options, DebugOptionsSchema),
      ),
    );

  const NOW = new Date().toISOString(); // TODO move somewhere common
  const fees = orders
    .command("fees [productId]")
    .alias("f")
    .description("Show total fees paid on orders");

  addDebugOption(fees);
  addFromOption(fees, COINBASE_EPOCH);
  addRangeOption(fees);
  addToOption(fees, NOW);
  addYearOption(fees, "Calculate fees for the specified year");

  fees
    .option("-s, --side <side>", "Order side (BUY || SELL)")
    .action(
      withAction(
        parseArgWithOptions(z.string().optional()),
        async (productId, options) =>
          runActionWithArgument(coinbaseOrdersFees, productId, options, CoinbaseOrdersFeesOptionsSchema),
      ),
    );

  const insert = orders
    .command("insert <orderId>")
    .alias("i")
    .description("Download an order from the exchange and insert into the database");

  addDebugOption(insert);

  insert
    .action(
      withAction(
        parseArgWithOptions(z.string()),
        async (orderId, options) => runActionWithArgument(coinbaseOrdersInsert, orderId, options, DebugOptionsSchema),
      ),
    );

  const update = orders
    .command("update")
    .alias("u")
    .description(`Update ${COINBASE_ORDERS_TABLE} from cache or remote`);

  addCacheOption(update);
  addDebugOption(update);
  addFromOption(update, COINBASE_EPOCH);
  addToOption(update, NOW);
  addRsyncOption(
    update,
    `Read the last filled order from ${COINBASE_ORDERS_TABLE} and request all filled orders since`,
  );

  update
    .action(
      withAction(
        parseOptions(),
        async (options) => runAction(coinbaseOrdersUpdate, options, CoinbaseOrdersUpdateOptionsSchema),
      ),
    );
}
