import { v3 as uuidv3, v5 as uuidv5 } from 'uuid';

const coinbase_id = '67fefbe2d300f7e2798af373';
const cointracker_id = '01963fe5-072a-76e2-b479-a85ad78b6e1a';

const date = new Date('2025-04-16T00:00:00.000Z');
console.log(date.toISOString());

const NIL_NAMESPACE = '00000000-0000-0000-0000-000000000000';
const utc_namespace = uuidv3('04/16/2025', NIL_NAMESPACE);

const utc_namespace_v5 = uuidv3(coinbase_id, utc_namespace);
console.log(utc_namespace_v5);
console.log(utc_namespace_v5 === cointracker_id);
