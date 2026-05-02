import { describe, expect, it } from "vitest";

import {
  buildPurchaseApprovalSnapshot,
  evaluatePurchaseDecision,
} from "../../lib/domain/purchase-approval";

describe("purchase approval", () => {
  it("requires every active non-submitter partner", () => {
    const snapshot = buildPurchaseApprovalSnapshot({
      activePartnerIds: ["p1", "p2", "p3"],
      submitterId: "p1",
    });

    expect(snapshot).toEqual({
      requiredApproverIds: ["p2", "p3"],
      requiredApprovalCount: 2,
    });
  });

  it("stays pending until all required partners approve", () => {
    expect(
      evaluatePurchaseDecision({
        requiredApproverIds: ["p2", "p3"],
        decisions: [{ partnerId: "p2", decision: "approved" }],
      }),
    ).toBe("pending");

    expect(
      evaluatePurchaseDecision({
        requiredApproverIds: ["p2", "p3"],
        decisions: [
          { partnerId: "p2", decision: "approved" },
          { partnerId: "p3", decision: "approved" },
        ],
      }),
    ).toBe("approved");
  });

  it("rejects when any required partner rejects", () => {
    expect(
      evaluatePurchaseDecision({
        requiredApproverIds: ["p2", "p3"],
        decisions: [{ partnerId: "p3", decision: "rejected" }],
      }),
    ).toBe("rejected");
  });
});