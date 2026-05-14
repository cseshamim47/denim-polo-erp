import { Model, model, models, Schema, Types } from "mongoose";

export type AssetStatus = "pending" | "approved" | "rejected";
export type AssetDecision = "approved" | "rejected";

export interface AssetApproval {
  partnerId: Types.ObjectId;
  decision: AssetDecision;
  decidedAt: Date;
  comment?: string | null;
}

export interface Asset {
  title: string;
  category: string;
  amount: unknown;
  note?: string | null;
  submittedBy: Types.ObjectId;
  submittedAt: Date;
  status: AssetStatus;
  approvals: AssetApproval[];
  requiredApproverIdsSnapshot: Types.ObjectId[];
  requiredApprovalCountSnapshot: number;
  assetDate: Date;
  createdAt: Date;
  updatedAt: Date;
}

const assetApprovalSchema = new Schema<AssetApproval>(
  {
    partnerId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    decision: { type: String, enum: ["approved", "rejected"], required: true },
    decidedAt: { type: Date, required: true },
    comment: { type: String, default: null },
  },
  {
    _id: false,
  },
);

const assetSchema = new Schema<Asset>(
  {
    title: { type: String, required: true, trim: true },
    category: { type: String, required: true, trim: true, uppercase: true },
    amount: { type: Schema.Types.Decimal128, required: true },
    note: { type: String, default: null },
    submittedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    submittedAt: { type: Date, required: true },
    status: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      required: true,
      default: "pending",
    },
    approvals: { type: [assetApprovalSchema], default: [] },
    requiredApproverIdsSnapshot: {
      type: [{ type: Schema.Types.ObjectId, ref: "User", required: true }],
      required: true,
    },
    requiredApprovalCountSnapshot: { type: Number, required: true, min: 1 },
    assetDate: { type: Date, required: true },
  },
  {
    timestamps: true,
  },
);

assetSchema.index({ status: 1, assetDate: -1, createdAt: -1 });

const AssetModel =
  (models.Asset as Model<Asset>) || model<Asset>("Asset", assetSchema);

export default AssetModel;
