import { HydratedDocument, Types } from "mongoose";

import { connectToDatabase } from "@/lib/db";
import {
  buildPurchaseApprovalSnapshot,
  evaluatePurchaseDecision,
} from "@/lib/domain/purchase-approval";
import {
  buildApprovalReviewUpdate,
  uniqReviewIds,
  type ApprovalDecision,
} from "@/lib/services/approval-review";
import { recordHistoryEvent } from "@/lib/services/history";
import { decimalToNumber, toDecimal128 } from "@/lib/money";
import { applyPurchaseToVariant } from "@/lib/domain/stock-calculations";
import PurchaseModel, {
  type Purchase,
  type PurchaseStatus,
} from "@/models/Purchase";
import ProductModel from "@/models/Product";
import UserModel from "@/models/User";
import VariantModel from "@/models/Variant";

export type PurchaseHistoryRecord = {
  id: string;
  purchaseDate: string;
  sku: string;
  productName: string;
  size: string;
  color: string;
  qty: number;
  costPerUnit: number;
  additionalCost: number;
  totalCost: number;
  cashOutTotal: number;
  note: string | null;
  status: PurchaseStatus;
  createdById: string;
  createdByName: string;
  requiredApprovalCount: number;
  approvalCount: number;
  canReview: boolean;
  pendingPartnerIds: string[];
  pendingPartnerNames: string[];
  approvals: Array<{
    partnerId: string;
    partnerName: string;
    decision: "approved" | "rejected";
    comment: string | null;
    decidedAt: string;
  }>;
};

