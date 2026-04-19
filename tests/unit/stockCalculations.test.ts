import { describe, expect, it } from "vitest";

import {
  applyCustomerReturn,
  applyDamagedReturn,
  applyPurchaseToVariant,
  buildSaleLineSnapshot,
} from "../../lib/domain/stock-calculations";

describe("stock calculations", () => {
  it("updates stock and weighted average cost on purchase", () => {
    const result = applyPurchaseToVariant({
      oldStock: 10,
      oldAvgCost: 100,
      purchaseQty: 5,
      costPerUnit: 130,
    });

    expect(result).toEqual({
      newStock: 15,
      newAvgCost: 110,
    });
  });

  it("deducts stock and snapshots profit on sale", () => {
    const result = buildSaleLineSnapshot({
      stockQty: 8,
      soldQty: 3,
      sellingPrice: 180,
      avgCostAtTimeOfSale: 125,
    });

    expect(result).toEqual({
      remainingStock: 5,
      profitPerItem: 55,
    });
  });

  it("returns stock for customer returns and reduces snapped profit", () => {
    const result = applyCustomerReturn({
      currentStock: 5,
      returnedQty: 2,
      soldQty: 3,
      alreadyReturnedQty: 0,
      alreadyDamagedQty: 0,
      profitPerItemSnapshot: 55,
    });

    expect(result).toEqual({
      newStock: 7,
      profitAdjustment: 110,
      resolvedQty: 2,
    });
  });

  it("does not change stock for damaged returns and records loss", () => {
    const result = applyDamagedReturn({
      currentStock: 5,
      damagedQty: 1,
      soldQty: 3,
      alreadyReturnedQty: 1,
      alreadyDamagedQty: 0,
      profitPerItemSnapshot: 55,
      avgCostSnapshot: 125,
    });

    expect(result).toEqual({
      newStock: 5,
      profitAdjustment: 55,
      lossAmount: 125,
      resolvedQty: 1,
    });
  });
});
