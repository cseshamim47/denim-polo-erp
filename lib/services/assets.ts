import { HydratedDocument, Types } from "mongoose";

import { connectToDatabase } from "@/lib/db";
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

  return AssetModel.create({
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
