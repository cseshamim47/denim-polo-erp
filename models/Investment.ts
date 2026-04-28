import { Model, model, models, Schema, Types } from "mongoose";

export type InvestmentStatus = "pending" | "approved" | "rejected";
export type InvestmentDecision = "approved" | "rejected";

export interface InvestmentApproval {
  partnerId: Types.ObjectId;
  decision: InvestmentDecision;
  decidedAt: Date;
  comment?: string | null;
}

export interface Investment {
  partnerId: Types.ObjectId;
  amount: unknown;
  note?: string | null;
  submittedAt: Date;
  status: InvestmentStatus;
  approvals: InvestmentApproval[];
  requiredApproverIdsSnapshot: Types.ObjectId[];
  requiredApprovalCountSnapshot: number;
  investedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const investmentApprovalSchema = new Schema<InvestmentApproval>(
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

const investmentSchema = new Schema<Investment>(
  {
    partnerId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    amount: { type: Schema.Types.Decimal128, required: true },
    note: { type: String, default: null },
    submittedAt: { type: Date, required: true, default: Date.now },
    status: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      required: true,
      default: "pending",
    },
    approvals: { type: [investmentApprovalSchema], default: [] },
    requiredApproverIdsSnapshot: {
      type: [{ type: Schema.Types.ObjectId, ref: "User", required: true }],
      required: true,
    },
    requiredApprovalCountSnapshot: { type: Number, required: true, min: 1 },
    investedAt: { type: Date, required: true },
  },
  {
    timestamps: true,
  },
);

investmentSchema.index({ status: 1, investedAt: -1, createdAt: -1 });

const InvestmentModel =
  (models.Investment as Model<Investment>) ||
  model<Investment>("Investment", investmentSchema);

export default InvestmentModel;
