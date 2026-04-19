type ExpenseDecision = "approved" | "rejected";

export function buildExpenseApprovalSnapshot(input: {
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

export function evaluateExpenseDecision(input: {
  requiredApproverIds: string[];
  decisions: Array<{
    partnerId: string;
    decision: ExpenseDecision;
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
