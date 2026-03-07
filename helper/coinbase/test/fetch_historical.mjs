import { requestHistoricalData, Granularity } from '../http/rest.js';
import { getCredentials } from '../credentials.ts';

const ONE_MINUTE = 60; // Sixty Seconds
const ONE_HOUR = ONE_MINUTE * 60;
const SIX_HOURS = ONE_HOUR * 6;
// const ONE_DAY = SIX_HOURS * 4;// Max 87.5 days

const product = 'BTC-USD';
const endTimestamp = Math.floor(Date.now() / 1000);
const startTimestamp = endTimestamp - SIX_HOURS * 350;

// console.log(new Date(startTimestamp * 1000).toLocaleString());
// console.log(new Date(endTimestamp * 1000).toLocaleString());

await getCredentials();
requestHistoricalData(product, startTimestamp, endTimestamp, Granularity.SIX_HOUR)
  .then((data) => {
    console.log('records: ', data.length);
  })
  .catch((error) => {
    console.error('Error fetching historical data:', error);
  });
