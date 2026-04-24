import type { Command } from "commander";
import { AccountsOptionsSchema, InspectOptionsSchema } from "../schemas/command-options.js";
import {
  handleAccountsAction,
  handleBalanceAction,
  handleCashAction,
  handleFeesAction,
} from "../account-handlers.js";
import { parseOptionalProductOptions, parseOptions, withAction } from "./register-utils.js";

export function registerAccountsCommands(program: Command) {
  program
    .command("accounts [product]")
    .alias("account")
    .description("List account balances (non-zero only unless [product] is provided)")
    .option("--crypto", "Show only crypto accounts", false)
    .option("--cash", "Show only fiat (cash) accounts; ignored if --crypto is also set", false)
    .option("--json", "Print machine-readable JSON output", false)
    .option("--json-file <path>", "Write machine-readable JSON output to <path>")
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
    .option("--json", "Print machine-readable JSON output", false)
    .option("--json-file <path>", "Write machine-readable JSON output to <path>")
    .action(withAction("balance", parseOptions(InspectOptionsSchema), handleBalanceAction));

  program
    .command("cash")
    .description("List non-zero fiat (cash) account balances")
    .option("--json", "Print machine-readable JSON output", false)
    .option("--json-file <path>", "Write machine-readable JSON output to <path>")
    .option("--raw", "Show hold and available sizes without increment-based rounding", false)
    .option("--value", "Show estimated USD value using current product prices", false)
    .action(withAction("cash", parseOptions(AccountsOptionsSchema), handleCashAction));
  program
    .command("fees")
    .description("Show transaction summary with pricing tier and maker/taker fees")
    .option("--json", "Print machine-readable JSON output", false)
    .option("--json-file <path>", "Write machine-readable JSON output to <path>")
    .action(withAction("fees", parseOptions(InspectOptionsSchema), handleFeesAction));
}
