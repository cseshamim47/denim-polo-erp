import { HydratedDocument, Types } from "mongoose";

import { connectToDatabase } from "@/lib/db";
import {
  buildPurchaseApprovalSnapshot,
  evaluatePurchaseDecision,
} from "@/lib/domain/purchase-approval";
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
  approvals: Array<{
    partnerId: string;
    partnerName: string;
    decision: "approved" | "rejected";
    comment: string | null;
    decidedAt: string;
  }>;
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

  return PurchaseModel.create({
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

export async function listPurchases(input?: {
  actorId?: string;
  search?: string;
  from?: Date;
  to?: Date;
  limit?: number;
}): Promise<PurchaseHistoryRecord[]> {
  await connectToDatabase();

  const query: Record<string, unknown> = {};

  if (input?.from || input?.to) {
    query.purchaseDate = {
      ...(input.from ? { $gte: input.from } : {}),
      ...(input.to ? { $lte: input.to } : {}),
    };
  }

  const purchases = await PurchaseModel.find(query)
    .sort({ purchaseDate: -1, createdAt: -1 })
    .limit(input?.limit ?? 200)
    .lean();

  if (purchases.length === 0) {
    return [];
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
  const approvalPartnerIds = Array.from(
    new Set(
      purchases.flatMap((purchase) =>
        toApprovals(purchase.approvals).map((approval) =>
          approval.partnerId.toString(),
        ),
      ),
    ),
  );
  const partnerIds = Array.from(new Set([...creatorIds, ...approvalPartnerIds]));

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
        purchase.createdBy.toString() !== input?.actorId &&
        purchase.status === "pending" &&
        Boolean(input?.actorId) &&
        !approvals.some(
          (approval) => approval.partnerId.toString() === input?.actorId,
        ),
      approvals: approvals.map((approval) => ({
        partnerId: approval.partnerId.toString(),
        partnerName:
          partnerNameById.get(approval.partnerId.toString()) ?? "Unknown partner",
        decision: approval.decision,
        comment: approval.comment ?? null,
        decidedAt: approval.decidedAt.toISOString(),
      })),
    };
  });

  const normalizedSearch = input?.search?.trim().toLocaleLowerCase();

  if (!normalizedSearch) {
    return records;
  }

  return records.filter((record) => {
    return (
      record.sku.toLocaleLowerCase().includes(normalizedSearch) ||
      record.productName.toLocaleLowerCase().includes(normalizedSearch) ||
      record.size.toLocaleLowerCase().includes(normalizedSearch) ||
      record.color.toLocaleLowerCase().includes(normalizedSearch) ||
      (record.note ?? "").toLocaleLowerCase().includes(normalizedSearch)
    );
  });
}
