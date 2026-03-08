import { DUST_THRESHOLD } from "../../shared/date-range-utils.js";
import type { CoinbaseTransactionRow } from "../../../db/coinbase/transactions/coinbase-transactions-repository.js";

const BUY_TYPES = new Set([
  "Buy",
  "Advanced Trade Buy",
  "Staking Income",
  "Reward Income",
  "Subscription Rebate",
  "Subscription Rebates (24 Hours)",
  "Deposit",
  "Receive",
]);

const SELL_TYPES = new Set([
  "Sell",
  "Advanced Trade Sell",
]);

export type CoinbaseLotTerm = "short" | "long" | "n/a";

export type CoinbaseLotRow = {
  kind: "buy" | "sell";
  id: string;
  asset: string;
  buy_tx_id: string;
  sell_tx_id: string | null;
  acquired: Date;
  sold: Date | null;
  size: number;
  balance: number;
  basis: number;
  proceeds: number;
  gain: number;
  term: CoinbaseLotTerm;
};

type InventoryLot = {
  asset: string;
  buyTxId: string;
  acquired: Date;
  remaining: number;
  size: number;
  price: number;
  fees: number;
  balanceAfterBuy: number;
};

export type CoinbaseLotsMatchResult = {
  balance: number;
  lots: CoinbaseLotRow[];
};

export type CoinbaseLotsAccounting = "FIFO" | "LIFO" | "HIFO";

function isBuyType(type: string): boolean {
  return BUY_TYPES.has(type);
}

function isSellType(type: string): boolean {
  return SELL_TYPES.has(type);
}

function daysBetweenUtc(a: Date, b: Date): number {
  const ms = b.getTime() - a.getTime();
  return Math.floor(ms / (24 * 60 * 60 * 1000));
}

function normalizeLotAsset(asset: string): string {
  return asset.toUpperCase() === "ETH2" ? "ETH" : asset.toUpperCase();
}

function selectInventoryLot(buys: InventoryLot[], accounting: CoinbaseLotsAccounting): InventoryLot | null {
  if (accounting === "FIFO") {
    return buys.find((entry) => entry.remaining > DUST_THRESHOLD) ?? null;
  }

  if (accounting === "LIFO") {
    for (let i = buys.length - 1; i >= 0; i -= 1) {
      const entry = buys[i];
      if (entry && entry.remaining > DUST_THRESHOLD) {
        return entry;
      }
    }
    return null;
  }

  let maxLot: InventoryLot | null = null;
  for (const entry of buys) {
    if (entry.remaining > DUST_THRESHOLD && (!maxLot || entry.price > maxLot.price)) {
      maxLot = entry;
    }
  }
  return maxLot;
}

export function matchCoinbaseLots(
  transactions: CoinbaseTransactionRow[],
  accounting: CoinbaseLotsAccounting,
  includeBuyLots = false,
): CoinbaseLotsMatchResult {
  const txs = [...transactions].sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
  const buys: InventoryLot[] = [];
  const lots: CoinbaseLotRow[] = [];

  const getRemainingBalance = () => buys.reduce((sum, entry) => sum + entry.remaining, 0);

  for (const tx of txs) {
    const size = Number(tx.num_quantity);
    const price = Number(tx.num_price_at_tx);
    const fees = Number(tx.num_fee);

    if (!Number.isFinite(size) || !Number.isFinite(price) || !Number.isFinite(fees)) {
      throw new Error(`Invalid numeric transaction values for ${tx.id}`);
    }

    const normalizedAsset = normalizeLotAsset(tx.asset);

    if (isBuyType(tx.type)) {
      const balanceAfterBuy = getRemainingBalance() + size;
      const buy: InventoryLot = {
        asset: normalizedAsset,
        buyTxId: tx.id,
        acquired: tx.timestamp,
        remaining: size,
        size,
        price,
        fees,
        balanceAfterBuy,
      };
      buys.push(buy);

      if (includeBuyLots) {
        lots.push({
          kind: "buy",
          id: buy.buyTxId,
          asset: buy.asset,
          buy_tx_id: buy.buyTxId,
          sell_tx_id: null,
          acquired: buy.acquired,
          sold: null,
          size: buy.size,
          balance: buy.balanceAfterBuy,
          basis: 0,
          proceeds: 0,
          gain: 0,
          term: "n/a",
        });
      }

      continue;
    }

    if (!isSellType(tx.type)) {
      continue;
    }

    let remainingToSell = size;
    const grossSellValue = price * size;
    const sellFeeRate = grossSellValue === 0 ? 0 : fees / grossSellValue;

    while (remainingToSell > DUST_THRESHOLD) {
      const buy = selectInventoryLot(buys, accounting);
      if (!buy) {
        throw new Error(`Not enough inventory to cover SELL of ${size} ${normalizedAsset}`);
      }

      const usedSize = Math.min(remainingToSell, buy.remaining);
      const buyFeePortion = buy.fees * (usedSize / buy.size);
      const sellFeePortion = grossSellValue * sellFeeRate * (usedSize / size);
      const proceeds = (price * usedSize) - sellFeePortion;
      const basis = (buy.price * usedSize) + buyFeePortion;
      const gain = proceeds - basis;

      remainingToSell -= usedSize;
      if (remainingToSell < DUST_THRESHOLD) {
        remainingToSell = 0;
      }

      buy.remaining -= usedSize;
      if (buy.remaining < DUST_THRESHOLD) {
        buy.remaining = 0;
      }

      const balance = getRemainingBalance();
      const termDays = daysBetweenUtc(buy.acquired, tx.timestamp);

      lots.push({
        kind: "sell",
        id: `${buy.buyTxId}:${tx.id}`,
        asset: normalizedAsset,
        buy_tx_id: buy.buyTxId,
        sell_tx_id: tx.id,
        acquired: buy.acquired,
        sold: tx.timestamp,
        size: usedSize,
        balance,
        basis,
        proceeds,
        gain,
        term: termDays >= 365 ? "long" : "short",
      });
    }
  }

  return {
    balance: getRemainingBalance(),
    lots,
  };
}

