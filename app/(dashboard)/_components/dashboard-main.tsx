"use client";

import type { ReactNode } from "react";

import { Spinner } from "@/components/ui/spinner";
import { useDashboardNavigation } from "./dashboard-navigation-context";

export function DashboardMain({ children }: { children: ReactNode }) {
  const { isNavigating, pendingHref } = useDashboardNavigation();

  return (
    <main className="panel relative rounded-4xl p-4 sm:p-6 lg:p-8">
      {isNavigating ? (
        <div className="pointer-events-none absolute inset-x-4 top-4 z-20 rounded-3xl border border-(--stroke-soft) bg-white/88 px-4 py-3 shadow-sm backdrop-blur sm:inset-x-6 lg:inset-x-8">
          <Spinner
            className="justify-start"
            label={`Opening ${pendingHref ?? "page"}...`}
          />
        </div>
      ) : null}
      {children}
    </main>
  );
}
