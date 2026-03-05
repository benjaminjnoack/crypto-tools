import readlineSync from "readline-sync";
import chalk from "chalk";
import { ORDER_SIDE } from "../../../shared/coinbase/schemas/enums.js";

export function confirmOrder(
  type: string,
  side: string,
  product: string,
  size: string,
  price: string,
  value: string,
): boolean {
  console.log("\nOrder Summary:");
  console.log(`  Type: ${type.toUpperCase()}`);
  if (side === ORDER_SIDE.BUY) {
    console.log(`  Side: ${chalk.green(side.toUpperCase())}`);
  } else if (side === ORDER_SIDE.SELL) {
    console.log(`  Side: ${chalk.red(side.toUpperCase())}`);
  } else {
    console.log(`  Side: ${side.toUpperCase()}`);
  }
  console.log(`  Product: ${product}`);
  console.log(`  Size: ${size}`);
  console.log(`  Price: $${price}`);
  console.log(`  Value: ${chalk.green(`$${value}`)}`);

  const confirmation = readlineSync.question("\nProceed? (yes/no): ").trim().toLowerCase();
  return confirmation.toLowerCase() === "yes" || confirmation.toLowerCase() === "y";
}
