import { describe, expect, it } from "vitest";

import {
  calculateCurrentBalance,
  calculateCustomerRefundTotal,
} from "../../lib/domain/balance";

describe("balance helpers", () => {
  it("calculates customer refund total from returned sale lines", () => {
    expect(
      calculateCustomerRefundTotal([
        {
          items: [
            {
              returnedQty: 2,
              sellingPriceSnapshot: "180",
            },
            {
              returnedQty: 1,
              sellingPriceSnapshot: "95",
            },
          ],
        },
        {
          items: [
            {
              returnedQty: 0,
              sellingPriceSnapshot: "220",
            },
          ],
        },
      ]),
    ).toBe(455);
  });

  it("calculates current balance from money in and out", () => {
    expect(
      calculateCurrentBalance({
        approvedInvestmentTotal: 10000,
        completedSalesTotal: 6500,
        customerRefundTotal: 500,
        purchaseTotal: 4200,
        approvedAssetTotal: 700,
        approvedExpenseTotal: 800,
      }),
    ).toBe(10300);
  });
});
