"use client";

import { useEffect, useState } from "react";

type DashboardResponse = {
  summary: {
    currentBalance: number;
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
    maximumFractionDigits: 0,
  }).format(value);
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadDashboard() {
      try {
        const response = await fetch("/api/dashboard", { cache: "no-store" });
        const payload = (await response.json()) as
          | DashboardResponse
          | { error?: string };

        if (!response.ok || !("summary" in payload)) {
          setError("Unable to load dashboard right now.");
          return;
        }

        setData(payload);
      } catch {
        setError("Unable to load dashboard right now.");
      }
    }

    void loadDashboard();
  }, []);

  const latestTrend = data?.trend.slice(-7) ?? [];
  const peakProfit = Math.max(...latestTrend.map((entry) => entry.profit), 1);

  return (
    <div className="space-y-6">
      <section className="grid gap-6 xl:grid-cols-[1.4fr_0.9fr]">
        <div className="rounded-[2rem] bg-[var(--surface-panel-strong)] p-6 ring-1 ring-[var(--stroke-soft)]">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-[var(--text-secondary)]">
            Partner panel
          </p>
          <h2 className="mt-3 max-w-xl text-2xl font-semibold tracking-tight text-[var(--text-primary)] sm:text-4xl">
            Profit, stock, and approvals in one view.
          </h2>
        </div>
        <div className="rounded-[2rem] bg-[var(--surface-accent-soft)] p-6 ring-1 ring-[var(--stroke-soft)]">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-[var(--text-secondary)]">
            30-day rhythm
          </p>
          <div className="mt-4 grid gap-3">
            {latestTrend.map((entry) => (
              <div
                key={entry.date}
                className="grid grid-cols-[56px_1fr] items-center gap-3 text-sm sm:grid-cols-[70px_1fr_88px]"
              >
                <span className="text-[var(--text-secondary)]">
                  {entry.date.slice(5)}
                </span>
                <div className="h-3 rounded-full bg-white/80">
                  <div
                    className="h-3 rounded-full bg-[var(--surface-accent)]"
                    style={{
                      width: `${Math.max((entry.profit / peakProfit) * 100, 8)}%`,
                    }}
                  />
                </div>
                <span className="col-span-2 text-right font-medium text-[var(--text-primary)] sm:col-span-1">
                  {currency(entry.profit)}
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {[
          {
            label: "Balance in hand",
            value: currency(data?.summary.currentBalance ?? 0),
          },
          {
            label: "Today profit",
            value: currency(data?.summary.todayProfit ?? 0),
          },
          {
            label: "Month profit",
            value: currency(data?.summary.monthProfit ?? 0),
          },
          {
            label: "Low-stock variants",
            value: String(data?.summary.lowStockCount ?? 0),
          },
          {
            label: "Pending expenses",
            value: String(data?.summary.pendingExpenseCount ?? 0),
          },
        ].map((card) => (
          <div
            key={card.label}
            className="rounded-[1.7rem] bg-white/80 p-5 ring-1 ring-[var(--stroke-soft)]"
          >
            <p className="text-sm text-[var(--text-secondary)]">{card.label}</p>
            <p className="mt-4 text-3xl font-semibold tracking-tight text-[var(--text-primary)]">
              {card.value}
            </p>
          </div>
        ))}
      </section>

      <section className="rounded-[1.7rem] bg-white/80 p-5 ring-1 ring-[var(--stroke-soft)]">
        <div className="flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-end">
          <div>
            <p className="text-sm text-[var(--text-secondary)]">
              Partner capital and profit share
            </p>
            <h3 className="mt-2 text-2xl font-semibold tracking-tight text-[var(--text-primary)]">
              {currency(data?.capital.totalInvested ?? 0)} invested total
            </h3>
          </div>
          <p className="text-sm text-[var(--text-secondary)]">
            Shareable month profit:{" "}
            {currency(data?.capital.distributableProfit ?? 0)}
          </p>
        </div>
        <div className="mt-5 grid gap-3 md:grid-cols-3">
          {(data?.capital.partnerShares ?? []).map((share) => (
            <div
              key={share.partnerId}
              className="rounded-[1.3rem] border border-[var(--stroke-soft)] p-4"
            >
              <p className="font-medium text-[var(--text-primary)]">
                {share.partnerName}
              </p>
              <p className="mt-2 text-sm text-[var(--text-secondary)]">
                Capital {currency(share.totalInvestment)}
              </p>
              <p className="mt-1 text-sm text-[var(--text-secondary)]">
                Share {share.profitSharePercent}%
              </p>
              <p className="mt-3 text-lg font-semibold text-[var(--text-primary)]">
                Owed {currency(share.profitShareAmount)}
              </p>
            </div>
          ))}
        </div>
      </section>

      {error ? (
        <div className="rounded-[1.7rem] border border-[var(--stroke-soft)] bg-white/80 p-5 text-sm text-[var(--danger)]">
          {error}
        </div>
      ) : null}
    </div>
  );
}
