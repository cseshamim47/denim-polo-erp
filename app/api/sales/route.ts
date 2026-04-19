import { NextResponse } from "next/server";
import { z } from "zod";

import { getRequiredSession } from "@/lib/auth";
import { connectToDatabase } from "@/lib/db";
import { decimalToNumber } from "@/lib/money";
import { createSale } from "@/lib/services/sales";
import SaleModel from "@/models/Sale";

const saleSchema = z.object({
  paymentMethod: z.string().trim().min(1),
  saleDate: z.coerce.date(),
  items: z
    .array(
      z.object({
        variantId: z.string().trim().min(1),
        qty: z.number().int().positive(),
        sellingPrice: z.number().nonnegative().optional(),
      }),
    )
    .min(1),
});

export async function GET() {
  const session = await getRequiredSession(["partner", "salesman"]);

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await connectToDatabase();

  const sales = await SaleModel.find().sort({ saleDate: -1 }).limit(20).lean();

  return NextResponse.json({
    sales: sales.map((sale) => ({
      id: sale._id.toString(),
      saleNumber: sale.saleNumber,
      saleDate: sale.saleDate,
      paymentMethod: sale.paymentMethod,
      grandTotal: decimalToNumber(sale.grandTotal),
      itemCount: sale.items.length,
      status: sale.status,
      items: sale.items.map((item) => ({
        id: item._id?.toString() ?? "",
        variantId: item.variantId.toString(),
        productSnapshot: item.productSnapshot,
        skuSnapshot: item.skuSnapshot,
        colorSnapshot: item.colorSnapshot,
        sizeSnapshot: item.sizeSnapshot,
        qty: item.qty,
        returnedQty: item.returnedQty,
        damagedQty: item.damagedQty,
      })),
    })),
  });
}

export async function POST(request: Request) {
  const session = await getRequiredSession(["partner", "salesman"]);

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = saleSchema.safeParse(await request.json());

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten() },
      { status: 400 },
    );
  }

  try {
    const sale = await createSale({
      ...parsed.data,
      soldBy: session.user.id,
    });

    return NextResponse.json({ saleId: sale._id.toString() }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Unable to create sale",
      },
      { status: 400 },
    );
  }
}
