import { requestOrders } from '../http/rest.js';
import { ORDER_STATUS } from '@core/dictionary.ts';
import { saveOrder } from '@core/cache.js';
import { ORDER_PLACEMENT_SOURCE } from '../dictionary';

let endDate = new Date();
endDate.setFullYear(2025, 0, 1);
endDate.setHours(0, 0, 0, 0);
// console.log(endDate.toISOString());
// process.exit(0);

const orders = await requestOrders(
  ORDER_STATUS.FILLED,
  ORDER_PLACEMENT_SOURCE.UNKNOWN,
  null,
  null,
  null,
);
console.log(`found ${orders.length} orders`);
// await promises.writeFile('orders.json', JSON.stringify(orders, null, 4));
for (const order of orders) {
  await saveOrder(order.order_id, order);
}
