import type { ReactNode } from "react";

import { DashboardMain } from "./dashboard-main";
import { MobileDashboardNav } from "./mobile-dashboard-nav";
import { DashboardNavigationProvider } from "./dashboard-navigation-context";
import { SessionPanel } from "./session-panel";
import { SidebarNav } from "./sidebar-nav";

export type DashboardNavItem = {
  href: string;
  label: string;
};

export type DashboardCurrentUser = {
  email: string;
  name: string;
  role: string;
};

type DashboardShellProps = {
  children: ReactNode;
  currentUser: DashboardCurrentUser;
  navItems: DashboardNavItem[];
};

export function DashboardShell({
  children,
  currentUser,
  navItems,
}: DashboardShellProps) {
  return (
    <DashboardNavigationProvider>
      <div className="min-h-screen px-4 py-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl space-y-4">
          <MobileDashboardNav currentUser={currentUser} navItems={navItems} />

          <div className="grid min-h-[calc(100vh-2rem)] gap-4 lg:grid-cols-[260px_minmax(0,1fr)]">
            <aside className="panel hidden rounded-4xl p-5 lg:block lg:p-6">
              <SidebarContent currentUser={currentUser} navItems={navItems} />
            </aside>
            <DashboardMain>{children}</DashboardMain>
          </div>
        </div>
      </div>
    </DashboardNavigationProvider>
  );
}

type SidebarContentProps = {
  currentUser: DashboardCurrentUser;
  navItems: DashboardNavItem[];
};

function SidebarContent({ currentUser, navItems }: SidebarContentProps) {
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
            Sales, stock, expenses, returns, and partner visibility in one
            place.
          </p>
        </div>
        <SidebarNav navItems={navItems} />
      </div>
      <div className="mt-8 rounded-[1.6rem] bg-(--surface-accent) p-5 text-(--text-inverse)">
        <p className="text-xs uppercase tracking-[0.3em] text-white/70">
          Operating note
        </p>
        <p className="mt-3 text-sm leading-6 text-white/88">
          Sales lock stock immediately. Purchases update average cost. Returns
          never rewrite history.
        </p>
        <SessionPanel currentUser={currentUser} />
      </div>
    </>
  );
}
