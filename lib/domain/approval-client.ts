import type { ApprovalReviewUpdate } from "@/lib/services/approval-review";

type ReviewableRecord = {
  id: string;
  status: "pending" | "approved" | "rejected";
  approvalCount: number;
  canReview: boolean;
  approvals: Array<{
    partnerId: string;
    partnerName: string;
    decision: "approved" | "rejected";
    comment: string | null;
    decidedAt: string;
  }>;
};

export function applyReviewUpdates<T extends ReviewableRecord>(
  records: T[],
  updates: ApprovalReviewUpdate[],
) {
  const updateById = new Map(updates.map((update) => [update.id, update]));

  return records.map((record) => {
    const update = updateById.get(record.id);

    if (!update) {
      return record;
    }

    const alreadyReviewed = record.approvals.some(
      (approval) => approval.partnerId === update.approval.partnerId,
    );

    return {
      ...record,
      status: update.status,
      approvalCount: alreadyReviewed
        ? record.approvalCount
        : record.approvalCount + 1,
      canReview: false,
      approvals: alreadyReviewed
        ? record.approvals.map((approval) =>
            approval.partnerId === update.approval.partnerId
              ? update.approval
              : approval,
          )
        : [...record.approvals, update.approval],
    };
  });
}

export function clearReviewedSelections(
  selectedIds: string[],
  records: Array<{ id: string; canReview: boolean }>,
) {
  const stillReviewable = new Set(
    records.filter((record) => record.canReview).map((record) => record.id),
  );

  return selectedIds.filter((id) => stillReviewable.has(id));
}
