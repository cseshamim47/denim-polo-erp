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
        const payload = (await response.json()) as DashboardResponse | { error?: string };

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
          <h2 className="mt-3 max-w-xl text-4xl font-semibold tracking-tight text-[var(--text-primary)]">
            Know profit today, weak stock now, and pending approvals before shop closes.
          </h2>
          <p className="mt-4 max-w-2xl text-sm leading-7 text-[var(--text-secondary)]">
            This dashboard stays focused on actions that replace pen-and-paper uncertainty: profit visibility,
            low-stock pressure, and expense approvals waiting on partners.
          </p>
        </div>
        <div className="rounded-[2rem] bg-[var(--surface-accent-soft)] p-6 ring-1 ring-[var(--stroke-soft)]">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-[var(--text-secondary)]">
            30-day rhythm
          </p>
          <div className="mt-4 grid gap-3">
            {latestTrend.map((entry) => (
              <div key={entry.date} className="grid grid-cols-[70px_1fr_88px] items-center gap-3 text-sm">
                <span className="text-[var(--text-secondary)]">{entry.date.slice(5)}</span>
                <div className="h-3 rounded-full bg-white/80">
                  <div
                    className="h-3 rounded-full bg-[var(--surface-accent)]"
                    style={{ width: `${Math.max((entry.profit / peakProfit) * 100, 8)}%` }}
                  />
                </div>
                <span className="text-right font-medium text-[var(--text-primary)]">{currency(entry.profit)}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {[
          { label: "Today profit", value: currency(data?.summary.todayProfit ?? 0) },
          { label: "Month profit", value: currency(data?.summary.monthProfit ?? 0) },
          { label: "Low-stock variants", value: String(data?.summary.lowStockCount ?? 0) },
          { label: "Pending expenses", value: String(data?.summary.pendingExpenseCount ?? 0) },
        ].map((card) => (
          <div key={card.label} className="rounded-[1.7rem] bg-white/80 p-5 ring-1 ring-[var(--stroke-soft)]">
            <p className="text-sm text-[var(--text-secondary)]">{card.label}</p>
            <p className="mt-4 text-3xl font-semibold tracking-tight text-[var(--text-primary)]">{card.value}</p>
          </div>
        ))}
      </section>

      {error ? (
        <div className="rounded-[1.7rem] border border-[var(--stroke-soft)] bg-white/80 p-5 text-sm text-[var(--danger)]">
          {error}
        </div>
      ) : null}
    </div>
  );
}
