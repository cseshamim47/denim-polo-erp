import Link from "next/link";
import type { ReactNode } from "react";

import { SessionPanel } from "./_components/session-panel";

const navItems = [
  { href: "/", label: "Dashboard" },
  { href: "/sales/new", label: "New Sale" },
  { href: "/products", label: "Products" },
  { href: "/purchases/new", label: "Purchases" },
  { href: "/expenses", label: "Expenses" },
  { href: "/investments", label: "Investments" },
  { href: "/returns", label: "Returns" },
  { href: "/reports", label: "Reports" },
];

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen px-4 py-4 sm:px-6 lg:px-8">
      <div className="mx-auto grid min-h-[calc(100vh-2rem)] max-w-7xl gap-4 lg:grid-cols-[260px_minmax(0,1fr)]">
        <aside className="panel rounded-4xl p-5 lg:p-6">
          <div className="space-y-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.32em] text-(--text-secondary)">
                Denim Polo ERP
              </p>
              <h1 className="mt-3 text-3xl font-semibold tracking-tight text-foreground">
                Shop control room
              </h1>
              <p className="mt-3 text-sm leading-6 text-(--text-secondary)">
                Sales, stock, expenses, returns, and partner visibility in one
                place.
              </p>
            </div>
            <nav className="grid gap-2">
              {navItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="rounded-2xl border border-(--stroke-soft) bg-white/70 px-4 py-3 text-sm font-medium text-foreground transition hover:border-(--stroke-strong) hover:bg-white"
                >
                  {item.label}
                </Link>
              ))}
            </nav>
          </div>
          <div className="mt-8 rounded-[1.6rem] bg-(--surface-accent) p-5 text-(--text-inverse)">
            <p className="text-xs uppercase tracking-[0.3em] text-white/70">
              Operating note
            </p>
            <p className="mt-3 text-sm leading-6 text-white/88">
              Sales lock stock immediately. Purchases update average cost.
              Returns never rewrite history.
            </p>
            <SessionPanel />
          </div>
        </aside>
        <main className="panel rounded-4xl p-4 sm:p-6 lg:p-8">{children}</main>
      </div>
    </div>
  );
}
