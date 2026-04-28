import { NextResponse } from "next/server";
import { z } from "zod";

import { getRequiredSession } from "@/lib/auth";
import { connectToDatabase } from "@/lib/db";
import { decimalToNumber } from "@/lib/money";
import { createSale } from "@/lib/services/sales";
import SaleModel from "@/models/Sale";

function parseDateOnly(dateValue: string, endOfDay: boolean) {
  const trimmed = dateValue.trim();

  if (!trimmed) {
    return null;
  }

  const normalized = `${trimmed}${endOfDay ? "T23:59:59.999Z" : "T00:00:00.000Z"}`;
  const parsed = new Date(normalized);

  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return parsed;
}

const saleSchema = z.object({
  paymentMethod: z.string().trim().min(1),
  saleDate: z.coerce.date(),
  discountAmount: z.number().nonnegative().optional(),
  note: z.string().trim().optional(),
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

export async function GET(request: Request) {
  const session = await getRequiredSession(["partner", "salesman"]);

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await connectToDatabase();

  const { searchParams } = new URL(request.url);
  const search = searchParams.get("search")?.trim() ?? "";
  const paymentMethod = searchParams.get("paymentMethod")?.trim() ?? "";
  const status = searchParams.get("status")?.trim() ?? "";
  const fromDate = searchParams.get("from") ?? "";
  const toDate = searchParams.get("to") ?? "";

  const filters: Record<string, unknown> = {};

  if (paymentMethod) {
    filters.paymentMethod = paymentMethod;
  }

  if (status) {
    filters.status = status;
  }

  const saleDateFilter: { $gte?: Date; $lte?: Date } = {};
  const parsedFromDate = parseDateOnly(fromDate, false);
  const parsedToDate = parseDateOnly(toDate, true);

  if (parsedFromDate) {
    saleDateFilter.$gte = parsedFromDate;
  }

  if (parsedToDate) {
    saleDateFilter.$lte = parsedToDate;
  }

  if (saleDateFilter.$gte || saleDateFilter.$lte) {
    filters.saleDate = saleDateFilter;
  }

  if (search) {
    const escapedSearch = search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const keywordRegex = new RegExp(escapedSearch, "i");

    filters.$or = [
      { saleNumber: keywordRegex },
      { "items.skuSnapshot": keywordRegex },
      { "items.productSnapshot": keywordRegex },
      { note: keywordRegex },
    ];
  }

  const sales = await SaleModel.find(filters)
    .sort({ saleDate: -1 })
    .limit(100)
    .lean();

  return NextResponse.json({
    sales: sales.map((sale) => ({
      id: sale._id.toString(),
      saleNumber: sale.saleNumber,
      saleDate: sale.saleDate,
      paymentMethod: sale.paymentMethod,
      subtotal: decimalToNumber(sale.subtotal),
      discountTotal: decimalToNumber(sale.discountTotal),
      grandTotal: decimalToNumber(sale.grandTotal),
      note: sale.note ?? null,
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
