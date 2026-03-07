import readlineSync from "readline-sync";
import chalk from "chalk";
import { ORDER_SIDE } from "#shared/coinbase/index";

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

export function confirmBreakEvenStopUpdate(
  product: string,
  size: string,
  currentPrice: string,
  currentLimitPrice: string,
  newLimitPrice: string,
  currentStopPrice: string,
  newStopPrice: string,
): boolean {
  console.log("\nBreak-Even Update Summary:");
  console.log(`  Product: ${product}`);
  console.log(`  Size: ${size}`);
  console.log(`  Current Price: $${currentPrice}`);
  console.log(`  Limit Price: $${currentLimitPrice} -> $${newLimitPrice}`);
  console.log(`  Stop Price: $${currentStopPrice} -> $${newStopPrice}`);

  const confirmation = readlineSync.question("\nProceed? (yes/no): ").trim().toLowerCase();
  return confirmation === "yes" || confirmation === "y";
}
