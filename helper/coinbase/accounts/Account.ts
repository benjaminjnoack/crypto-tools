import { requestAccount } from '../http/rest.js';
import type { CoinbaseAccount } from '@cb/http/contracts';
//TODO with zod, what is the point of this class?
class Account {
  account: CoinbaseAccount;

  constructor(account: CoinbaseAccount) {
    this.account = account;
  }

  getAvailableBalanceValue() {
    return this.account.available_balance.value;
  }

  getHoldValue() {
    return this.account.hold.value;
  }

  getUuid() {
    return this.account.uuid;
  }

  async update() {
    this.account = await requestAccount(this.getUuid());
  }
}

export default Account;
