import { describe, expect, it } from "vitest";
import {
  getAbbreviatedType,
  getClassifierForType,
  getSuperclassForType,
  getTypesForClassifier,
} from "../../../../../../../src/apps/hdb/commands/coinbase/transactions/coinbase-transaction-classifiers.js";

describe("coinbase transaction classifiers", () => {
  it("maps classifiers and superclasses to concrete transaction types", () => {
    expect(getTypesForClassifier("trade_buy")).toEqual(["Advanced Trade Buy", "Buy"]);
    expect(getTypesForClassifier("income")).toEqual([
      "Staking Income",
      "Reward Income",
      "Subscription Rebate",
      "Subscription Rebates (24 Hours)",
    ]);
  });

  it("throws for an unknown classifier label", () => {
    expect(() => getTypesForClassifier("made-up")).toThrow("Unknown classifier: made-up");
  });

  it("maps transaction types back to classifier and superclass labels", () => {
    expect(getClassifierForType("Buy")).toBe("trade_buy");
    expect(getSuperclassForType("Buy")).toBe("trade");
    expect(getClassifierForType("Deposit")).toBe("transfer_in");
    expect(getSuperclassForType("Deposit")).toBe("non_taxable");
    expect(getClassifierForType("Surprise")).toBe("unknown");
    expect(getSuperclassForType("Surprise")).toBe("uncategorized");
  });

  it("returns abbreviations and falls back to the original type", () => {
    expect(getAbbreviatedType("Advanced Trade Buy")).toBe("ATB");
    expect(getAbbreviatedType("Reward Income")).toBe("RIN");
    expect(getAbbreviatedType("Custom Type")).toBe("Custom Type");
  });
});
