import { Model, model, models, Schema, Types } from "mongoose";

export interface Investment {
  partnerId: Types.ObjectId;
  amount: unknown;
  note?: string | null;
  investedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const investmentSchema = new Schema<Investment>(
  {
    partnerId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    amount: { type: Schema.Types.Decimal128, required: true },
    note: { type: String, default: null },
    investedAt: { type: Date, required: true },
  },
  {
    timestamps: true,
  },
);

const InvestmentModel =
  (models.Investment as Model<Investment>) ||
  model<Investment>("Investment", investmentSchema);

export default InvestmentModel;
