import { describe, expect, it } from "vitest";

import { pickChangedFields } from "@/lib/domain/history";

describe("pickChangedFields", () => {
  it("returns only changed fields for before and after snapshots", () => {
    const result = pickChangedFields(
      { title: "Old", amount: 100, status: "pending" },
      { title: "Old", amount: 120, status: "approved" },
    );

    expect(result).toEqual({
      before: { amount: 100, status: "pending" },
      after: { amount: 120, status: "approved" },
    });
  });
});
