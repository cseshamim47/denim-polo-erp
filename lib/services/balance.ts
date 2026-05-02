import { calculateCurrentBalance, calculateCustomerRefundTotal } from "@/lib/domain/balance";
import { connectToDatabase } from "@/lib/db";
import { decimalToNumber } from "@/lib/money";
import ExpenseModel from "@/models/Expense";
import InvestmentModel from "@/models/Investment";
import PurchaseModel from "@/models/Purchase";
import SaleModel from "@/models/Sale";

export async function getCurrentBalanceSnapshot() {
  await connectToDatabase();

  const [approvedInvestments, completedSales, approvedExpenses, purchases] =
    await Promise.all([
      InvestmentModel.find({ status: "approved" }).lean(),
      SaleModel.find({ status: "completed" }).lean(),
      ExpenseModel.find({ status: "approved" }).lean(),
      PurchaseModel.find({ status: "approved" }).lean(),
    ]);

  const approvedInvestmentTotal = approvedInvestments.reduce(
    (sum, investment) => sum + decimalToNumber(investment.amount),
    0,
  );
  const completedSalesTotal = completedSales.reduce(
    (sum, sale) => sum + decimalToNumber(sale.grandTotal),
    0,
  );
  const customerRefundTotal = calculateCustomerRefundTotal(completedSales);
  const purchaseTotal = purchases.reduce(
    (sum, purchase) =>
      sum + decimalToNumber(purchase.cashOutTotal ?? purchase.totalCost),
    0,
  );
  const approvedExpenseTotal = approvedExpenses.reduce(
    (sum, expense) => sum + decimalToNumber(expense.amount),
    0,
  );

  return {
    currentBalance: calculateCurrentBalance({
      approvedInvestmentTotal,
      completedSalesTotal,
      customerRefundTotal,
      purchaseTotal,
      approvedExpenseTotal,
    }),
    breakdown: {
      approvedInvestmentTotal,
      completedSalesTotal,
      customerRefundTotal,
      purchaseTotal,
      approvedExpenseTotal,
    },
  };
}