import { HydratedDocument, Types } from "mongoose";

import { connectToDatabase } from "@/lib/db";
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

  return InvestmentModel.create({
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
