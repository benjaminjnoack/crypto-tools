import { selectCoinbaseOrder } from './queries.js';
import { ORDER_KEYS, ORDER_TYPES } from '@core/dictionary.ts';

/**
 * Read the order record from the database and reconstruct it as an order-like object
 * @param {string} orderId
 * @param {boolean} printRecord
 * @param {boolean} printOrder
 * @return {Promise<object>}
 */
export async function reconstructCoinbaseOrderFromDb(
  orderId,
  printRecord = false,
  printOrder = false,
) {
  const record = await selectCoinbaseOrder(orderId);
  if (printRecord) {
    console.log('RECORD:');
    console.dir(record);
  }
  const order = {
    [ORDER_KEYS.AVERAGE_FILLED_PRICE]: record['average_filled_price'],
    [ORDER_KEYS.COMPLETION_PERCENTAGE]: record['completion_percentage'],
    [ORDER_KEYS.FILLED_SIZE]: record.filled_size,
    [ORDER_KEYS.FILLED_VALUE]: record.filled_value,
    [ORDER_KEYS.ORDER_ID]: record.order_id,
    [ORDER_KEYS.PRODUCT_ID]: record.product_id,
    [ORDER_KEYS.STATUS]: record.status,
    [ORDER_KEYS.TOTAL_FEES]: record.total_fees,
    [ORDER_KEYS.TOTAL_VALUE_AFTER_FEES]: record.total_value_after_fees,
    [ORDER_KEYS.SIDE]: record.side,
    product_type: record['product_type'],
    exchange: record['exchange'],
    order_type: record['order_type'],
    order_configuration: {},
  };

  //TODO there is no consideration of the order side here
  switch (record['order_type']) {
    case ORDER_TYPES.BRACKET:
      order.order_configuration[ORDER_KEYS.TRIGGER_BRACKET_GTC] = {
        [ORDER_KEYS.BASE_SIZE]: record.base_size,
        [ORDER_KEYS.LIMIT_PRICE]: record.limit_price,
        [ORDER_KEYS.STOP_PRICE]: record.stop_price,
      };
      break;
    case ORDER_TYPES.LIMIT:
      order.order_configuration[ORDER_KEYS.LIMIT_LIMIT_GTC] = {
        [ORDER_KEYS.BASE_SIZE]: record.base_size,
        [ORDER_KEYS.LIMIT_PRICE]: record.limit_price,
      };
      break;
    case ORDER_TYPES.MARKET:
      // Do nothing
      break;
    case ORDER_TYPES.STOP_LIMIT:
      order.order_configuration[ORDER_KEYS.STOP_LIMIT] = {
        [ORDER_KEYS.BASE_SIZE]: record.base_size,
        [ORDER_KEYS.LIMIT_PRICE]: record.limit_price,
        [ORDER_KEYS.STOP_PRICE]: record.stop_price,
      };
      break;
    default:
      throw new Error(
        `reconstructCoinbaseOrderFromDb => unrecognized order type: ${record['order_type']}`,
      );
  }

  if (printOrder) {
    console.log('ORDER:');
    console.dir(order);
  }
  return order;
}

/**
 * @param {object} record
 */
export function printCoinbaseOrderRecord(record) {
  console.log(`Order ID: ${record.order_id}`);
  console.log(`  Product ID: ${record.product_id}`);
  console.log(`  Product Type: ${record['product_type']}`);
  console.log(`  Type: ${record['order_type']}`);
  console.log(`  Created Time: ${record['created_time']}`);
  console.log(`  Side: ${record.side}`);
  console.log(`  Status: ${record.status}`);
  console.log(`  Base Size: ${record.base_size}`);
  console.log(`  Limit Price: ${record.limit_price}`);
  console.log(`  Stop Price: ${record.stop_price}`);
  console.log(`  Filled Size: ${record.filled_size}`);
  console.log(`  Average Filled Price: ${record['average_filled_price']}`);
  console.log(`  Filled Value: ${record.filled_value}`);
  console.log(`  Last Fill Time: ${record.last_fill_time}`);
  console.log(`  Total Fees: ${record.total_fees}`);
  console.log(`  Total Value After Fees: ${record.total_value_after_fees}`);
}
