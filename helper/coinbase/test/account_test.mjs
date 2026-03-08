import { requestAccounts, requestAccount } from '../http/rest.js';

try {
  const accounts = await requestAccounts();
  const usdAccount = accounts.find((account) => account.currency === 'USD');
  console.dir(usdAccount);
  // for (const account of accounts) {
  //     const a = await requestAccount(account['uuid']);
  //     console.dir(a);
  // }
} catch (err) {
  console.error(err.message);
}
