import { requestAccounts, requestProducts } from '../http/rest.js';
import { log } from '@core/logger';
import type { CoinbaseAccount, CoinbaseProduct } from '@cb/http/contracts';

/**
 * Initialize, get a list of accounts
 * Get Account
 */
class AccountManager {
  accounts: CoinbaseAccount[];
  constructor() {
    this.accounts = [];
  }

  async retrieveAllAccount(): Promise<void> {
    this.accounts = await requestAccounts();
  }

  getAllCurrencies(): string[] {
    return this.accounts.map((account) => account.currency);
  }

  hasAccount(currency: string): boolean {
    return this.accounts.some((account) => account.currency === currency);
  }

  async getAccountByCurrency(
    currency: string,
    forceUpdate: boolean = false,
  ): Promise<CoinbaseAccount> {
    if (!this.hasAccount(currency)) {
      log.warn(`missing account ${currency}`);
      await this.retrieveAllAccount();
    } else if (forceUpdate) {
      log.warn(`force updating for ${currency}`);
      await this.retrieveAllAccount();
    }

    const account = this.accounts.find((account) => account.currency === currency);
    if (!account) {
      throw new Error(`account not found: ${currency}`);
    }
    return account;
  }

  async getAccountBalanceByCurrency(
    currency: string,
    forceUpdate: boolean = false,
  ): Promise<number> {
    const account = await this.getAccountByCurrency(currency, forceUpdate);
    return parseFloat(account.available_balance.value) + parseFloat(account.hold.value);
  }

  async getTotalCryptoValue() {
    const coins: Map<string, { balance: number }> = new Map();
    this.accounts
      .filter((account) => account.currency !== 'USD' && account.currency !== 'USDC')
      .forEach((account) => {
        coins.set(`${account.currency}-USD`, {
          balance: parseFloat(account.available_balance.value) + parseFloat(account.hold.value),
        });
      });
    const productIds: string[] = [...coins.keys()];
    const products: CoinbaseProduct[] = await requestProducts(productIds);

    let totalValue = 0;
    products.forEach(({ product_id, price }) => {
      const coin = coins.get(product_id);
      if (!coin) {
        return;
      }
      const value = coin.balance * parseFloat(price);
      totalValue += value;
    });
    return totalValue;
  }
}

const accountManager = new AccountManager();

export default accountManager;
