import { HydratedDocument, Types } from "mongoose";

import { connectToDatabase } from "@/lib/db";
import { decimalToNumber, toDecimal128 } from "@/lib/money";
import { applyPurchaseToVariant } from "@/lib/domain/stock-calculations";
import PurchaseModel, { type Purchase } from "@/models/Purchase";
import ProductModel from "@/models/Product";
import VariantModel from "@/models/Variant";

export type PurchaseHistoryRecord = {
  id: string;
  purchaseDate: string;
  sku: string;
  productName: string;
  size: string;
  color: string;
  qty: number;
  costPerUnit: number;
  additionalCost: number;
  totalCost: number;
  cashOutTotal: number;
  note: string | null;
};

export async function createPurchase(input: {
  variantId: string;
  qty: number;
  costPerUnit: number;
  additionalCost?: number;
  purchaseDate: Date;
  createdBy: string;
  billImageUrl?: string;
  note?: string;
}): Promise<HydratedDocument<Purchase>> {
  await connectToDatabase();

  const variant = await VariantModel.findById(input.variantId);

  if (!variant) {
    throw new Error("variant not found");
  }

  const totalCost = input.qty * input.costPerUnit;
  const additionalCost = input.additionalCost ?? 0;
  const cashOutTotal = totalCost + additionalCost;
  const landedCostPerUnit = cashOutTotal / input.qty;

  const { newStock, newAvgCost } = applyPurchaseToVariant({
    oldStock: variant.stockQty,
    oldAvgCost: decimalToNumber(variant.avgCost),
    purchaseQty: input.qty,
    costPerUnit: landedCostPerUnit,
  });

  variant.stockQty = newStock;
  variant.avgCost = toDecimal128(newAvgCost) as never;
  await variant.save();

  return PurchaseModel.create({
    variantId: new Types.ObjectId(input.variantId),
    qty: input.qty,
    costPerUnit: toDecimal128(input.costPerUnit),
    landedCostPerUnit: toDecimal128(landedCostPerUnit),
    totalCost: toDecimal128(totalCost),
    additionalCost: toDecimal128(additionalCost),
    cashOutTotal: toDecimal128(cashOutTotal),
    billImageUrl: input.billImageUrl ?? null,
    purchaseDate: input.purchaseDate,
    note: input.note ?? null,
    createdBy: new Types.ObjectId(input.createdBy),
  });
}

export async function listPurchases(input?: {
  search?: string;
  from?: Date;
  to?: Date;
  limit?: number;
}): Promise<PurchaseHistoryRecord[]> {
  await connectToDatabase();

  const query: Record<string, unknown> = {};

  if (input?.from || input?.to) {
    query.purchaseDate = {
      ...(input.from ? { $gte: input.from } : {}),
      ...(input.to ? { $lte: input.to } : {}),
    };
  }

  const purchases = await PurchaseModel.find(query)
    .sort({ purchaseDate: -1, createdAt: -1 })
    .limit(input?.limit ?? 200)
    .lean();

  if (purchases.length === 0) {
    return [];
  }

  const variantIds = Array.from(
    new Set(purchases.map((purchase) => purchase.variantId.toString())),
  );

  const variants = await VariantModel.find({ _id: { $in: variantIds } })
    .select({ sku: 1, size: 1, color: 1, productId: 1 })
    .lean();

  const productIds = Array.from(
    new Set(variants.map((variant) => variant.productId.toString())),
  );

  const products = await ProductModel.find({ _id: { $in: productIds } })
    .select({ name: 1 })
    .lean();

  const variantById = new Map(variants.map((variant) => [variant._id.toString(), variant]));
  const productNameById = new Map(
    products.map((product) => [product._id.toString(), product.name]),
  );

  const records = purchases.map((purchase) => {
    const variant = variantById.get(purchase.variantId.toString());
    const productName = variant
      ? productNameById.get(variant.productId.toString()) ?? "Unknown product"
      : "Unknown product";

    return {
      id: purchase._id.toString(),
      purchaseDate: purchase.purchaseDate.toISOString(),
      sku: variant?.sku ?? "Unknown SKU",
      productName,
      size: variant?.size ?? "-",
      color: variant?.color ?? "-",
      qty: purchase.qty,
      costPerUnit: decimalToNumber(purchase.costPerUnit),
      additionalCost: decimalToNumber(purchase.additionalCost),
      totalCost: decimalToNumber(purchase.totalCost),
      cashOutTotal: decimalToNumber(purchase.cashOutTotal),
      note: purchase.note ?? null,
    };
  });

  const normalizedSearch = input?.search?.trim().toLocaleLowerCase();

  if (!normalizedSearch) {
    return records;
  }

  return records.filter((record) => {
    return (
      record.sku.toLocaleLowerCase().includes(normalizedSearch) ||
      record.productName.toLocaleLowerCase().includes(normalizedSearch) ||
      record.size.toLocaleLowerCase().includes(normalizedSearch) ||
      record.color.toLocaleLowerCase().includes(normalizedSearch) ||
      (record.note ?? "").toLocaleLowerCase().includes(normalizedSearch)
    );
  });
}
