import { Model, model, models, Schema, Types } from "mongoose";

export type ReturnType = "customer_return" | "damaged";

export interface ReturnRecord {
  saleId: Types.ObjectId;
  saleLineId: Types.ObjectId;
  variantId: Types.ObjectId;
  qty: number;
  returnType: ReturnType;
  lossAmount: unknown;
  note?: string | null;
  processedBy: Types.ObjectId;
  returnDate: Date;
  createdAt: Date;
  updatedAt: Date;
}

const returnSchema = new Schema<ReturnRecord>(
  {
    saleId: {
      type: Schema.Types.ObjectId,
      ref: "Sale",
      required: true,
      index: true,
    },
    saleLineId: { type: Schema.Types.ObjectId, required: true },
    variantId: {
      type: Schema.Types.ObjectId,
      ref: "Variant",
      required: true,
      index: true,
    },
    qty: { type: Number, required: true, min: 1 },
    returnType: {
      type: String,
      enum: ["customer_return", "damaged"],
      required: true,
    },
    lossAmount: { type: Schema.Types.Decimal128, required: true },
    note: { type: String, default: null },
    processedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    returnDate: { type: Date, required: true },
  },
  {
    timestamps: true,
  },
);

returnSchema.index({ saleId: 1, saleLineId: 1, returnDate: -1 });

const ReturnModel =
  (models.Return as Model<ReturnRecord>) ||
  model<ReturnRecord>("Return", returnSchema);

export default ReturnModel;
