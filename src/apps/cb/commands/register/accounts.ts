import type { Command } from "commander";
import { type AccountsOptions, AccountsOptionsSchema } from "../schemas/options.js";
import {
  handleAccountsAction,
  handleBalanceAction,
  handleCashAction,
  handleFeesAction,
} from "../accounts.js";
import { withNoArgs, withValidatedOptions } from "./shared.js";

export function registerAccountsCommands(program: Command) {
  program
    .command("accounts [product]")
    .alias("account")
    .description("List non-zero account balances, optionally filtered by product or account type")
    .option("--crypto", "Show only crypto accounts", false)
    .option("--cash", "Show only fiat (cash) accounts; ignored if --crypto is also set", false)
    .action(
      withValidatedOptions(
        "accounts",
        AccountsOptionsSchema,
        async (product, options: AccountsOptions) => {
          await handleAccountsAction(product, options);
        },
      ),
    );

  program
    .command("balance")
    .alias("usd")
    .description("Show USD available, hold, and total balances")
    .action(withNoArgs("balance", handleBalanceAction));

  program.command("cash").description("List non-zero fiat (cash) account balances").action(handleCashAction);
  program
    .command("fees")
    .description("Show transaction summary with pricing tier and maker/taker fees")
    .action(handleFeesAction);
}
