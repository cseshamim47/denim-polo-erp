import { describe, expect, it } from "vitest";

import {
  applyReviewUpdates,
  clearReviewedSelections,
} from "@/lib/domain/approval-client";

describe("approval client helpers", () => {
  it("patches reviewed records without refetching full list", () => {
    const records = [
      {
        id: "expense-1",
        status: "pending" as const,
        approvalCount: 0,
        requiredApprovalCount: 2,
        canReview: true,
        approvals: [],
      },
      {
        id: "expense-2",
        status: "pending" as const,
        approvalCount: 1,
        requiredApprovalCount: 2,
        canReview: true,
        approvals: [
          {
            partnerId: "partner-2",
            partnerName: "Partner Two",
            decision: "approved" as const,
            comment: null,
            decidedAt: "2026-05-18T08:00:00.000Z",
          },
        ],
      },
    ];

    const nextRecords = applyReviewUpdates(records, [
      {
        id: "expense-2",
        status: "approved",
        approval: {
          partnerId: "partner-3",
          partnerName: "Partner Three",
          decision: "approved",
          comment: null,
          decidedAt: "2026-05-18T09:00:00.000Z",
        },
      },
    ]);

    expect(nextRecords).toEqual([
      records[0],
      {
        id: "expense-2",
        status: "approved",
        approvalCount: 2,
        requiredApprovalCount: 2,
        canReview: false,
        approvals: [
          {
            partnerId: "partner-2",
            partnerName: "Partner Two",
            decision: "approved",
            comment: null,
            decidedAt: "2026-05-18T08:00:00.000Z",
          },
          {
            partnerId: "partner-3",
            partnerName: "Partner Three",
            decision: "approved",
            comment: null,
            decidedAt: "2026-05-18T09:00:00.000Z",
          },
        ],
      },
    ]);
  });

  it("drops selections for items no longer reviewable", () => {
    const selectedIds = ["expense-1", "expense-2", "expense-3"];
    const records = [
      { id: "expense-1", canReview: false },
      { id: "expense-2", canReview: true },
      { id: "expense-3", canReview: false },
    ];

    expect(clearReviewedSelections(selectedIds, records)).toEqual([
      "expense-2",
    ]);
  });
});
