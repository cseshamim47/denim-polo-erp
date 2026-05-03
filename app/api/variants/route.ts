import { Types } from "mongoose";
import { NextResponse } from "next/server";
import { z } from "zod";

import { generateVariantSku } from "@/lib/domain/sku";
import { getRequiredSession } from "@/lib/auth";
import { connectToDatabase } from "@/lib/db";
import { decimalToNumber, toDecimal128 } from "@/lib/money";
import ProductModel from "@/models/Product";
import UserModel from "@/models/User";
import VariantModel from "@/models/Variant";

const createVariantSchema = z.object({
  productId: z.string().trim().min(1),
  color: z.string().trim().optional().default(""),
  size: z.string().trim().min(1).optional(),
  sizes: z.array(z.string().trim().min(1)).min(1).optional(),
  barcode: z.string().trim().optional(),
  sellingPrice: z.number().nonnegative(),
});

const deleteVariantSchema = z.object({
  variantId: z.string().trim().min(1),
});

const reviewDeleteVariantSchema = z.object({
  variantId: z.string().trim().min(1),
  decision: z.enum(["approved", "rejected"]),
  comment: z.string().trim().optional(),
});

const requestUpdateVariantSchema = z.object({
  variantId: z.string().trim().min(1),
  sellingPrice: z.number().nonnegative().optional(),
  comment: z.string().trim().optional(),
});

const reviewUpdateVariantSchema = z.object({
  requestType: z.literal("update"),
  variantId: z.string().trim().min(1),
  decision: z.enum(["approved", "rejected"]),
  comment: z.string().trim().optional(),
});

