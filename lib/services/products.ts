import { Types } from "mongoose";

import { connectToDatabase } from "@/lib/db";
import {
  buildApprovalReviewUpdate,
  type ApprovalDecision,
  type ApprovalReviewUpdate,
  uniqReviewIds,
} from "@/lib/services/approval-review";
import { recordHistoryEvent } from "@/lib/services/history";
import ProductModel from "@/models/Product";
import UserModel from "@/models/User";
import VariantModel from "@/models/Variant";

export type ProductApprovalQueueItem = {
  id: string;
  selectionKey: string;
  kind: "products";
  title: string;
  subtitle: string;
  ownerId: string;
  ownerName: string;
  amount: number;
  status: "pending" | "approved" | "rejected";
  submittedAt: string;
  effectiveDate: string;
  note: null;
  approvalCount: number;
  requiredApprovalCount: number;
  canReview: boolean;
  pendingPartnerIds: string[];
  pendingPartnerNames: string[];
};

function getConfiguredPartnerCount() {
  return (process.env.PARTNER_EMAILS ?? "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean).length;
}

function normalizeDeleteRequestStatus(input: {
  status?: string | null;
  requestedById?: string | null;
  isActive: boolean;
}) {
  if (!input.isActive) {
    return "approved" as const;
  }

  if (
    input.status === "none" ||
    input.status === "pending" ||
    input.status === "approved" ||
    input.status === "rejected"
  ) {
    return input.status;
  }

  if (input.requestedById) {
    return "pending" as const;
  }

  return "none" as const;
}

async function getFallbackReviewerIds(
  requestedById: string | null | undefined,
) {
  const activePartners = await UserModel.find({
    role: "partner",
    isActive: true,
  })
    .select({ _id: 1 })
    .lean();

  return activePartners
    .map((partner) => partner._id)
    .filter((partnerId) => partnerId.toString() !== requestedById);
}

export async function listProductApprovalQueueItems(input: {
  actorId: string;
  view: "mine" | "partners";
}) {
  await connectToDatabase();

  const [products, partners] = await Promise.all([
    ProductModel.find({
      isActive: true,
      deleteRequestStatus: "pending",
    })
      .sort({ deleteRequestedAt: -1, updatedAt: -1, name: 1 })
      .lean(),
    UserModel.find({ role: "partner", isActive: true })
      .select({ name: 1 })
      .lean(),
  ]);

  const partnerNameById = new Map(
    partners.map((partner) => [partner._id.toString(), partner.name]),
  );

  return products
    .map((product) => {
      const requestedById = product.deleteRequestedBy?.toString() ?? null;
      const requestedAt = product.deleteRequestedAt ?? product.updatedAt;
      const approvalIds = (product.deleteApprovals ?? []).map((approval) =>
        approval.partnerId.toString(),
      );
      const requiredApproverIds =
        (product.deleteRequiredApproverIdsSnapshot ?? []).length > 0
          ? (product.deleteRequiredApproverIdsSnapshot ?? []).map((approverId) =>
              approverId.toString(),
            )
          : partners
              .map((partner) => partner._id.toString())
              .filter((partnerId) => partnerId !== requestedById);
      const pendingPartnerIds = requiredApproverIds.filter(
        (partnerId) => !approvalIds.includes(partnerId),
      );
      const status = normalizeDeleteRequestStatus({
        status: product.deleteRequestStatus,
        requestedById,
        isActive: product.isActive,
      });
      const queueStatus: ProductApprovalQueueItem["status"] =
        status === "none" ? "pending" : status;

      return {
        id: product._id.toString(),
        selectionKey: `products:${product._id.toString()}`,
        kind: "products" as const,
        title: product.name,
        subtitle: `${product.category} · Product delete request`,
        ownerId: requestedById ?? "",
        ownerName: requestedById
          ? (partnerNameById.get(requestedById) ?? "Unknown partner")
          : "Unknown partner",
        amount: 0,
        status: queueStatus,
        submittedAt: requestedAt.toISOString(),
        effectiveDate: requestedAt.toISOString(),
        note: null,
        approvalCount: product.deleteApprovals?.length ?? 0,
        requiredApprovalCount:
          product.deleteRequiredApprovalCountSnapshot > 0
            ? product.deleteRequiredApprovalCountSnapshot
            : Math.max(getConfiguredPartnerCount() - 1, requiredApproverIds.length, 0),
        canReview:
          queueStatus === "pending" &&
          requestedById !== input.actorId &&
          pendingPartnerIds.includes(input.actorId),
        pendingPartnerIds,
        pendingPartnerNames: pendingPartnerIds.map(
          (partnerId) => partnerNameById.get(partnerId) ?? "Unknown partner",
        ),
      };
    })
    .filter((item) =>
      input.view === "mine" ? item.canReview : item.pendingPartnerIds.length > 0,
    );
}

export async function reviewProducts(input: {
  productIds: string[];
  partnerId: string;
  partnerName: string;
  decision: ApprovalDecision;
  comment?: string;
}) {
  await connectToDatabase();

  const productIds = uniqReviewIds(input.productIds);

  if (productIds.length === 0) {
    return [] as ApprovalReviewUpdate[];
  }

  const actorId = new Types.ObjectId(input.partnerId);
  const products = await ProductModel.find({
    _id: { $in: productIds },
    isActive: true,
  });

  const productsById = new Map(
    products.map((product) => [product._id.toString(), product]),
  );
  const now = new Date();
  const results: ApprovalReviewUpdate[] = [];

  for (const productId of productIds) {
    const product = productsById.get(productId);

    if (!product) {
      throw new Error("Product not found.");
    }

    const normalizedStatus = normalizeDeleteRequestStatus({
      status: product.deleteRequestStatus,
      requestedById: product.deleteRequestedBy?.toString(),
      isActive: product.isActive,
    });

    if (normalizedStatus !== "pending") {
      throw new Error("Delete request is not pending.");
    }

    if (product.deleteRequestedBy?.toString() === input.partnerId) {
      throw new Error("Requester cannot review own delete request.");
    }

    const fallbackReviewerIds = await getFallbackReviewerIds(
      product.deleteRequestedBy?.toString(),
    );

    if ((product.deleteRequiredApproverIdsSnapshot ?? []).length === 0) {
      product.deleteRequiredApproverIdsSnapshot = fallbackReviewerIds;
      product.deleteRequiredApprovalCountSnapshot = Math.max(
        getConfiguredPartnerCount() > 0
          ? getConfiguredPartnerCount() - 1
          : fallbackReviewerIds.length,
        0,
      );
    }

    const canReview = (product.deleteRequiredApproverIdsSnapshot ?? []).some(
      (approverId) => approverId.toString() === input.partnerId,
    );

    if (!canReview) {
      throw new Error("You are not in the required reviewers list.");
    }

    const alreadyReviewed = (product.deleteApprovals ?? []).some(
      (approval) => approval.partnerId.toString() === input.partnerId,
    );

    if (alreadyReviewed) {
      throw new Error("You already reviewed this delete request.");
    }

    product.deleteApprovals.push({
      partnerId: actorId,
      decision: input.decision,
      comment: input.comment ?? null,
      decidedAt: now,
    });

    if (input.decision === "rejected") {
      product.deleteRequestStatus = "rejected";
      product.deleteFinalizedAt = now;
      await product.save();
      await recordHistoryEvent({
        actorId: input.partnerId,
        actorName: input.partnerName,
        actorRole: "partner",
        module: "products",
        entityType: "product",
        entityId: product._id.toString(),
        entityLabel: `${product.name} (${product.category})`,
        action: "reject_delete",
        summary: `Product delete rejected: ${product.name} (${product.category})`,
        before: { deleteRequestStatus: "pending", isActive: true },
        after: { deleteRequestStatus: "rejected", isActive: true },
      });
      results.push(
        buildApprovalReviewUpdate({
          id: product._id.toString(),
          status: "rejected",
          partnerId: input.partnerId,
          partnerName: input.partnerName,
          decision: input.decision,
          comment: input.comment,
          decidedAt: now,
        }),
      );
      continue;
    }

    const requiredApprovalCount =
      product.deleteRequiredApprovalCountSnapshot > 0
        ? product.deleteRequiredApprovalCountSnapshot
        : Math.max(
            getConfiguredPartnerCount() > 0
              ? getConfiguredPartnerCount() - 1
              : fallbackReviewerIds.length,
            0,
          );

    if (product.deleteApprovals.length >= requiredApprovalCount) {
      const stockCount = await VariantModel.countDocuments({
        productId: product._id,
        isActive: true,
        stockQty: { $gt: 0 },
      });

      if (stockCount > 0) {
        throw new Error(
          "Product stock changed and is now above 0. Delete request cannot be finalized.",
        );
      }

      product.isActive = false;
      product.deleteRequestStatus = "approved";
      product.deleteFinalizedAt = now;
      await product.save();

      await VariantModel.updateMany(
        { productId: product._id, stockQty: 0 },
        { $set: { isActive: false } },
      );

      await recordHistoryEvent({
        actorId: input.partnerId,
        actorName: input.partnerName,
        actorRole: "partner",
        module: "products",
        entityType: "product",
        entityId: product._id.toString(),
        entityLabel: `${product.name} (${product.category})`,
        action: "approve_delete",
        summary: `Product delete approved: ${product.name} (${product.category})`,
        before: { deleteRequestStatus: "pending", isActive: true },
        after: { deleteRequestStatus: "approved", isActive: false },
      });

      results.push(
        buildApprovalReviewUpdate({
          id: product._id.toString(),
          status: "approved",
          partnerId: input.partnerId,
          partnerName: input.partnerName,
          decision: input.decision,
          comment: input.comment,
          decidedAt: now,
        }),
      );
      continue;
    }

    await product.save();
    await recordHistoryEvent({
      actorId: input.partnerId,
      actorName: input.partnerName,
      actorRole: "partner",
      module: "products",
      entityType: "product",
      entityId: product._id.toString(),
      entityLabel: `${product.name} (${product.category})`,
      action: input.decision === "approved" ? "approve_delete" : "reject_delete",
      summary: `Product delete ${input.decision}: ${product.name} (${product.category})`,
      before: { deleteRequestStatus: "pending", isActive: true },
      after: { deleteRequestStatus: product.deleteRequestStatus, isActive: true },
      meta: {
        reviewStatus: "pending",
      },
    });
    results.push(
      buildApprovalReviewUpdate({
        id: product._id.toString(),
        status: "pending",
        partnerId: input.partnerId,
        partnerName: input.partnerName,
        decision: input.decision,
        comment: input.comment,
        decidedAt: now,
      }),
    );
  }

  return results;
}
