"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function ProfileSettingsForm({
  email,
  initialName,
  role,
}: {
  email: string;
  initialName: string;
  role: string;
}) {
  const router = useRouter();
  const [name, setName] = useState(initialName);
  const [isPending, startTransition] = useTransition();

  async function submitProfile(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const loadingToastId = toast.loading("Saving profile...");

    try {
      const response = await fetch("/api/settings/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const payload = (await response.json().catch(() => null)) as
        | { error?: string; user?: { name: string } }
        | null;

      toast.dismiss(loadingToastId);

      if (!response.ok) {
        toast.error(payload?.error ?? "Profile update failed.");
        return;
      }

      setName(payload?.user?.name ?? name.trim());
      toast.success("Profile updated.");
      startTransition(() => {
        router.refresh();
      });
    } finally {
      toast.dismiss(loadingToastId);
    }
  }

  return (
    <form className="grid gap-4" onSubmit={submitProfile}>
      <div className="grid gap-2">
        <label
          className="text-sm font-medium text-foreground"
          htmlFor="settings-name"
        >
          Display name
        </label>
        <Input
          id="settings-name"
          className="h-11 rounded-2xl px-4"
          value={name}
          onChange={(event) => setName(event.target.value)}
          autoComplete="name"
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-[1.3rem] border border-(--stroke-soft) bg-white/70 px-4 py-3">
          <p className="text-xs uppercase tracking-[0.24em] text-(--text-secondary)">
            Email
          </p>
          <p className="mt-2 text-sm font-medium text-foreground">{email}</p>
        </div>
        <div className="rounded-[1.3rem] border border-(--stroke-soft) bg-white/70 px-4 py-3">
          <p className="text-xs uppercase tracking-[0.24em] text-(--text-secondary)">
            Role
          </p>
          <p className="mt-2 text-sm font-medium capitalize text-foreground">
            {role}
          </p>
        </div>
      </div>

      <div className="flex justify-end">
        <Button
          className="w-full rounded-full sm:w-auto"
          disabled={isPending}
          type="submit"
        >
          {isPending ? "Refreshing..." : "Save profile"}
        </Button>
      </div>
    </form>
  );
}
