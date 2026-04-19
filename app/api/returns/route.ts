import { NextResponse } from "next/server";
import { z } from "zod";

import { getRequiredSession } from "@/lib/auth";
import { createReturn } from "@/lib/services/returns";

const returnSchema = z.object({
  saleId: z.string().trim().min(1),
  saleLineId: z.string().trim().min(1),
  qty: z.number().int().positive(),
  returnType: z.enum(["customer_return", "damaged"]),
  note: z.string().trim().optional(),
  returnDate: z.coerce.date(),
});

export async function POST(request: Request) {
  const session = await getRequiredSession(["partner"]);

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = returnSchema.safeParse(await request.json());

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten() },
      { status: 400 },
    );
  }

  try {
    const returnRecord = await createReturn({
      ...parsed.data,
      processedBy: session.user.id,
    });

    return NextResponse.json(
      { returnId: returnRecord._id.toString() },
      { status: 201 },
    );
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Unable to process return",
      },
      { status: 400 },
    );
  }
}
