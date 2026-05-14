type AssetDecision = "approved" | "rejected";

export function buildAssetApprovalSnapshot(input: {
  activePartnerIds: string[];
  submitterId: string;
}) {
  const requiredApproverIds = input.activePartnerIds.filter(
    (partnerId) => partnerId !== input.submitterId,
  );

  return {
    requiredApproverIds,
    requiredApprovalCount: requiredApproverIds.length,
  };
}

export function evaluateAssetDecision(input: {
  requiredApproverIds: string[];
  decisions: Array<{
    partnerId: string;
    decision: AssetDecision;
  }>;
}): "pending" | "approved" | "rejected" {
  const decisionMap = new Map(
    input.decisions.map((item) => [item.partnerId, item.decision]),
  );

  for (const approverId of input.requiredApproverIds) {
    if (decisionMap.get(approverId) === "rejected") {
      return "rejected";
    }
  }

  const approvedAll = input.requiredApproverIds.every(
    (approverId) => decisionMap.get(approverId) === "approved",
  );

  return approvedAll ? "approved" : "pending";
}
