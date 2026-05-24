import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { authOptions } from "@/lib/auth";

import { PasswordSettingsForm } from "./_components/password-settings-form";
import { ProfileSettingsForm } from "./_components/profile-settings-form";

export default async function SettingsPage() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id || !session.user.role) {
    redirect("/login");
  }

  return (
    <div className="space-y-6">
      <section className="space-y-3">
        <p className="text-xs font-semibold uppercase tracking-[0.32em] text-(--text-secondary)">
          Account settings
        </p>
        <h1 className="text-3xl font-semibold tracking-tight text-foreground">
          Profile and password
        </h1>
        <p className="max-w-2xl text-sm leading-6 text-(--text-secondary)">
          Keep your display name current and manage the password you use for
          email sign-in. Partner Google access stays available separately.
        </p>
      </section>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)]">
        <Card className="rounded-[1.8rem] border-(--stroke-soft) bg-white/80 shadow-none">
          <CardHeader className="gap-3 px-5 sm:px-6">
            <CardTitle className="text-xl tracking-tight">Profile</CardTitle>
            <CardDescription>
              Update the name shown across the dashboard. Email and role stay
              read-only here.
            </CardDescription>
          </CardHeader>
          <CardContent className="px-5 sm:px-6">
            <ProfileSettingsForm
              email={session.user.email ?? ""}
              initialName={session.user.name ?? ""}
              role={session.user.role}
            />
          </CardContent>
        </Card>

        <Card className="rounded-[1.8rem] border-(--stroke-soft) bg-white/80 shadow-none">
          <CardHeader className="gap-3 px-5 sm:px-6">
            <CardTitle className="text-xl tracking-tight">Security</CardTitle>
            <CardDescription>
              Change your password for email sign-in. You need your current
              password to confirm the update.
            </CardDescription>
          </CardHeader>
          <CardContent className="px-5 sm:px-6">
            <PasswordSettingsForm />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
