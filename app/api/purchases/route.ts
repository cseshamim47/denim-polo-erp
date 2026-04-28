import { NextResponse } from "next/server";
import { z } from "zod";

import { getRequiredSession } from "@/lib/auth";
import { createPurchase, listPurchases } from "@/lib/services/purchases";

const purchaseSchema = z.object({
  variantId: z.string().trim().min(1),
  qty: z.number().int().positive(),
  costPerUnit: z.number().nonnegative(),
  additionalCost: z.number().nonnegative().optional(),
  purchaseDate: z.coerce.date(),
  billImageUrl: z.string().trim().optional(),
  note: z.string().trim().optional(),
});

export async function GET(request: Request) {
  const session = await getRequiredSession(["partner"]);

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const search = url.searchParams.get("search") ?? "";
  const from = url.searchParams.get("from");
  const to = url.searchParams.get("to");

  try {
    const purchases = await listPurchases({
      search,
      from: from ? new Date(`${from}T00:00:00.000Z`) : undefined,
      to: to ? new Date(`${to}T23:59:59.999Z`) : undefined,
    });

    return NextResponse.json({ purchases }, { status: 200 });
  } catch {
    return NextResponse.json(
      { error: "Unable to load purchases" },
      { status: 500 },
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
