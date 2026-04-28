"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type DashboardResponse = {
  summary: {
    todayProfit: number;
    monthProfit: number;
    lowStockCount: number;
    pendingExpenseCount: number;
  };
  capital: {
    totalInvested: number;
    distributableProfit: number;
    partnerShares: Array<{
      partnerId: string;
      partnerName: string;
      totalInvestment: number;
      profitSharePercent: number;
      profitShareAmount: number;
    }>;
  };
  trend: Array<{
    date: string;
    salesTotal: number;
    expenseTotal: number;
    profit: number;
  }>;
};

function currency(value: number) {
  return new Intl.NumberFormat("en-BD", {
    style: "currency",
    currency: "BDT",
    maximumFractionDigits: 2,
  }).format(value);
}

export default function ReportsPage() {
  const [data, setData] = useState<DashboardResponse | null>(null);

  async function load() {
    const dashboardResponse = await fetch("/api/dashboard", {
      cache: "no-store",
    });

    setData((await dashboardResponse.json()) as DashboardResponse);
  }

  useEffect(() => {
    void load();
  }, []);

  return (
    <div className="space-y-6">
      <section className="rounded-[1.8rem] bg-white/80 p-6 ring-1 ring-(--stroke-soft)">
        <h2 className="text-2xl font-semibold tracking-tight">
          Profit, capital, and partner share reports
        </h2>
        <p className="mt-3 text-sm leading-7 text-(--text-secondary)">
          Daily and monthly profit use snapped sale profit, reduced by returns
          and approved expenses. Partner profit share uses only approved
          investments. Investment submission, verification, history, and filters
          now live in a dedicated page.
        </p>
        <Link className="btn-secondary mt-4 inline-flex" href="/investments">
          Open investments
        </Link>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-[1.8rem] bg-white/80 p-6 ring-1 ring-(--stroke-soft)">
          <p className="text-sm text-(--text-secondary)">Today profit</p>
          <p className="mt-3 text-3xl font-semibold">
            {currency(data?.summary.todayProfit ?? 0)}
          </p>
          <p className="mt-6 text-sm text-(--text-secondary)">
            Low stock variants: {data?.summary.lowStockCount ?? 0}
          </p>
        </div>
        <div className="rounded-[1.8rem] bg-white/80 p-6 ring-1 ring-(--stroke-soft)">
          <p className="text-sm text-(--text-secondary)">Month profit</p>
          <p className="mt-3 text-3xl font-semibold">
            {currency(data?.summary.monthProfit ?? 0)}
          </p>
          <p className="mt-6 text-sm text-(--text-secondary)">
            Pending expenses: {data?.summary.pendingExpenseCount ?? 0}
          </p>
        </div>
      </section>

      <section className="rounded-[1.8rem] bg-white/80 p-6 ring-1 ring-(--stroke-soft)">
        <div className="flex items-end justify-between gap-3">
          <div>
            <p className="text-sm text-(--text-secondary)">Capital invested</p>
            <p className="mt-2 text-3xl font-semibold">
              {currency(data?.capital.totalInvested ?? 0)}
            </p>
          </div>
          <p className="text-sm text-(--text-secondary)">
            Distributable month profit:{" "}
            {currency(data?.capital.distributableProfit ?? 0)}
          </p>
        </div>
        <div className="mt-5 grid gap-3">
          {(data?.capital.partnerShares ?? []).map((share) => (
            <div
              key={share.partnerId}
              className="grid grid-cols-[1fr_auto] gap-3 rounded-[1.2rem] border border-(--stroke-soft) p-4"
            >
              <div>
                <p className="font-medium text-foreground">
                  {share.partnerName}
                </p>
                <p className="mt-1 text-sm text-(--text-secondary)">
                  Capital {currency(share.totalInvestment)} · Share{" "}
                  {share.profitSharePercent}%
                </p>
              </div>
              <p className="text-right text-sm font-semibold text-foreground">
                {currency(share.profitShareAmount)}
              </p>
            </div>
          ))}
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
              <span className="text-right text-foreground">
                {currency(entry.profit)}
              </span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
