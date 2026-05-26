"use client";

import { LoaderCircleIcon } from "lucide-react";
import { usePathname } from "next/navigation";

import type { DashboardNavItem } from "./dashboard-shell";
import { DashboardNavLink } from "./dashboard-nav-link";
import { useDashboardNavigation } from "./dashboard-navigation-context";

function isItemActive(pathname: string, href: string) {
  if (href === "/") {
    return pathname === "/";
  }

  return pathname === href || pathname.startsWith(`${href}/`);
}

export function SidebarNav({
  navItems,
  onNavigate,
}: {
  navItems: DashboardNavItem[];
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const { isNavigating, pendingHref } = useDashboardNavigation();

  return (
    <nav className="grid gap-2">
      {navItems.map((item) => {
        const active = isItemActive(pathname, item.href);
        const isPending =
          pendingHref === item.href ||
          (item.href !== "/" && pendingHref?.startsWith(`${item.href}/`));

        return (
          <DashboardNavLink
            key={item.href}
            href={item.href}
            onNavigate={onNavigate}
            className={[
              "flex items-center justify-between gap-3 rounded-2xl border px-4 py-3 text-sm font-medium transition",
              active
                ? "border-(--stroke-strong) bg-white text-foreground"
                : "border-(--stroke-soft) bg-white/70 text-foreground hover:border-(--stroke-strong) hover:bg-white",
            ].join(" ")}
          >
            <span>{item.label}</span>
            {isNavigating && isPending ? (
              <LoaderCircleIcon
                aria-hidden="true"
                className="size-4 shrink-0 animate-spin text-(--text-secondary)"
              />
            ) : null}
          </DashboardNavLink>
        );
      })}
    </nav>
  );
}
