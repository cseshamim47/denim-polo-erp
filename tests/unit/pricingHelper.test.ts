import { describe, expect, it } from "vitest";

import {
  calculateBreakEvenUnits,
  calculatePricingSuggestion,
} from "../../lib/domain/pricing";

describe("pricing helper", () => {
  it("allocates fixed expenses per unit and suggests a selling price from target margin", () => {
    const result = calculatePricingSuggestion({
      costPerUnit: 480,
      fixedExpensesTotal: 1200,
      expectedUnitsSold: 12,
      targetMarginPercent: 25,
    });

    expect(result).toEqual({
      breakEvenPricePerUnit: 580,
      suggestedSellingPrice: 773.33,
      expectedProfitPerUnit: 193.33,
      expectedProfitTotal: 2319.96,
    });
  });

  it("calculates how many units are needed to recover fixed expenses", () => {
    expect(
      calculateBreakEvenUnits({
        sellingPrice: 850,
        costPerUnit: 500,
        fixedExpensesTotal: 3000,
      }),
    ).toBe(9);
  });

  it("rejects impossible margin targets and non-positive unit counts", () => {
    expect(() =>
      calculatePricingSuggestion({
        costPerUnit: 400,
        fixedExpensesTotal: 800,
        expectedUnitsSold: 0,
        targetMarginPercent: 20,
      }),
    ).toThrow(/units/i);

    expect(() =>
      calculatePricingSuggestion({
        costPerUnit: 400,
        fixedExpensesTotal: 800,
        expectedUnitsSold: 10,
        targetMarginPercent: 100,
      }),
    ).toThrow(/margin/i);
  });
});
