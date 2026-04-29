"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";

import { SessionPanel } from "./session-panel";

export type DashboardNavItem = {
  href: string;
  label: string;
};

function isItemActive(pathname: string, href: string) {
  if (href === "/") {
    return pathname === "/";
  }

  return pathname === href || pathname.startsWith(`${href}/`);
}

type DashboardShellProps = {
  children: ReactNode;
  navItems: DashboardNavItem[];
};

export function DashboardShell({ children, navItems }: DashboardShellProps) {
  const pathname = usePathname();
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);

  useEffect(() => {
    if (!isMobileNavOpen) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isMobileNavOpen]);

  return (
    <div className="min-h-screen px-4 py-4 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-4">
        <header className="panel flex items-center justify-between rounded-3xl px-4 py-3 lg:hidden">
          <div>
            <p className="text-[0.68rem] font-semibold uppercase tracking-[0.24em] text-(--text-secondary)">
              Denim Polo ERP
            </p>
            <p className="text-sm font-medium text-foreground">Shop control room</p>
          </div>
          <button
            type="button"
            className="rounded-2xl border border-(--stroke-soft) bg-white/80 px-3 py-2 text-sm font-medium text-foreground"
            onClick={() => setIsMobileNavOpen(true)}
            aria-label="Open navigation menu"
            aria-expanded={isMobileNavOpen}
            aria-controls="dashboard-mobile-nav"
          >
            <span className="block h-0.5 w-5 bg-(--text-primary)" />
            <span className="mt-1.5 block h-0.5 w-5 bg-(--text-primary)" />
            <span className="mt-1.5 block h-0.5 w-5 bg-(--text-primary)" />
          </button>
        </header>

        <div className="grid min-h-[calc(100vh-2rem)] gap-4 lg:grid-cols-[260px_minmax(0,1fr)]">
          <aside className="panel hidden rounded-4xl p-5 lg:block lg:p-6">
            <SidebarContent navItems={navItems} pathname={pathname} />
          </aside>
          <main className="panel rounded-4xl p-4 sm:p-6 lg:p-8">{children}</main>
        </div>
      </div>

      {isMobileNavOpen ? (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true">
          <button
            type="button"
            aria-label="Close navigation menu"
            className="absolute inset-0 bg-[rgba(13,32,24,0.48)]"
            onClick={() => setIsMobileNavOpen(false)}
          />
          <aside
            id="dashboard-mobile-nav"
            className="panel absolute right-4 top-4 flex h-[calc(100dvh-2rem)] max-h-[calc(100dvh-2rem)] w-[min(84vw,320px)] flex-col rounded-4xl p-5"
          >
            <div className="flex shrink-0 items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.32em] text-(--text-secondary)">
                  Denim Polo ERP
                </p>
                <h2 className="mt-2 text-2xl font-semibold tracking-tight text-foreground">
                  Navigation
                </h2>
              </div>
              <button
                type="button"
                className="rounded-full border border-(--stroke-soft) bg-white/70 px-3 py-1 text-sm"
                onClick={() => setIsMobileNavOpen(false)}
              >
                Close
              </button>
            </div>
            <div className="mt-4 min-h-0 flex-1 overflow-y-auto overscroll-contain pr-2 pb-[max(1.75rem,env(safe-area-inset-bottom))]">
              <SidebarContent
                navItems={navItems}
                pathname={pathname}
                onNavigate={() => setIsMobileNavOpen(false)}
              />
            </div>
          </aside>
        </div>
      ) : null}
    </div>
  );
}

type SidebarContentProps = {
  navItems: DashboardNavItem[];
  pathname: string;
  onNavigate?: () => void;
};

function SidebarContent({ navItems, pathname, onNavigate }: SidebarContentProps) {
  return (
    <>
      <div className="space-y-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.32em] text-(--text-secondary)">
            Denim Polo ERP
          </p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight text-foreground">
            Shop control room
          </h1>
          <p className="mt-3 text-sm leading-6 text-(--text-secondary)">
            Sales, stock, expenses, returns, and partner visibility in one place.
          </p>
        </div>
        <nav className="grid gap-2">
          {navItems.map((item) => {
            const active = isItemActive(pathname, item.href);

            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onNavigate}
                className={[
                  "rounded-2xl border px-4 py-3 text-sm font-medium transition",
                  active
                    ? "border-(--stroke-strong) bg-white text-foreground"
                    : "border-(--stroke-soft) bg-white/70 text-foreground hover:border-(--stroke-strong) hover:bg-white",
                ].join(" ")}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
      </div>
      <div className="mt-8 rounded-[1.6rem] bg-(--surface-accent) p-5 text-(--text-inverse)">
        <p className="text-xs uppercase tracking-[0.3em] text-white/70">Operating note</p>
        <p className="mt-3 text-sm leading-6 text-white/88">
          Sales lock stock immediately. Purchases update average cost. Returns never rewrite
          history.
        </p>
        <SessionPanel />
      </div>
    </>
  );
}
