import { NextResponse } from "next/server";
import { z } from "zod";

import { getRequiredSession } from "@/lib/auth";
import { listInvestmentHistory } from "@/lib/services/investment-history";
import { createInvestment, reviewInvestments } from "@/lib/services/investments";

const createInvestmentSchema = z.object({
  amount: z
    .number({ error: "Amount is required." })
    .finite("Amount must be a valid number.")
    .positive("Amount must be greater than 0."),
  investedAt: z.coerce.date(),
  note: z.string().trim().optional(),
});

const reviewInvestmentSchema = z.union([
  z.object({
    investmentId: z.string().trim().min(1),
    decision: z.enum(["approved", "rejected"]),
    comment: z.string().trim().optional(),
  }),
  z.object({
    investmentIds: z.array(z.string().trim().min(1)).min(1),
    decision: z.enum(["approved", "rejected"]),
    comment: z.string().trim().optional(),
  }),
]);

export async function GET(request: Request) {
  const session = await getRequiredSession(["partner"]);

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const history = await listInvestmentHistory({
      actorId: session.user.id,
      page: Number(searchParams.get("page") ?? "1"),
      pageSize: Number(searchParams.get("pageSize") ?? "10"),
      scope: searchParams.get("scope"),
      owner: searchParams.get("owner"),
      status: searchParams.get("status"),
      from: searchParams.get("from"),
      to: searchParams.get("to"),
      needsReview: searchParams.get("needsReview") === "true",
    });

    return NextResponse.json(history);
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Unable to load investments",
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

  const parsed = createInvestmentSchema.safeParse(await request.json());

  if (!parsed.success) {
    const firstIssue = parsed.error.issues[0];

    return NextResponse.json(
      { error: firstIssue?.message ?? "Invalid investment request." },
      { status: 400 },
    );
  }

  try {
    const investment = await createInvestment({
      amount: parsed.data.amount,
      investedAt: parsed.data.investedAt,
      note: parsed.data.note,
      submittedBy: session.user.id,
    });

    return NextResponse.json(
      { investmentId: investment._id.toString() },
      { status: 201 },
    );
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to create investment",
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

  const parsed = reviewInvestmentSchema.safeParse(await request.json());

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten() },
      { status: 400 },
    );
  }

  try {
    const investmentIds =
      "investmentId" in parsed.data
        ? [parsed.data.investmentId]
        : parsed.data.investmentIds;
    const reviews = await reviewInvestments({
      investmentIds,
      partnerId: session.user.id,
      partnerName:
        session.user.name ?? session.user.email ?? "Unknown partner",
      decision: parsed.data.decision,
      comment: parsed.data.comment,
    });

    return NextResponse.json({ reviews });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to review investment",
      },
      { status: 400 },
    );
  }
}
