import { describe, expect, it } from "vitest";

import {
  buildAssetApprovalSnapshot,
  evaluateAssetDecision,
} from "../../lib/domain/asset-approval";

describe("asset approval", () => {
  it("requires all active partners except submitter", () => {
    const result = buildAssetApprovalSnapshot({
      activePartnerIds: ["p1", "p2", "p3"],
      submitterId: "p1",
    });

    expect(result).toEqual({
      requiredApproverIds: ["p2", "p3"],
      requiredApprovalCount: 2,
    });
  });

  it("rejects when any approver rejects", () => {
    expect(
      evaluateAssetDecision({
        requiredApproverIds: ["p2", "p3"],
        decisions: [
          { partnerId: "p2", decision: "approved" },
          { partnerId: "p3", decision: "rejected" },
        ],
      }),
    ).toBe("rejected");
  });

  it("approves only when all required approvers approve", () => {
    expect(
      evaluateAssetDecision({
        requiredApproverIds: ["p2", "p3"],
        decisions: [
          { partnerId: "p2", decision: "approved" },
          { partnerId: "p3", decision: "approved" },
        ],
      }),
    ).toBe("approved");
  });
});
