import { Types } from "mongoose";

import { connectToDatabase } from "@/lib/db";
import {
  buildApprovalReviewUpdate,
  uniqReviewIds,
  type ApprovalDecision,
} from "@/lib/services/approval-review";
import { recordHistoryEvent } from "@/lib/services/history";
import {
  buildExpenseApprovalSnapshot,
  evaluateExpenseDecision,
} from "@/lib/domain/expense-approval";
import { toDecimal128 } from "@/lib/money";
import ExpenseModel from "@/models/Expense";
import UserModel from "@/models/User";

export async function createExpense(input: {
  title: string;
  amount: number;
  note?: string;
  expenseDate: Date;
  submittedBy: string;
  submittedByName: string;
}) {
  await connectToDatabase();

  const activePartners = await UserModel.find({
    role: "partner",
    isActive: true,
  }).lean();
  const snapshot = buildExpenseApprovalSnapshot({
    activePartnerIds: activePartners.map((partner) => partner._id.toString()),
    submitterId: input.submittedBy,
  });

  if (snapshot.requiredApprovalCount === 0) {
    throw new Error("expense approval requires at least one active approver");
  }

  const expense = await ExpenseModel.create({
    title: input.title,
    amount: toDecimal128(input.amount),
    note: input.note ?? null,
    submittedBy: new Types.ObjectId(input.submittedBy),
    submittedAt: new Date(),
    status: "pending",
    approvals: [],
    requiredApproverIdsSnapshot: snapshot.requiredApproverIds.map(
      (partnerId) => new Types.ObjectId(partnerId),
    ),
    requiredApprovalCountSnapshot: snapshot.requiredApprovalCount,
    expenseDate: input.expenseDate,
  });

  await recordHistoryEvent({
    actorId: input.submittedBy,
    actorName: input.submittedByName,
    actorRole: "partner",
    module: "expenses",
    entityType: "expense",
    entityId: expense._id.toString(),
    entityLabel: input.title,
    action: "create",
    summary: `Expense created: ${input.title}`,
    before: null,
    after: {
      title: input.title,
      amount: input.amount,
      expenseDate: input.expenseDate.toISOString(),
      status: "pending",
      note: input.note ?? null,
    },
  });

  return expense;
}

export async function reviewExpense(input: {
  expenseId: string;
  partnerId: string;
  decision: "approved" | "rejected";
  comment?: string;
}) {
  await connectToDatabase();

  const expense = await ExpenseModel.findById(input.expenseId);

  if (!expense) {
    throw new Error("expense not found");
  }

  if (expense.submittedBy.toString() === input.partnerId) {
    throw new Error("submitter cannot approve own expense");
  }

  const existingDecision = expense.approvals.find(
    (approval) => approval.partnerId.toString() === input.partnerId,
  );

  if (existingDecision) {
    throw new Error("partner already reviewed expense");
  }

  expense.approvals.push({
    partnerId: new Types.ObjectId(input.partnerId),
    decision: input.decision,
    decidedAt: new Date(),
    comment: input.comment ?? null,
  });

  expense.status = evaluateExpenseDecision({
    requiredApproverIds: expense.requiredApproverIdsSnapshot.map((partnerId) =>
      partnerId.toString(),
    ),
    decisions: expense.approvals.map((approval) => ({
      partnerId: approval.partnerId.toString(),
      decision: approval.decision,
    })),
  });

  await expense.save();

  return expense;
}

export async function reviewExpenses(input: {
  expenseIds: string[];
  partnerId: string;
  partnerName: string;
  decision: ApprovalDecision;
  comment?: string;
}) {
  const expenseIds = uniqReviewIds(input.expenseIds);
  const reviews = [];

  for (const expenseId of expenseIds) {
    const expense = await reviewExpense({
      expenseId,
      partnerId: input.partnerId,
      decision: input.decision,
      comment: input.comment,
    });
    const actorApproval = expense.approvals.find(
      (approval) => approval.partnerId.toString() === input.partnerId,
    );

    if (!actorApproval) {
      continue;
    }

    reviews.push(
      buildApprovalReviewUpdate({
        id: expense._id.toString(),
        status: expense.status,
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
      module: "expenses",
      entityType: "expense",
      entityId: expense._id.toString(),
      entityLabel: expense.title,
      action: input.decision === "approved" ? "approve" : "reject",
      summary: `Expense ${input.decision}: ${expense.title}`,
      before: { status: "pending" },
      after: {
        status: expense.status,
        comment: actorApproval.comment ?? null,
      },
    });
  }

  return reviews;
}
