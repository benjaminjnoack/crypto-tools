import type { Command } from "commander";
import { AccountsOptionsSchema } from "../schemas/command-options.js";
import {
  handleAccountsAction,
  handleBalanceAction,
  handleCashAction,
  handleFeesAction,
} from "../account-handlers.js";
import { parseNone, parseOptionalProductOptions, withAction } from "./register-utils.js";

export function registerAccountsCommands(program: Command) {
  program
    .command("accounts [product]")
    .alias("account")
    .description("List account balances (non-zero only unless [product] is provided)")
    .option("--crypto", "Show only crypto accounts", false)
    .option("--cash", "Show only fiat (cash) accounts; ignored if --crypto is also set", false)
    .option("--json [filepath]", "Write account balances JSON to a file (defaults to ./accounts.json)")
    .option("--raw", "Show hold and available sizes without increment-based rounding", false)
    .option("--value", "Show estimated USD value using current product prices", false)
    .action(
      withAction(
        "accounts",
        parseOptionalProductOptions(AccountsOptionsSchema),
        handleAccountsAction,
      ),
    );

  program
    .command("balance")
    .alias("usd")
    .description("Show USD available, hold, and total balances")
    .action(withAction("balance", parseNone(), handleBalanceAction));

  program.command("cash").description("List non-zero fiat (cash) account balances").action(handleCashAction);
  program
    .command("fees")
    .description("Show transaction summary with pricing tier and maker/taker fees")
    .action(handleFeesAction);
}
