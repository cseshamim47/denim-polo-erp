import { HydratedDocument, Types } from "mongoose";

import { connectToDatabase } from "@/lib/db";
import {
  buildApprovalReviewUpdate,
  uniqReviewIds,
  type ApprovalDecision,
} from "@/lib/services/approval-review";
import { recordHistoryEvent } from "@/lib/services/history";
import {
  buildInvestmentApprovalSnapshot,
  evaluateInvestmentDecision,
} from "@/lib/domain/investment-approval";
import { toDecimal128 } from "@/lib/money";
import InvestmentModel, { type Investment } from "@/models/Investment";
import UserModel from "@/models/User";

export async function createInvestment(input: {
  amount: number;
  investedAt: Date;
  note?: string;
  submittedBy: string;
  submittedByName: string;
}): Promise<HydratedDocument<Investment>> {
  await connectToDatabase();

  const activePartners = await UserModel.find({
    role: "partner",
    isActive: true,
  }).lean();
  const snapshot = buildInvestmentApprovalSnapshot({
    activePartnerIds: activePartners.map((partner) => partner._id.toString()),
    submitterId: input.submittedBy,
  });

  if (snapshot.requiredApprovalCount === 0) {
    throw new Error(
      "investment approval requires at least one active approver",
    );
  }

  const investment = await InvestmentModel.create({
    partnerId: new Types.ObjectId(input.submittedBy),
    amount: toDecimal128(input.amount),
    note: input.note ?? null,
    submittedAt: new Date(),
    status: "pending",
    approvals: [],
    requiredApproverIdsSnapshot: snapshot.requiredApproverIds.map(
      (partnerId) => new Types.ObjectId(partnerId),
    ),
    requiredApprovalCountSnapshot: snapshot.requiredApprovalCount,
    investedAt: input.investedAt,
  });

  await recordHistoryEvent({
    actorId: input.submittedBy,
    actorName: input.submittedByName,
    actorRole: "partner",
    module: "investments",
    entityType: "investment",
    entityId: investment._id.toString(),
    entityLabel: input.submittedByName,
    action: "create",
    summary: `Investment created: ${input.submittedByName}`,
    before: null,
    after: {
      amount: input.amount,
      investedAt: input.investedAt.toISOString(),
      status: "pending",
      note: input.note ?? null,
    },
  });

  return investment;
}

export async function reviewInvestment(input: {
  investmentId: string;
  partnerId: string;
  decision: "approved" | "rejected";
  comment?: string;
}): Promise<HydratedDocument<Investment>> {
  await connectToDatabase();

  const investment = await InvestmentModel.findById(input.investmentId);

  if (!investment) {
    throw new Error("investment not found");
  }

  if (investment.partnerId.toString() === input.partnerId) {
    throw new Error("submitter cannot approve own investment");
  }

  const existingDecision = investment.approvals.find(
    (approval) => approval.partnerId.toString() === input.partnerId,
  );

  if (existingDecision) {
    throw new Error("partner already reviewed investment");
  }

  investment.approvals.push({
    partnerId: new Types.ObjectId(input.partnerId),
    decision: input.decision,
    decidedAt: new Date(),
    comment: input.comment ?? null,
  });

  investment.status = evaluateInvestmentDecision({
    requiredApproverIds: investment.requiredApproverIdsSnapshot.map(
      (partnerId) => partnerId.toString(),
    ),
    decisions: investment.approvals.map((approval) => ({
      partnerId: approval.partnerId.toString(),
      decision: approval.decision,
    })),
  });

  await investment.save();

  return investment;
}

export async function reviewInvestments(input: {
  investmentIds: string[];
  partnerId: string;
  partnerName: string;
  decision: ApprovalDecision;
  comment?: string;
}) {
  const investmentIds = uniqReviewIds(input.investmentIds);
  const reviews = [];

  for (const investmentId of investmentIds) {
    const investment = await reviewInvestment({
      investmentId,
      partnerId: input.partnerId,
      decision: input.decision,
      comment: input.comment,
    });
    const actorApproval = investment.approvals.find(
      (approval) => approval.partnerId.toString() === input.partnerId,
    );

    if (!actorApproval) {
      continue;
    }

    reviews.push(
      buildApprovalReviewUpdate({
        id: investment._id.toString(),
        status: investment.status,
        partnerId: input.partnerId,
        partnerName: input.partnerName,
        decision: actorApproval.decision,
        comment: actorApproval.comment,
        decidedAt: actorApproval.decidedAt,
      }),
    );

    await recordHistoryEvent({
      actorId: input.partnerId,
      actorName: input.partnerName,
      actorRole: "partner",
      module: "investments",
      entityType: "investment",
      entityId: investment._id.toString(),
      entityLabel: investment.partnerId.toString(),
      action: input.decision === "approved" ? "approve" : "reject",
      summary: `Investment ${input.decision}: ${investment._id.toString()}`,
      before: { status: "pending" },
      after: {
        status: investment.status,
        comment: actorApproval.comment ?? null,
      },
    });
  }

  return reviews;
}
