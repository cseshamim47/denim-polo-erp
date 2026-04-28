import mongoose from "mongoose";

const required = {
  MONGODB_URI: process.env.MONGODB_URI,
};

const missing = Object.entries(required)
  .filter(([, value]) => !value)
  .map(([key]) => key);

if (missing.length > 0) {
  console.error(`Missing env: ${missing.join(", ")}`);
  process.exit(1);
}

const isApply = process.argv.includes("--apply");

function normalizeStatus(variant) {
  const status = variant.updateRequestStatus;

  if (variant.isActive === false) {
    return "approved";
  }

  if (status === "approved" || status === "rejected" || status === "pending") {
    return status;
  }

  const hasRequestMetadata =
    Boolean(variant.updateRequestedBy) ||
    Boolean(variant.updateRequestedAt) ||
    (variant.updateApprovals?.length ?? 0) > 0 ||
    Number(variant.updateRequiredApprovalCountSnapshot ?? 0) > 0 ||
    variant.updateProposedSellingPrice != null;

  if (hasRequestMetadata) {
    return "pending";
  }

  return "none";
}

function computeRequiredApprovalCount(partnerCount) {
  return Math.max(partnerCount - 1, 0);
}

function normalizeIdList(values) {
  return (values ?? []).map((id) => id.toString()).sort();
}

async function main() {
  await mongoose.connect(required.MONGODB_URI, { bufferCommands: false });

  const db = mongoose.connection.db;
  const variants = db.collection("variants");
  const users = db.collection("users");

  const activePartners = await users
    .find({ role: "partner", isActive: true }, { projection: { _id: 1 } })
    .toArray();

  const activePartnerIds = activePartners.map((partner) => partner._id.toString());
  const configuredPartnerCount = (process.env.PARTNER_EMAILS ?? "")
    .split(",")
    .map((email) => email.trim())
    .filter(Boolean).length;

  const partnerCountForApproval = Math.max(configuredPartnerCount, activePartnerIds.length);

  const cursor = variants.find({ isActive: true });

  let scanned = 0;
  let toFix = 0;
  let updated = 0;

  while (await cursor.hasNext()) {
    const variant = await cursor.next();
    if (!variant) {
      continue;
    }

    scanned += 1;

    const normalizedStatus = normalizeStatus(variant);

    const requesterId = variant.updateRequestedBy?.toString() ?? null;

    const reviewerIds = requesterId
      ? activePartnerIds.filter((id) => id !== requesterId)
      : [];

    const requiredApprovalCountSnapshot = requesterId
      ? computeRequiredApprovalCount(partnerCountForApproval)
      : 0;

    const shouldResetToNone =
      normalizedStatus === "none" &&
      (!requesterId || variant.updateProposedSellingPrice == null);

    const nextSet =
      shouldResetToNone
        ? {
            updateRequestStatus: "none",
            updateRequestedBy: null,
            updateRequestedAt: null,
            updateProposedColor: null,
            updateProposedSize: null,
            updateProposedSellingPrice: null,
            updateApprovals: [],
            updateRequiredApproverIdsSnapshot: [],
            updateRequiredApprovalCountSnapshot: 0,
            updateFinalizedAt: null,
          }
        : normalizedStatus === "pending"
          ? {
              updateRequestStatus: "pending",
              updateRequiredApproverIdsSnapshot: reviewerIds.map(
                (id) => new mongoose.Types.ObjectId(id),
              ),
              updateRequiredApprovalCountSnapshot,
            }
          : {
              updateRequestStatus: normalizedStatus,
            };

    const changed = shouldResetToNone
      ? variant.updateRequestStatus !== "none" ||
        variant.updateRequestedBy != null ||
        variant.updateRequestedAt != null ||
        variant.updateProposedColor != null ||
        variant.updateProposedSize != null ||
        variant.updateProposedSellingPrice != null ||
        (variant.updateApprovals?.length ?? 0) > 0 ||
        normalizeIdList(variant.updateRequiredApproverIdsSnapshot).length > 0 ||
        Number(variant.updateRequiredApprovalCountSnapshot ?? 0) !== 0 ||
        variant.updateFinalizedAt != null
      : normalizedStatus === "pending"
        ? variant.updateRequestStatus !== "pending" ||
          Number(variant.updateRequiredApprovalCountSnapshot ?? 0) !==
            requiredApprovalCountSnapshot ||
          JSON.stringify(
            normalizeIdList(variant.updateRequiredApproverIdsSnapshot),
          ) !== JSON.stringify(reviewerIds.sort())
        : variant.updateRequestStatus !== normalizedStatus;

    if (!changed) {
      continue;
    }

    toFix += 1;

    if (!isApply) {
      continue;
    }

    await variants.updateOne({ _id: variant._id }, { $set: nextSet });
    updated += 1;
  }

  console.log("Variant update request repair");
  console.log(`Mode: ${isApply ? "apply" : "dry-run"}`);
  console.log(`Scanned: ${scanned}`);
  console.log(`Needs fix: ${toFix}`);
  console.log(`Updated: ${updated}`);
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });
