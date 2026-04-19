import { NextResponse } from "next/server";
import { z } from "zod";

import { getRequiredSession } from "@/lib/auth";
import { connectToDatabase } from "@/lib/db";
import { decimalToNumber } from "@/lib/money";
import { createExpense, reviewExpense } from "@/lib/services/expenses";
import ExpenseModel from "@/models/Expense";

const createExpenseSchema = z.object({
  title: z.string().trim().min(1),
  amount: z.number().positive(),
  category: z.string().trim().min(1),
  note: z.string().trim().optional(),
  expenseDate: z.coerce.date(),
});

const reviewExpenseSchema = z.object({
  expenseId: z.string().trim().min(1),
  decision: z.enum(["approved", "rejected"]),
  comment: z.string().trim().optional(),
});

export async function GET() {
  const session = await getRequiredSession(["partner"]);

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await connectToDatabase();

  const expenses = await ExpenseModel.find().sort({ expenseDate: -1 }).lean();

  return NextResponse.json({
    expenses: expenses.map((expense) => ({
      id: expense._id.toString(),
      title: expense.title,
      amount: decimalToNumber(expense.amount),
      category: expense.category,
      status: expense.status,
      requiredApprovalCount: expense.requiredApprovalCountSnapshot,
      approvalCount: expense.approvals.length,
      expenseDate: expense.expenseDate,
      note: expense.note,
    })),
  });
}

export async function POST(request: Request) {
  const session = await getRequiredSession(["partner"]);

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = createExpenseSchema.safeParse(await request.json());

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten() },
      { status: 400 },
    );
  }

  try {
    const expense = await createExpense({
      ...parsed.data,
      submittedBy: session.user.id,
    });

    return NextResponse.json(
      { expenseId: expense._id.toString() },
      { status: 201 },
    );
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Unable to create expense",
      },
      { status: 400 },
    );
  }
}

export async function PATCH(request: Request) {
  const session = await getRequiredSession(["partner"]);

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = reviewExpenseSchema.safeParse(await request.json());

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten() },
      { status: 400 },
    );
  }

  try {
    const expense = await reviewExpense({
      ...parsed.data,
      partnerId: session.user.id,
    });

    return NextResponse.json({ status: expense.status });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Unable to review expense",
      },
      { status: 400 },
    );
  }
}
