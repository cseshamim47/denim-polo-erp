import { describe, expect, it } from "vitest";

import {
  buildPerfumeSaleFinancials,
  buildPerfumeSellingPrice,
} from "@/lib/domain/perfume-pricing";

describe("perfume pricing helpers", () => {
  it("calculates customer selling price from liquid cost and bottle selling price", () => {
    expect(
      buildPerfumeSellingPrice({
        avgCostPerMl: 5,
        soldMl: 15,
        bottleSellingPrice: 100,
      }),
    ).toBe(250);
  });

  it("calculates perfume line financial snapshots", () => {
    expect(
      buildPerfumeSaleFinancials({
        avgCostPerMl: 5,
        soldMl: 15,
        bottleBuyingCost: 12,
        bottleSellingPrice: 100,
      }),
    ).toEqual({
      liquidCost: 75,
      sellingPrice: 250,
      totalCost: 87,
      profit: 163,
    });
  });
});
