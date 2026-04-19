import { Model, model, models, Schema, Types } from "mongoose";

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
  createdAt: Date;
  updatedAt: Date;
}

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
  },
  {
    timestamps: true,
  },
);

variantSchema.index({ productId: 1, color: 1, size: 1 }, { unique: true });

const VariantModel =
  (models.Variant as Model<Variant>) ||
  model<Variant>("Variant", variantSchema);

export default VariantModel;
