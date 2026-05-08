import type { DashboardCurrentUser } from "./dashboard-shell";
import { SignOutButton } from "./sign-out-button";

export function SessionPanel({
  currentUser,
}: {
  currentUser: DashboardCurrentUser;
}) {
  return (
    <div className="mt-8 rounded-[1.6rem] border border-white/15 bg-white/8 p-5 text-(--text-inverse)">
      <p className="text-xs uppercase tracking-[0.3em] text-white/60">
        Current session
      </p>
      <p className="mt-3 text-base font-medium text-white">
        {currentUser.name}
      </p>
      <p className="mt-1 text-sm text-white/70">
        {currentUser.email}
      </p>
      <p className="mt-1 text-xs uppercase tracking-[0.22em] text-white/50">
        {currentUser.role}
      </p>
      <SignOutButton />
    </div>
  );
}
