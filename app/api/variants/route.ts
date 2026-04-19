import { NextResponse } from "next/server";
import { z } from "zod";

import { getRequiredSession } from "@/lib/auth";
import { connectToDatabase } from "@/lib/db";
import { decimalToNumber, toDecimal128 } from "@/lib/money";
import { generateVariantSku } from "@/lib/domain/sku";
import ProductModel from "@/models/Product";
import VariantModel from "@/models/Variant";

const createVariantSchema = z.object({
  productId: z.string().trim().min(1),
  color: z.string().trim().min(1),
  size: z.string().trim().min(1),
  barcode: z.string().trim().optional(),
  sellingPrice: z.number().nonnegative(),
  lowStockThreshold: z.number().int().nonnegative().default(0),
});

export async function GET(request: Request) {
  const session = await getRequiredSession(["partner", "salesman"]);

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await connectToDatabase();

  const { searchParams } = new URL(request.url);
  const productId = searchParams.get("productId")?.trim();
  const search = searchParams.get("search")?.trim().toUpperCase();
  const query: Record<string, unknown> = { isActive: true };

  if (productId) {
    query.productId = productId;
  }

  if (search) {
    query.$or = [
      { sku: { $regex: search, $options: "i" } },
      { color: { $regex: search, $options: "i" } },
      { size: { $regex: search, $options: "i" } },
    ];
  }

  const variants = await VariantModel.find(query).sort({ sku: 1 }).lean();

  return NextResponse.json({
    variants: variants.map((variant) => ({
      id: variant._id.toString(),
      productId: variant.productId.toString(),
      color: variant.color,
      size: variant.size,
      sku: variant.sku,
      stockQty: variant.stockQty,
      avgCost: decimalToNumber(variant.avgCost),
      sellingPrice: decimalToNumber(variant.sellingPrice),
      lowStockThreshold: variant.lowStockThreshold,
      isActive: variant.isActive,
    })),
  });
}

export async function POST(request: Request) {
  const session = await getRequiredSession(["partner"]);

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = createVariantSchema.safeParse(await request.json());

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten() },
      { status: 400 },
    );
  }

  await connectToDatabase();

  const product = await ProductModel.findById(parsed.data.productId);

  if (!product) {
    return NextResponse.json({ error: "Product not found" }, { status: 404 });
  }

  const variant: any = await VariantModel.create({
    productId: product._id,
    color: parsed.data.color.trim().toUpperCase(),
    size: parsed.data.size.trim().toUpperCase(),
    sku: generateVariantSku({
      category: product.category,
      color: parsed.data.color,
      size: parsed.data.size,
    }),
    barcode: parsed.data.barcode ?? null,
    stockQty: 0,
    avgCost: toDecimal128(0),
    sellingPrice: toDecimal128(parsed.data.sellingPrice),
    lowStockThreshold: parsed.data.lowStockThreshold,
    isActive: true,
  });

  return NextResponse.json(
    {
      variant: {
        id: variant._id.toString(),
        sku: variant.sku,
      },
    },
    { status: 201 },
  );
}