function getConfiguredPartnerCount() {
  return (process.env.PARTNER_EMAILS ?? "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean).length;
}

function normalizeDeleteRequestStatus(input: {
  status?: string | null;
  requestedById?: string | null;
  requestedAt?: Date | null;
  approvalCount?: number;
  requiredApprovalCountSnapshot?: number;
  isActive: boolean;
}) {
  if (!input.isActive) {
    return "approved" as const;
  }

  if (
    input.status === "none" &&
    (input.requestedById ||
      input.requestedAt ||
      (input.approvalCount ?? 0) > 0 ||
      (input.requiredApprovalCountSnapshot ?? 0) > 0)
  ) {
    return "pending" as const;
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

function normalizeUpdateRequestStatus(input: {
  status?: string | null;
  requestedById?: string | null;
  requestedAt?: Date | null;
  approvalCount?: number;
  requiredApprovalCountSnapshot?: number;
  hasProposedSellingPrice?: boolean;
  finalizedAt?: Date | null;
  isActive: boolean;
}) {
  if (!input.isActive) {
    return "approved" as const;
  }

  if (
    input.status === "none" &&
    (input.requestedById ||
      input.requestedAt ||
      (input.approvalCount ?? 0) > 0 ||
      (input.requiredApprovalCountSnapshot ?? 0) > 0 ||
      (input.hasProposedSellingPrice && !input.finalizedAt))
  ) {
    return "pending" as const;
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

function getFallbackRequiredApprovalCount(options: {
  requestedById: string | null | undefined;
  configuredPartnerCount: number;
  activePartnerCount: number;
}) {
  if (!options.requestedById) {
    return 0;
  }

  return Math.max(
    options.configuredPartnerCount > 0
      ? options.configuredPartnerCount - 1
      : options.activePartnerCount - 1,
    0,
  );
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

export async function GET(request: Request) {
  const session = await getRequiredSession(["partner", "salesman"]);

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await connectToDatabase();

  const { searchParams } = new URL(request.url);
  const productId = searchParams.get("productId")?.trim();
  const search = searchParams.get("search")?.trim().toUpperCase();
  const stock = searchParams.get("stock");
  const deleteStatus = searchParams.get("deleteStatus");
  const pageParam = searchParams.get("page");
  const pageSizeParam = searchParams.get("pageSize");
  const shouldPaginate = Boolean(pageParam || pageSizeParam);
  const page = Math.max(1, Number(pageParam ?? "1") || 1);
  const pageSize = Math.max(
    1,
    Math.min(100, Number(pageSizeParam ?? "8") || 8),
  );
  const query: Record<string, unknown> = { isActive: true };

  if (productId) {
    query.productId = productId;
  }

  if (search) {
    query.$or = [
      { sku: { $regex: search, $options: "i" } },
      { color: { $regex: search, $options: "i" } },
      { size: { $regex: search, $options: "i" } },
    ];
  }

  if (stock === "in-stock") {
    query.stockQty = { $gt: 0 };
  }

  if (stock === "zero-stock") {
    query.stockQty = { $lte: 0 };
  }

  const [variants, partners] = await Promise.all([
    VariantModel.find(query).sort({ sku: 1 }).lean(),
    UserModel.find({ role: "partner" }).select({ name: 1, isActive: 1 }).lean(),
  ]);

  const partnerNameById = new Map(
    partners.map((partner) => [partner._id.toString(), partner.name]),
  );
  const configuredPartnerCount = getConfiguredPartnerCount();
  const activePartners = partners.filter((partner) => partner.isActive);

  const normalizedDeleteStatusFilter =
    deleteStatus === "pending" ||
    deleteStatus === "approved" ||
    deleteStatus === "rejected" ||
    deleteStatus === "none"
      ? deleteStatus
      : "all";

  const mappedVariants = variants
    .map((variant) => {
      const normalizedStatus = normalizeDeleteRequestStatus({
        status: variant.deleteRequestStatus,
        requestedById: variant.deleteRequestedBy?.toString(),
        requestedAt: variant.deleteRequestedAt,
        approvalCount: variant.deleteApprovals?.length ?? 0,
        requiredApprovalCountSnapshot:
          variant.deleteRequiredApprovalCountSnapshot ?? 0,
        isActive: variant.isActive,
      });
      const normalizedUpdateStatus = normalizeUpdateRequestStatus({
        status: variant.updateRequestStatus,
        requestedById: variant.updateRequestedBy?.toString(),
        requestedAt: variant.updateRequestedAt,
        approvalCount: variant.updateApprovals?.length ?? 0,
        requiredApprovalCountSnapshot:
          variant.updateRequiredApprovalCountSnapshot ?? 0,
        hasProposedSellingPrice: variant.updateProposedSellingPrice != null,
        finalizedAt: variant.updateFinalizedAt,
        isActive: variant.isActive,
      });

      return {
        id: variant._id.toString(),
        productId: variant.productId.toString(),
        color: variant.color,
        size: variant.size,
        sku: variant.sku,
        stockQty: variant.stockQty,
        avgCost: decimalToNumber(variant.avgCost),
        sellingPrice: decimalToNumber(variant.sellingPrice),
        lowStockThreshold: variant.lowStockThreshold,
        isActive: variant.isActive,
        deleteRequest: {
          status: normalizedStatus,
          requestedById: variant.deleteRequestedBy?.toString() ?? null,
          requestedByName: variant.deleteRequestedBy
            ? (partnerNameById.get(variant.deleteRequestedBy.toString()) ??
              "Unknown partner")
            : null,
          requestedAt: variant.deleteRequestedAt?.toISOString() ?? null,
          requiredApprovalCount: getFallbackRequiredApprovalCount({
            requestedById: variant.deleteRequestedBy?.toString(),
            configuredPartnerCount,
            activePartnerCount: activePartners.length,
          }),
          approvalCount: variant.deleteApprovals?.length ?? 0,
          canReview:
            normalizedStatus === "pending" &&
            variant.deleteRequestedBy?.toString() !== session.user.id &&
            ((variant.deleteRequiredApproverIdsSnapshot ?? []).length > 0
              ? (variant.deleteRequiredApproverIdsSnapshot ?? []).some(
                  (approverId) => approverId.toString() === session.user.id,
                )
              : activePartners.some(
                  (partner) => partner._id.toString() === session.user.id,
                )) &&
            !(variant.deleteApprovals ?? []).some(
              (approval) => approval.partnerId.toString() === session.user.id,
            ),
          approvals: (variant.deleteApprovals ?? []).map((approval) => ({
            partnerId: approval.partnerId.toString(),
            partnerName:
              partnerNameById.get(approval.partnerId.toString()) ??
              "Unknown partner",
            decision: approval.decision,
            comment: approval.comment ?? null,
            decidedAt: approval.decidedAt.toISOString(),
          })),
        },
        updateRequest: {
          status: normalizedUpdateStatus,
          requestedById: variant.updateRequestedBy?.toString() ?? null,
          requestedByName: variant.updateRequestedBy
            ? (partnerNameById.get(variant.updateRequestedBy.toString()) ??
              "Unknown partner")
            : null,
          requestedAt: variant.updateRequestedAt?.toISOString() ?? null,
          requiredApprovalCount: getFallbackRequiredApprovalCount({
            requestedById: variant.updateRequestedBy?.toString(),
            configuredPartnerCount,
            activePartnerCount: activePartners.length,
          }),
          approvalCount: variant.updateApprovals?.length ?? 0,
          canReview:
            normalizedUpdateStatus === "pending" &&
            variant.updateRequestedBy?.toString() !== session.user.id &&
            ((variant.updateRequiredApproverIdsSnapshot ?? []).length > 0
              ? (variant.updateRequiredApproverIdsSnapshot ?? []).some(
                  (approverId) => approverId.toString() === session.user.id,
                )
              : activePartners.some(
                  (partner) => partner._id.toString() === session.user.id,
                )) &&
            !(variant.updateApprovals ?? []).some(
              (approval) => approval.partnerId.toString() === session.user.id,
            ),
          proposal: {
            color: variant.updateProposedColor ?? null,
            size: variant.updateProposedSize ?? null,
            sellingPrice:
              variant.updateProposedSellingPrice == null
                ? null
                : decimalToNumber(variant.updateProposedSellingPrice),
          },
          approvals: (variant.updateApprovals ?? []).map((approval) => ({
            partnerId: approval.partnerId.toString(),
            partnerName:
              partnerNameById.get(approval.partnerId.toString()) ??
              "Unknown partner",
            decision: approval.decision,
            comment: approval.comment ?? null,
            decidedAt: approval.decidedAt.toISOString(),
          })),
        },
      };
    })
    .filter((variant) => {
      if (
        normalizedDeleteStatusFilter !== "all" &&
        variant.deleteRequest.status !== normalizedDeleteStatusFilter
      ) {
        return false;
      }

      return true;
    });

  if (!shouldPaginate) {
    return NextResponse.json({ variants: mappedVariants });
  }

  const total = mappedVariants.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const normalizedPage = Math.min(page, totalPages);
  const startIndex = (normalizedPage - 1) * pageSize;

  return NextResponse.json({
    variants: mappedVariants.slice(startIndex, startIndex + pageSize),
    pagination: {
      total,
      page: normalizedPage,
      pageSize,
      totalPages,
    },
  });
}

export async function POST(request: Request) {
  const session = await getRequiredSession(["partner"]);

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = createVariantSchema.safeParse(await request.json());

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const inputSizes =
    parsed.data.sizes ?? (parsed.data.size ? [parsed.data.size] : []);

  const normalizedSizes = Array.from(
    new Set(
      inputSizes.map((size) => size.trim().toUpperCase()).filter(Boolean),
    ),
  );

  if (normalizedSizes.length === 0) {
    return NextResponse.json(
      { error: "At least one size is required" },
      { status: 400 },
    );
  }

  await connectToDatabase();

  const product = await ProductModel.findById(parsed.data.productId);

  if (!product) {
    return NextResponse.json({ error: "Product not found" }, { status: 404 });
  }

  const normalizedColor = parsed.data.color.trim().toUpperCase();

  const existing = await VariantModel.find({
    productId: product._id,
    color: normalizedColor,
    size: { $in: normalizedSizes },
  })
    .select({ size: 1 })
    .lean();

  if (existing.length > 0) {
    return NextResponse.json(
      {
        error: `Variant already exists for size(s): ${existing
          .map((item) => item.size)
          .join(", ")}`,
      },
      { status: 409 },
    );
  }

  const variantsToCreate = normalizedSizes.map((size) => ({
    productId: product._id,
    color: normalizedColor,
    size,
    sku: generateVariantSku({
      category: product.category,
      productName: product.name,
      color: normalizedColor,
      size,
    }),
    barcode: parsed.data.barcode ?? null,
    stockQty: 0,
    avgCost: toDecimal128(0),
    sellingPrice: toDecimal128(parsed.data.sellingPrice),
    lowStockThreshold: 0,
    isActive: true,
  }));

  const createdVariants = await VariantModel.insertMany(variantsToCreate);

  return NextResponse.json(
    {
      createdCount: createdVariants.length,
      variants: createdVariants.map((variant) => ({
        id: variant._id.toString(),
        sku: variant.sku,
      })),
    },
    { status: 201 },
  );
}

export async function DELETE(request: Request) {
  const session = await getRequiredSession(["partner"]);

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = deleteVariantSchema.safeParse(await request.json());

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten() },
      { status: 400 },
    );
  }

  await connectToDatabase();

  const actorId = new Types.ObjectId(session.user.id);
  const variant = await VariantModel.findById(parsed.data.variantId);

  if (!variant || !variant.isActive) {
    return NextResponse.json({ error: "Variant not found" }, { status: 404 });
  }

  if (variant.stockQty > 0) {
    return NextResponse.json(
      { error: "Cannot delete variant while stock is greater than zero." },
      { status: 400 },
    );
  }

  const normalizedStatus = normalizeDeleteRequestStatus({
    status: variant.deleteRequestStatus,
    requestedById: variant.deleteRequestedBy?.toString(),
    requestedAt: variant.deleteRequestedAt,
    approvalCount: variant.deleteApprovals?.length ?? 0,
    requiredApprovalCountSnapshot:
      variant.deleteRequiredApprovalCountSnapshot ?? 0,
    isActive: variant.isActive,
  });

  if (normalizedStatus === "pending") {
    return NextResponse.json(
      { error: "Delete request already pending review." },
      { status: 409 },
    );
  }

  const reviewers = await UserModel.find({
    role: "partner",
    isActive: true,
    _id: { $ne: actorId },
  })
    .select({ _id: 1 })
    .lean();

  const requiredApproverIds = reviewers.map((reviewer) => reviewer._id);

  if (requiredApproverIds.length === 0) {
    variant.isActive = false;
    variant.deleteRequestStatus = "approved";
    variant.deleteRequestedBy = actorId;
    variant.deleteRequestedAt = new Date();
    variant.deleteApprovals = [];
    variant.deleteRequiredApproverIdsSnapshot = [];
    variant.deleteRequiredApprovalCountSnapshot = 0;
    variant.deleteFinalizedAt = new Date();
    await variant.save();

    return NextResponse.json({ status: "deleted" });
  }

  variant.deleteRequestStatus = "pending";
  variant.deleteRequestedBy = actorId;
  variant.deleteRequestedAt = new Date();
  variant.deleteApprovals = [];
  variant.deleteRequiredApproverIdsSnapshot = requiredApproverIds;
  variant.deleteRequiredApprovalCountSnapshot = requiredApproverIds.length;
  variant.deleteFinalizedAt = null;
  await variant.save();

  return NextResponse.json({
    status: "pending_review",
    requiredApprovalCount: requiredApproverIds.length,
  });
}

export async function PUT(request: Request) {
  const session = await getRequiredSession(["partner"]);

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = requestUpdateVariantSchema.safeParse(await request.json());

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten() },
      { status: 400 },
    );
  }

  await connectToDatabase();

  const actorId = new Types.ObjectId(session.user.id);
  const variant = await VariantModel.findById(parsed.data.variantId);

  if (!variant || !variant.isActive) {
    return NextResponse.json({ error: "Variant not found" }, { status: 404 });
  }

  const normalizedDeleteStatus = normalizeDeleteRequestStatus({
    status: variant.deleteRequestStatus,
    requestedById: variant.deleteRequestedBy?.toString(),
    requestedAt: variant.deleteRequestedAt,
    approvalCount: variant.deleteApprovals?.length ?? 0,
    requiredApprovalCountSnapshot:
      variant.deleteRequiredApprovalCountSnapshot ?? 0,
    isActive: variant.isActive,
  });

  if (normalizedDeleteStatus === "pending") {
    return NextResponse.json(
      { error: "Cannot request update while delete request is pending." },
      { status: 409 },
    );
  }

  const normalizedUpdateStatus = normalizeUpdateRequestStatus({
    status: variant.updateRequestStatus,
    requestedById: variant.updateRequestedBy?.toString(),
    requestedAt: variant.updateRequestedAt,
    approvalCount: variant.updateApprovals?.length ?? 0,
    requiredApprovalCountSnapshot:
      variant.updateRequiredApprovalCountSnapshot ?? 0,
    hasProposedSellingPrice: variant.updateProposedSellingPrice != null,
    finalizedAt: variant.updateFinalizedAt,
    isActive: variant.isActive,
  });

  if (normalizedUpdateStatus === "pending") {
    return NextResponse.json(
      { error: "Update request already pending review." },
      { status: 409 },
    );
  }

  const proposedSellingPrice =
    parsed.data.sellingPrice ?? decimalToNumber(variant.sellingPrice);

  const hasChanges =
    proposedSellingPrice !== decimalToNumber(variant.sellingPrice);

  if (!hasChanges) {
    return NextResponse.json(
      { error: "No changes detected for update request." },
      { status: 400 },
    );
  }

  const reviewers = await UserModel.find({
    role: "partner",
    isActive: true,
    _id: { $ne: actorId },
  })
    .select({ _id: 1 })
    .lean();

  const requiredApproverIds = reviewers.map((reviewer) => reviewer._id);
  const configuredPartnerCount = getConfiguredPartnerCount();
  const requiredApprovalCountSnapshot = Math.max(
    configuredPartnerCount > 0
      ? configuredPartnerCount - 1
      : requiredApproverIds.length,
    0,
  );

  if (requiredApproverIds.length === 0 && requiredApprovalCountSnapshot === 0) {
    variant.sellingPrice = toDecimal128(proposedSellingPrice) as never;
    variant.updateRequestStatus = "approved";
    variant.updateRequestedBy = actorId;
    variant.updateRequestedAt = new Date();
    variant.updateProposedColor = variant.color;
    variant.updateProposedSize = variant.size;
    variant.updateProposedSellingPrice = toDecimal128(
      proposedSellingPrice,
    ) as never;
    variant.updateApprovals = [];
    variant.updateRequiredApproverIdsSnapshot = [];
    variant.updateRequiredApprovalCountSnapshot = 0;
    variant.updateFinalizedAt = new Date();
    await variant.save();

    return NextResponse.json({ status: "updated" });
  }

  variant.updateRequestStatus = "pending";
  variant.updateRequestedBy = actorId;
  variant.updateRequestedAt = new Date();
  variant.updateProposedColor = variant.color;
  variant.updateProposedSize = variant.size;
  variant.updateProposedSellingPrice = toDecimal128(
    proposedSellingPrice,
  ) as never;
  variant.updateApprovals = [];
  variant.updateRequiredApproverIdsSnapshot = requiredApproverIds;
  variant.updateRequiredApprovalCountSnapshot = requiredApprovalCountSnapshot;
  variant.updateFinalizedAt = null;
  await variant.save();

  return NextResponse.json({
    status: "pending_review",
    requiredApprovalCount: requiredApprovalCountSnapshot,
  });
}

