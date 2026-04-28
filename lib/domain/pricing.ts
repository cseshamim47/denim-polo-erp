function roundCurrency(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function assertNonNegative(value: number, label: string) {
  if (value < 0) {
    throw new Error(`${label} must be zero or greater`);
  }
}

export function calculatePricingSuggestion(input: {
  costPerUnit: number;
  fixedExpensesTotal: number;
  expectedUnitsSold: number;
  targetMarginPercent: number;
}) {
  assertNonNegative(input.costPerUnit, "Cost per unit");
  assertNonNegative(input.fixedExpensesTotal, "Fixed expenses");
  assertNonNegative(input.targetMarginPercent, "Target margin");

  if (input.expectedUnitsSold <= 0) {
    throw new Error("Expected units sold must be greater than zero");
  }

  if (input.targetMarginPercent >= 100) {
    throw new Error("Target margin must stay below 100%");
  }

  const breakEvenPricePerUnit = roundCurrency(
    input.costPerUnit + input.fixedExpensesTotal / input.expectedUnitsSold,
  );
  const suggestedSellingPrice = roundCurrency(
    breakEvenPricePerUnit / (1 - input.targetMarginPercent / 100),
  );
  const expectedProfitPerUnit = roundCurrency(
    suggestedSellingPrice - breakEvenPricePerUnit,
  );

  return {
    breakEvenPricePerUnit,
    suggestedSellingPrice,
    expectedProfitPerUnit,
    expectedProfitTotal: roundCurrency(
      expectedProfitPerUnit * input.expectedUnitsSold,
    ),
  };
}

export function calculateBreakEvenUnits(input: {
  sellingPrice: number;
  costPerUnit: number;
  fixedExpensesTotal: number;
}) {
  assertNonNegative(input.sellingPrice, "Selling price");
  assertNonNegative(input.costPerUnit, "Cost per unit");
  assertNonNegative(input.fixedExpensesTotal, "Fixed expenses");

  const contributionPerUnit = input.sellingPrice - input.costPerUnit;

  if (contributionPerUnit <= 0) {
    throw new Error("Selling price must exceed cost to break even");
  }

  if (input.fixedExpensesTotal === 0) {
    return 0;
  }

  return Math.ceil(input.fixedExpensesTotal / contributionPerUnit);
}
