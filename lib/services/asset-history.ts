import { Types } from "mongoose";

import { connectToDatabase } from "@/lib/db";
import { decimalToNumber } from "@/lib/money";
import { getCurrentBalanceSnapshot } from "@/lib/services/balance";
import AssetModel, { type AssetStatus } from "@/models/Asset";
import UserModel from "@/models/User";

export interface ListAssetHistoryInput {
  actorId: string;
  page?: number;
  pageSize?: number;
  scope?: string | null;
  owner?: string | null;
  status?: string | null;
  category?: string | null;
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

function toRequiredApprovalCount(asset: {
  requiredApprovalCountSnapshot?: number | null;
  requiredApproverIdsSnapshot?: Types.ObjectId[] | null;
}) {
  return (
    asset.requiredApprovalCountSnapshot ??
    asset.requiredApproverIdsSnapshot?.length ??
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

export async function listAssetHistory(input: ListAssetHistoryInput) {
  await connectToDatabase();

  const page = toPage(input.page, 1);
  const pageSize = toPageSize(input.pageSize, 10);
  const scope = input.scope?.trim();
  const owner = input.owner?.trim();
  const status = input.status?.trim();
  const category = input.category?.trim().toUpperCase();
  const actorId = toObjectId(input.actorId, "actorId");
  const query: Record<string, unknown> = {};

  if (owner) {
    query.submittedBy = toObjectId(owner, "owner filter");
  } else if (scope === "mine") {
    query.submittedBy = actorId;
  } else if (scope === "others") {
    query.submittedBy = { $ne: actorId };
  }

  if (input.needsReview) {
    query.status = "pending";
    query.submittedBy = { $ne: actorId };
    query.requiredApproverIdsSnapshot = actorId;
    query.approvals = {
      $not: { $elemMatch: { partnerId: actorId } },
    };
  } else if (status && ["pending", "approved", "rejected"].includes(status)) {
    query.status = status as AssetStatus;
  }

  if (category) {
    query.category = category;
  }

  const fromDate = toDate(input.from, "start");
  const toDateValue = toDate(input.to, "end");

  if (fromDate || toDateValue) {
    query.assetDate = {};

    if (fromDate) {
      query.assetDate = {
        ...(query.assetDate as Record<string, unknown>),
        $gte: fromDate,
      };
    }

    if (toDateValue) {
      query.assetDate = {
        ...(query.assetDate as Record<string, unknown>),
        $lte: toDateValue,
      };
    }
  }

  const [allPartners, totalCount, assets, categorySuggestions, approvedAssets, balance] =
    await Promise.all([
      UserModel.find({ role: "partner" }).sort({ name: 1 }).lean(),
      AssetModel.countDocuments(query),
      AssetModel.find(query)
        .sort({ assetDate: -1, createdAt: -1 })
        .skip((page - 1) * pageSize)
        .limit(pageSize)
        .lean(),
      AssetModel.distinct("category"),
      AssetModel.find({ status: "approved" }).lean(),
      getCurrentBalanceSnapshot(),
    ]);

  const partnerNameById = new Map(
    allPartners.map((partner) => [partner._id.toString(), partner.name]),
  );
  const activePartners = allPartners.filter((partner) => partner.isActive);
  const approvedAssetTotal = approvedAssets.reduce(
    (sum, asset) => sum + decimalToNumber(asset.amount),
    0,
  );
  const pendingAssetCount = await AssetModel.countDocuments({ status: "pending" });

  return {
    partners: activePartners.map((partner) => ({
      id: partner._id.toString(),
      name: partner.name,
      email: partner.email,
    })),
    categorySuggestions: toSortedSuggestions(categorySuggestions),
    summary: {
      currentBalance: balance.currentBalance,
      approvedAssetTotal,
      pendingAssetCount,
    },
    assets: assets.map((asset) => {
      const approvals = toApprovals(asset.approvals);

      return {
        id: asset._id.toString(),
        title: asset.title,
        category: asset.category,
        amount: decimalToNumber(asset.amount),
        note: asset.note ?? null,
        status: asset.status,
        submittedById: asset.submittedBy.toString(),
        submittedByName:
          partnerNameById.get(asset.submittedBy.toString()) ?? "Unknown partner",
        submittedAt: toIsoDate(asset.submittedAt, asset.createdAt),
        assetDate: toIsoDate(asset.assetDate, asset.createdAt),
        requiredApprovalCount: toRequiredApprovalCount(asset),
        approvalCount: approvals.length,
        canReview:
          asset.submittedBy.toString() !== input.actorId &&
          asset.status === "pending" &&
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
