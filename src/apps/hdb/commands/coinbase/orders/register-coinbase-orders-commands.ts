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
} from "../../../../../shared/cli/option-builders.js";
import { runAction, runActionWithArgument } from "../../shared/action-runner.js";
import {
  coinbaseOrders,
  coinbaseOrdersFees,
  coinbaseOrdersInsert,
  coinbaseOrdersObject,
  coinbaseOrdersRegenerate,
  coinbaseOrdersUpdate,
} from "./coinbase-orders-handlers.js";
import { DebugOptionsSchema } from "../../schemas/debug-options.js";
import {
  CoinbaseOrdersFeesOptionsSchema,
  CoinbaseOrdersInsertOptionsSchema,
  CoinbaseOrdersRegenerateOptionsSchema,
  CoinbaseOrdersUpdateOptionsSchema,
} from "./schemas/coinbase-orders-options.js";
import { COINBASE_EPOCH } from "../../shared/date-range-utils.js";
import { COINBASE_ORDERS_TABLE } from "../../../db/coinbase/orders/coinbase-orders-repository.js";
import { parseArgWithOptions, parseOptions, withAction } from "../../register/register-utils.js";

const NOW = new Date().toISOString();

export function registerCoinbaseOrderCommands(coinbase: Command): void {
  const orders = coinbase.command("orders").description("Coinbase orders");

  const show = orders
    .command("show <orderId>")
    .description("Show a normalized order record from the database");

  addDebugOption(show);

  show
    .action(
      withAction(
        parseArgWithOptions(z.string()),
        async (orderId, options) => runActionWithArgument(coinbaseOrders, orderId, options, DebugOptionsSchema),
      ),
    );

  const inspect = orders
    .command("inspect <orderId>")
    .description("Show the reconstructed order object as full JSON");

  addDebugOption(inspect);

  inspect
    .action(
      withAction(
        parseArgWithOptions(z.string()),
        async (orderId, options) =>
          runActionWithArgument(coinbaseOrdersObject, orderId, options, DebugOptionsSchema),
      ),
    );

  const fees = orders
    .command("fees [productId]")
    .description("Show total order fees over a time range");

  addDebugOption(fees);
  addFromOption(fees, COINBASE_EPOCH);
  addRangeOption(fees);
  addToOption(fees, NOW);
  addYearOption(fees, "Calculate fees for the specified year");

  fees
    .option("--side <side>", "Order side (BUY or SELL)")
    .action(
      withAction(
        parseArgWithOptions(z.string().optional()),
        async (productId, options) =>
          runActionWithArgument(coinbaseOrdersFees, productId, options, CoinbaseOrdersFeesOptionsSchema),
      ),
    );

  const importOne = orders
    .command("import-one <orderId>")
    .description("Fetch one order from Coinbase and insert it");

  addDebugOption(importOne);

  importOne
    .option("--remote", "Allow live Coinbase API request for this command", false)
    .action(
      withAction(
        parseArgWithOptions(z.string()),
        async (orderId, options) =>
          runActionWithArgument(coinbaseOrdersInsert, orderId, options, CoinbaseOrdersInsertOptionsSchema),
      ),
    );

  const sync = orders
    .command("sync")
    .description(`Sync ${COINBASE_ORDERS_TABLE} from cache or remote`);

  addCacheOption(sync);
  addDebugOption(sync);
  addFromOption(sync, COINBASE_EPOCH);
  addToOption(sync, NOW);
  addRsyncOption(
    sync,
    `Read the last filled order from ${COINBASE_ORDERS_TABLE} and request all filled orders since`,
  );

  sync
    .option("--remote", "Allow live Coinbase API requests (mutually exclusive with --cache)", false)
    .action(
      withAction(
        parseOptions(),
        async (options) => runAction(coinbaseOrdersUpdate, options, CoinbaseOrdersUpdateOptionsSchema),
      ),
    );

  const rebuild = orders
    .command("rebuild")
    .description(`Drop/truncate and repopulate ${COINBASE_ORDERS_TABLE} from cache or remote`);

  addDebugOption(rebuild);
  addCacheOption(rebuild);
  addFromOption(rebuild, COINBASE_EPOCH);
  addToOption(rebuild, NOW);
  addRsyncOption(
    rebuild,
    `Read the last filled order from ${COINBASE_ORDERS_TABLE} and request all filled orders since`,
  );

  rebuild
    .option("--drop", "Drop table and re-create before repopulating", false)
    .option("--remote", "Allow live Coinbase API requests (mutually exclusive with --cache)", false)
    .action(
      withAction(
        parseOptions(),
        async (options) => runAction(coinbaseOrdersRegenerate, options, CoinbaseOrdersRegenerateOptionsSchema),
      ),
    );
}
