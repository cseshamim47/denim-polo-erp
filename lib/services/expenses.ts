import { Types } from "mongoose";

import { connectToDatabase } from "@/lib/db";
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

  return ExpenseModel.create({
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
