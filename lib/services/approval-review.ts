export type ApprovalDecision = "approved" | "rejected";

export type ApprovalStatus = "pending" | "approved" | "rejected";

export type ApprovalActorUpdate = {
  partnerId: string;
  partnerName: string;
  decision: ApprovalDecision;
  comment: string | null;
  decidedAt: string;
};

export type ApprovalReviewUpdate = {
  id: string;
  status: ApprovalStatus;
  approval: ApprovalActorUpdate;
};

export function buildApprovalReviewUpdate(input: {
  id: string;
  status: ApprovalStatus;
  partnerId: string;
  partnerName: string;
  decision: ApprovalDecision;
  comment?: string | null;
  decidedAt: Date;
}): ApprovalReviewUpdate {
  return {
    id: input.id,
    status: input.status,
    approval: {
      partnerId: input.partnerId,
      partnerName: input.partnerName,
      decision: input.decision,
      comment: input.comment ?? null,
      decidedAt: input.decidedAt.toISOString(),
    },
  };
}

export function uniqReviewIds(ids: string[]) {
  return Array.from(new Set(ids.map((id) => id.trim()).filter(Boolean)));
}