export type PurchaseHistoryPage = {
  items: PurchaseHistoryRecord[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

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

function toRequiredApprovalCount(purchase: {
  requiredApprovalCountSnapshot?: number | null;
  requiredApproverIdsSnapshot?: Types.ObjectId[] | null;
}) {
  return (
    purchase.requiredApprovalCountSnapshot ??
    purchase.requiredApproverIdsSnapshot?.length ??
    0
  );
}

export async function createPurchase(input: {
  variantId: string;
  qty: number;
  costPerUnit: number;
  additionalCost?: number;
  purchaseDate: Date;
  createdBy: string;
  createdByName: string;
  billImageUrl?: string;
  note?: string;
}): Promise<HydratedDocument<Purchase>> {
  await connectToDatabase();

  const [variant, activePartners] = await Promise.all([
    VariantModel.findById(input.variantId),
    UserModel.find({ role: "partner", isActive: true }).lean(),
  ]);

  if (!variant) {
    throw new Error("variant not found");
  }

  const snapshot = buildPurchaseApprovalSnapshot({
    activePartnerIds: activePartners.map((partner) => partner._id.toString()),
    submitterId: input.createdBy,
  });

  if (snapshot.requiredApprovalCount === 0) {
    throw new Error("purchase approval requires at least one active approver");
  }

  const totalCost = input.qty * input.costPerUnit;
  const additionalCost = input.additionalCost ?? 0;
  const cashOutTotal = totalCost + additionalCost;
  const landedCostPerUnit = cashOutTotal / input.qty;

  const purchase = await PurchaseModel.create({
    variantId: new Types.ObjectId(input.variantId),
    qty: input.qty,
    costPerUnit: toDecimal128(input.costPerUnit),
    landedCostPerUnit: toDecimal128(landedCostPerUnit),
    totalCost: toDecimal128(totalCost),
    additionalCost: toDecimal128(additionalCost),
    cashOutTotal: toDecimal128(cashOutTotal),
    billImageUrl: input.billImageUrl ?? null,
    purchaseDate: input.purchaseDate,
    note: input.note ?? null,
    createdBy: new Types.ObjectId(input.createdBy),
    status: "pending",
    approvals: [],
    requiredApproverIdsSnapshot: snapshot.requiredApproverIds.map(
      (partnerId) => new Types.ObjectId(partnerId),
    ),
    requiredApprovalCountSnapshot: snapshot.requiredApprovalCount,
  });

  const product = await ProductModel.findById(variant.productId)
    .select({ name: 1 })
    .lean();

  await recordHistoryEvent({
    actorId: input.createdBy,
    actorName: input.createdByName,
    actorRole: "partner",
    module: "purchases",
    entityType: "purchase",
    entityId: purchase._id.toString(),
    entityLabel: `${product?.name ?? "Unknown product"} · ${variant.sku}`,
    action: "create",
    summary: `Purchase created: ${product?.name ?? "Unknown product"} (${input.qty} @ ${input.costPerUnit})`,
    before: null,
    after: {
      variantId: input.variantId,
      qty: input.qty,
      costPerUnit: input.costPerUnit,
      additionalCost,
      cashOutTotal,
      purchaseDate: input.purchaseDate.toISOString(),
      status: "pending",
    },
  });

  return purchase;
}

export async function reviewPurchase(input: {
  purchaseId: string;
  partnerId: string;
  decision: "approved" | "rejected";
  comment?: string;
}): Promise<HydratedDocument<Purchase>> {
  await connectToDatabase();

  const purchase = await PurchaseModel.findById(input.purchaseId);

  if (!purchase) {
    throw new Error("purchase not found");
  }

  if (purchase.createdBy.toString() === input.partnerId) {
    throw new Error("submitter cannot approve own purchase");
  }

  const existingDecision = purchase.approvals.find(
    (approval) => approval.partnerId.toString() === input.partnerId,
  );

  if (existingDecision) {
    throw new Error("partner already reviewed purchase");
  }

  purchase.approvals.push({
    partnerId: new Types.ObjectId(input.partnerId),
    decision: input.decision,
    decidedAt: new Date(),
    comment: input.comment ?? null,
  });

  const nextStatus = evaluatePurchaseDecision({
    requiredApproverIds: purchase.requiredApproverIdsSnapshot.map((partnerId) =>
      partnerId.toString(),
    ),
    decisions: purchase.approvals.map((approval) => ({
      partnerId: approval.partnerId.toString(),
      decision: approval.decision,
    })),
  });

  const shouldApplyToVariant =
    purchase.status !== "approved" && nextStatus === "approved";

  purchase.status = nextStatus;

  if (shouldApplyToVariant) {
    const variant = await VariantModel.findById(purchase.variantId);

    if (!variant) {
      throw new Error("variant not found");
    }

    const { newStock, newAvgCost } = applyPurchaseToVariant({
      oldStock: variant.stockQty,
      oldAvgCost: decimalToNumber(variant.avgCost),
      purchaseQty: purchase.qty,
      costPerUnit: decimalToNumber(purchase.landedCostPerUnit),
    });

    variant.stockQty = newStock;
    variant.avgCost = toDecimal128(newAvgCost) as never;
    await variant.save();
  }

  await purchase.save();

  return purchase;
}

export async function reviewPurchases(input: {
  purchaseIds: string[];
  partnerId: string;
  partnerName: string;
  decision: ApprovalDecision;
  comment?: string;
}) {
  const purchaseIds = uniqReviewIds(input.purchaseIds);
  const reviews = [];

  for (const purchaseId of purchaseIds) {
    const purchase = await reviewPurchase({
      purchaseId,
      partnerId: input.partnerId,
      decision: input.decision,
      comment: input.comment,
    });
    const actorApproval = purchase.approvals.find(
      (approval) => approval.partnerId.toString() === input.partnerId,
    );

    if (!actorApproval) {
      continue;
    }

    reviews.push(
      buildApprovalReviewUpdate({
        id: purchase._id.toString(),
        status: purchase.status,
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
      module: "purchases",
      entityType: "purchase",
      entityId: purchase._id.toString(),
      entityLabel: purchase.variantId.toString(),
      action: input.decision === "approved" ? "approve" : "reject",
      summary: `Purchase ${input.decision}: ${purchase._id.toString()}`,
      before: {
        status:
          input.decision === "approved" && purchase.status === "approved"
            ? "pending"
            : purchase.status === "rejected"
              ? "pending"
              : "pending",
      },
      after: {
        status: purchase.status,
        comment: actorApproval.comment ?? null,
      },
    });
  }

  return reviews;
}

export async function listPurchases(input?: {
  actorId?: string;
  search?: string;
  from?: Date;
  to?: Date;
  page?: number;
  pageSize?: number;
  needsReview?: boolean;
  status?: string | null;
}): Promise<PurchaseHistoryPage> {
  await connectToDatabase();

  const requestedPage = Number.isFinite(input?.page)
    ? Math.max(1, Math.trunc(input?.page ?? 1))
    : 1;
  const requestedPageSize = Number.isFinite(input?.pageSize)
    ? Math.max(1, Math.min(100, Math.trunc(input?.pageSize ?? 20)))
    : 20;

  const query: Record<string, unknown> = {};

  const actorId = input?.actorId?.trim();
  const actorObjectId =
    actorId && Types.ObjectId.isValid(actorId)
      ? new Types.ObjectId(actorId)
      : null;

  if (input?.from || input?.to) {
    query.purchaseDate = {
      ...(input.from ? { $gte: input.from } : {}),
      ...(input.to ? { $lte: input.to } : {}),
    };
  }

  if (input?.needsReview && actorObjectId) {
    query.status = "pending";
    query.createdBy = { $ne: actorObjectId };
    query.requiredApproverIdsSnapshot = actorObjectId;
    query.approvals = {
      $not: { $elemMatch: { partnerId: actorObjectId } },
    };
  } else if (
    input?.status &&
    ["pending", "approved", "rejected"].includes(input.status)
  ) {
    query.status = input.status;
  }

  const purchases = await PurchaseModel.find(query)
    .sort({ purchaseDate: -1, createdAt: -1 })
    .lean();

  if (purchases.length === 0) {
    return {
      items: [],
      total: 0,
      page: 1,
      pageSize: requestedPageSize,
      totalPages: 1,
    };
  }

  const variantIds = Array.from(
    new Set(purchases.map((purchase) => purchase.variantId.toString())),
  );

  const variants = await VariantModel.find({ _id: { $in: variantIds } })
    .select({ sku: 1, size: 1, color: 1, productId: 1 })
    .lean();

  const productIds = Array.from(
    new Set(variants.map((variant) => variant.productId.toString())),
  );

  const creatorIds = Array.from(
    new Set(purchases.map((purchase) => purchase.createdBy.toString())),
  );
  const requiredApproverIds = Array.from(
    new Set(
      purchases.flatMap((purchase) =>
        (purchase.requiredApproverIdsSnapshot ?? []).map((partnerId) =>
          partnerId.toString(),
        ),
      ),
    ),
  );
  const approvalPartnerIds = Array.from(
    new Set(
      purchases.flatMap((purchase) =>
        toApprovals(purchase.approvals).map((approval) =>
          approval.partnerId.toString(),
        ),
      ),
    ),
  );
  const partnerIds = Array.from(
    new Set([...creatorIds, ...requiredApproverIds, ...approvalPartnerIds]),
  );

  const [products, partners] = await Promise.all([
    ProductModel.find({ _id: { $in: productIds } })
      .select({ name: 1 })
      .lean(),
    UserModel.find({ _id: { $in: partnerIds } })
      .select({ name: 1 })
      .lean(),
  ]);

  const variantById = new Map(
    variants.map((variant) => [variant._id.toString(), variant]),
  );
  const productNameById = new Map(
    products.map((product) => [product._id.toString(), product.name]),
  );
  const partnerNameById = new Map(
    partners.map((partner) => [partner._id.toString(), partner.name]),
  );

  const records = purchases.map((purchase) => {
    const variant = variantById.get(purchase.variantId.toString());
    const productName = variant
      ? (productNameById.get(variant.productId.toString()) ?? "Unknown product")
      : "Unknown product";
    const approvals = toApprovals(purchase.approvals);
    const pendingPartnerIds = (
      purchase.requiredApproverIdsSnapshot ?? []
    )
      .map((partnerId) => partnerId.toString())
      .filter(
        (partnerId) =>
          !approvals.some((approval) => approval.partnerId.toString() === partnerId),
      );

    return {
      id: purchase._id.toString(),
      purchaseDate: purchase.purchaseDate.toISOString(),
      sku: variant?.sku ?? "Unknown SKU",
      productName,
      size: variant?.size ?? "-",
      color: variant?.color ?? "-",
      qty: purchase.qty,
      costPerUnit: decimalToNumber(purchase.costPerUnit),
      additionalCost: decimalToNumber(purchase.additionalCost),
      totalCost: decimalToNumber(purchase.totalCost),
      cashOutTotal: decimalToNumber(purchase.cashOutTotal),
      note: purchase.note ?? null,
      status: purchase.status,
      createdById: purchase.createdBy.toString(),
      createdByName:
        partnerNameById.get(purchase.createdBy.toString()) ?? "Unknown partner",
      requiredApprovalCount: toRequiredApprovalCount(purchase),
      approvalCount: approvals.length,
      canReview:
        purchase.createdBy.toString() !== actorId &&
        purchase.status === "pending" &&
        Boolean(actorId) &&
        !approvals.some(
          (approval) => approval.partnerId.toString() === actorId,
        ),
      pendingPartnerIds,
      pendingPartnerNames: pendingPartnerIds.map(
        (partnerId) => partnerNameById.get(partnerId) ?? "Unknown partner",
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
  });

  const normalizedSearch = input?.search?.trim().toLocaleLowerCase();

  const filteredRecords = !normalizedSearch
    ? records
    : records.filter((record) => {
        return (
          record.sku.toLocaleLowerCase().includes(normalizedSearch) ||
          record.productName.toLocaleLowerCase().includes(normalizedSearch) ||
          record.size.toLocaleLowerCase().includes(normalizedSearch) ||
          record.color.toLocaleLowerCase().includes(normalizedSearch) ||
          (record.note ?? "").toLocaleLowerCase().includes(normalizedSearch)
        );
      });

  const total = filteredRecords.length;
  const totalPages = Math.max(1, Math.ceil(total / requestedPageSize));
  const page = Math.min(requestedPage, totalPages);
  const startIndex = (page - 1) * requestedPageSize;
  const items = filteredRecords.slice(
    startIndex,
    startIndex + requestedPageSize,
  );

  return {
    items,
    total,
    page,
    pageSize: requestedPageSize,
    totalPages,
  };
}
