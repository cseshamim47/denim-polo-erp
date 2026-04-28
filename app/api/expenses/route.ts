import { NextResponse } from "next/server";
import { z } from "zod";

import { getRequiredSession } from "@/lib/auth";
import { listExpenseHistory } from "@/lib/services/expense-history";
import { createExpense, reviewExpense } from "@/lib/services/expenses";

const createExpenseSchema = z.object({
  title: z.string().trim().min(1),
  amount: z.number().positive(),
  note: z.string().trim().optional(),
  expenseDate: z.coerce.date(),
});

const reviewExpenseSchema = z.object({
  expenseId: z.string().trim().min(1),
  decision: z.enum(["approved", "rejected"]),
  comment: z.string().trim().optional(),
});

export async function GET(request: Request) {
  const session = await getRequiredSession(["partner"]);

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const history = await listExpenseHistory({
      actorId: session.user.id,
      page: Number(searchParams.get("page") ?? "1"),
      pageSize: Number(searchParams.get("pageSize") ?? "10"),
      scope: searchParams.get("scope"),
      owner: searchParams.get("owner"),
      status: searchParams.get("status"),
      from: searchParams.get("from"),
      to: searchParams.get("to"),
    });

    return NextResponse.json(history);
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Unable to load expenses",
      },
      { status: 400 },
    );
  }
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
