import { Types } from "mongoose";

import { connectToDatabase } from "@/lib/db";
import { decimalToNumber } from "@/lib/money";
import ExpenseModel, { type ExpenseStatus } from "@/models/Expense";
import UserModel from "@/models/User";

export type ExpenseHistoryScope = "all" | "mine" | "others";

export interface ListExpenseHistoryInput {
  actorId: string;
  page?: number;
  pageSize?: number;
  scope?: string | null;
  owner?: string | null;
  status?: string | null;
  from?: string | null;
  to?: string | null;
}

function toIsoDate(
  value: Date | null | undefined,
  fallback: Date | null | undefined,
) {
  return (value ?? fallback ?? new Date(0)).toISOString();
}

function toApprovals(
  approvals:
    | Array<{
        partnerId: Types.ObjectId;
        decision: "approved" | "rejected";
        comment?: string | null;
        decidedAt: Date;
      }>
    | null
    | undefined,
) {
  return approvals ?? [];
}

function toRequiredApprovalCount(expense: {
  requiredApprovalCountSnapshot?: number | null;
  requiredApproverIdsSnapshot?: Types.ObjectId[] | null;
}) {
  return (
    expense.requiredApprovalCountSnapshot ??
    expense.requiredApproverIdsSnapshot?.length ??
    0
  );
}

function toPage(value: number | undefined, fallback: number) {
  const numericValue = Number(value ?? fallback);

  if (!Number.isFinite(numericValue)) {
    return fallback;
  }

  return Math.max(Math.trunc(numericValue), 1);
}

function toPageSize(value: number | undefined, fallback: number) {
  return Math.min(toPage(value, fallback), 50);
}

function toObjectId(value: string, label: string) {
  if (!Types.ObjectId.isValid(value)) {
    throw new Error(`Invalid ${label}`);
  }

  return new Types.ObjectId(value);
}

function toSortedSuggestions(values: unknown[]) {
  return values
    .filter((value): value is string => typeof value === "string")
    .sort((left, right) => left.localeCompare(right));
}

function toDate(value: string | null | undefined, boundary: "start" | "end") {
  if (!value) {
    return null;
  }

  const isDateOnly = /^\d{4}-\d{2}-\d{2}$/.test(value);

  if (isDateOnly) {
    return new Date(
      `${value}T${boundary === "start" ? "00:00:00.000" : "23:59:59.999"}Z`,
    );
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date;
}

export async function listExpenseHistory(input: ListExpenseHistoryInput) {
  await connectToDatabase();

  const page = toPage(input.page, 1);
  const pageSize = toPageSize(input.pageSize, 10);
  const scope = input.scope?.trim();
  const owner = input.owner?.trim();
  const status = input.status?.trim();
  const actorId = toObjectId(input.actorId, "actorId");
  const query: Record<string, unknown> = {};

  if (owner) {
    query.submittedBy = toObjectId(owner, "owner filter");
  } else if (scope === "mine") {
    query.submittedBy = actorId;
  } else if (scope === "others") {
    query.submittedBy = { $ne: actorId };
  }

  if (status && ["pending", "approved", "rejected"].includes(status)) {
    query.status = status as ExpenseStatus;
  }

  const fromDate = toDate(input.from, "start");
  const toDateValue = toDate(input.to, "end");

  if (fromDate || toDateValue) {
    query.expenseDate = {};

    if (fromDate) {
      query.expenseDate = {
        ...(query.expenseDate as Record<string, unknown>),
        $gte: fromDate,
      };
    }

    if (toDateValue) {
      query.expenseDate = {
        ...(query.expenseDate as Record<string, unknown>),
        $lte: toDateValue,
      };
    }
  }

  const [allPartners, totalCount, expenses, titleSuggestions] =
    await Promise.all([
      UserModel.find({ role: "partner" }).sort({ name: 1 }).lean(),
      ExpenseModel.countDocuments(query),
      ExpenseModel.find(query)
        .sort({ expenseDate: -1, createdAt: -1 })
        .skip((page - 1) * pageSize)
        .limit(pageSize)
        .lean(),
      ExpenseModel.distinct("title"),
    ]);

  const partnerNameById = new Map(
    allPartners.map((partner) => [partner._id.toString(), partner.name]),
  );
  const activePartners = allPartners.filter((partner) => partner.isActive);

  return {
    partners: activePartners.map((partner) => ({
      id: partner._id.toString(),
      name: partner.name,
      email: partner.email,
    })),
    titleSuggestions: toSortedSuggestions(titleSuggestions),
    expenses: expenses.map((expense) => {
      const approvals = toApprovals(expense.approvals);

      return {
        id: expense._id.toString(),
        title: expense.title,
        amount: decimalToNumber(expense.amount),
        note: expense.note ?? null,
        status: expense.status,
        submittedById: expense.submittedBy.toString(),
        submittedByName:
          partnerNameById.get(expense.submittedBy.toString()) ??
          "Unknown partner",
        submittedAt: toIsoDate(expense.submittedAt, expense.createdAt),
        requiredApprovalCount: toRequiredApprovalCount(expense),
        approvalCount: approvals.length,
        canReview:
          expense.submittedBy.toString() !== input.actorId &&
          expense.status === "pending" &&
          !approvals.some(
            (approval) => approval.partnerId.toString() === input.actorId,
          ),
        approvals: approvals.map((approval) => ({
          partnerId: approval.partnerId.toString(),
          partnerName:
            partnerNameById.get(approval.partnerId.toString()) ??
            "Unknown partner",
          decision: approval.decision,
          comment: approval.comment ?? null,
          decidedAt: approval.decidedAt.toISOString(),
        })),
        expenseDate: toIsoDate(expense.expenseDate, expense.createdAt),
      };
    }),
    pagination: {
      page,
      pageSize,
      totalCount,
      totalPages: Math.max(Math.ceil(totalCount / pageSize), 1),
    },
  };
}
