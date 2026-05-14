import { decimalToNumber } from "@/lib/money";

type ReturnedSaleLine = {
  returnedQty: number;
  sellingPriceSnapshot: unknown;
};

type ReturnedSale = {
  items: ReturnedSaleLine[];
};

export function calculateCustomerRefundTotal(sales: ReturnedSale[]) {
  return sales.reduce(
    (salesTotal, sale) =>
      salesTotal +
      sale.items.reduce(
        (lineTotal, item) =>
          lineTotal +
          decimalToNumber(item.sellingPriceSnapshot) * item.returnedQty,
        0,
      ),
    0,
  );
}

export function calculateCurrentBalance(input: {
  approvedInvestmentTotal: number;
  completedSalesTotal: number;
  customerRefundTotal: number;
  purchaseTotal: number;
  approvedAssetTotal: number;
  approvedExpenseTotal: number;
}) {
  return (
    input.approvedInvestmentTotal +
    input.completedSalesTotal -
    input.customerRefundTotal -
    input.purchaseTotal -
    input.approvedAssetTotal -
    input.approvedExpenseTotal
  );
}
