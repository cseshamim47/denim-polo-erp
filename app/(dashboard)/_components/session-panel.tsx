"use client";

import { signOut, useSession } from "next-auth/react";

export function SessionPanel() {
  const { data: session } = useSession();

  return (
    <div className="mt-8 rounded-[1.6rem] border border-white/15 bg-white/8 p-5 text-(--text-inverse)">
      <p className="text-xs uppercase tracking-[0.3em] text-white/60">
        Current session
      </p>
      <p className="mt-3 text-base font-medium text-white">
        {session?.user?.name ?? "Unknown user"}
      </p>
      <p className="mt-1 text-sm text-white/70">
        {session?.user?.email ?? "No email"}
      </p>
      <p className="mt-1 text-xs uppercase tracking-[0.22em] text-white/50">
        {session?.user?.role ?? "no-role"}
      </p>
      <button
        className="btn-secondary mt-5 w-full"
        onClick={() => signOut({ callbackUrl: "/login" })}
        type="button"
      >
        Sign out
      </button>
    </div>
  );
}
