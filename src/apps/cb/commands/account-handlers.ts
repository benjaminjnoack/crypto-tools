import type { AccountsOptions } from "./schemas/command-options.js";
import { toIncrement } from "../../../shared/common/index.js";
import {
  getProductInfo,
  getTransactionSummary,
  requestAccounts,
  requestCurrencyAccount,
} from "../../../shared/coinbase/index.js";

export async function handleAccountsAction(
  product: string | null,
  options: AccountsOptions,
): Promise<void> {
  let accounts = await requestAccounts();

  if (product) {
    const currency = product.split("-")[0];
    if (!currency) {
      throw new Error(`Error parsing product: ${product}`);
    }
    accounts = accounts.filter((acc) => acc.currency.toUpperCase() === currency);
    const { price, price_increment } = await getProductInfo(
      product,
      true,
    );
    console.table(
      accounts.map((acc) => {
        const hold = acc.hold.value;
        const available = acc.available_balance.value;
        const holdValue = toIncrement(price_increment, parseFloat(hold) * parseFloat(price));
        const availableValue = toIncrement(
          price_increment,
          parseFloat(available) * parseFloat(price),
        );
        return {
          Currency: acc.currency,
          Price: price,
          Hold: `${hold} ($${holdValue})`,
          Available: `${available} ($${availableValue})`,
        };
      }),
    );
  } else {
    if (options.crypto) {
      accounts = accounts.filter((acc) => acc.type === "ACCOUNT_TYPE_CRYPTO");
    } else if (options.cash) {
      accounts = accounts.filter((acc) => acc.type === "ACCOUNT_TYPE_FIAT");
    }

    accounts = accounts.filter((acc) => {
      return acc.available_balance.value !== "0" || acc.hold.value !== "0";
    });

    console.table(
      accounts.map((acc) => ({
        Currency: acc.currency,
        Hold: parseFloat(acc.hold.value).toFixed(2),
        Available: parseFloat(acc.available_balance.value).toFixed(2),
      })),
    );
  }
}

export async function handleBalanceAction() {
  const { available, hold, total } = await requestCurrencyAccount("USD", "0.01");
  console.log("USD ($)");
  console.log(`Available: $${available}`);
  console.log(`Hold: $${hold}`);
  console.log(`Total: $${total}`);
}

export async function handleCashAction() {
  const accountsOptions: AccountsOptions = {
    cash: true,
  };
  return handleAccountsAction(null, accountsOptions);
}

export async function handleFeesAction() {
  const { total_fees, total_volume, fee_tier, total_balance } = await getTransactionSummary();
  const { pricing_tier, taker_fee_rate, maker_fee_rate } = fee_tier;
  console.log("Transaction Summary:");
  console.log(`  Total balance: ${total_balance}`);
  console.log(`  Total volume: ${total_volume}`);
  console.log(`  Pricing Tier: ${pricing_tier}`);
  console.log(`  Taker Fee Rate: ${taker_fee_rate}`);
  console.log(`  Maker Fee Rate: ${maker_fee_rate}`);
  console.log(`  Total fees: ${total_fees}`);
}
