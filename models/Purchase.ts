import { Model, model, models, Schema, Types } from "mongoose";

export type PurchaseStatus = "pending" | "approved" | "rejected";
export type PurchaseDecision = "approved" | "rejected";

export interface PurchaseApproval {
  partnerId: Types.ObjectId;
  decision: PurchaseDecision;
  decidedAt: Date;
  comment?: string | null;
}

export interface Purchase {
  variantId: Types.ObjectId;
  qty: number;
  costPerUnit: unknown;
  landedCostPerUnit: unknown;
  totalCost: unknown;
  additionalCost: unknown;
  cashOutTotal: unknown;
  billImageUrl?: string | null;
  purchaseDate: Date;
  note?: string | null;
  createdBy: Types.ObjectId;
  status: PurchaseStatus;
  approvals: PurchaseApproval[];
  requiredApproverIdsSnapshot: Types.ObjectId[];
  requiredApprovalCountSnapshot: number;
  createdAt: Date;
  updatedAt: Date;
}

const purchaseApprovalSchema = new Schema<PurchaseApproval>(
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

const purchaseSchema = new Schema<Purchase>(
  {
    variantId: {
      type: Schema.Types.ObjectId,
      ref: "Variant",
      required: true,
      index: true,
    },
    qty: { type: Number, required: true, min: 1 },
    costPerUnit: { type: Schema.Types.Decimal128, required: true },
    landedCostPerUnit: { type: Schema.Types.Decimal128, required: true },
    totalCost: { type: Schema.Types.Decimal128, required: true },
    additionalCost: {
      type: Schema.Types.Decimal128,
      required: true,
      default: () => Types.Decimal128.fromString("0"),
    },
    cashOutTotal: { type: Schema.Types.Decimal128, required: true },
    billImageUrl: { type: String, default: null },
    purchaseDate: { type: Date, required: true },
    note: { type: String, default: null },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    status: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      required: true,
      default: "pending",
    },
    approvals: { type: [purchaseApprovalSchema], default: [] },
    requiredApproverIdsSnapshot: {
      type: [{ type: Schema.Types.ObjectId, ref: "User", required: true }],
      required: true,
    },
    requiredApprovalCountSnapshot: { type: Number, required: true, min: 1 },
  },
  {
    timestamps: true,
  },
);

purchaseSchema.index({ status: 1, purchaseDate: -1, createdAt: -1 });

const PurchaseModel =
  (models.Purchase as Model<Purchase>) ||
  model<Purchase>("Purchase", purchaseSchema);

export default PurchaseModel;
