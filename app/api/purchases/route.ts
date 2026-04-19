import { NextResponse } from "next/server";
import { z } from "zod";

import { getRequiredSession } from "@/lib/auth";
import { createPurchase } from "@/lib/services/purchases";

const purchaseSchema = z.object({
  variantId: z.string().trim().min(1),
  qty: z.number().int().positive(),
  costPerUnit: z.number().nonnegative(),
  purchaseDate: z.coerce.date(),
  billImageUrl: z.string().trim().optional(),
  note: z.string().trim().optional(),
});

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
