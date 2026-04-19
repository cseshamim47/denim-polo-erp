import { NextResponse } from "next/server";

import { getRequiredSession } from "@/lib/auth";
import { connectToDatabase } from "@/lib/db";
import { decimalToNumber } from "@/lib/money";
import ExpenseModel from "@/models/Expense";
import SaleModel from "@/models/Sale";
import VariantModel from "@/models/Variant";

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function calculateSaleProfit(
  sale: Awaited<ReturnType<typeof SaleModel.find>> extends never ? never : any,
) {
  return sale.items.reduce((total: number, item: any) => {
    const resolvedQty = item.returnedQty + item.damagedQty;
    return (
      total +
      decimalToNumber(item.profitPerUnitSnapshot) * (item.qty - resolvedQty)
    );
  }, 0);
}

export async function GET() {
  const session = await getRequiredSession(["partner"]);

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await connectToDatabase();

  const now = new Date();
  const todayStart = startOfDay(now);
  const monthStart = startOfMonth(now);
  const trendStart = new Date(now);
  trendStart.setDate(trendStart.getDate() - 29);

  const [
    todaySales,
    monthSales,
    todayExpenses,
    monthExpenses,
    lowStockCount,
    pendingExpenseCount,
    trendSales,
    trendExpenses,
  ] = await Promise.all([
    SaleModel.find({
      saleDate: { $gte: todayStart },
      status: "completed",
    }).lean(),
    SaleModel.find({
      saleDate: { $gte: monthStart },
      status: "completed",
    }).lean(),
    ExpenseModel.find({
      expenseDate: { $gte: todayStart },
      status: "approved",
    }).lean(),
    ExpenseModel.find({
      expenseDate: { $gte: monthStart },
      status: "approved",
    }).lean(),
    VariantModel.countDocuments({
      isActive: true,
      $expr: { $lte: ["$stockQty", "$lowStockThreshold"] },
    }),
    ExpenseModel.countDocuments({ status: "pending" }),
    SaleModel.find({
      saleDate: { $gte: trendStart },
      status: "completed",
    }).lean(),
    ExpenseModel.find({
      expenseDate: { $gte: trendStart },
      status: "approved",
    }).lean(),
  ]);

  const todayProfit =
    todaySales.reduce((sum, sale) => sum + calculateSaleProfit(sale), 0) -
    todayExpenses.reduce(
      (sum, expense) => sum + decimalToNumber(expense.amount),
      0,
    );
  const monthProfit =
    monthSales.reduce((sum, sale) => sum + calculateSaleProfit(sale), 0) -
    monthExpenses.reduce(
      (sum, expense) => sum + decimalToNumber(expense.amount),
      0,
    );

  const trendMap = new Map<
    string,
    { date: string; salesTotal: number; expenseTotal: number; profit: number }
  >();

  for (let index = 0; index < 30; index += 1) {
    const date = new Date(trendStart);
    date.setDate(trendStart.getDate() + index);
    const key = date.toISOString().slice(0, 10);
    trendMap.set(key, { date: key, salesTotal: 0, expenseTotal: 0, profit: 0 });
  }

  for (const sale of trendSales) {
    const key = new Date(sale.saleDate).toISOString().slice(0, 10);
    const entry = trendMap.get(key);

    if (!entry) {
      continue;
    }

    entry.salesTotal += decimalToNumber(sale.grandTotal);
    entry.profit += calculateSaleProfit(sale);
  }

  for (const expense of trendExpenses) {
    const key = new Date(expense.expenseDate).toISOString().slice(0, 10);
    const entry = trendMap.get(key);

    if (!entry) {
      continue;
    }

    const amount = decimalToNumber(expense.amount);
    entry.expenseTotal += amount;
    entry.profit -= amount;
  }

  return NextResponse.json({
    summary: {
      todayProfit,
      monthProfit,
      lowStockCount,
      pendingExpenseCount,
    },
    trend: Array.from(trendMap.values()),
  });
}
