import bs58 from 'bs58';
import crypto from 'crypto';

const PAD_LENGTH = 70;
// NOTE: may want to use slice instead of subarray. Both work.
function addChecksum(buf) {
  const checksum = crypto
    .createHash('sha256')
    .update(crypto.createHash('sha256').update(buf).digest())
    .digest()
    .subarray(0, 4);
  return Buffer.concat([buf, checksum]);
}

function verifyChecksum(bufWithChecksum) {
  const data = bufWithChecksum.slice(0, -4);
  const checksum = bufWithChecksum.slice(-4);
  const validChecksum = crypto
    .createHash('sha256')
    .update(crypto.createHash('sha256').update(data).digest())
    .digest()
    .subarray(0, 4);
  return checksum.equals(validChecksum);
}

/**
 * @param {string} buy
 * @param {string} sell
 * @returns {string}
 */
export function toLotId(buy, sell) {
  const raw = `${buy}:${sell}`.padEnd(PAD_LENGTH, '\0');
  const data = Buffer.from(raw, 'utf8');
  const withChecksum = addChecksum(data);
  return bs58.encode(withChecksum);
}

/**
 * @param {string} lotId
 * @returns {{buy: string, sell: string}}
 */
export function fromLotId(lotId) {
  const bufWithChecksum = Buffer.from(bs58.decode(lotId));
  if (!verifyChecksum(bufWithChecksum)) {
    throw new Error('Invalid checksum');
  }
  const raw = bufWithChecksum.subarray(0, -4).toString('utf8').replace(/\0+$/, '');
  const [buy, sell] = raw.split(':');
  return { buy, sell };
}

// const buyTxId ='synthetic-67f54f60818f08828b754420';
// console.log(buyTxId);
// const sellTxId = 'synthetic-67f550641ce41fa9be425830';
// console.log(sellTxId);
// // const padLen = buyTxId.length + sellTxId.length;// 68
// // aCten5RoMvMqhdMEugMJA33FuFK5mmY6AYSA7bf6noitDFBTtRwQnuLEm6dny2WTKtmoEE6sCj5U671pDcNQbQp83v8gFoec3hVCS
// const lotId = toLotId(buyTxId, sellTxId);
// console.log(lotId);
// const {buy, sell} = fromLotId(lotId);
// console.log(buy);
// console.log(buyTxId === buy);
// console.log(sell);
// console.log(sellTxId === sell);
