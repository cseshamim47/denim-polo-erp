import { Model, model, models, Schema, Types } from "mongoose";

export type ExpenseStatus = "pending" | "approved" | "rejected";
export type ExpenseDecision = "approved" | "rejected";

export interface ExpenseApproval {
  partnerId: Types.ObjectId;
  decision: ExpenseDecision;
  decidedAt: Date;
  comment?: string | null;
}

export interface Expense {
  title: string;
  amount: unknown;
  category: string;
  note?: string | null;
  submittedBy: Types.ObjectId;
  submittedAt: Date;
  status: ExpenseStatus;
  approvals: ExpenseApproval[];
  requiredApproverIdsSnapshot: Types.ObjectId[];
  requiredApprovalCountSnapshot: number;
  expenseDate: Date;
  createdAt: Date;
  updatedAt: Date;
}

const expenseApprovalSchema = new Schema<ExpenseApproval>(
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

const expenseSchema = new Schema<Expense>(
  {
    title: { type: String, required: true, trim: true },
    amount: { type: Schema.Types.Decimal128, required: true },
    category: { type: String, required: true, trim: true },
    note: { type: String, default: null },
    submittedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    submittedAt: { type: Date, required: true },
    status: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      required: true,
      default: "pending",
    },
    approvals: { type: [expenseApprovalSchema], default: [] },
    requiredApproverIdsSnapshot: {
      type: [{ type: Schema.Types.ObjectId, ref: "User", required: true }],
      required: true,
    },
    requiredApprovalCountSnapshot: { type: Number, required: true, min: 1 },
    expenseDate: { type: Date, required: true },
  },
  {
    timestamps: true,
  },
);

expenseSchema.index({ status: 1, expenseDate: -1 });

const ExpenseModel =
  (models.Expense as Model<Expense>) ||
  model<Expense>("Expense", expenseSchema);

export default ExpenseModel;
