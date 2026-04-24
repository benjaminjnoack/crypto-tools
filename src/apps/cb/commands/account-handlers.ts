import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import process from "node:process";
import type { AccountsOptions } from "./schemas/command-options.js";
import { toIncrement } from "../../../shared/common/index.js";
import {
  getProductInfo,
  getTransactionSummary,
  requestAccounts,
  requestCurrencyAccount,
} from "../../../shared/coinbase/index.js";
import { type CoinbaseAccount, type CoinbaseProduct } from "../../../shared/coinbase/schemas/coinbase-rest-schemas.js";

const FIAT_BASE_INCREMENT = "0.01";
const DEFAULT_CRYPTO_BASE_INCREMENT = "0.00000001";

type AccountDisplayMetadata = {
  baseIncrement: string;
  price: string | null;
  priceIncrement: string;
};

type AccountBalanceRow = {
  Currency: string;
  Hold: string;
  Available: string;
};

type AccountExportRow = {
  currency: string;
  type: CoinbaseAccount["type"];
  hold: string;
  available: string;
  price?: string | null;
  holdValueUsd?: string | null;
  availableValueUsd?: string | null;
  totalValueUsd?: string | null;
};

type AccountsJsonPayload = {
  rows: AccountExportRow[];
  filters: {
    product: string | null;
    currency: string | null;
    crypto: boolean;
    cash: boolean;
    raw: boolean;
    value: boolean;
  };
  meta: {
    rowCount: number;
  };
};

function formatAccountSize(value: string, baseIncrement: string, raw: boolean | undefined): string {
  if (raw) {
    return value;
  }
  return toIncrement(baseIncrement, parseFloat(value));
}

function filterAccounts(
  accounts: CoinbaseAccount[],
  options: Pick<AccountsOptions, "crypto" | "cash">,
): CoinbaseAccount[] {
  if (options.crypto) {
    return accounts.filter((acc) => acc.type === "ACCOUNT_TYPE_CRYPTO");
  }
  if (options.cash) {
    return accounts.filter((acc) => acc.type === "ACCOUNT_TYPE_FIAT");
  }
  return accounts;
}

async function buildMetadataByCurrency(
  accounts: CoinbaseAccount[],
  includeValue: boolean,
): Promise<Map<string, AccountDisplayMetadata>> {
  const uniqueAccountsByCurrency = new Map<string, Pick<CoinbaseAccount, "currency" | "type">>();
  for (const account of accounts) {
    uniqueAccountsByCurrency.set(account.currency.toUpperCase(), account);
  }
  const metadataEntries = await Promise.all(
    Array.from(uniqueAccountsByCurrency.entries()).map(async ([currency, account]) => {
      const metadata = await getAccountDisplayMetadata(account, includeValue);
      return [currency, metadata] as const;
    }),
  );
  return new Map(metadataEntries);
}

function getAccountMetadata(
  metadataByCurrency: Map<string, AccountDisplayMetadata>,
  currency: string,
): AccountDisplayMetadata {
  return metadataByCurrency.get(currency.toUpperCase()) ?? {
    baseIncrement: DEFAULT_CRYPTO_BASE_INCREMENT,
    price: null,
    priceIncrement: FIAT_BASE_INCREMENT,
  };
}

function toAccountBalanceRow(
  account: CoinbaseAccount,
  metadataByCurrency: Map<string, AccountDisplayMetadata>,
  raw: boolean | undefined,
): AccountBalanceRow {
  const metadata = getAccountMetadata(metadataByCurrency, account.currency);
  return {
    Currency: account.currency,
    Hold: formatAccountSize(account.hold.value, metadata.baseIncrement, raw),
    Available: formatAccountSize(account.available_balance.value, metadata.baseIncrement, raw),
  };
}

function buildAccountsJsonPayload(
  rows: AccountExportRow[],
  options: AccountsOptions,
  product: string | null,
): AccountsJsonPayload {
  return {
    rows,
    filters: {
      product,
      currency: product ? product.split("-")[0] ?? null : null,
      crypto: Boolean(options.crypto),
      cash: Boolean(options.cash),
      raw: Boolean(options.raw),
      value: Boolean(options.value),
    },
    meta: {
      rowCount: rows.length,
    },
  };
}

function printAccountsJson(payload: AccountsJsonPayload): void {
  console.log(JSON.stringify(payload, null, 2));
}

function writeAccountsJsonFile(payload: AccountsJsonPayload, jsonFile: string): void {
  const outputPath = path.resolve(process.cwd(), jsonFile);
  mkdirSync(path.dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, `${JSON.stringify(payload, null, 2)}\n`);
}

function buildProductJsonRows(
  accounts: CoinbaseAccount[],
  price: string,
  priceIncrement: string,
): AccountExportRow[] {
  return accounts.map((acc) => {
    const hold = acc.hold.value;
    const available = acc.available_balance.value;
    const holdValueUsd = toIncrement(priceIncrement, parseFloat(hold) * parseFloat(price));
    const availableValueUsd = toIncrement(priceIncrement, parseFloat(available) * parseFloat(price));
    return {
      currency: acc.currency,
      type: acc.type,
      price,
      hold,
      available,
      holdValueUsd,
      availableValueUsd,
      totalValueUsd: toIncrement(
        priceIncrement,
        parseFloat(holdValueUsd) + parseFloat(availableValueUsd),
      ),
    };
  });
}

