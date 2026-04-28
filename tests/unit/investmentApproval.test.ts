import { describe, expect, it } from "vitest";

import {
  buildInvestmentApprovalSnapshot,
  evaluateInvestmentDecision,
} from "../../lib/domain/investment-approval";

describe("investment approval", () => {
  it("requires every active non-submitter partner to verify the investment", () => {
    const snapshot = buildInvestmentApprovalSnapshot({
      activePartnerIds: ["p1", "p2", "p3"],
      submitterId: "p1",
    });

    expect(snapshot).toEqual({
      requiredApproverIds: ["p2", "p3"],
      requiredApprovalCount: 2,
    });
  });

  it("marks the investment approved only after all required partners approve", () => {
    expect(
      evaluateInvestmentDecision({
        requiredApproverIds: ["p2", "p3"],
        decisions: [{ partnerId: "p2", decision: "approved" }],
      }),
    ).toBe("pending");

    expect(
      evaluateInvestmentDecision({
        requiredApproverIds: ["p2", "p3"],
        decisions: [
          { partnerId: "p2", decision: "approved" },
          { partnerId: "p3", decision: "approved" },
        ],
      }),
    ).toBe("approved");
  });

  it("rejects the investment when any required partner rejects it", () => {
    expect(
      evaluateInvestmentDecision({
        requiredApproverIds: ["p2", "p3"],
        decisions: [{ partnerId: "p3", decision: "rejected" }],
      }),
    ).toBe("rejected");
  });
});