export async function PATCH(request: Request) {
  const session = await getRequiredSession(["partner"]);

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const requestBody = await request.json();

  if (requestBody?.requestType === "update") {
    const parsedUpdate = reviewUpdateVariantSchema.safeParse(requestBody);

    if (!parsedUpdate.success) {
      return NextResponse.json(
        { error: parsedUpdate.error.flatten() },
        { status: 400 },
      );
    }

    await connectToDatabase();

    const actorId = new Types.ObjectId(session.user.id);
    const variant = await VariantModel.findById(parsedUpdate.data.variantId);

    if (!variant || !variant.isActive) {
      return NextResponse.json({ error: "Variant not found" }, { status: 404 });
    }

    const normalizedUpdateStatus = normalizeUpdateRequestStatus({
      status: variant.updateRequestStatus,
      requestedById: variant.updateRequestedBy?.toString(),
      requestedAt: variant.updateRequestedAt,
      approvalCount: variant.updateApprovals?.length ?? 0,
      requiredApprovalCountSnapshot:
        variant.updateRequiredApprovalCountSnapshot ?? 0,
      hasProposedSellingPrice: variant.updateProposedSellingPrice != null,
      finalizedAt: variant.updateFinalizedAt,
      isActive: variant.isActive,
    });

    if (normalizedUpdateStatus !== "pending") {
      return NextResponse.json(
        { error: "Update request is not pending." },
        { status: 400 },
      );
    }

    if (variant.updateRequestedBy?.toString() === session.user.id) {
      return NextResponse.json(
        { error: "Requester cannot review own update request." },
        { status: 400 },
      );
    }

    const fallbackReviewerIds = await getFallbackReviewerIds(
      variant.updateRequestedBy?.toString(),
    );

    if ((variant.updateRequiredApproverIdsSnapshot ?? []).length === 0) {
      variant.updateRequiredApproverIdsSnapshot = fallbackReviewerIds;
      variant.updateRequiredApprovalCountSnapshot = Math.max(
        getConfiguredPartnerCount() > 0
          ? getConfiguredPartnerCount() - 1
          : fallbackReviewerIds.length,
        0,
      );
    }

    const canReview = (variant.updateRequiredApproverIdsSnapshot ?? []).some(
      (approverId) => approverId.toString() === session.user.id,
    );

    if (!canReview) {
      return NextResponse.json(
        { error: "You are not in the required reviewers list." },
        { status: 403 },
      );
    }

    const alreadyReviewed = (variant.updateApprovals ?? []).some(
      (approval) => approval.partnerId.toString() === session.user.id,
    );

    if (alreadyReviewed) {
      return NextResponse.json(
        { error: "You already reviewed this update request." },
        { status: 409 },
      );
    }

    variant.updateApprovals.push({
      partnerId: actorId,
      decision: parsedUpdate.data.decision,
      comment: parsedUpdate.data.comment ?? null,
      decidedAt: new Date(),
    });

    if (parsedUpdate.data.decision === "rejected") {
      variant.updateRequestStatus = "rejected";
      variant.updateFinalizedAt = new Date();
      await variant.save();

      return NextResponse.json({ status: "rejected" });
    }

    const requiredApprovalCount =
      variant.updateRequiredApprovalCountSnapshot > 0
        ? variant.updateRequiredApprovalCountSnapshot
        : Math.max(
            getConfiguredPartnerCount() > 0
              ? getConfiguredPartnerCount() - 1
              : fallbackReviewerIds.length,
            0,
          );

    if (variant.updateApprovals.length >= requiredApprovalCount) {
      if (variant.updateProposedSellingPrice != null) {
        variant.sellingPrice = variant.updateProposedSellingPrice as never;
      }
      variant.updateRequestStatus = "approved";
      variant.updateFinalizedAt = new Date();
      await variant.save();

      return NextResponse.json({ status: "approved" });
    }

    await variant.save();
    return NextResponse.json({ status: "pending" });
  }

  const parsed = reviewDeleteVariantSchema.safeParse(requestBody);

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten() },
      { status: 400 },
    );
  }

  await connectToDatabase();

  const actorId = new Types.ObjectId(session.user.id);
  const variant = await VariantModel.findById(parsed.data.variantId);

  if (!variant || !variant.isActive) {
    return NextResponse.json({ error: "Variant not found" }, { status: 404 });
  }

  const normalizedStatus = normalizeDeleteRequestStatus({
    status: variant.deleteRequestStatus,
    requestedById: variant.deleteRequestedBy?.toString(),
    requestedAt: variant.deleteRequestedAt,
    approvalCount: variant.deleteApprovals?.length ?? 0,
    requiredApprovalCountSnapshot:
      variant.deleteRequiredApprovalCountSnapshot ?? 0,
    isActive: variant.isActive,
  });

  if (normalizedStatus !== "pending") {
    return NextResponse.json(
      { error: "Delete request is not pending." },
      { status: 400 },
    );
  }

  if (variant.deleteRequestedBy?.toString() === session.user.id) {
    return NextResponse.json(
      { error: "Requester cannot review own delete request." },
      { status: 400 },
    );
  }

  const fallbackReviewerIds = await getFallbackReviewerIds(
    variant.deleteRequestedBy?.toString(),
  );

  if ((variant.deleteRequiredApproverIdsSnapshot ?? []).length === 0) {
    variant.deleteRequiredApproverIdsSnapshot = fallbackReviewerIds;
    variant.deleteRequiredApprovalCountSnapshot = Math.max(
      getConfiguredPartnerCount() > 0
        ? getConfiguredPartnerCount() - 1
        : fallbackReviewerIds.length,
      0,
    );
  }

  const canReview = (variant.deleteRequiredApproverIdsSnapshot ?? []).some(
    (approverId) => approverId.toString() === session.user.id,
  );

  if (!canReview) {
    return NextResponse.json(
      { error: "You are not in the required reviewers list." },
      { status: 403 },
    );
  }

  const alreadyReviewed = (variant.deleteApprovals ?? []).some(
    (approval) => approval.partnerId.toString() === session.user.id,
  );

  if (alreadyReviewed) {
    return NextResponse.json(
      { error: "You already reviewed this delete request." },
      { status: 409 },
    );
  }

  variant.deleteApprovals.push({
    partnerId: actorId,
    decision: parsed.data.decision,
    comment: parsed.data.comment ?? null,
    decidedAt: new Date(),
  });

  if (parsed.data.decision === "rejected") {
    variant.deleteRequestStatus = "rejected";
    variant.deleteFinalizedAt = new Date();
    await variant.save();

    return NextResponse.json({ status: "rejected" });
  }

  const requiredApprovalCount =
    variant.deleteRequiredApprovalCountSnapshot > 0
      ? variant.deleteRequiredApprovalCountSnapshot
      : Math.max(
          getConfiguredPartnerCount() > 0
            ? getConfiguredPartnerCount() - 1
            : fallbackReviewerIds.length,
          0,
        );

  if (variant.deleteApprovals.length >= requiredApprovalCount) {
    if (variant.stockQty > 0) {
      return NextResponse.json(
        {
          error:
            "Variant stock changed and is now above 0. Delete request cannot be finalized.",
        },
        { status: 400 },
      );
    }

    variant.isActive = false;
    variant.deleteRequestStatus = "approved";
    variant.deleteFinalizedAt = new Date();
    await variant.save();

    return NextResponse.json({ status: "approved" });
  }

  await variant.save();
  return NextResponse.json({ status: "pending" });
}
