import { describe, expect, it } from "vitest";

import {
  buildExpenseApprovalSnapshot,
  evaluateExpenseDecision,
} from "../../lib/domain/expense-approval";

describe("expense approval", () => {
  it("requires all active partners except submitter", () => {
    const result = buildExpenseApprovalSnapshot({
      activePartnerIds: ["p1", "p2", "p3"],
      submitterId: "p1",
    });

    expect(result).toEqual({
      requiredApproverIds: ["p2", "p3"],
      requiredApprovalCount: 2,
    });
  });

  it("adapts when only two active partners remain", () => {
    const result = buildExpenseApprovalSnapshot({
      activePartnerIds: ["p1", "p2"],
      submitterId: "p1",
    });

    expect(result).toEqual({
      requiredApproverIds: ["p2"],
      requiredApprovalCount: 1,
    });
  });

  it("marks rejected when any approver rejects", () => {
    const result = evaluateExpenseDecision({
      requiredApproverIds: ["p2", "p3"],
      decisions: [
        { partnerId: "p2", decision: "approved" },
        { partnerId: "p3", decision: "rejected" },
      ],
    });

    expect(result).toBe("rejected");
  });

  it("marks approved only when all required approvers approve", () => {
    const result = evaluateExpenseDecision({
      requiredApproverIds: ["p2", "p3"],
      decisions: [
        { partnerId: "p2", decision: "approved" },
        { partnerId: "p3", decision: "approved" },
      ],
    });

    expect(result).toBe("approved");
  });
});
