"use client";

import { useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

import { useDashboardNavigation } from "./dashboard-navigation-context";

function isModifiedEvent(event: React.MouseEvent<HTMLAnchorElement>) {
  return event.metaKey || event.ctrlKey || event.shiftKey || event.altKey;
}

export function DashboardNavLink({
  href,
  className,
  children,
  onNavigate,
}: {
  href: string;
  className: string;
  children: React.ReactNode;
  onNavigate?: () => void;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const { navigate } = useDashboardNavigation();

  useEffect(() => {
    router.prefetch(href);
  }, [href, router]);

  return (
    <Link
      href={href}
      prefetch
      onClick={(event) => {
        if (
          event.defaultPrevented ||
          isModifiedEvent(event) ||
          event.button !== 0
        ) {
          return;
        }

        if (href === pathname || (href !== "/" && pathname.startsWith(`${href}/`))) {
          onNavigate?.();
          return;
        }

        event.preventDefault();
        onNavigate?.();
        navigate(href);
      }}
      className={className}
    >
      {children}
    </Link>
  );
}
