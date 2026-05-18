import { Types } from "mongoose";

import { connectToDatabase } from "@/lib/db";
import { decimalToNumber } from "@/lib/money";
import { getCurrentBalanceSnapshot } from "@/lib/services/balance";
import InvestmentModel, { type InvestmentStatus } from "@/models/Investment";
import UserModel from "@/models/User";

export interface ListInvestmentHistoryInput {
  actorId: string;
  page?: number;
  pageSize?: number;
  scope?: string | null;
  owner?: string | null;
  status?: string | null;
  from?: string | null;
  to?: string | null;
  needsReview?: boolean;
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

function toRequiredApprovalCount(investment: {
  requiredApprovalCountSnapshot?: number | null;
  requiredApproverIdsSnapshot?: Types.ObjectId[] | null;
}) {
  return (
    investment.requiredApprovalCountSnapshot ??
    investment.requiredApproverIdsSnapshot?.length ??
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

export async function listInvestmentHistory(input: ListInvestmentHistoryInput) {
  await connectToDatabase();

  const page = toPage(input.page, 1);
  const pageSize = toPageSize(input.pageSize, 10);
  const scope = input.scope?.trim();
  const owner = input.owner?.trim();
  const status = input.status?.trim();
  const actorId = toObjectId(input.actorId, "actorId");
  const query: Record<string, unknown> = {};

  if (owner) {
    query.partnerId = toObjectId(owner, "owner filter");
  } else if (scope === "mine") {
    query.partnerId = actorId;
  } else if (scope === "others") {
    query.partnerId = { $ne: actorId };
  }

  if (input.needsReview) {
    query.status = "pending";
    query.partnerId = { $ne: actorId };
    query.requiredApproverIdsSnapshot = actorId;
    query.approvals = {
      $not: { $elemMatch: { partnerId: actorId } },
    };
  } else if (status && ["pending", "approved", "rejected"].includes(status)) {
    query.status = status as InvestmentStatus;
  }

  const fromDate = toDate(input.from, "start");
  const toDateValue = toDate(input.to, "end");

  if (fromDate || toDateValue) {
    query.investedAt = {};

    if (fromDate) {
      query.investedAt = {
        ...(query.investedAt as Record<string, unknown>),
        $gte: fromDate,
      };
    }

    if (toDateValue) {
      query.investedAt = {
        ...(query.investedAt as Record<string, unknown>),
        $lte: toDateValue,
      };
    }
  }

  const [partners, totalCount, investments, approvedInvestments, balance] =
    await Promise.all([
      UserModel.find({ role: "partner", isActive: true }).sort({ name: 1 }).lean(),
      InvestmentModel.countDocuments(query),
      InvestmentModel.find(query)
        .sort({ investedAt: -1, createdAt: -1 })
        .skip((page - 1) * pageSize)
        .limit(pageSize)
        .lean(),
      InvestmentModel.find({ status: "approved" }).lean(),
      getCurrentBalanceSnapshot(),
    ]);

  const partnerNameById = new Map(
    partners.map((partner) => [partner._id.toString(), partner.name]),
  );

  const approvedTotalByPartnerId = new Map<string, number>();

  for (const investment of approvedInvestments) {
    const partnerId = investment.partnerId.toString();
    const currentTotal = approvedTotalByPartnerId.get(partnerId) ?? 0;

    approvedTotalByPartnerId.set(
      partnerId,
      currentTotal + decimalToNumber(investment.amount),
    );
  }

  return {
    balance,
    partners: partners.map((partner) => ({
      id: partner._id.toString(),
      name: partner.name,
      email: partner.email,
    })),
    approvedTotals: partners.map((partner) => ({
      partnerId: partner._id.toString(),
      partnerName: partner.name,
      totalApprovedInvestment:
        approvedTotalByPartnerId.get(partner._id.toString()) ?? 0,
    })),
    investments: investments.map((investment) => {
      const approvals = toApprovals(investment.approvals);

      return {
        id: investment._id.toString(),
        partnerId: investment.partnerId.toString(),
        partnerName:
          partnerNameById.get(investment.partnerId.toString()) ??
          "Unknown partner",
        amount: decimalToNumber(investment.amount),
        note: investment.note ?? null,
        status: investment.status,
        submittedAt: toIsoDate(investment.submittedAt, investment.createdAt),
        requiredApprovalCount: toRequiredApprovalCount(investment),
        approvalCount: approvals.length,
        canReview:
          investment.partnerId.toString() !== input.actorId &&
          investment.status === "pending" &&
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
        investedAt: toIsoDate(investment.investedAt, investment.createdAt),
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
