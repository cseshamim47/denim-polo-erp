import { Types } from "mongoose";

import { connectToDatabase } from "@/lib/db";
import { decimalToNumber, toDecimal128 } from "@/lib/money";
import PerfumePricingRuleModel from "@/models/PerfumePricingRule";
import ProductModel from "@/models/Product";
import VariantModel from "@/models/Variant";

type PerfumeRuleListFilters = {
  perfumeVariantId?: string | null;
  bottleVariantId?: string | null;
};

export async function listPerfumePricingRules(filters: PerfumeRuleListFilters) {
  await connectToDatabase();

  const query: Record<string, unknown> = {};

  if (filters.perfumeVariantId) {
    query.perfumeVariantId = new Types.ObjectId(filters.perfumeVariantId);
  }

  if (filters.bottleVariantId) {
    query.bottleVariantId = new Types.ObjectId(filters.bottleVariantId);
  }

  const [rules, perfumeVariants, bottleVariants] = await Promise.all([
    PerfumePricingRuleModel.find(query).sort({
      perfumeVariantId: 1,
      fillMl: 1,
      createdAt: -1,
    }).lean(),
    VariantModel.find({
      isActive: true,
      inventoryMode: "volume",
    })
      .select({ productId: 1, sku: 1, size: 1, stockQty: 1, unitLabel: 1 })
      .sort({ sku: 1 })
      .lean(),
    VariantModel.find({
      isActive: true,
      inventoryMode: "packaging",
    })
      .select({
        productId: 1,
        sku: 1,
        size: 1,
        stockQty: 1,
        unitLabel: 1,
        sellingPrice: 1,
      })
      .sort({ sku: 1 })
      .lean(),
  ]);

  const productIds = Array.from(
    new Set(
      [...perfumeVariants, ...bottleVariants].map((variant) =>
        variant.productId.toString(),
      ),
    ),
  );

  const products = await ProductModel.find({ _id: { $in: productIds } })
    .select({ name: 1, category: 1 })
    .lean();

  const productById = new Map(
    products.map((product) => [product._id.toString(), product]),
  );
  const perfumeVariantById = new Map(
    perfumeVariants.map((variant) => [variant._id.toString(), variant]),
  );
  const bottleVariantById = new Map(
    bottleVariants.map((variant) => [variant._id.toString(), variant]),
  );

  return {
    rules: rules.map((rule) => {
      const perfumeVariant = perfumeVariantById.get(rule.perfumeVariantId.toString());
      const bottleVariant = bottleVariantById.get(rule.bottleVariantId.toString());
      const perfumeProduct = perfumeVariant
        ? productById.get(perfumeVariant.productId.toString())
        : null;
      const bottleProduct = bottleVariant
        ? productById.get(bottleVariant.productId.toString())
        : null;

      return {
        id: rule._id.toString(),
        perfumeVariantId: rule.perfumeVariantId.toString(),
        perfumeLabel: perfumeVariant
          ? `${perfumeProduct?.name ?? "Unknown perfume"} · ${perfumeVariant.sku}`
          : "Unknown perfume",
        bottleVariantId: rule.bottleVariantId.toString(),
        bottleLabel: bottleVariant
          ? `${bottleProduct?.name ?? "Bottle"} · ${bottleVariant.size}`
          : "Unknown bottle",
        fillMl: rule.fillMl,
        bottleSellingPrice: decimalToNumber(rule.bottleSellingPrice),
        isActive: rule.isActive,
      };
    }),
    perfumes: perfumeVariants.map((variant) => ({
      id: variant._id.toString(),
      productId: variant.productId.toString(),
      productName:
        productById.get(variant.productId.toString())?.name ?? "Unknown perfume",
      sku: variant.sku,
      size: variant.size,
      stockQty: variant.stockQty,
      unitLabel: variant.unitLabel ?? "ML",
    })),
    bottles: bottleVariants.map((variant) => ({
      id: variant._id.toString(),
      productId: variant.productId.toString(),
      productName:
        productById.get(variant.productId.toString())?.name ?? "Unknown bottle",
      sku: variant.sku,
      size: variant.size,
      stockQty: variant.stockQty,
      unitLabel: variant.unitLabel ?? "PCS",
      defaultSellingPrice: decimalToNumber(variant.sellingPrice),
    })),
  };
}

export async function createPerfumePricingRule(input: {
  perfumeVariantId: string;
  bottleVariantId: string;
  fillMl: number;
  bottleSellingPrice: number;
}) {
  await connectToDatabase();

  const rule = await PerfumePricingRuleModel.create({
    perfumeVariantId: new Types.ObjectId(input.perfumeVariantId),
    bottleVariantId: new Types.ObjectId(input.bottleVariantId),
    fillMl: input.fillMl,
    bottleSellingPrice: toDecimal128(input.bottleSellingPrice),
    isActive: true,
  });

  return {
    id: rule._id.toString(),
  };
}

export async function updatePerfumePricingRule(input: {
  ruleId: string;
  fillMl?: number;
  bottleSellingPrice?: number;
  isActive?: boolean;
}) {
  await connectToDatabase();

  const update: Record<string, unknown> = {};

  if (typeof input.fillMl === "number") {
    update.fillMl = input.fillMl;
  }

  if (typeof input.bottleSellingPrice === "number") {
    update.bottleSellingPrice = toDecimal128(input.bottleSellingPrice);
  }

  if (typeof input.isActive === "boolean") {
    update.isActive = input.isActive;
  }

  const rule = await PerfumePricingRuleModel.findByIdAndUpdate(
    input.ruleId,
    { $set: update },
    { returnDocument: "after" },
  );

  if (!rule) {
    throw new Error("Perfume pricing rule not found");
  }

  return {
    id: rule._id.toString(),
  };
}
