import { NextResponse } from "next/server";
import { z } from "zod";

import { getRequiredSession } from "@/lib/auth";
import { connectToDatabase } from "@/lib/db";
import ProductModel from "@/models/Product";

const createProductSchema = z.object({
  name: z.string().trim().min(1),
  category: z.string().trim().min(1),
  description: z.string().trim().optional(),
});

export async function GET(request: Request) {
  const session = await getRequiredSession(["partner", "salesman"]);

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await connectToDatabase();

  const { searchParams } = new URL(request.url);
  const category = searchParams.get("category")?.trim().toUpperCase();
  const query = category ? { isActive: true, category } : { isActive: true };
  const products = await ProductModel.find(query)
    .sort({ category: 1, name: 1 })
    .lean();

  return NextResponse.json({
    products: products.map((product) => ({
      id: product._id.toString(),
      name: product.name,
      category: product.category,
      description: product.description,
      isActive: product.isActive,
    })),
  });
}

export async function POST(request: Request) {
  const session = await getRequiredSession(["partner"]);

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = createProductSchema.safeParse(await request.json());

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten() },
      { status: 400 },
    );
  }

  await connectToDatabase();

  const product = await ProductModel.create({
    name: parsed.data.name,
    category: parsed.data.category.trim().toUpperCase(),
    description: parsed.data.description ?? null,
    isActive: true,
  });

  return NextResponse.json(
    {
      product: {
        id: product._id.toString(),
        name: product.name,
        category: product.category,
      },
    },
    { status: 201 },
  );
}
