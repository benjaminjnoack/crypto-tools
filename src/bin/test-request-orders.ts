#!/usr/bin/env node

import { requestOpenOrders } from "../coinbase/rest.js";
import { printOrder } from "../log/orders.js";

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
