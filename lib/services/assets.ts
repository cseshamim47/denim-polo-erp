import { HydratedDocument, Types } from "mongoose";

import { connectToDatabase } from "@/lib/db";
import {
  buildApprovalReviewUpdate,
  uniqReviewIds,
  type ApprovalDecision,
} from "@/lib/services/approval-review";
import { recordHistoryEvent } from "@/lib/services/history";
import {
  buildAssetApprovalSnapshot,
  evaluateAssetDecision,
} from "@/lib/domain/asset-approval";
import { toDecimal128 } from "@/lib/money";
import AssetModel, { type Asset } from "@/models/Asset";
import UserModel from "@/models/User";

export async function createAsset(input: {
  title: string;
  category: string;
  amount: number;
  note?: string;
  assetDate: Date;
  submittedBy: string;
  submittedByName: string;
}): Promise<HydratedDocument<Asset>> {
  await connectToDatabase();

  const activePartners = await UserModel.find({
    role: "partner",
    isActive: true,
  }).lean();
  const snapshot = buildAssetApprovalSnapshot({
    activePartnerIds: activePartners.map((partner) => partner._id.toString()),
    submitterId: input.submittedBy,
  });

  if (snapshot.requiredApprovalCount === 0) {
    throw new Error("asset approval requires at least one active approver");
  }

  const asset = await AssetModel.create({
    title: input.title,
    category: input.category.trim().toUpperCase(),
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
    assetDate: input.assetDate,
  });

  await recordHistoryEvent({
    actorId: input.submittedBy,
    actorName: input.submittedByName,
    actorRole: "partner",
    module: "assets",
    entityType: "asset",
    entityId: asset._id.toString(),
    entityLabel: input.title,
    action: "create",
    summary: `Asset created: ${input.title}`,
    before: null,
    after: {
      title: input.title,
      category: input.category.trim().toUpperCase(),
      amount: input.amount,
      assetDate: input.assetDate.toISOString(),
      status: "pending",
      note: input.note ?? null,
    },
  });

  return asset;
}

export async function reviewAsset(input: {
  assetId: string;
  partnerId: string;
  decision: "approved" | "rejected";
  comment?: string;
}): Promise<HydratedDocument<Asset>> {
  await connectToDatabase();

  const asset = await AssetModel.findById(input.assetId);

  if (!asset) {
    throw new Error("asset not found");
  }

  if (asset.submittedBy.toString() === input.partnerId) {
    throw new Error("submitter cannot approve own asset");
  }

  const existingDecision = asset.approvals.find(
    (approval) => approval.partnerId.toString() === input.partnerId,
  );

  if (existingDecision) {
    throw new Error("partner already reviewed asset");
  }

  asset.approvals.push({
    partnerId: new Types.ObjectId(input.partnerId),
    decision: input.decision,
    decidedAt: new Date(),
    comment: input.comment ?? null,
  });

  asset.status = evaluateAssetDecision({
    requiredApproverIds: asset.requiredApproverIdsSnapshot.map((partnerId) =>
      partnerId.toString(),
    ),
    decisions: asset.approvals.map((approval) => ({
      partnerId: approval.partnerId.toString(),
      decision: approval.decision,
    })),
  });

  await asset.save();

  return asset;
}

export async function reviewAssets(input: {
  assetIds: string[];
  partnerId: string;
  partnerName: string;
  decision: ApprovalDecision;
  comment?: string;
}) {
  const assetIds = uniqReviewIds(input.assetIds);
  const reviews = [];

  for (const assetId of assetIds) {
    const asset = await reviewAsset({
      assetId,
      partnerId: input.partnerId,
      decision: input.decision,
      comment: input.comment,
    });
    const actorApproval = asset.approvals.find(
      (approval) => approval.partnerId.toString() === input.partnerId,
    );

    if (!actorApproval) {
      continue;
    }

    reviews.push(
      buildApprovalReviewUpdate({
        id: asset._id.toString(),
        status: asset.status,
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
      module: "assets",
      entityType: "asset",
      entityId: asset._id.toString(),
      entityLabel: asset.title,
      action: input.decision === "approved" ? "approve" : "reject",
      summary: `Asset ${input.decision}: ${asset.title}`,
      before: { status: "pending" },
      after: {
        status: asset.status,
        comment: actorApproval.comment ?? null,
      },
    });
  }

  return reviews;
}
