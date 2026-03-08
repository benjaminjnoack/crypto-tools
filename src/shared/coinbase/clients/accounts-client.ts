import { toIncrement } from "#shared/common/increment";
import { getSignedConfig, requestWithSchema } from "#shared/coinbase/http/http-client";
import { AccountsResponseSchema, type CoinbaseAccount } from "#shared/coinbase/schemas/coinbase-rest-schemas";

export async function requestAccounts(): Promise<CoinbaseAccount[]> {
  const requestPath = "/api/v3/brokerage/accounts";
  const q = new URLSearchParams({ limit: "250" }).toString();
  const config = await getSignedConfig("GET", requestPath, `?${q}`);
  const parsed = await requestWithSchema(config, AccountsResponseSchema);
  return parsed.accounts;
}

export async function requestCurrencyAccount(currency: string = "USD", increment: string = "0.01") {
  const accounts = await requestAccounts();
  const account = accounts.find((entry) => entry.currency === currency);
  if (!account) {
    throw new Error(`Could not find ${currency} account`);
  }

  const available = account.available_balance.value;
  const hold = account.hold.value;
  const numAvailable = parseFloat(available);
  const numHold = parseFloat(hold);
  const total = toIncrement(increment, numAvailable + numHold);

  return {
    available,
    hold,
    total,
  };
}
