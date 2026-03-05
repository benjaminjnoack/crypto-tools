#!/usr/bin/env node

import { requestOpenOrders } from "#shared/coinbase/rest";
import { printOrder } from "#shared/log/orders";

async function run(): Promise<void> {
  const orders = await requestOpenOrders();
  for (const order of orders) {
    printOrder(order);
  }
}

run().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exit(1);
});
