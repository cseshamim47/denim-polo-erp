"use client";

import { useEffect, useState } from "react";

import type { DashboardCurrentUser, DashboardNavItem } from "./dashboard-shell";
import { SidebarNav } from "./sidebar-nav";
import { SignOutButton } from "./sign-out-button";

export function MobileDashboardNav({
  currentUser,
  navItems,
}: {
  currentUser: DashboardCurrentUser;
  navItems: DashboardNavItem[];
}) {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isOpen]);

  return (
    <>
      <div className="panel flex items-center justify-between rounded-3xl px-4 py-3 lg:hidden">
        <div>
          <p className="text-[0.68rem] font-semibold uppercase tracking-[0.24em] text-(--text-secondary)">
            Denim Polo ERP
          </p>
          <p className="text-sm font-medium text-foreground">
            Shop control room
          </p>
        </div>
        <button
          type="button"
          className="rounded-2xl border border-(--stroke-soft) bg-white/80 px-3 py-2 text-sm font-medium text-foreground"
          onClick={() => setIsOpen(true)}
          aria-label="Open navigation menu"
          aria-expanded={isOpen}
          aria-controls="dashboard-mobile-nav"
        >
          <span className="block h-0.5 w-5 bg-(--text-primary)" />
          <span className="mt-1.5 block h-0.5 w-5 bg-(--text-primary)" />
          <span className="mt-1.5 block h-0.5 w-5 bg-(--text-primary)" />
        </button>
      </div>

      {isOpen ? (
        <div
          className="fixed inset-0 z-50 lg:hidden"
          role="dialog"
          aria-modal="true"
        >
          <button
            type="button"
            aria-label="Close navigation menu"
            className="absolute inset-0 bg-[rgba(13,32,24,0.48)]"
            onClick={() => setIsOpen(false)}
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
                onClick={() => setIsOpen(false)}
              >
                Close
              </button>
            </div>
            <div className="mt-4 min-h-0 flex-1 overflow-y-auto overscroll-contain pr-2 pb-[max(1.75rem,env(safe-area-inset-bottom))]">
              <SidebarNav
                navItems={navItems}
                onNavigate={() => setIsOpen(false)}
              />
              <div className="mt-8 rounded-[1.6rem] bg-(--surface-accent) p-5 text-(--text-inverse)">
                <p className="text-xs uppercase tracking-[0.3em] text-white/70">
                  Operating note
                </p>
                <p className="mt-3 text-sm leading-6 text-white/88">
                  Sales lock stock immediately. Purchases update average cost.
                  Returns never rewrite history.
                </p>
                <div className="mt-8 rounded-[1.6rem] border border-white/15 bg-white/8 p-5 text-(--text-inverse)">
                  <p className="text-xs uppercase tracking-[0.3em] text-white/60">
                    Current session
                  </p>
                  <p className="mt-3 text-base font-medium text-white">
                    {currentUser.name}
                  </p>
                  <p className="mt-1 text-sm text-white/70">
                    {currentUser.email}
                  </p>
                  <p className="mt-1 text-xs uppercase tracking-[0.22em] text-white/50">
                    {currentUser.role}
                  </p>
                  <SignOutButton className="btn-secondary mt-5 w-full" />
                </div>
              </div>
            </div>
          </aside>
        </div>
      ) : null}
    </>
  );
}
