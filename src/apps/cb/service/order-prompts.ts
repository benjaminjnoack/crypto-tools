import readlineSync from "readline-sync";
import chalk from "chalk";
import { ORDER_SIDE } from "../../../shared/coinbase/index.js";

type SummaryLine = {
  label: string;
  value: string;
};

export function confirmOrderChange(action: string, lines: SummaryLine[]): boolean {
  console.log("\nOrder Change Summary:");
  console.log(`  Action: ${action}`);
  lines.forEach(({ label, value }) => {
    console.log(`  ${label}: ${value}`);
  });

  const confirmation = readlineSync.question("\nProceed? (yes/no): ").trim().toLowerCase();
  return confirmation === "yes" || confirmation === "y";
}

export function confirmOrder(
  type: string,
  side: string,
  product: string,
  size: string,
  price: string,
  value: string,
): boolean {
  let sideLabel: string;
  if (side === ORDER_SIDE.BUY) {
    sideLabel = chalk.green(side.toUpperCase());
  } else if (side === ORDER_SIDE.SELL) {
    sideLabel = chalk.red(side.toUpperCase());
  } else {
    sideLabel = side.toUpperCase();
  }
  return confirmOrderChange(`CREATE ${type.toUpperCase()}`, [
    { label: "Type", value: type.toUpperCase() },
    { label: "Side", value: sideLabel },
    { label: "Product", value: product },
    { label: "Size", value: size },
    { label: "Price", value: `$${price}` },
    { label: "Value", value: chalk.green(`$${value}`) },
  ]);
}
