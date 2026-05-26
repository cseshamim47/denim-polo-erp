import { Types } from "mongoose";
import { NextResponse } from "next/server";
import { z } from "zod";

import { getRequiredSession } from "@/lib/auth";
import { connectToDatabase } from "@/lib/db";
import { ensureProductActiveUniqueIndex } from "@/lib/services/product-indexes";
import { recordHistoryEvent } from "@/lib/services/history";
import ProductModel from "@/models/Product";
import UserModel from "@/models/User";
import VariantModel from "@/models/Variant";

const createProductSchema = z.object({
  name: z.string().trim().min(1),
  category: z.string().trim().min(1),
  description: z.string().trim().optional(),
});

const deleteProductSchema = z.object({
  productId: z.string().trim().min(1),
});

const reviewDeleteSchema = z.object({
  productId: z.string().trim().min(1),
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
  const forOptions = searchParams.get("forOptions") === "1";
  const pageParam = searchParams.get("page");
  const pageSizeParam = searchParams.get("pageSize");
  const category = searchParams.get("category")?.trim().toUpperCase();
  const search = searchParams.get("search")?.trim();
  const stock = searchParams.get("stock");
  const deleteStatus = searchParams.get("deleteStatus");

  const query: Record<string, unknown> = category
    ? { isActive: true, category }
    : { isActive: true };

  if (search) {
    query.$or = [
      { name: { $regex: search, $options: "i" } },
      { category: { $regex: search, $options: "i" } },
      { description: { $regex: search, $options: "i" } },
    ];
  }

  const shouldPaginate = Boolean(pageParam || pageSizeParam);
  const page = Math.max(1, Number(pageParam ?? "1") || 1);
  const pageSize = Math.max(
    1,
    Math.min(100, Number(pageSizeParam ?? "8") || 8),
  );

  if (forOptions) {
    const products = await ProductModel.find({ isActive: true })
      .select({ name: 1, category: 1, description: 1 })
      .sort({ category: 1, name: 1 })
      .lean();

    return NextResponse.json({
      products: products.map((product) => ({
        id: product._id.toString(),
        name: product.name,
        category: product.category,
        description: product.description,
      })),
    });
  }

  const [products, partners, stockByProduct] = await Promise.all([
    ProductModel.find(query).sort({ category: 1, name: 1 }).lean(),
    UserModel.find({ role: "partner" }).select({ name: 1, isActive: 1 }).lean(),
    VariantModel.aggregate<{
      _id: Types.ObjectId;
      stockQty: number;
    }>([
      { $match: { isActive: true } },
      { $group: { _id: "$productId", stockQty: { $sum: "$stockQty" } } },
    ]),
  ]);

  const stockQtyByProductId = new Map(
    stockByProduct.map((entry) => [entry._id.toString(), entry.stockQty]),
  );

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

  const normalizedStockFilter =
    stock === "in-stock" || stock === "zero-stock" ? stock : "all";

  const mappedProducts = products
    .map((product) => {
      const normalizedStatus = normalizeDeleteRequestStatus({
        status: product.deleteRequestStatus,
        requestedById: product.deleteRequestedBy?.toString(),
        isActive: product.isActive,
      });

      const stockQty = stockQtyByProductId.get(product._id.toString()) ?? 0;

      return {
        id: product._id.toString(),
        name: product.name,
        category: product.category,
        description: product.description,
        isActive: product.isActive,
        stockQty,
        deleteRequest: {
          status: normalizedStatus,
          requestedById: product.deleteRequestedBy?.toString() ?? null,
          requestedByName: product.deleteRequestedBy
            ? (partnerNameById.get(product.deleteRequestedBy.toString()) ??
              "Unknown partner")
            : null,
          requestedAt: product.deleteRequestedAt?.toISOString() ?? null,
          requiredApprovalCount: getFallbackRequiredApprovalCount({
            requestedById: product.deleteRequestedBy?.toString(),
            configuredPartnerCount,
            activePartnerCount: activePartners.length,
          }),
          approvalCount: product.deleteApprovals?.length ?? 0,
          canReview:
            normalizedStatus === "pending" &&
            product.deleteRequestedBy?.toString() !== session.user.id &&
            ((product.deleteRequiredApproverIdsSnapshot ?? []).length > 0
              ? (product.deleteRequiredApproverIdsSnapshot ?? []).some(
                  (approverId) => approverId.toString() === session.user.id,
                )
              : activePartners.some(
                  (partner) => partner._id.toString() === session.user.id,
                )) &&
            !(product.deleteApprovals ?? []).some(
              (approval) => approval.partnerId.toString() === session.user.id,
            ),
          approvals: (product.deleteApprovals ?? []).map((approval) => ({
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
    .filter((product) => {
      if (
        normalizedDeleteStatusFilter !== "all" &&
        product.deleteRequest.status !== normalizedDeleteStatusFilter
      ) {
        return false;
      }

      if (normalizedStockFilter === "in-stock" && product.stockQty <= 0) {
        return false;
      }

      if (normalizedStockFilter === "zero-stock" && product.stockQty > 0) {
        return false;
      }

      return true;
    });

  if (!shouldPaginate) {
    return NextResponse.json({ products: mappedProducts });
  }

  const total = mappedProducts.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const normalizedPage = Math.min(page, totalPages);
  const startIndex = (normalizedPage - 1) * pageSize;

  return NextResponse.json({
    products: mappedProducts.slice(startIndex, startIndex + pageSize),
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

  const parsed = createProductSchema.safeParse(await request.json());

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten() },
      { status: 400 },
    );
  }

  await connectToDatabase();
  await ensureProductActiveUniqueIndex();

  try {
    const product = await ProductModel.create({
      name: parsed.data.name,
      category: parsed.data.category.trim().toUpperCase(),
      description: parsed.data.description ?? null,
      isActive: true,
    });

    await recordHistoryEvent({
      actorId: session.user.id,
      actorName: session.user.name ?? session.user.email ?? "Unknown partner",
      actorRole: "partner",
      module: "products",
      entityType: "product",
      entityId: product._id.toString(),
      entityLabel: `${product.name} (${product.category})`,
      action: "create",
      summary: `Product created: ${product.name} (${product.category})`,
      before: null,
      after: {
        name: product.name,
        category: product.category,
        description: product.description ?? null,
        isActive: true,
      },
    });

    return NextResponse.json(
      {
        product: {
          id: product._id.toString(),
          name: product.name,
          category: product.category,
        },
      },
      { status: 201 },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    if (/duplicate key/i.test(message)) {
      return NextResponse.json(
        {
          error:
            "An active product with the same name and category already exists.",
        },
        { status: 409 },
      );
    }

    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Unable to create product",
      },
      { status: 400 },
    );
  }
}

export async function DELETE(request: Request) {
  const session = await getRequiredSession(["partner"]);

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = deleteProductSchema.safeParse(await request.json());

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten() },
      { status: 400 },
    );
  }

  await connectToDatabase();

  const actorId = new Types.ObjectId(session.user.id);

  const stockCount = await VariantModel.countDocuments({
    productId: parsed.data.productId,
    isActive: true,
    stockQty: { $gt: 0 },
  });

  if (stockCount > 0) {
    return NextResponse.json(
      { error: "Cannot delete product while stock is greater than zero." },
      { status: 400 },
    );
  }

  const product = await ProductModel.findById(parsed.data.productId);

  if (!product || !product.isActive) {
    return NextResponse.json({ error: "Product not found" }, { status: 404 });
  }

  const normalizedStatus = normalizeDeleteRequestStatus({
    status: product.deleteRequestStatus,
    requestedById: product.deleteRequestedBy?.toString(),
    isActive: product.isActive,
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
    product.isActive = false;
    product.deleteRequestStatus = "approved";
    product.deleteRequestedBy = actorId;
    product.deleteRequestedAt = new Date();
    product.deleteApprovals = [];
    product.deleteRequiredApproverIdsSnapshot = [];
    product.deleteRequiredApprovalCountSnapshot = 0;
    product.deleteFinalizedAt = new Date();
    await product.save();

    await VariantModel.updateMany(
      { productId: product._id, stockQty: 0 },
      { $set: { isActive: false } },
    );

    return NextResponse.json({ status: "deleted" });
  }

  product.deleteRequestStatus = "pending";
  product.deleteRequestedBy = actorId;
  product.deleteRequestedAt = new Date();
  product.deleteApprovals = [];
  product.deleteRequiredApproverIdsSnapshot = requiredApproverIds;
  product.deleteRequiredApprovalCountSnapshot = requiredApproverIds.length;
  product.deleteFinalizedAt = null;
  await product.save();

  await recordHistoryEvent({
    actorId: session.user.id,
    actorName: session.user.name ?? session.user.email ?? "Unknown partner",
    actorRole: "partner",
    module: "products",
    entityType: "product",
    entityId: product._id.toString(),
    entityLabel: `${product.name} (${product.category})`,
    action: "request_delete",
    summary: `Product delete requested: ${product.name} (${product.category})`,
    before: {
      deleteRequestStatus: "none",
      isActive: true,
    },
    after: {
      deleteRequestStatus: "pending",
      deleteRequestedBy: session.user.id,
      requiredApprovalCount: requiredApproverIds.length,
    },
  });

  return NextResponse.json({
    status: "pending_review",
    requiredApprovalCount: requiredApproverIds.length,
  });
}

export async function PATCH(request: Request) {
  const session = await getRequiredSession(["partner"]);

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = reviewDeleteSchema.safeParse(await request.json());

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten() },
      { status: 400 },
    );
  }

  await connectToDatabase();

  const actorId = new Types.ObjectId(session.user.id);
  const product = await ProductModel.findById(parsed.data.productId);

  if (!product || !product.isActive) {
    return NextResponse.json({ error: "Product not found" }, { status: 404 });
  }

  const normalizedStatus = normalizeDeleteRequestStatus({
    status: product.deleteRequestStatus,
    requestedById: product.deleteRequestedBy?.toString(),
    isActive: product.isActive,
  });

  if (normalizedStatus !== "pending") {
    return NextResponse.json(
      { error: "Delete request is not pending." },
      { status: 400 },
    );
  }

  if (product.deleteRequestedBy?.toString() === session.user.id) {
    return NextResponse.json(
      { error: "Requester cannot review own delete request." },
      { status: 400 },
    );
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
    (approverId) => approverId.toString() === session.user.id,
  );

  if (!canReview) {
    return NextResponse.json(
      { error: "You are not in the required reviewers list." },
      { status: 403 },
    );
  }

  const alreadyReviewed = (product.deleteApprovals ?? []).some(
    (approval) => approval.partnerId.toString() === session.user.id,
  );

  if (alreadyReviewed) {
    return NextResponse.json(
      { error: "You already reviewed this delete request." },
      { status: 409 },
    );
  }

  product.deleteApprovals.push({
    partnerId: actorId,
    decision: parsed.data.decision,
    comment: parsed.data.comment ?? null,
    decidedAt: new Date(),
  });

  if (parsed.data.decision === "rejected") {
    product.deleteRequestStatus = "rejected";
    product.deleteFinalizedAt = new Date();
    await product.save();

    await recordHistoryEvent({
      actorId: session.user.id,
      actorName: session.user.name ?? session.user.email ?? "Unknown partner",
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

    return NextResponse.json({ status: "rejected" });
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
      return NextResponse.json(
        {
          error:
            "Product stock changed and is now above 0. Delete request cannot be finalized.",
        },
        { status: 400 },
      );
    }

    product.isActive = false;
    product.deleteRequestStatus = "approved";
    product.deleteFinalizedAt = new Date();
    await product.save();

    await VariantModel.updateMany(
      { productId: product._id, stockQty: 0 },
      { $set: { isActive: false } },
    );

    await recordHistoryEvent({
      actorId: session.user.id,
      actorName: session.user.name ?? session.user.email ?? "Unknown partner",
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

    return NextResponse.json({ status: "approved" });
  }

  await product.save();

  await recordHistoryEvent({
    actorId: session.user.id,
    actorName: session.user.name ?? session.user.email ?? "Unknown partner",
    actorRole: "partner",
    module: "products",
    entityType: "product",
    entityId: product._id.toString(),
    entityLabel: `${product.name} (${product.category})`,
    action: parsed.data.decision === "approved" ? "approve_delete" : "reject_delete",
    summary: `Product delete reviewed: ${product.name} (${product.category})`,
    before: { deleteRequestStatus: "pending", isActive: true },
    after: { deleteRequestStatus: "pending", isActive: true },
    meta: { reviewDecision: parsed.data.decision },
  });
  return NextResponse.json({ status: "pending" });
}
