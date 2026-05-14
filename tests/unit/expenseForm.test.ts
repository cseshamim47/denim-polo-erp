import { describe, expect, it } from "vitest";

import {
  buildExpenseRequest,
  formatDateInputValue,
} from "../../lib/domain/expense-form";

describe("expense form helpers", () => {
  it("formats local date values for date inputs", () => {
    const value = formatDateInputValue(new Date(2026, 4, 14, 18, 30, 0));

    expect(value).toBe("2026-05-14");
  });

  it("preserves selected expense date in request payload", () => {
    const payload = buildExpenseRequest({
      title: "  Fuel  ",
      amount: 1250,
      note: "  Delivery van refill  ",
      expenseDate: "2026-05-09",
    });

    expect(payload).toEqual({
      title: "Fuel",
      amount: 1250,
      note: "Delivery van refill",
      expenseDate: "2026-05-09",
    });
  });
});
