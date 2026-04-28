import { Model, model, models, Schema, Types } from "mongoose";

export type VariantDeleteRequestStatus =
  | "none"
  | "pending"
  | "approved"
  | "rejected";

export type VariantUpdateRequestStatus =
  | "none"
  | "pending"
  | "approved"
  | "rejected";

export interface VariantDeleteApproval {
  partnerId: Types.ObjectId;
  decision: "approved" | "rejected";
  decidedAt: Date;
  comment?: string | null;
}

export interface VariantUpdateApproval {
  partnerId: Types.ObjectId;
  decision: "approved" | "rejected";
  decidedAt: Date;
  comment?: string | null;
}

export interface Variant {
  productId: Types.ObjectId;
  color: string;
  size: string;
  sku: string;
  barcode?: string | null;
  stockQty: number;
  avgCost: unknown;
  sellingPrice: unknown;
  lowStockThreshold: number;
  isActive: boolean;
  deleteRequestStatus: VariantDeleteRequestStatus;
  deleteRequestedBy?: Types.ObjectId | null;
  deleteRequestedAt?: Date | null;
  deleteApprovals: VariantDeleteApproval[];
  deleteRequiredApproverIdsSnapshot: Types.ObjectId[];
  deleteRequiredApprovalCountSnapshot: number;
  deleteFinalizedAt?: Date | null;
  updateRequestStatus: VariantUpdateRequestStatus;
  updateRequestedBy?: Types.ObjectId | null;
  updateRequestedAt?: Date | null;
  updateProposedColor?: string | null;
  updateProposedSize?: string | null;
  updateProposedSellingPrice?: unknown;
  updateApprovals: VariantUpdateApproval[];
  updateRequiredApproverIdsSnapshot: Types.ObjectId[];
  updateRequiredApprovalCountSnapshot: number;
  updateFinalizedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const variantDeleteApprovalSchema = new Schema<VariantDeleteApproval>(
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

const variantUpdateApprovalSchema = new Schema<VariantUpdateApproval>(
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

const variantSchema = new Schema<Variant>(
  {
    productId: {
      type: Schema.Types.ObjectId,
      ref: "Product",
      required: true,
      index: true,
    },
    color: { type: String, required: true, trim: true, uppercase: true },
    size: { type: String, required: true, trim: true, uppercase: true },
    sku: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      uppercase: true,
    },
    barcode: { type: String, default: null },
    stockQty: { type: Number, required: true, min: 0, default: 0, index: true },
    avgCost: {
      type: Schema.Types.Decimal128,
      required: true,
      default: () => Types.Decimal128.fromString("0"),
    },
    sellingPrice: { type: Schema.Types.Decimal128, required: true },
    lowStockThreshold: { type: Number, required: true, min: 0, default: 0 },
    isActive: { type: Boolean, default: true, index: true },
    deleteRequestStatus: {
      type: String,
      enum: ["none", "pending", "approved", "rejected"],
      required: true,
      default: "none",
    },
    deleteRequestedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    deleteRequestedAt: { type: Date, default: null },
    deleteApprovals: { type: [variantDeleteApprovalSchema], default: [] },
    deleteRequiredApproverIdsSnapshot: {
      type: [{ type: Schema.Types.ObjectId, ref: "User", required: true }],
      default: [],
    },
    deleteRequiredApprovalCountSnapshot: { type: Number, required: true, default: 0 },
    deleteFinalizedAt: { type: Date, default: null },
    updateRequestStatus: {
      type: String,
      enum: ["none", "pending", "approved", "rejected"],
      required: true,
      default: "none",
    },
    updateRequestedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    updateRequestedAt: { type: Date, default: null },
    updateProposedColor: { type: String, default: null },
    updateProposedSize: { type: String, default: null },
    updateProposedSellingPrice: {
      type: Schema.Types.Decimal128,
      default: null,
    },
    updateApprovals: { type: [variantUpdateApprovalSchema], default: [] },
    updateRequiredApproverIdsSnapshot: {
      type: [{ type: Schema.Types.ObjectId, ref: "User", required: true }],
      default: [],
    },
    updateRequiredApprovalCountSnapshot: {
      type: Number,
      required: true,
      default: 0,
    },
    updateFinalizedAt: { type: Date, default: null },
  },
  {
    timestamps: true,
  },
);

variantSchema.index({ productId: 1, color: 1, size: 1 }, { unique: true });

function patchVariantSchema(targetSchema: Schema) {
  if (!targetSchema.path("deleteRequestStatus")) {
    targetSchema.add({
      deleteRequestStatus: {
        type: String,
        enum: ["none", "pending", "approved", "rejected"],
        required: true,
        default: "none",
      },
      deleteRequestedBy: {
        type: Schema.Types.ObjectId,
        ref: "User",
        default: null,
      },
      deleteRequestedAt: { type: Date, default: null },
      deleteApprovals: { type: [variantDeleteApprovalSchema], default: [] },
      deleteRequiredApproverIdsSnapshot: {
        type: [{ type: Schema.Types.ObjectId, ref: "User", required: true }],
        default: [],
      },
      deleteRequiredApprovalCountSnapshot: {
        type: Number,
        required: true,
        default: 0,
      },
      deleteFinalizedAt: { type: Date, default: null },
    });
  }

  if (!targetSchema.path("updateRequestStatus")) {
    targetSchema.add({
      updateRequestStatus: {
        type: String,
        enum: ["none", "pending", "approved", "rejected"],
        required: true,
        default: "none",
      },
      updateRequestedBy: {
        type: Schema.Types.ObjectId,
        ref: "User",
        default: null,
      },
      updateRequestedAt: { type: Date, default: null },
      updateProposedColor: { type: String, default: null },
      updateProposedSize: { type: String, default: null },
      updateProposedSellingPrice: {
        type: Schema.Types.Decimal128,
        default: null,
      },
      updateApprovals: { type: [variantUpdateApprovalSchema], default: [] },
      updateRequiredApproverIdsSnapshot: {
        type: [{ type: Schema.Types.ObjectId, ref: "User", required: true }],
        default: [],
      },
      updateRequiredApprovalCountSnapshot: {
        type: Number,
        required: true,
        default: 0,
      },
      updateFinalizedAt: { type: Date, default: null },
    });
  }
}

const existingVariantModel = models.Variant as Model<Variant> | undefined;

if (existingVariantModel) {
  patchVariantSchema(existingVariantModel.schema);
}

const VariantModel = existingVariantModel || model<Variant>("Variant", variantSchema);

export default VariantModel;
