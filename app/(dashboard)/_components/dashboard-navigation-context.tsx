"use client";

import {
  createContext,
  startTransition,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { usePathname, useRouter } from "next/navigation";

type DashboardNavigationContextValue = {
  isNavigating: boolean;
  pendingHref: string | null;
  navigate: (href: string) => void;
};

const DashboardNavigationContext =
  createContext<DashboardNavigationContextValue | null>(null);

export function DashboardNavigationProvider({
  children,
}: {
  children: ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [pendingHref, setPendingHref] = useState<string | null>(null);
  const isNavigating =
    pendingHref !== null &&
    pendingHref !== pathname &&
    !(pendingHref !== "/" && pathname.startsWith(`${pendingHref}/`));

  const value = useMemo<DashboardNavigationContextValue>(
    () => ({
      isNavigating,
      pendingHref,
      navigate(href: string) {
        if (
          href === pathname ||
          (href !== "/" && pathname.startsWith(`${href}/`))
        ) {
          setPendingHref(null);
          return;
        }

        setPendingHref(href);
        startTransition(() => {
          router.push(href);
        });
      },
    }),
    [isNavigating, pathname, pendingHref, router],
  );

  return (
    <DashboardNavigationContext.Provider value={value}>
      {children}
    </DashboardNavigationContext.Provider>
  );
}

export function useDashboardNavigation() {
  const context = useContext(DashboardNavigationContext);

  if (!context) {
    throw new Error(
      "useDashboardNavigation must be used inside DashboardNavigationProvider.",
    );
  }

  return context;
}
