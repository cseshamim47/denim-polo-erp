import { Types } from "mongoose";

import { connectToDatabase } from "@/lib/db";
import { decimalToNumber, toDecimal128 } from "@/lib/money";
import { applyPurchaseToVariant } from "@/lib/domain/stock-calculations";
import PurchaseModel from "@/models/Purchase";
import VariantModel from "@/models/Variant";

export async function createPurchase(input: {
  variantId: string;
  qty: number;
  costPerUnit: number;
  purchaseDate: Date;
  createdBy: string;
  billImageUrl?: string;
  note?: string;
}): Promise<any> {
  await connectToDatabase();

  const variant = await VariantModel.findById(input.variantId);

  if (!variant) {
    throw new Error("variant not found");
  }

  const { newStock, newAvgCost } = applyPurchaseToVariant({
    oldStock: variant.stockQty,
    oldAvgCost: decimalToNumber(variant.avgCost),
    purchaseQty: input.qty,
    costPerUnit: input.costPerUnit,
  });

  variant.stockQty = newStock;
  variant.avgCost = toDecimal128(newAvgCost) as never;
  await variant.save();

  const totalCost = input.qty * input.costPerUnit;

  return PurchaseModel.create({
    variantId: new Types.ObjectId(input.variantId),
    qty: input.qty,
    costPerUnit: toDecimal128(input.costPerUnit),
    totalCost: toDecimal128(totalCost),
    billImageUrl: input.billImageUrl ?? null,
    purchaseDate: input.purchaseDate,
    note: input.note ?? null,
    createdBy: new Types.ObjectId(input.createdBy),
  });
}
