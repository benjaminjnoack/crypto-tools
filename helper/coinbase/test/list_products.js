import { requestProducts } from '../http/rest.js';

const productIds = ['AAVE-USD', 'ETH-USD', 'BTC-USD'];
const products = await requestProducts(productIds);
console.dir(products);
