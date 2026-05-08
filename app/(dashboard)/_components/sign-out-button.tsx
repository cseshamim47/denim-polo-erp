"use client";

import { signOut } from "next-auth/react";

export function SignOutButton({
  className,
}: {
  className?: string;
}) {
  return (
    <button
      className={className ?? "btn-secondary mt-5 w-full"}
      onClick={() => signOut({ callbackUrl: "/login" })}
      type="button"
    >
      Sign out
    </button>
  );
}
