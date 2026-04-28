import type { ReactNode } from "react";

import {
  DashboardShell,
  type DashboardNavItem,
} from "./_components/dashboard-shell";

const navItems: DashboardNavItem[] = [
  { href: "/", label: "Dashboard" },
  { href: "/sales/new", label: "New Sale" },
  { href: "/products", label: "Products" },
  { href: "/purchases", label: "Purchases" },
  { href: "/expenses", label: "Expenses" },
  { href: "/investments", label: "Investments" },
  { href: "/returns", label: "Returns" },
  { href: "/reports", label: "Reports" },
];

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return <DashboardShell navItems={navItems}>{children}</DashboardShell>;
}
