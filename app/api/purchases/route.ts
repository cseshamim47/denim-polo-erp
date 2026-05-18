import { NextResponse } from "next/server";
import { z } from "zod";

import { getRequiredSession } from "@/lib/auth";
import {
  createPurchase,
  listPurchases,
  reviewPurchases,
} from "@/lib/services/purchases";

const purchaseSchema = z.object({
  variantId: z.string().trim().min(1),
  qty: z.number().int().positive(),
  costPerUnit: z.number().nonnegative(),
  additionalCost: z.number().nonnegative().optional(),
  purchaseDate: z.coerce.date(),
  billImageUrl: z.string().trim().optional(),
  note: z.string().trim().optional(),
});

const reviewPurchaseSchema = z.union([
  z.object({
    purchaseId: z.string().trim().min(1),
    decision: z.enum(["approved", "rejected"]),
    comment: z.string().trim().optional(),
  }),
  z.object({
    purchaseIds: z.array(z.string().trim().min(1)).min(1),
    decision: z.enum(["approved", "rejected"]),
    comment: z.string().trim().optional(),
  }),
]);

export async function GET(request: Request) {
  const session = await getRequiredSession(["partner"]);

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const search = url.searchParams.get("search") ?? "";
  const from = url.searchParams.get("from");
  const to = url.searchParams.get("to");
  const page = Number(url.searchParams.get("page") ?? "1");
  const pageSize = Number(url.searchParams.get("pageSize") ?? "20");

  try {
    const result = await listPurchases({
      actorId: session.user.id,
      search,
      from: from ? new Date(`${from}T00:00:00.000Z`) : undefined,
      to: to ? new Date(`${to}T23:59:59.999Z`) : undefined,
      page,
      pageSize,
      needsReview: url.searchParams.get("needsReview") === "true",
    });

    return NextResponse.json(
      {
        purchases: result.items,
        pagination: {
          total: result.total,
          page: result.page,
          pageSize: result.pageSize,
          totalPages: result.totalPages,
        },
      },
      { status: 200 },
    );
  } catch {
    return NextResponse.json(
      { error: "Unable to load purchases" },
      { status: 500 },
    );
  }
}

export async function PATCH(request: Request) {
  const session = await getRequiredSession(["partner"]);

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = reviewPurchaseSchema.safeParse(await request.json());

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten() },
      { status: 400 },
    );
  }

  try {
    const purchaseIds =
      "purchaseId" in parsed.data
        ? [parsed.data.purchaseId]
        : parsed.data.purchaseIds;
    const reviews = await reviewPurchases({
      purchaseIds,
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
          error instanceof Error ? error.message : "Unable to review purchase",
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

  const parsed = purchaseSchema.safeParse(await request.json());

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten() },
      { status: 400 },
    );
  }

  try {
    const purchase = await createPurchase({
      ...parsed.data,
      createdBy: session.user.id,
    });

    return NextResponse.json(
      { purchaseId: purchase._id.toString() },
      { status: 201 },
    );
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Unable to create purchase",
      },
      { status: 400 },
    );
  }
}