export function filterLots(lots: CoinbaseLotRow[], from: Date, includeBuyLots: boolean): CoinbaseLotRow[] {
  const sells = lots.filter((lot) => lot.kind === "sell" && lot.sold && lot.sold >= from);

  if (!includeBuyLots) {
    return sells;
  }

  const buyTxIds = new Set(sells.map((lot) => lot.buy_tx_id));
  const buys = lots.filter((lot) => lot.kind === "buy" && buyTxIds.has(lot.buy_tx_id));
  return [...buys, ...sells];
}

export function sortLots(lots: CoinbaseLotRow[]): CoinbaseLotRow[] {
  lots.sort((a, b) => {
    const aDate = a.kind === "buy" ? a.acquired : (a.sold ?? a.acquired);
    const bDate = b.kind === "buy" ? b.acquired : (b.sold ?? b.acquired);

    const diff = aDate.getTime() - bDate.getTime();
    if (diff !== 0) {
      return diff;
    }

    if (a.kind === "buy" && b.kind === "sell") {
      return -1;
    }
    if (a.kind === "sell" && b.kind === "buy") {
      return 1;
    }
    return 0;
  });
  return lots;
}

export function getLotTotals(lots: CoinbaseLotRow[]): {
  totalCostBasis: number;
  totalProceeds: number;
  shortTerm: number;
  longTerm: number;
} {
  let totalCostBasis = 0;
  let totalProceeds = 0;
  let shortTerm = 0;
  let longTerm = 0;

  for (const lot of lots) {
    totalCostBasis += lot.basis;
    totalProceeds += lot.proceeds;
    if (lot.term === "short") {
      shortTerm += lot.gain;
    } else if (lot.term === "long") {
      longTerm += lot.gain;
    }
  }

  return { totalCostBasis, totalProceeds, shortTerm, longTerm };
}

export function formatLotTotals(
  totals: { totalCostBasis: number; totalProceeds: number; shortTerm: number; longTerm: number },
  asset = "",
): Record<string, number | string> {
  const row: Record<string, number | string> = {};
  if (asset) {
    row.asset = asset;
  }
  row["Total Cost Basis"] = Number(totals.totalCostBasis.toFixed(2));
  row["Total Proceeds"] = Number(totals.totalProceeds.toFixed(2));
  row["Short-Term Gains"] = Number(totals.shortTerm.toFixed(2));
  row["Long-Term Gains"] = Number(totals.longTerm.toFixed(2));
  return row;
}

export function toLotTableRow(lot: CoinbaseLotRow): Record<string, unknown> {
  return {
    id: lot.id,
    asset: lot.asset,
    acquired: lot.acquired,
    sold: lot.sold,
    size: lot.size,
    balance: lot.balance,
    basis: Number(lot.basis.toFixed(2)),
    proceeds: Number(lot.proceeds.toFixed(2)),
    gain: Number(lot.gain.toFixed(2)),
    term: lot.term,
  };
}
