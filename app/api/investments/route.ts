import { NextResponse } from "next/server";
import { Types } from "mongoose";
import { z } from "zod";

import { getRequiredSession } from "@/lib/auth";
import { connectToDatabase } from "@/lib/db";
import { decimalToNumber } from "@/lib/money";
import { getCurrentBalanceSnapshot } from "@/lib/services/balance";
import { createInvestment, reviewInvestment } from "@/lib/services/investments";
import InvestmentModel from "@/models/Investment";
import UserModel from "@/models/User";

function toIsoDate(
  value: Date | null | undefined,
  fallback: Date | null | undefined,
) {
  return (value ?? fallback ?? new Date(0)).toISOString();
}

function toApprovals(
  approvals:
    | Array<{
        partnerId: Types.ObjectId;
        decision: "approved" | "rejected";
        comment?: string | null;
        decidedAt: Date;
      }>
    | null
    | undefined,
) {
  return approvals ?? [];
}

function toRequiredApprovalCount(investment: {
  requiredApprovalCountSnapshot?: number | null;
  requiredApproverIdsSnapshot?: Types.ObjectId[] | null;
}) {
  return (
    investment.requiredApprovalCountSnapshot ??
    investment.requiredApproverIdsSnapshot?.length ??
    0
  );
}

const createInvestmentSchema = z.object({
  amount: z.number().positive(),
  investedAt: z.coerce.date(),
  note: z.string().trim().optional(),
});

const reviewInvestmentSchema = z.object({
  investmentId: z.string().trim().min(1),
  decision: z.enum(["approved", "rejected"]),
  comment: z.string().trim().optional(),
});

export async function GET(request: Request) {
  const session = await getRequiredSession(["partner"]);

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await connectToDatabase();

  const { searchParams } = new URL(request.url);
  const page = Math.max(Number(searchParams.get("page") ?? "1") || 1, 1);
  const pageSize = Math.min(
    Math.max(Number(searchParams.get("pageSize") ?? "10") || 10, 1),
    50,
  );
  const scope = searchParams.get("scope")?.trim();
  const owner = searchParams.get("owner")?.trim();
  const status = searchParams.get("status")?.trim();
  const from = searchParams.get("from");
  const to = searchParams.get("to");

  const query: Record<string, unknown> = {};

  if (scope === "mine") {
    query.partnerId = new Types.ObjectId(session.user.id);
  } else if (scope === "others") {
    query.partnerId = { $ne: new Types.ObjectId(session.user.id) };
  } else if (owner) {
    query.partnerId = new Types.ObjectId(owner);
  }

  if (status && ["pending", "approved", "rejected"].includes(status)) {
    query.status = status;
  }

  if (from || to) {
    query.investedAt = {};

    if (from) {
      query.investedAt = {
        ...(query.investedAt as Record<string, unknown>),
        $gte: new Date(from),
      };
    }

    if (to) {
      const endDate = new Date(to);
      endDate.setHours(23, 59, 59, 999);
      query.investedAt = {
        ...(query.investedAt as Record<string, unknown>),
        $lte: endDate,
      };
    }
  }

  const [partners, totalCount, investments, approvedInvestments, balance] =
    await Promise.all([
      UserModel.find({ role: "partner", isActive: true })
        .sort({ name: 1 })
        .lean(),
      InvestmentModel.countDocuments(query),
      InvestmentModel.find(query)
        .sort({ investedAt: -1, createdAt: -1 })
        .skip((page - 1) * pageSize)
        .limit(pageSize)
        .lean(),
      InvestmentModel.find({ status: "approved" }).lean(),
      getCurrentBalanceSnapshot(),
    ]);

  const partnerNameById = new Map(
    partners.map((partner) => [partner._id.toString(), partner.name]),
  );

  const approvedTotalByPartnerId = new Map<string, number>();

  for (const investment of approvedInvestments) {
    const partnerId = investment.partnerId.toString();
    const currentTotal = approvedTotalByPartnerId.get(partnerId) ?? 0;

    approvedTotalByPartnerId.set(
      partnerId,
      currentTotal + decimalToNumber(investment.amount),
    );
  }

  return NextResponse.json({
    balance,
    partners: partners.map((partner) => ({
      id: partner._id.toString(),
      name: partner.name,
      email: partner.email,
    })),
    approvedTotals: partners.map((partner) => ({
      partnerId: partner._id.toString(),
      partnerName: partner.name,
      totalApprovedInvestment:
        approvedTotalByPartnerId.get(partner._id.toString()) ?? 0,
    })),
    investments: investments.map((investment) => {
      const approvals = toApprovals(investment.approvals);

      return {
        id: investment._id.toString(),
        partnerId: investment.partnerId.toString(),
        partnerName:
          partnerNameById.get(investment.partnerId.toString()) ??
          "Unknown partner",
        amount: decimalToNumber(investment.amount),
        note: investment.note ?? null,
        status: investment.status,
        submittedAt: toIsoDate(investment.submittedAt, investment.createdAt),
        requiredApprovalCount: toRequiredApprovalCount(investment),
        approvalCount: approvals.length,
        canReview:
          investment.partnerId.toString() !== session.user.id &&
          investment.status === "pending" &&
          !approvals.some(
            (approval) => approval.partnerId.toString() === session.user.id,
          ),
        approvals: approvals.map((approval) => ({
          partnerId: approval.partnerId.toString(),
          partnerName:
            partnerNameById.get(approval.partnerId.toString()) ??
            "Unknown partner",
          decision: approval.decision,
          comment: approval.comment ?? null,
          decidedAt: approval.decidedAt.toISOString(),
        })),
        investedAt: toIsoDate(investment.investedAt, investment.createdAt),
      };
    }),
    pagination: {
      page,
      pageSize,
      totalCount,
      totalPages: Math.max(Math.ceil(totalCount / pageSize), 1),
    },
  });
}

export async function POST(request: Request) {
  const session = await getRequiredSession(["partner"]);

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = createInvestmentSchema.safeParse(await request.json());

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten() },
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
    const investment = await reviewInvestment({
      ...parsed.data,
      partnerId: session.user.id,
    });

    return NextResponse.json({ status: investment.status });
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
