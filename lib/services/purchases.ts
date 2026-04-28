import { HydratedDocument, Types } from "mongoose";

import { connectToDatabase } from "@/lib/db";
import { decimalToNumber, toDecimal128 } from "@/lib/money";
import { applyPurchaseToVariant } from "@/lib/domain/stock-calculations";
import PurchaseModel, { type Purchase } from "@/models/Purchase";
import VariantModel from "@/models/Variant";

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