function buildAccountJsonRows(
  accounts: CoinbaseAccount[],
  metadataByCurrency: Map<string, AccountDisplayMetadata>,
  options: AccountsOptions,
): AccountExportRow[] {
  return accounts.map((account) => {
    const metadata = getAccountMetadata(metadataByCurrency, account.currency);
    const row = toAccountBalanceRow(account, metadataByCurrency, options.raw);
    const totalSize = parseFloat(account.hold.value) + parseFloat(account.available_balance.value);
    return {
      currency: account.currency,
      type: account.type,
      hold: row.Hold,
      available: row.Available,
      price: options.value ? metadata.price : null,
      holdValueUsd: options.value && metadata.price !== null
        ? toIncrement(metadata.priceIncrement, parseFloat(account.hold.value) * parseFloat(metadata.price))
        : null,
      availableValueUsd: options.value && metadata.price !== null
        ? toIncrement(metadata.priceIncrement, parseFloat(account.available_balance.value) * parseFloat(metadata.price))
        : null,
      totalValueUsd: options.value && metadata.price !== null
        ? toIncrement(metadata.priceIncrement, totalSize * parseFloat(metadata.price))
        : null,
    };
  });
}

async function getSupportedProduct(
  account: Pick<CoinbaseAccount, "currency" | "type">,
): Promise<{ productId: string; product: CoinbaseProduct } | null> {
  const currency = account.currency.toUpperCase();
  const productCandidates = [`${currency}-USD`, `${currency}-USDC`];
  for (const productId of productCandidates) {
    try {
      const product = await getProductInfo(productId, false, { tryFetchOnce: true });
      return { productId, product };
    } catch {
      continue;
    }
  }

  return null;
}

async function getAccountDisplayMetadata(
  account: Pick<CoinbaseAccount, "currency" | "type">,
  includeValue: boolean,
): Promise<AccountDisplayMetadata> {
  const currency = account.currency.toUpperCase();
  if (currency === "USD" || currency === "USDC" || account.type === "ACCOUNT_TYPE_FIAT") {
    return {
      baseIncrement: FIAT_BASE_INCREMENT,
      price: includeValue ? "1" : null,
      priceIncrement: FIAT_BASE_INCREMENT,
    };
  }

  const supportedProduct = await getSupportedProduct(account);
  if (!supportedProduct) {
    return {
      baseIncrement: DEFAULT_CRYPTO_BASE_INCREMENT,
      price: null,
      priceIncrement: FIAT_BASE_INCREMENT,
    };
  }

  let currentProduct = supportedProduct.product;
  if (includeValue) {
    try {
      // Value mode prefers latest pricing for supported products.
      currentProduct = await getProductInfo(supportedProduct.productId, true);
    } catch {
      // Fall back to the cache/initial lookup price if force refresh fails.
    }
  }

  return {
    baseIncrement: currentProduct.base_increment,
    price: includeValue ? currentProduct.price : null,
    priceIncrement: currentProduct.price_increment,
  };
}

export async function handleAccountsAction(
  product: string | null,
  options: AccountsOptions,
): Promise<void> {
  const allAccounts = await requestAccounts();
  const filteredAccounts = filterAccounts(allAccounts, options);
  const wantsJson = options.json || Boolean(options.jsonFile);

  let accounts = filteredAccounts;

  if (product) {
    const currency = product.split("-")[0];
    if (!currency) {
      throw new Error(`Error parsing product: ${product}`);
    }
    accounts = accounts.filter((acc) => acc.currency.toUpperCase() === currency);
    const { price, price_increment } = await getProductInfo(product);
    if (wantsJson) {
      const payload = buildAccountsJsonPayload(
        buildProductJsonRows(accounts, price, price_increment),
        options,
        product,
      );
      if (options.jsonFile) {
        writeAccountsJsonFile(payload, options.jsonFile);
      }
      printAccountsJson(payload);
      return;
    }
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
    accounts = accounts.filter((acc) => {
      return acc.available_balance.value !== "0" || acc.hold.value !== "0";
    });
    const metadataByCurrency = await buildMetadataByCurrency(accounts, options.value === true);
    if (wantsJson) {
      const payload = buildAccountsJsonPayload(
        buildAccountJsonRows(accounts, metadataByCurrency, options),
        options,
        product,
      );
      if (options.jsonFile) {
        writeAccountsJsonFile(payload, options.jsonFile);
      }
      printAccountsJson(payload);
      return;
    }

    console.table(
      accounts.map((acc) => {
        const metadata = getAccountMetadata(metadataByCurrency, acc.currency);
        const accountRow = toAccountBalanceRow(acc, metadataByCurrency, options.raw);
        if (!options.value) {
          return accountRow;
        }
        const totalSize = parseFloat(acc.hold.value) + parseFloat(acc.available_balance.value);
        const value = metadata.price === null
          ? "N/A"
          : `$${toIncrement(metadata.priceIncrement, totalSize * parseFloat(metadata.price))}`;
        return {
          ...accountRow,
          Value: value,
        };
      }),
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
