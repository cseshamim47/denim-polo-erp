import { Model, model, models, Schema, Types } from "mongoose";

export type ProductDeleteRequestStatus =
  | "none"
  | "pending"
  | "approved"
  | "rejected";

export interface ProductDeleteApproval {
  partnerId: Types.ObjectId;
  decision: "approved" | "rejected";
  decidedAt: Date;
  comment?: string | null;
}

export interface Product {
  name: string;
  category: string;
  description?: string | null;
  isActive: boolean;
  deleteRequestStatus: ProductDeleteRequestStatus;
  deleteRequestedBy?: Types.ObjectId | null;
  deleteRequestedAt?: Date | null;
  deleteApprovals: ProductDeleteApproval[];
  deleteRequiredApproverIdsSnapshot: Types.ObjectId[];
  deleteRequiredApprovalCountSnapshot: number;
  deleteFinalizedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const productDeleteApprovalSchema = new Schema<ProductDeleteApproval>(
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

const productSchema = new Schema<Product>(
  {
    name: { type: String, required: true, trim: true },
    category: { type: String, required: true, trim: true, uppercase: true },
    description: { type: String, default: null },
    isActive: { type: Boolean, default: true },
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
    deleteApprovals: { type: [productDeleteApprovalSchema], default: [] },
    deleteRequiredApproverIdsSnapshot: {
      type: [{ type: Schema.Types.ObjectId, ref: "User", required: true }],
      default: [],
    },
    deleteRequiredApprovalCountSnapshot: { type: Number, required: true, default: 0 },
    deleteFinalizedAt: { type: Date, default: null },
  },
  {
    timestamps: true,
  },
);

productSchema.index(
  { category: 1, name: 1 },
  {
    unique: true,
    partialFilterExpression: { isActive: true },
  },
);

function patchProductSchema(targetSchema: Schema) {
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
      deleteApprovals: { type: [productDeleteApprovalSchema], default: [] },
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
}

const existingProductModel = models.Product as Model<Product> | undefined;

if (existingProductModel) {
  patchProductSchema(existingProductModel.schema);
}

const ProductModel = existingProductModel || model<Product>("Product", productSchema);

export default ProductModel;
