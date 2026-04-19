const MONEY_SCALE = 10_000;

function toMoneyUnits(value: number): number {
  return Math.round(value * MONEY_SCALE);
}

function fromMoneyUnits(value: number): number {
  return value / MONEY_SCALE;
}

function ensurePositiveQuantity(quantity: number, fieldName: string) {
  if (quantity <= 0) {
    throw new Error(`${fieldName} must be greater than zero`);
  }
}

function ensureNonNegativeMoney(amount: number, fieldName: string) {
  if (amount < 0) {
    throw new Error(`${fieldName} cannot be negative`);
  }
}

function ensureReturnCapacity(input: {
  soldQty: number;
  alreadyReturnedQty: number;
  alreadyDamagedQty: number;
  requestedQty: number;
}) {
  const resolvedQty = input.alreadyReturnedQty + input.alreadyDamagedQty;
  const remainingQty = input.soldQty - resolvedQty;

  if (input.requestedQty > remainingQty) {
    throw new Error("return quantity exceeds remaining sold quantity");
  }
}

export function applyPurchaseToVariant(input: {
  oldStock: number;
  oldAvgCost: number;
  purchaseQty: number;
  costPerUnit: number;
}) {
  ensurePositiveQuantity(input.purchaseQty, "purchaseQty");
  ensureNonNegativeMoney(input.oldAvgCost, "oldAvgCost");
  ensureNonNegativeMoney(input.costPerUnit, "costPerUnit");

  const newStock = input.oldStock + input.purchaseQty;

  if (newStock <= 0) {
    throw new Error("new stock must be greater than zero");
  }

  const oldValue = input.oldStock * toMoneyUnits(input.oldAvgCost);
  const purchaseValue = input.purchaseQty * toMoneyUnits(input.costPerUnit);
  const newAvgCost = fromMoneyUnits(
    Math.round((oldValue + purchaseValue) / newStock),
  );

  return {
    newStock,
    newAvgCost,
  };
}

export function buildSaleLineSnapshot(input: {
  stockQty: number;
  soldQty: number;
  sellingPrice: number;
  avgCostAtTimeOfSale: number;
}) {
  ensurePositiveQuantity(input.soldQty, "soldQty");
  ensureNonNegativeMoney(input.sellingPrice, "sellingPrice");
  ensureNonNegativeMoney(input.avgCostAtTimeOfSale, "avgCostAtTimeOfSale");

  if (input.soldQty > input.stockQty) {
    throw new Error("sold quantity exceeds stock");
  }

  return {
    remainingStock: input.stockQty - input.soldQty,
    profitPerItem: fromMoneyUnits(
      toMoneyUnits(input.sellingPrice) -
        toMoneyUnits(input.avgCostAtTimeOfSale),
    ),
  };
}

export function applyCustomerReturn(input: {
  currentStock: number;
  returnedQty: number;
  soldQty: number;
  alreadyReturnedQty: number;
  alreadyDamagedQty: number;
  profitPerItemSnapshot: number;
}) {
  ensurePositiveQuantity(input.returnedQty, "returnedQty");
  ensureReturnCapacity({
    soldQty: input.soldQty,
    alreadyReturnedQty: input.alreadyReturnedQty,
    alreadyDamagedQty: input.alreadyDamagedQty,
    requestedQty: input.returnedQty,
  });

  return {
    newStock: input.currentStock + input.returnedQty,
    profitAdjustment: fromMoneyUnits(
      toMoneyUnits(input.profitPerItemSnapshot) * input.returnedQty,
    ),
    resolvedQty: input.returnedQty,
  };
}

export function applyDamagedReturn(input: {
  currentStock: number;
  damagedQty: number;
  soldQty: number;
  alreadyReturnedQty: number;
  alreadyDamagedQty: number;
  profitPerItemSnapshot: number;
  avgCostSnapshot: number;
}) {
  ensurePositiveQuantity(input.damagedQty, "damagedQty");
  ensureNonNegativeMoney(input.avgCostSnapshot, "avgCostSnapshot");
  ensureReturnCapacity({
    soldQty: input.soldQty,
    alreadyReturnedQty: input.alreadyReturnedQty,
    alreadyDamagedQty: input.alreadyDamagedQty,
    requestedQty: input.damagedQty,
  });

  return {
    newStock: input.currentStock,
    profitAdjustment: fromMoneyUnits(
      toMoneyUnits(input.profitPerItemSnapshot) * input.damagedQty,
    ),
    lossAmount: fromMoneyUnits(
      toMoneyUnits(input.avgCostSnapshot) * input.damagedQty,
    ),
    resolvedQty: input.damagedQty,
  };
}
