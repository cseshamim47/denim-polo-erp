import { Model, model, models, Schema, Types } from "mongoose";

export interface PerfumePricingRule {
  perfumeVariantId: Types.ObjectId;
  bottleVariantId: Types.ObjectId;
  fillMl: number;
  bottleSellingPrice: unknown;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const perfumePricingRuleSchema = new Schema<PerfumePricingRule>(
  {
    perfumeVariantId: {
      type: Schema.Types.ObjectId,
      ref: "Variant",
      required: true,
      index: true,
    },
    bottleVariantId: {
      type: Schema.Types.ObjectId,
      ref: "Variant",
      required: true,
      index: true,
    },
    fillMl: { type: Number, required: true, min: 1 },
    bottleSellingPrice: { type: Schema.Types.Decimal128, required: true },
    isActive: { type: Boolean, required: true, default: true },
  },
  {
    timestamps: true,
  },
);

perfumePricingRuleSchema.index(
  { perfumeVariantId: 1, bottleVariantId: 1, fillMl: 1 },
  { unique: true },
);

const PerfumePricingRuleModel =
  (models.PerfumePricingRule as Model<PerfumePricingRule>) ||
  model<PerfumePricingRule>("PerfumePricingRule", perfumePricingRuleSchema);

export default PerfumePricingRuleModel;
