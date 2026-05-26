import { HydratedDocument, Types } from "mongoose";

import { connectToDatabase } from "@/lib/db";
import { buildSaleLineSnapshot } from "@/lib/domain/stock-calculations";
import { buildPerfumeSaleFinancials } from "@/lib/domain/perfume-pricing";
import { recordHistoryEvent } from "@/lib/services/history";
import { decimalToNumber, toDecimal128 } from "@/lib/money";
import PerfumePricingRuleModel from "@/models/PerfumePricingRule";
import ProductModel from "@/models/Product";
import SaleModel, { type Sale } from "@/models/Sale";
import VariantModel from "@/models/Variant";

function buildSaleNumber() {
  return `SALE-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
}

function normalizeSnapshotValue(value: string | null | undefined, fallback: string) {
  const normalized = value?.trim();

  return normalized ? normalized : fallback;
}

export async function createSale(input: {
  soldBy: string;
  soldByName: string;
  soldByRole: string;
  paymentMethod: string;
  saleDate: Date;
  discountAmount?: number;
  note?: string;
  items: Array<
    | {
        mode?: "standard";
        variantId: string;
        qty: number;
        sellingPrice?: number;
      }
    | {
        mode: "perfume";
        pricingRuleId: string;
        soldMl: number;
      }
  >;
}): Promise<HydratedDocument<Sale>> {
  await connectToDatabase();

  const saleItems = [];
  let subtotal = 0;

  for (const item of input.items) {
    if (item.mode === "perfume") {
      const pricingRule = await PerfumePricingRuleModel.findById(
        item.pricingRuleId,
      );

      if (!pricingRule || !pricingRule.isActive) {
        throw new Error("perfume pricing rule not found");
      }

      const [perfumeVariant, bottleVariant] = await Promise.all([
        VariantModel.findById(pricingRule.perfumeVariantId),
        VariantModel.findById(pricingRule.bottleVariantId),
      ]);

      if (!perfumeVariant || perfumeVariant.inventoryMode !== "volume") {
        throw new Error("perfume variant not found");
      }

      if (!bottleVariant || bottleVariant.inventoryMode !== "packaging") {
        throw new Error("perfume bottle variant not found");
      }

      const [perfumeProduct, bottleProduct] = await Promise.all([
        ProductModel.findById(perfumeVariant.productId),
        ProductModel.findById(bottleVariant.productId),
      ]);

      if (!perfumeProduct || !bottleProduct) {
        throw new Error("product not found");
      }

      const perfumeVariantUpdated = await VariantModel.findOneAndUpdate(
        {
          _id: perfumeVariant._id,
          stockQty: { $gte: item.soldMl },
        },
        { $inc: { stockQty: -item.soldMl } },
        { returnDocument: "after" },
      );

      if (!perfumeVariantUpdated) {
        throw new Error("sold quantity exceeds stock");
      }

      const bottleVariantUpdated = await VariantModel.findOneAndUpdate(
        {
          _id: bottleVariant._id,
          stockQty: { $gte: 1 },
        },
        { $inc: { stockQty: -1 } },
        { returnDocument: "after" },
      );

      if (!bottleVariantUpdated) {
        await VariantModel.updateOne(
          { _id: perfumeVariant._id },
          { $inc: { stockQty: item.soldMl } },
        );
        throw new Error("sold quantity exceeds stock");
      }

      const avgCostPerMl = decimalToNumber(perfumeVariant.avgCost);
      const bottleBuyingCost = decimalToNumber(bottleVariant.avgCost);
      const bottleSellingPrice = decimalToNumber(
        pricingRule.bottleSellingPrice,
      );
      const financials = buildPerfumeSaleFinancials({
        avgCostPerMl,
        soldMl: item.soldMl,
        bottleBuyingCost,
        bottleSellingPrice,
      });

      subtotal += financials.sellingPrice;

      saleItems.push({
        variantId: perfumeVariant._id,
        saleMode: "perfume",
        productSnapshot: perfumeProduct.name,
        skuSnapshot: perfumeVariant.sku,
        colorSnapshot: normalizeSnapshotValue(perfumeVariant.color, "N/A"),
        sizeSnapshot: normalizeSnapshotValue(perfumeVariant.size, "N/A"),
        qty: 1,
        sellingPriceSnapshot: toDecimal128(financials.sellingPrice),
        avgCostSnapshot: toDecimal128(financials.totalCost),
        profitPerUnitSnapshot: toDecimal128(financials.profit),
        lineSubtotal: toDecimal128(financials.sellingPrice),
        lineDiscount: toDecimal128(0),
        lineTotal: toDecimal128(financials.sellingPrice),
        perfumeFillMl: item.soldMl,
        packagingVariantId: bottleVariant._id,
        packagingSkuSnapshot: bottleVariant.sku,
        packagingSizeSnapshot: bottleVariant.size,
        packagingCostSnapshot: toDecimal128(bottleBuyingCost),
        packagingSellingPriceSnapshot: toDecimal128(bottleSellingPrice),
        liquidCostSnapshot: toDecimal128(financials.liquidCost),
        returnedQty: 0,
        damagedQty: 0,
      });

      continue;
    }

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
      saleMode: "standard",
      productSnapshot: product.name,
      skuSnapshot: variant.sku,
      colorSnapshot: normalizeSnapshotValue(variant.color, "N/A"),
      sizeSnapshot: normalizeSnapshotValue(variant.size, "N/A"),
      qty: item.qty,
      sellingPriceSnapshot: toDecimal128(sellingPrice),
      avgCostSnapshot: toDecimal128(avgCost),
      profitPerUnitSnapshot: toDecimal128(snapshot.profitPerItem),
      lineSubtotal: toDecimal128(lineSubtotal),
      lineDiscount: toDecimal128(0),
      lineTotal: toDecimal128(lineSubtotal),
      perfumeFillMl: null,
      packagingVariantId: null,
      packagingSkuSnapshot: null,
      packagingSizeSnapshot: null,
      packagingCostSnapshot: null,
      packagingSellingPriceSnapshot: null,
      liquidCostSnapshot: null,
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

  const sale = await SaleModel.create({
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

  await recordHistoryEvent({
    actorId: input.soldBy,
    actorName: input.soldByName,
    actorRole: input.soldByRole,
    module: "sales",
    entityType: "sale",
    entityId: sale._id.toString(),
    entityLabel: sale.saleNumber,
    action: "create",
    summary: `Sale created: ${sale.saleNumber}`,
    before: null,
    after: {
      paymentMethod: input.paymentMethod,
      itemCount: sale.items.length,
      grandTotal: grandTotal,
      saleDate: input.saleDate.toISOString(),
      note: input.note?.trim() || null,
    },
  });

  return sale;
}
