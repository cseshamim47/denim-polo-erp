"use client";

import { useEffect, useState } from "react";

type DashboardResponse = {
  summary: {
    todayProfit: number;
    monthProfit: number;
    lowStockCount: number;
    pendingExpenseCount: number;
  };
  trend: Array<{
    date: string;
    salesTotal: number;
    expenseTotal: number;
    profit: number;
  }>;
};

export default function ReportsPage() {
  const [data, setData] = useState<DashboardResponse | null>(null);

  useEffect(() => {
    async function load() {
      const response = await fetch("/api/dashboard", { cache: "no-store" });
      const payload = (await response.json()) as DashboardResponse;
      setData(payload);
    }

    void load();
  }, []);

  return (
    <div className="space-y-6">
      <section className="rounded-[1.8rem] bg-white/80 p-6 ring-1 ring-(--stroke-soft)">
        <h2 className="text-2xl font-semibold tracking-tight">
          Profit and stock reports
        </h2>
        <p className="mt-3 text-sm leading-7 text-(--text-secondary)">
          Daily and monthly profit use snapped sale profit, reduced by returns
          and approved expenses.
        </p>
      </section>
      <section className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-[1.8rem] bg-white/80 p-6 ring-1 ring-(--stroke-soft)">
          <p className="text-sm text-(--text-secondary)">Today profit</p>
          <p className="mt-3 text-3xl font-semibold">
            {data?.summary.todayProfit ?? 0}
          </p>
          <p className="mt-6 text-sm text-(--text-secondary)">
            Low stock variants: {data?.summary.lowStockCount ?? 0}
          </p>
        </div>
        <div className="rounded-[1.8rem] bg-white/80 p-6 ring-1 ring-(--stroke-soft)">
          <p className="text-sm text-(--text-secondary)">Month profit</p>
          <p className="mt-3 text-3xl font-semibold">
            {data?.summary.monthProfit ?? 0}
          </p>
          <p className="mt-6 text-sm text-(--text-secondary)">
            Pending expenses: {data?.summary.pendingExpenseCount ?? 0}
          </p>
        </div>
      </section>
      <section className="rounded-[1.8rem] bg-white/80 p-6 ring-1 ring-(--stroke-soft)">
        <div className="grid gap-3">
          {data?.trend.map((entry) => (
            <div
              key={entry.date}
              className="grid grid-cols-[82px_1fr_100px] items-center gap-3 text-sm"
            >
              <span className="text-(--text-secondary)">
                {entry.date.slice(5)}
              </span>
              <div className="h-3 rounded-full bg-(--surface-accent-soft)">
                <div
                  className="h-3 rounded-full bg-(--surface-accent)"
                  style={{ width: `${Math.max(entry.salesTotal / 50, 6)}%` }}
                />
              </div>
              <span className="text-right text-foreground">{entry.profit}</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
