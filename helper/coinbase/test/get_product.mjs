import { requestProduct } from '../http/rest.js';

requestProduct('BTC-USD')
  .then((result) => {
    console.dir(result);
  })
  .catch((err) => {
    console.error(err);
  });
