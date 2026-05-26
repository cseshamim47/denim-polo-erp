import { HydratedDocument, Types } from "mongoose";

import { connectToDatabase } from "@/lib/db";
import {
  applyCustomerReturn,
  applyDamagedReturn,
} from "@/lib/domain/stock-calculations";
import { recordHistoryEvent } from "@/lib/services/history";
import { decimalToNumber, toDecimal128 } from "@/lib/money";
import ReturnModel, { type ReturnRecord } from "@/models/Return";
import SaleModel from "@/models/Sale";
import VariantModel from "@/models/Variant";

export async function createReturn(input: {
  saleId: string;
  saleLineId: string;
  qty: number;
  returnType: "customer_return" | "damaged";
  note?: string;
  processedBy: string;
  processedByName: string;
  returnDate: Date;
}): Promise<HydratedDocument<ReturnRecord>> {
  await connectToDatabase();

  const sale = await SaleModel.findById(input.saleId);

  if (!sale) {
    throw new Error("sale not found");
  }

  const saleLine = sale.items.find(
    (item) => item._id?.toString() === input.saleLineId,
  );

  if (!saleLine) {
    throw new Error("sale line not found");
  }

  const variant = await VariantModel.findById(saleLine.variantId);

  if (!variant) {
    throw new Error("variant not found");
  }

  const baseInput = {
    currentStock: variant.stockQty,
    soldQty: saleLine.qty,
    alreadyReturnedQty: saleLine.returnedQty,
    alreadyDamagedQty: saleLine.damagedQty,
    profitPerItemSnapshot: decimalToNumber(saleLine.profitPerUnitSnapshot),
  };

  let lossAmount = 0;

  if (input.returnType === "customer_return") {
    const result = applyCustomerReturn({
      ...baseInput,
      returnedQty: input.qty,
    });

    variant.stockQty = result.newStock;
    saleLine.returnedQty += result.resolvedQty;
  } else {
    const result = applyDamagedReturn({
      ...baseInput,
      damagedQty: input.qty,
      avgCostSnapshot: decimalToNumber(saleLine.avgCostSnapshot),
    });

    lossAmount = result.lossAmount;
    saleLine.damagedQty += result.resolvedQty;
  }

  await variant.save();
  await sale.save();

  const returnRecord = await ReturnModel.create({
    saleId: new Types.ObjectId(input.saleId),
    saleLineId: new Types.ObjectId(input.saleLineId),
    variantId: new Types.ObjectId(variant._id),
    qty: input.qty,
    returnType: input.returnType,
    lossAmount: toDecimal128(lossAmount),
    note: input.note ?? null,
    processedBy: new Types.ObjectId(input.processedBy),
    returnDate: input.returnDate,
  });

  await recordHistoryEvent({
    actorId: input.processedBy,
    actorName: input.processedByName,
    actorRole: "partner",
    module: "returns",
    entityType: "return",
    entityId: returnRecord._id.toString(),
    entityLabel: sale.saleNumber,
    action: "create",
    summary: `Return created: ${sale.saleNumber}`,
    before: null,
    after: {
      saleId: input.saleId,
      saleLineId: input.saleLineId,
      qty: input.qty,
      returnType: input.returnType,
      lossAmount,
      returnDate: input.returnDate.toISOString(),
      note: input.note ?? null,
    },
  });

  return returnRecord;
}
