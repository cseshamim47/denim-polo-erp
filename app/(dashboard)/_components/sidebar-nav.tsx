"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import type { DashboardNavItem } from "./dashboard-shell";

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

  return (
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
  );
}
