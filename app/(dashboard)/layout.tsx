import type { ReactNode } from "react";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import {
  DashboardShell,
  type DashboardCurrentUser,
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

export default async function DashboardLayout({
  children,
}: {
  children: ReactNode;
}) {
  const session = await getServerSession(authOptions);
  const currentUser: DashboardCurrentUser = {
    email: session?.user?.email ?? "No email",
    name: session?.user?.name ?? "Unknown user",
    role: session?.user?.role ?? "no-role",
  };

  return (
    <DashboardShell currentUser={currentUser} navItems={navItems}>
      {children}
    </DashboardShell>
  );
}
