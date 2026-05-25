export function buildPerfumeSellingPrice(input: {
  avgCostPerMl: number;
  soldMl: number;
  bottleSellingPrice: number;
}) {
  const liquidCost = input.avgCostPerMl * input.soldMl;

  return liquidCost * 2 + input.bottleSellingPrice;
}

export function buildPerfumeSaleFinancials(input: {
  avgCostPerMl: number;
  soldMl: number;
  bottleBuyingCost: number;
  bottleSellingPrice: number;
}) {
  const liquidCost = input.avgCostPerMl * input.soldMl;
  const sellingPrice = buildPerfumeSellingPrice(input);
  const totalCost = liquidCost + input.bottleBuyingCost;

  return {
    liquidCost,
    sellingPrice,
    totalCost,
    profit: sellingPrice - totalCost,
  };
}
