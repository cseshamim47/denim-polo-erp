import { Model, model, models, Schema, Types } from "mongoose";

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
  createdAt: Date;
  updatedAt: Date;
}

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
  },
  {
    timestamps: true,
  },
);

const PurchaseModel =
  (models.Purchase as Model<Purchase>) ||
  model<Purchase>("Purchase", purchaseSchema);

export default PurchaseModel;
