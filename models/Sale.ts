import { Model, model, models, Schema, Types } from "mongoose";

export type SaleStatus = "completed" | "voided";

export interface SaleLine {
  _id?: Types.ObjectId;
  variantId: Types.ObjectId;
  productSnapshot: string;
  skuSnapshot: string;
  colorSnapshot: string;
  sizeSnapshot: string;
  qty: number;
  sellingPriceSnapshot: unknown;
  avgCostSnapshot: unknown;
  profitPerUnitSnapshot: unknown;
  lineSubtotal: unknown;
  lineDiscount: unknown;
  lineTotal: unknown;
  returnedQty: number;
  damagedQty: number;
}

export interface Sale {
  saleNumber: string;
  items: SaleLine[];
  subtotal: unknown;
  discountTotal: unknown;
  grandTotal: unknown;
  paymentMethod: string;
  soldBy: Types.ObjectId;
  saleDate: Date;
  status: SaleStatus;
  voidedBy?: Types.ObjectId | null;
  voidedAt?: Date | null;
  voidReason?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

const saleLineSchema = new Schema<SaleLine>(
  {
    variantId: { type: Schema.Types.ObjectId, ref: "Variant", required: true },
    productSnapshot: { type: String, required: true, trim: true },
    skuSnapshot: { type: String, required: true, trim: true, uppercase: true },
    colorSnapshot: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
    },
    sizeSnapshot: { type: String, required: true, trim: true, uppercase: true },
    qty: { type: Number, required: true, min: 1 },
    sellingPriceSnapshot: { type: Schema.Types.Decimal128, required: true },
    avgCostSnapshot: { type: Schema.Types.Decimal128, required: true },
    profitPerUnitSnapshot: { type: Schema.Types.Decimal128, required: true },
    lineSubtotal: { type: Schema.Types.Decimal128, required: true },
    lineDiscount: {
      type: Schema.Types.Decimal128,
      required: true,
      default: () => Types.Decimal128.fromString("0"),
    },
    lineTotal: { type: Schema.Types.Decimal128, required: true },
    returnedQty: { type: Number, required: true, min: 0, default: 0 },
    damagedQty: { type: Number, required: true, min: 0, default: 0 },
  },
  {
    _id: true,
  },
);

const saleSchema = new Schema<Sale>(
  {
    saleNumber: { type: String, required: true, unique: true, trim: true },
    items: {
      type: [saleLineSchema],
      required: true,
      validate: [
        (value: SaleLine[]) => value.length > 0,
        "Sale must have at least one item",
      ],
    },
    subtotal: { type: Schema.Types.Decimal128, required: true },
    discountTotal: {
      type: Schema.Types.Decimal128,
      required: true,
      default: () => Types.Decimal128.fromString("0"),
    },
    grandTotal: { type: Schema.Types.Decimal128, required: true },
    paymentMethod: { type: String, required: true, trim: true },
    soldBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    saleDate: { type: Date, required: true },
    status: {
      type: String,
      enum: ["completed", "voided"],
      required: true,
      default: "completed",
    },
    voidedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    voidedAt: { type: Date, default: null },
    voidReason: { type: String, default: null },
  },
  {
    timestamps: true,
  },
);

saleSchema.index({ saleDate: -1 });

const SaleModel =
  (models.Sale as Model<Sale>) || model<Sale>("Sale", saleSchema);

export default SaleModel;
