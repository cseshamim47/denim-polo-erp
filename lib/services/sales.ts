import { HydratedDocument, Types } from "mongoose";

import { connectToDatabase } from "@/lib/db";
import { buildSaleLineSnapshot } from "@/lib/domain/stock-calculations";
import { decimalToNumber, toDecimal128 } from "@/lib/money";
import ProductModel from "@/models/Product";
import SaleModel, { type Sale } from "@/models/Sale";
import VariantModel from "@/models/Variant";

function buildSaleNumber() {
  return `SALE-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
}

export async function createSale(input: {
  soldBy: string;
  paymentMethod: string;
  saleDate: Date;
  discountAmount?: number;
  note?: string;
  items: Array<{
    variantId: string;
    qty: number;
    sellingPrice?: number;
  }>;
}): Promise<HydratedDocument<Sale>> {
  await connectToDatabase();

  const saleItems = [];
  let subtotal = 0;

  for (const item of input.items) {
    const variant = await VariantModel.findById(item.variantId);

    if (!variant) {
      throw new Error("variant not found");
    }

    const product = await ProductModel.findById(variant.productId);

    if (!product) {
      throw new Error("product not found");
    }

    const sellingPrice =
      item.sellingPrice ?? decimalToNumber(variant.sellingPrice);
    const avgCost = decimalToNumber(variant.avgCost);
    const snapshot = buildSaleLineSnapshot({
      stockQty: variant.stockQty,
      soldQty: item.qty,
      sellingPrice,
      avgCostAtTimeOfSale: avgCost,
    });

    const updatedVariant = await VariantModel.findOneAndUpdate(
      {
        _id: variant._id,
        stockQty: { $gte: item.qty },
      },
      {
        $inc: { stockQty: -item.qty },
      },
      {
        returnDocument: "after",
      },
    );

    if (!updatedVariant) {
      throw new Error("sold quantity exceeds stock");
    }

    const lineSubtotal = sellingPrice * item.qty;
    subtotal += lineSubtotal;

    saleItems.push({
      variantId: variant._id,
      productSnapshot: product.name,
      skuSnapshot: variant.sku,
      colorSnapshot: variant.color,
      sizeSnapshot: variant.size,
      qty: item.qty,
      sellingPriceSnapshot: toDecimal128(sellingPrice),
      avgCostSnapshot: toDecimal128(avgCost),
      profitPerUnitSnapshot: toDecimal128(snapshot.profitPerItem),
      lineSubtotal: toDecimal128(lineSubtotal),
      lineDiscount: toDecimal128(0),
      lineTotal: toDecimal128(lineSubtotal),
      returnedQty: 0,
      damagedQty: 0,
    });
  }

  const maxDiscountAllowed = Math.min(50, subtotal * 0.05);
  const discountAmount = Math.max(input.discountAmount ?? 0, 0);

  if (discountAmount > maxDiscountAllowed) {
    throw new Error(
      `discount exceeds allowed threshold (${maxDiscountAllowed.toFixed(2)})`,
    );
  }

  const grandTotal = subtotal - discountAmount;

  return SaleModel.create({
    saleNumber: buildSaleNumber(),
    items: saleItems,
    subtotal: toDecimal128(subtotal),
    discountTotal: toDecimal128(discountAmount),
    grandTotal: toDecimal128(grandTotal),
    paymentMethod: input.paymentMethod,
    note: input.note?.trim() || null,
    soldBy: new Types.ObjectId(input.soldBy),
    saleDate: input.saleDate,
    status: "completed",
  });
}
