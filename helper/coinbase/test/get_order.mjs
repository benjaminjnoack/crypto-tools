import { requestOrder } from '../http/rest.js';
const order_id = '637402a5-64cb-47f8-ba7c-feb156cf3b66';
try {
  const order = await requestOrder(order_id);
  console.dir(order);
} catch (error) {
  console.error(error.message);
}
